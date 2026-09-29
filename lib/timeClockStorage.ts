export interface TimeClockSetup {
  businessName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  wifiPingUrl: string;
  configuredAt: string;
}

export interface EmployeeAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface PunchRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  type: "in" | "out";
  timestamp: string;
}

export interface RejectedPunchRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  timestamp: string;
  gpsPassed: boolean;
  wifiPassed: boolean;
  failureType: "gps" | "wifi" | "both" | "cooldown";
  reason: string;
}

export interface TimeClockStore {
  setup: TimeClockSetup | null;
  managerPasswordHash: string | null;
  employees: EmployeeAccount[];
  punches: PunchRecord[];
  rejectedPunches: RejectedPunchRecord[];
}

const STORAGE_KEY = "autospa.timeclock.v1";
const MANAGER_SESSION_KEY = "autospa.timeclock.manager";

const EMPTY_STORE: TimeClockStore = {
  setup: null,
  managerPasswordHash: null,
  employees: [],
  punches: [],
  rejectedPunches: [],
};

/**
 * Reads the full time clock store from localStorage and falls back to defaults when data is missing.
 */
export function getTimeClockStore(): TimeClockStore {
  if (typeof window === "undefined") return EMPTY_STORE;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return EMPTY_STORE;

  try {
    const parsed = JSON.parse(raw) as Partial<TimeClockStore> & {
      managerPassword?: string | null;
      employees?: Array<EmployeeAccount & { password?: string }>;
    };
    return {
      setup: parsed.setup ?? null,
      managerPasswordHash: parsed.managerPasswordHash ?? null,
      employees: Array.isArray(parsed.employees)
        ? parsed.employees.map((employee) => ({
            id: employee.id,
            name: employee.name,
            email: employee.email,
            passwordHash: employee.passwordHash ?? "",
            createdAt: employee.createdAt,
          }))
        : [],
      punches: Array.isArray(parsed.punches) ? parsed.punches : [],
      rejectedPunches: Array.isArray(parsed.rejectedPunches) ? parsed.rejectedPunches : [],
    };
  } catch {
    return EMPTY_STORE;
  }
}

/**
 * Persists the full time clock store in localStorage.
 */
export function saveTimeClockStore(store: TimeClockStore): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/**
 * Writes first-launch setup values and manager password.
 */
export async function configureTimeClock(
  setup: Omit<TimeClockSetup, "configuredAt">,
  managerPassword: string,
): Promise<TimeClockStore> {
  const managerPasswordHash = await hashSecret(managerPassword);
  const nextStore: TimeClockStore = {
    ...getTimeClockStore(),
    setup: { ...setup, configuredAt: nowIsoSecond() },
    managerPasswordHash,
  };
  saveTimeClockStore(nextStore);
  return nextStore;
}

/**
 * Adds a new employee account with normalized email and unique ID.
 */
export async function addEmployeeAccount(input: { name: string; email: string; password: string }): Promise<TimeClockStore> {
  const store = getTimeClockStore();
  const passwordHash = await hashSecret(input.password);
  const employee: EmployeeAccount = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    passwordHash,
    createdAt: nowIsoSecond(),
  };
  const nextStore = { ...store, employees: [...store.employees, employee] };
  saveTimeClockStore(nextStore);
  return nextStore;
}

/**
 * Removes an employee account and keeps historic punches/logs for audit history.
 */
export function removeEmployeeAccount(employeeId: string): TimeClockStore {
  const store = getTimeClockStore();
  const nextStore = {
    ...store,
    employees: store.employees.filter((employee) => employee.id !== employeeId),
  };
  saveTimeClockStore(nextStore);
  return nextStore;
}

/**
 * Finds an employee by email/password for employee login.
 */
export async function findEmployeeByCredentials(email: string, password: string): Promise<EmployeeAccount | null> {
  const store = getTimeClockStore();
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashSecret(password);
  return store.employees.find((employee) => employee.email === normalizedEmail && employee.passwordHash === passwordHash) ?? null;
}

/**
 * Records a confirmed IN/OUT punch with timestamp to the exact second.
 */
export function addPunch(employee: EmployeeAccount, type: "in" | "out"): TimeClockStore {
  const store = getTimeClockStore();
  const punch: PunchRecord = {
    id: crypto.randomUUID(),
    employeeId: employee.id,
    employeeName: employee.name,
    type,
    timestamp: nowIsoSecond(),
  };
  const nextStore = { ...store, punches: [...store.punches, punch] };
  saveTimeClockStore(nextStore);
  return nextStore;
}

/**
 * Stores rejected punch attempts with exact failure details for manager audit logs.
 */
export function addRejectedPunch(
  employee: EmployeeAccount,
  failureType: RejectedPunchRecord["failureType"],
  reason: string,
  gpsPassed: boolean,
  wifiPassed: boolean,
): TimeClockStore {
  const store = getTimeClockStore();
  const rejectedRecord: RejectedPunchRecord = {
    id: crypto.randomUUID(),
    employeeId: employee.id,
    employeeName: employee.name,
    timestamp: nowIsoSecond(),
    failureType,
    reason,
    gpsPassed,
    wifiPassed,
  };
  const nextStore = { ...store, rejectedPunches: [...store.rejectedPunches, rejectedRecord] };
  saveTimeClockStore(nextStore);
  return nextStore;
}

/**
 * Returns the newest punch for the selected employee.
 */
export function getLastEmployeePunch(employeeId: string, store: TimeClockStore): PunchRecord | null {
  const filtered = store.punches.filter((punch) => punch.employeeId === employeeId);
  if (filtered.length === 0) return null;
  return filtered.reduce((latest, current) => (current.timestamp > latest.timestamp ? current : latest));
}

/**
 * Determines the next automatic punch type by alternating from punch history.
 */
export function getNextPunchType(employeeId: string, store: TimeClockStore): "in" | "out" {
  const lastPunch = getLastEmployeePunch(employeeId, store);
  if (!lastPunch) return "in";
  return lastPunch.type === "in" ? "out" : "in";
}

/**
 * Validates manager password at login and password-change operations.
 */
export async function isManagerPasswordValid(password: string): Promise<boolean> {
  const store = getTimeClockStore();
  if (!store.managerPasswordHash) return false;
  const passwordHash = await hashSecret(password);
  return store.managerPasswordHash === passwordHash;
}

/**
 * Updates manager password after verifying the current password.
 */
export async function changeManagerPassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; store: TimeClockStore }> {
  const store = getTimeClockStore();
  if (!store.managerPasswordHash) {
    return { success: false, store };
  }
  const currentHash = await hashSecret(currentPassword);
  if (store.managerPasswordHash !== currentHash) {
    return { success: false, store };
  }
  const nextStore = { ...store, managerPasswordHash: await hashSecret(newPassword) };
  saveTimeClockStore(nextStore);
  return { success: true, store: nextStore };
}

/**
 * Starts a manager session in localStorage.
 */
export function setManagerSession(active: boolean): void {
  if (typeof window === "undefined") return;
  if (active) window.localStorage.setItem(MANAGER_SESSION_KEY, "1");
  else window.localStorage.removeItem(MANAGER_SESSION_KEY);
}

/**
 * Reads manager session status from localStorage.
 */
export function getManagerSession(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MANAGER_SESSION_KEY) === "1";
}

/**
 * Returns an ISO timestamp truncated to seconds for exact second-level storage.
 */
export function nowIsoSecond(): string {
  return new Date().toISOString().split(".")[0] + "Z";
}

/**
 * Hashes secrets before storage so passwords are never saved in plaintext.
 */
async function hashSecret(value: string): Promise<string> {
  const payload = new TextEncoder().encode(`autospa.timeclock::${value}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

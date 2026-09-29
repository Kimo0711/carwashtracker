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
  password: string;
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
  managerPassword: string | null;
  employees: EmployeeAccount[];
  punches: PunchRecord[];
  rejectedPunches: RejectedPunchRecord[];
}

const STORAGE_KEY = "autospa.timeclock.v1";
const MANAGER_SESSION_KEY = "autospa.timeclock.manager";
const EMPLOYEE_SESSION_KEY = "autospa.timeclock.employee";

const EMPTY_STORE: TimeClockStore = {
  setup: null,
  managerPassword: null,
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
    const parsed = JSON.parse(raw) as Partial<TimeClockStore>;
    return {
      setup: parsed.setup ?? null,
      managerPassword: parsed.managerPassword ?? null,
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
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
export function configureTimeClock(setup: Omit<TimeClockSetup, "configuredAt">, managerPassword: string): TimeClockStore {
  const nextStore: TimeClockStore = {
    ...getTimeClockStore(),
    setup: { ...setup, configuredAt: nowIsoSecond() },
    managerPassword,
  };
  saveTimeClockStore(nextStore);
  return nextStore;
}

/**
 * Adds a new employee account with normalized email and unique ID.
 */
export function addEmployeeAccount(input: { name: string; email: string; password: string }): TimeClockStore {
  const store = getTimeClockStore();
  const employee: EmployeeAccount = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
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
export function findEmployeeByCredentials(email: string, password: string): EmployeeAccount | null {
  const store = getTimeClockStore();
  const normalizedEmail = email.trim().toLowerCase();
  return store.employees.find((employee) => employee.email === normalizedEmail && employee.password === password) ?? null;
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
export function isManagerPasswordValid(password: string): boolean {
  const store = getTimeClockStore();
  return !!store.managerPassword && store.managerPassword === password;
}

/**
 * Updates manager password after verifying the current password.
 */
export function changeManagerPassword(currentPassword: string, newPassword: string): { success: boolean; store: TimeClockStore } {
  const store = getTimeClockStore();
  if (!store.managerPassword || store.managerPassword !== currentPassword) {
    return { success: false, store };
  }
  const nextStore = { ...store, managerPassword: newPassword };
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
 * Stores the currently authenticated employee ID.
 */
export function setEmployeeSession(employeeId: string | null): void {
  if (typeof window === "undefined") return;
  if (employeeId) window.localStorage.setItem(EMPLOYEE_SESSION_KEY, employeeId);
  else window.localStorage.removeItem(EMPLOYEE_SESSION_KEY);
}

/**
 * Reads the currently authenticated employee ID.
 */
export function getEmployeeSession(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(EMPLOYEE_SESSION_KEY);
}

/**
 * Returns an ISO timestamp truncated to seconds for exact second-level storage.
 */
export function nowIsoSecond(): string {
  return new Date().toISOString().split(".")[0] + "Z";
}

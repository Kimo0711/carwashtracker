"use client";

import { useMemo, useState } from "react";
import {
  TimeClockStore,
  addEmployeeAccount,
  changeManagerPassword,
  configureTimeClock,
  getManagerSession,
  isManagerPasswordValid,
  getTimeClockStore,
  removeEmployeeAccount,
  setManagerSession,
} from "../../../lib/timeClockStorage";

/**
 * Formats timestamps for manager views with second-level precision.
 */
function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("fr-CA", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Computes live IN/OUT status and last status timestamp for each employee.
 */
function buildStatus(store: TimeClockStore): Record<string, { state: "IN" | "OUT"; since: string | null }> {
  return store.employees.reduce<Record<string, { state: "IN" | "OUT"; since: string | null }>>((acc, employee) => {
    const employeePunches = store.punches
      .filter((punch) => punch.employeeId === employee.id)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const latest = employeePunches.at(-1);
    acc[employee.id] = {
      state: latest?.type === "in" ? "IN" : "OUT",
      since: latest?.timestamp ?? null,
    };
    return acc;
  }, {});
}

/**
 * Builds payroll CSV text from punch history.
 */
function buildTimesheetCsv(store: TimeClockStore): string {
  const rows = [
    ["Employee Name", "Employee Email", "Type", "Timestamp"],
    ...store.punches
      .slice()
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((punch) => {
        const employee = store.employees.find((item) => item.id === punch.employeeId);
        return [punch.employeeName, employee?.email ?? "", punch.type.toUpperCase(), punch.timestamp];
      }),
  ];
  return rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
}

export default function TimeClockManagerPage() {
  const [store, setStore] = useState<TimeClockStore>(getTimeClockStore());
  const [managerPasswordInput, setManagerPasswordInput] = useState("");
  const [managerSession, setManagerSessionState] = useState(getManagerSession());
  const [feedback, setFeedback] = useState("");

  const [setupForm, setSetupForm] = useState({
    businessName: "AutoSpa L'Exception",
    latitude: "45.4981",
    longitude: "-73.8719",
    radiusMeters: "100",
    wifiPingUrl: "http://192.168.1.1/ping.txt",
    managerPassword: "",
  });

  const [employeeForm, setEmployeeForm] = useState({ name: "", email: "", password: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [filters, setFilters] = useState({ employee: "", startDate: "", endDate: "" });

  const statusByEmployee = useMemo(() => buildStatus(store), [store]);

  /**
   * Handles first-launch manager setup for GPS/WiFi and credentials.
   */
  const handleInitialSetup = async () => {
    if (!setupForm.managerPassword.trim()) {
      setFeedback("Mot de passe gestionnaire requis (Manager password is required)");
      return;
    }

    const updated = await configureTimeClock(
      {
        businessName: setupForm.businessName.trim(),
        latitude: Number(setupForm.latitude),
        longitude: Number(setupForm.longitude),
        radiusMeters: Number(setupForm.radiusMeters),
        wifiPingUrl: setupForm.wifiPingUrl.trim(),
      },
      setupForm.managerPassword,
    );
    setStore(updated);
    setManagerSession(true);
    setManagerSessionState(true);
    setFeedback("Configuration enregistrée (Setup saved)");
  };

  /**
   * Authenticates manager access for protected dashboard views.
   */
  const handleManagerLogin = async () => {
    if (await isManagerPasswordValid(managerPasswordInput)) {
      setManagerSession(true);
      setManagerSessionState(true);
      setManagerPasswordInput("");
      setFeedback("Connecté (Connected)");
      return;
    }
    setFeedback("Mot de passe invalide (Invalid password)");
  };

  /**
   * Adds a new employee account in localStorage.
   */
  const handleAddEmployee = async () => {
    const name = employeeForm.name.trim();
    const email = employeeForm.email.trim().toLowerCase();
    const password = employeeForm.password;
    if (!name || !email || !password) {
      setFeedback("Tous les champs employés sont requis (All employee fields are required)");
      return;
    }
    if (store.employees.some((employee) => employee.email === email)) {
      setFeedback("Courriel déjà utilisé (Email already exists)");
      return;
    }
    const next = await addEmployeeAccount({ name, email, password });
    setStore(next);
    setEmployeeForm({ name: "", email: "", password: "" });
    setFeedback("Employé ajouté (Employee added)");
  };

  /**
   * Updates manager password from the protected dashboard.
   */
  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setFeedback("Entrez les deux mots de passe (Enter both passwords)");
      return;
    }
    const result = await changeManagerPassword(passwordForm.currentPassword, passwordForm.newPassword);
    if (!result.success) {
      setFeedback("Mot de passe actuel invalide (Current password is invalid)");
      return;
    }
    setStore(result.store);
    setPasswordForm({ currentPassword: "", newPassword: "" });
    setFeedback("Mot de passe modifié (Password changed)");
  };

  /**
   * Generates and downloads payroll CSV directly in the browser.
   */
  const exportCsv = () => {
    const csv = buildTimesheetCsv(store);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `autospa-timesheet-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const filteredPunches = store.punches
    .filter((punch) => {
      const employeeMatches = !filters.employee || punch.employeeName.toLowerCase().includes(filters.employee.toLowerCase());
      const stamp = new Date(punch.timestamp);
      const startMatches = !filters.startDate || stamp >= new Date(`${filters.startDate}T00:00:00`);
      const endMatches = !filters.endDate || stamp <= new Date(`${filters.endDate}T23:59:59`);
      return employeeMatches && startMatches && endMatches;
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (!store.setup || !store.managerPasswordHash) {
    return (
      <main className="min-h-screen p-4 md:p-8" style={{ background: "#0f172a", color: "#e2e8f0" }}>
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 space-y-4">
          <h1 className="text-3xl font-bold">Configuration initiale (First Launch Setup)</h1>
          <p className="text-sm text-slate-300">AutoSpa L&apos;Exception — Pointage (Time Clock)</p>

          <label className="block text-sm">Nom entreprise (Business name)
            <input className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2" value={setupForm.businessName} onChange={(e) => setSetupForm({ ...setupForm, businessName: e.target.value })} />
          </label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block text-sm">Latitude GPS
              <input className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2" value={setupForm.latitude} onChange={(e) => setSetupForm({ ...setupForm, latitude: e.target.value })} />
            </label>
            <label className="block text-sm">Longitude GPS
              <input className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2" value={setupForm.longitude} onChange={(e) => setSetupForm({ ...setupForm, longitude: e.target.value })} />
            </label>
          </div>
          <label className="block text-sm">Rayon (Geofence radius meters)
            <input className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2" value={setupForm.radiusMeters} onChange={(e) => setSetupForm({ ...setupForm, radiusMeters: e.target.value })} />
          </label>
          <label className="block text-sm">URL ping WiFi local
            <input className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2" value={setupForm.wifiPingUrl} onChange={(e) => setSetupForm({ ...setupForm, wifiPingUrl: e.target.value })} />
          </label>
          <label className="block text-sm">Mot de passe gestionnaire (Manager password)
            <input type="password" className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2" value={setupForm.managerPassword} onChange={(e) => setSetupForm({ ...setupForm, managerPassword: e.target.value })} />
          </label>
          <button onClick={handleInitialSetup} className="w-full rounded-2xl bg-sky-500 px-4 py-3 text-lg font-bold text-slate-950">
            Enregistrer (Save setup)
          </button>
          {feedback && <p className="text-sm text-sky-200">{feedback}</p>}
        </div>
      </main>
    );
  }

  if (!managerSession) {
    return (
      <main className="min-h-screen p-4 md:p-8" style={{ background: "#0f172a", color: "#e2e8f0" }}>
        <div className="mx-auto max-w-lg rounded-3xl border border-slate-700 bg-slate-900/80 p-6 space-y-4">
          <h1 className="text-3xl font-bold">Gestionnaire (Manager)</h1>
          <p className="text-sm text-slate-300">Connexion protégée (Protected login)</p>
          <label className="block text-sm">Mot de passe (Password)
            <input type="password" className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-3 text-lg" value={managerPasswordInput} onChange={(e) => setManagerPasswordInput(e.target.value)} />
          </label>
          <button onClick={handleManagerLogin} className="w-full rounded-2xl bg-sky-500 px-4 py-3 text-lg font-bold text-slate-950">
            Connexion (Login)
          </button>
          {feedback && <p className="text-sm text-red-200">{feedback}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8" style={{ background: "#0f172a", color: "#e2e8f0" }}>
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">{store.setup.businessName}</h1>
              <p className="text-sm text-slate-300">Tableau gestionnaire (Manager Dashboard)</p>
            </div>
            <button
              onClick={() => {
                setManagerSession(false);
                setManagerSessionState(false);
              }}
              className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 font-semibold"
            >
              Déconnexion (Logout)
            </button>
          </div>
          {feedback && <p className="mt-2 text-sm text-sky-200">{feedback}</p>}
        </header>

        <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
          <h2 className="text-xl font-semibold">Vue en direct (Live status)</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {store.employees.map((employee) => {
              const employeeStatus = statusByEmployee[employee.id];
              return (
                <div key={employee.id} className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
                  <p className="text-lg font-semibold">{employee.name}</p>
                  <p className="text-sm text-slate-300">{employee.email}</p>
                  <p className={`mt-2 font-bold ${employeeStatus?.state === "IN" ? "text-emerald-300" : "text-rose-300"}`}>
                    {employeeStatus?.state === "IN" ? "ENTRÉE (IN)" : "SORTIE (OUT)"}
                  </p>
                  <p className="text-sm text-slate-300">
                    Depuis (Since): {employeeStatus?.since ? formatDateTime(employeeStatus.since) : "—"}
                  </p>
                  <button
                    onClick={() => setStore(removeEmployeeAccount(employee.id))}
                    className="mt-3 rounded-xl border border-red-500/40 bg-red-600/20 px-3 py-2 text-sm font-semibold text-red-100"
                  >
                    Retirer employé (Remove employee)
                  </button>
                </div>
              );
            })}
            {store.employees.length === 0 && <p className="text-slate-300">Aucun employé (No employees yet)</p>}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
          <h2 className="text-xl font-semibold">Ajouter employé (Add employee)</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input placeholder="Nom (Name)" className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2" value={employeeForm.name} onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })} />
            <input placeholder="Courriel (Email)" className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2" value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} />
            <input placeholder="Mot de passe (Password)" type="password" className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2" value={employeeForm.password} onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })} />
          </div>
          <button onClick={handleAddEmployee} className="mt-3 rounded-2xl bg-sky-500 px-4 py-2 font-bold text-slate-950">
            Créer compte employé (Create employee account)
          </button>
        </section>

        <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Historique pointages (Punch history)</h2>
            <button onClick={exportCsv} className="rounded-2xl bg-emerald-500 px-4 py-2 font-bold text-slate-950">
              Export CSV
            </button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input placeholder="Filtre employé (Employee)" className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2" value={filters.employee} onChange={(e) => setFilters({ ...filters, employee: e.target.value })} />
            <input type="date" className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
            <input type="date" className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
          </div>
          <div className="mt-3 max-h-80 overflow-auto rounded-2xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-left">
                <tr>
                  <th className="px-3 py-2">Employé</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Heure</th>
                </tr>
              </thead>
              <tbody>
                {filteredPunches.map((punch) => (
                  <tr key={punch.id} className="border-t border-slate-700">
                    <td className="px-3 py-2">{punch.employeeName}</td>
                    <td className="px-3 py-2">{punch.type.toUpperCase()}</td>
                    <td className="px-3 py-2">{formatDateTime(punch.timestamp)}</td>
                  </tr>
                ))}
                {filteredPunches.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-slate-300">Aucun résultat (No results)</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
          <h2 className="text-xl font-semibold">Journal des rejets (Rejected punch log)</h2>
          <div className="mt-3 max-h-72 overflow-auto rounded-2xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-left">
                <tr>
                  <th className="px-3 py-2">Employé</th>
                  <th className="px-3 py-2">Heure</th>
                  <th className="px-3 py-2">Échec</th>
                  <th className="px-3 py-2">Détails</th>
                </tr>
              </thead>
              <tbody>
                {store.rejectedPunches
                  .slice()
                  .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                  .map((rejected) => (
                    <tr key={rejected.id} className="border-t border-slate-700">
                      <td className="px-3 py-2">{rejected.employeeName}</td>
                      <td className="px-3 py-2">{formatDateTime(rejected.timestamp)}</td>
                      <td className="px-3 py-2 uppercase">{rejected.failureType}</td>
                      <td className="px-3 py-2">
                        {rejected.reason}
                        <div className="text-xs text-slate-400">
                          GPS: {rejected.gpsPassed ? "OK" : "FAIL"} | WiFi: {rejected.wifiPassed ? "OK" : "FAIL"}
                        </div>
                      </td>
                    </tr>
                  ))}
                {store.rejectedPunches.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-slate-300">Aucun rejet (No rejected attempts)</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-5">
          <h2 className="text-xl font-semibold">Changer mot de passe gestionnaire (Change manager password)</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input type="password" placeholder="Mot de passe actuel (Current)" className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
            <input type="password" placeholder="Nouveau mot de passe (New)" className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
          </div>
          <button onClick={handleChangePassword} className="mt-3 rounded-2xl bg-sky-500 px-4 py-2 font-bold text-slate-950">
            Mettre à jour (Update password)
          </button>
        </section>
      </div>
    </main>
  );
}

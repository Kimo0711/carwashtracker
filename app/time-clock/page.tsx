"use client";

import { useEffect, useMemo, useState } from "react";
import { distanceMeters } from "@/lib/checkin";
import {
  EmployeeAccount,
  addPunch,
  addRejectedPunch,
  findEmployeeByCredentials,
  getEmployeeSession,
  getLastEmployeePunch,
  getNextPunchType,
  getTimeClockStore,
  setEmployeeSession,
} from "@/lib/timeClockStorage";

type PunchState = "idle" | "checking" | "done" | "error";

interface GpsCheckResult {
  passed: boolean;
  message: string;
}

interface WifiCheckResult {
  passed: boolean;
  message: string;
}

/**
 * Formats a timestamp for clear to-the-second confirmations on mobile.
 */
function formatClockTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("fr-CA", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Runs the GPS geofence check and returns the exact failure message required by policy.
 */
async function runGpsCheck(latitude: number, longitude: number, radiusMeters: number): Promise<GpsCheckResult> {
  if (!navigator.geolocation) {
    return { passed: false, message: "Please enable location access" };
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });

    const distance = distanceMeters(position.coords.latitude, position.coords.longitude, latitude, longitude);
    if (distance > radiusMeters) {
      return { passed: false, message: "You are not on-site" };
    }
    return { passed: true, message: "" };
  } catch {
    return { passed: false, message: "Please enable location access" };
  }
}

/**
 * Runs the local WiFi ping check using fetch + AbortController and a strict 3-second timeout.
 */
async function runWifiCheck(pingUrl: string): Promise<WifiCheckResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(pingUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      return { passed: false, message: "You must be connected to the shop WiFi" };
    }
    const text = (await response.text()).trim().toLowerCase();
    if (text !== "ok") {
      return { passed: false, message: "You must be connected to the shop WiFi" };
    }
    return { passed: true, message: "" };
  } catch {
    return { passed: false, message: "You must be connected to the shop WiFi" };
  } finally {
    window.clearTimeout(timeout);
  }
}

export default function TimeClockPage() {
  const [employee, setEmployee] = useState<EmployeeAccount | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [punchState, setPunchState] = useState<PunchState>("idle");
  const [message, setMessage] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [setupReady, setSetupReady] = useState(false);

  const store = useMemo(() => getTimeClockStore(), [employee, punchState, attempted]);
  const setup = store.setup;

  /**
   * Restores employee session from localStorage when available.
   */
  useEffect(() => {
    const employeeId = getEmployeeSession();
    if (!employeeId) return;
    const cachedEmployee = getTimeClockStore().employees.find((item) => item.id === employeeId) ?? null;
    setEmployee(cachedEmployee);
  }, []);

  /**
   * Enables punch operations only after manager setup is fully configured.
   */
  useEffect(() => {
    const currentStore = getTimeClockStore();
    setSetupReady(!!currentStore.setup && !!currentStore.managerPassword);
  }, [punchState, employee]);

  /**
   * Automatically runs punch validation as soon as an employee is logged in.
   */
  useEffect(() => {
    if (!employee || !setup || attempted || !setupReady) return;

    const handleAutomaticPunch = async () => {
      setPunchState("checking");
      setMessage("");

      const latestStore = getTimeClockStore();
      const lastPunch = getLastEmployeePunch(employee.id, latestStore);
      if (lastPunch) {
        const elapsedSeconds = Math.floor((Date.now() - new Date(lastPunch.timestamp).getTime()) / 1000);
        if (elapsedSeconds < 60) {
          const updatedStore = addRejectedPunch(
            employee,
            "cooldown",
            `Attendez 60 secondes entre pointages (Please wait 60 seconds between punches)`,
            true,
            true,
          );
          setAttempted(true);
          setPunchState("error");
          setMessage("Attendez 60 secondes entre pointages (Please wait 60 seconds between punches)");
          return updatedStore;
        }
      }

      const gpsPromise = runGpsCheck(setup.latitude, setup.longitude, setup.radiusMeters);
      const wifiPromise = runWifiCheck(setup.wifiPingUrl);
      const [gpsResult, wifiResult] = await Promise.all([gpsPromise, wifiPromise]);

      if (!gpsResult.passed || !wifiResult.passed) {
        const failureType = !gpsResult.passed && !wifiResult.passed ? "both" : gpsResult.passed ? "wifi" : "gps";
        const reason = !gpsResult.passed && !wifiResult.passed
          ? "You are not on-site + You must be connected to the shop WiFi"
          : gpsResult.passed
            ? wifiResult.message
            : gpsResult.message;

        addRejectedPunch(employee, failureType, reason, gpsResult.passed, wifiResult.passed);
        setAttempted(true);
        setPunchState("error");
        setMessage(
          !gpsResult.passed && !wifiResult.passed
            ? "Échec GPS + WiFi (GPS + WiFi failed)"
            : gpsResult.passed
              ? "Vous devez être connecté au WiFi du commerce (You must be connected to the shop WiFi)"
              : gpsResult.message === "Please enable location access"
                ? "Veuillez activer l’accès à la localisation (Please enable location access)"
                : "Vous n’êtes pas sur place (You are not on-site)",
        );
        return;
      }

      const currentStore = getTimeClockStore();
      const nextType = getNextPunchType(employee.id, currentStore);
      const nextStore = addPunch(employee, nextType);
      const latestPunch = getLastEmployeePunch(employee.id, nextStore);

      setAttempted(true);
      setPunchState("done");
      setMessage(
        nextType === "in"
          ? `Pointé ENTRÉE (Clocked IN) à ${formatClockTime(latestPunch?.timestamp ?? new Date().toISOString())}`
          : `Pointé SORTIE (Clocked OUT) à ${formatClockTime(latestPunch?.timestamp ?? new Date().toISOString())}`,
      );
    };

    handleAutomaticPunch();
  }, [attempted, employee, setup, setupReady]);

  /**
   * Authenticates employee credentials and starts a punch attempt with zero extra input.
   */
  const handleLogin = () => {
    const found = findEmployeeByCredentials(email, password);
    if (!found) {
      setPunchState("error");
      setMessage("Identifiants invalides (Invalid email or password)");
      return;
    }
    setEmployee(found);
    setEmployeeSession(found.id);
    setAttempted(false);
    setPunchState("idle");
    setMessage("");
  };

  /**
   * Signs out the employee on this browser.
   */
  const handleLogout = () => {
    setEmployeeSession(null);
    setEmployee(null);
    setEmail("");
    setPassword("");
    setMessage("");
    setPunchState("idle");
    setAttempted(false);
  };

  return (
    <main className="min-h-screen p-4 md:p-8" style={{ background: "#0f172a", color: "#e2e8f0" }}>
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 md:p-8">
        <h1 className="text-3xl font-bold">
          AutoSpa L&apos;Exception
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Pointage (Time Clock)
        </p>

        {!setupReady && (
          <div className="mt-6 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-amber-100">
            Configuration gestionnaire requise (Manager setup required)
          </div>
        )}

        {setupReady && !employee && (
          <section className="mt-6 space-y-4">
            <h2 className="text-xl font-semibold">Connexion employé (Employee Login)</h2>
            <label className="block text-sm">
              Courriel (Email)
              <input
                className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-3 text-lg"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
              />
            </label>
            <label className="block text-sm">
              Mot de passe (Password)
              <input
                className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-3 text-lg"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
              />
            </label>
            <button
              onClick={handleLogin}
              className="w-full rounded-2xl bg-sky-500 px-4 py-4 text-xl font-bold text-slate-950"
            >
              Connexion et pointage auto (Login and auto-punch)
            </button>
          </section>
        )}

        {employee && (
          <section className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
              <p className="text-sm text-slate-300">Connecté (Connected)</p>
              <p className="mt-1 text-2xl font-bold">{employee.name}</p>
              <p className="text-sm text-slate-400">{employee.email}</p>
            </div>

            {punchState === "checking" && (
              <div className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4">
                Vérification GPS + WiFi... (Checking GPS + WiFi...)
              </div>
            )}

            {(punchState === "done" || punchState === "error") && (
              <div
                className={`rounded-2xl border p-4 text-lg ${
                  punchState === "done"
                    ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-100"
                    : "border-red-400/50 bg-red-500/10 text-red-100"
                }`}
              >
                {message}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setAttempted(false);
                  setPunchState("idle");
                  setMessage("");
                }}
                className="flex-1 rounded-2xl border border-slate-600 bg-slate-800 px-4 py-3 font-semibold"
              >
                Réessayer (Retry)
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 font-semibold"
              >
                Déconnexion (Logout)
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

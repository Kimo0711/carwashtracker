'use client';

import { useEffect, useState, useCallback } from 'react';

interface Employee {
  id: number;
  username: string | null;
  telegramId: string | null;
}

function formatDuration(checkIn: string): string {
  const ms = Date.now() - new Date(checkIn).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function ClockPage() {
  const [phase, setPhase] = useState<'loading' | 'setup' | 'confirm-setup' | 'ready' | 'confirming' | 'done' | 'error'>('loading');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [username, setUsername] = useState('');
  const [clockedIn, setClockedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [resultMsg, setResultMsg] = useState('');
  const [resultAction, setResultAction] = useState<'in' | 'out' | null>(null);
  const [pendingEmployee, setPendingEmployee] = useState<Employee | null>(null);

  const loadStatus = useCallback(async (uid: number) => {
    try {
      const res = await fetch(`/api/clock?userId=${uid}`);
      const data = await res.json();
      setClockedIn(data.clockedIn);
      setCheckInTime(data.checkIn ?? null);
      setPhase('ready');
    } catch {
      setErrorMsg('Failed to load your status. Try again.');
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    const storedId = localStorage.getItem('cw_uid');
    const storedName = localStorage.getItem('cw_name');

    if (storedId && storedName) {
      setUserId(parseInt(storedId));
      setUsername(storedName);
      loadStatus(parseInt(storedId));
    } else {
      fetch('/api/users')
        .then((r) => r.json())
        .then((data: Employee[]) => {
          setEmployees(data.filter((e) => e.username));
          setPhase('setup');
        })
        .catch(() => {
          setErrorMsg('Failed to load employees. Try again.');
          setPhase('error');
        });
    }
  }, [loadStatus]);

  // Elapsed timer when clocked in
  useEffect(() => {
    if (!clockedIn || !checkInTime) return;
    const update = () => setElapsed(formatDuration(checkInTime));
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [clockedIn, checkInTime]);

  function selectEmployee(emp: Employee) {
    setPendingEmployee(emp);
    setUsername(emp.username ?? '');
    setPhase('confirm-setup');
  }

  function confirmSetup() {
    if (!pendingEmployee) return;
    localStorage.setItem('cw_uid', pendingEmployee.id.toString());
    localStorage.setItem('cw_name', pendingEmployee.username ?? '');
    setUserId(pendingEmployee.id);
    loadStatus(pendingEmployee.id);
  }

  async function handleClock() {
    setPhase('confirming');

    let lat: number | undefined;
    let lng: number | undefined;

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      // If location denied and shop coords are set, server will reject
    }

    try {
      const res = await fetch('/api/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, lat, lng }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong.');
        setPhase('error');
        return;
      }

      setResultAction(data.action);
      if (data.action === 'in') {
        setResultMsg(`Clocked in at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`);
      } else {
        const hours = data.entry?.totalHours?.toFixed(2) ?? '—';
        setResultMsg(`Clocked out — ${hours}h logged`);
      }
      setPhase('done');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setPhase('error');
    }
  }

  function resetDevice() {
    localStorage.removeItem('cw_uid');
    localStorage.removeItem('cw_name');
    window.location.reload();
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
        <div className="w-12 h-12 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-6" style={{ background: '#0f172a', color: '#f1f5f9' }}>
        <div className="text-5xl">❌</div>
        <h2 className="text-xl font-bold text-center">Oops</h2>
        <p className="text-center" style={{ color: '#94a3b8' }}>{errorMsg}</p>
        <button
          onClick={() => { setErrorMsg(''); setPhase('loading'); window.location.reload(); }}
          className="py-3 px-8 rounded-2xl font-semibold"
          style={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }}
        >
          Try again
        </button>
      </div>
    );
  }

  // ── First-time setup: pick your name ──────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0f172a', color: '#f1f5f9' }}>
        <div className="p-6 pb-2">
          <h1 className="text-2xl font-bold">AutoSpa <span style={{ color: '#38bdf8' }}>L&apos;Exception</span></h1>
          <p className="mt-1 text-sm" style={{ color: '#94a3b8' }}>Select your name to set up this device</p>
        </div>
        <div
          className="mx-6 mt-3 rounded-2xl p-4"
          style={{ background: '#1e293b', border: '1px solid #92400e' }}
        >
          <p className="text-sm" style={{ color: '#fbbf24' }}>
            ⚠️ Select YOUR name only. This device will always clock in as whoever you pick.
          </p>
        </div>
        <div className="flex flex-col gap-3 p-6">
          {employees.map((emp) => (
            <button
              key={emp.id}
              onClick={() => selectEmployee(emp)}
              className="w-full py-4 px-5 rounded-2xl text-left font-semibold text-lg transition-all active:scale-95"
              style={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }}
            >
              {emp.username}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Confirm identity ───────────────────────────────────────────────────────
  if (phase === 'confirm-setup') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-6" style={{ background: '#0f172a', color: '#f1f5f9' }}>
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold"
          style={{ background: '#0ea5e9', color: '#fff' }}
        >
          {username.charAt(0).toUpperCase()}
        </div>
        <p className="text-2xl font-bold text-center">{username}</p>
        <p className="text-sm text-center" style={{ color: '#94a3b8' }}>
          This device will always clock in as <strong>{username}</strong>.
        </p>
        <button
          onClick={confirmSetup}
          className="w-full py-4 rounded-2xl font-bold text-xl transition-all active:scale-95"
          style={{ background: '#0ea5e9', color: '#fff' }}
        >
          Yes, that&apos;s me
        </button>
        <button onClick={() => setPhase('setup')} className="text-sm" style={{ color: '#64748b' }}>
          Go back
        </button>
      </div>
    );
  }

  // ── Confirming / verifying location ───────────────────────────────────────
  if (phase === 'confirming') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-4" style={{ background: '#0f172a', color: '#f1f5f9' }}>
        <div className="w-12 h-12 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <p style={{ color: '#94a3b8' }}>Verifying location…</p>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const isIn = resultAction === 'in';
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-6" style={{ background: '#0f172a', color: '#f1f5f9' }}>
        <div
          className="w-28 h-28 rounded-full flex items-center justify-center text-5xl"
          style={{
            background: isIn ? '#022c22' : '#1c1917',
            border: `3px solid ${isIn ? '#22c55e' : '#f87171'}`,
          }}
        >
          {isIn ? '✅' : '👋'}
        </div>
        <h2 className="text-3xl font-bold">{username}</h2>
        <div
          className="px-5 py-2 rounded-full font-semibold text-sm"
          style={{
            background: isIn ? '#14532d' : '#450a0a',
            color: isIn ? '#86efac' : '#fca5a5',
          }}
        >
          {isIn ? 'CLOCKED IN' : 'CLOCKED OUT'}
        </div>
        <p style={{ color: '#94a3b8' }}>{resultMsg}</p>
        <p className="text-sm" style={{ color: '#334155' }}>You can close this tab.</p>
      </div>
    );
  }

  // ── Ready ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f172a', color: '#f1f5f9' }}>
      <div className="p-6">
        <h1 className="text-xl font-bold">AutoSpa <span style={{ color: '#38bdf8' }}>L&apos;Exception</span></h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold"
          style={{ background: '#0ea5e9', color: '#fff' }}
        >
          {username.charAt(0).toUpperCase()}
        </div>

        <div className="text-center">
          <p className="text-3xl font-bold">{username}</p>
          {clockedIn && checkInTime && (
            <p className="mt-1 text-sm" style={{ color: '#94a3b8' }}>
              Clocked in {elapsed} ago
            </p>
          )}
        </div>

        <div
          className="px-6 py-2 rounded-full font-semibold text-sm"
          style={{
            background: clockedIn ? '#14532d' : '#1e293b',
            color: clockedIn ? '#86efac' : '#94a3b8',
            border: `1px solid ${clockedIn ? '#16a34a' : '#334155'}`,
          }}
        >
          {clockedIn ? '🟢 Currently Clocked In' : '⚪ Not Clocked In'}
        </div>

        <button
          onClick={handleClock}
          className="w-full py-5 rounded-3xl font-bold text-2xl transition-all active:scale-95"
          style={{
            background: clockedIn
              ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
              : 'linear-gradient(135deg, #22c55e, #15803d)',
            color: '#fff',
            boxShadow: clockedIn ? '0 0 30px rgba(239,68,68,0.3)' : '0 0 30px rgba(34,197,94,0.3)',
          }}
        >
          {clockedIn ? 'Clock Out' : 'Clock In'}
        </button>

        <p className="text-xs text-center" style={{ color: '#475569' }}>
          Your location will be verified automatically
        </p>
      </div>

      <div className="p-6 text-center">
        <button onClick={resetDevice} className="text-xs" style={{ color: '#334155' }}>
          Not {username}? Reset this device
        </button>
      </div>
    </div>
  );
}

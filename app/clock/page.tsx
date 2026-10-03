'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

function formatDuration(checkIn: string): string {
  const ms = Date.now() - new Date(checkIn).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function postClock(coords: { lat?: number; lng?: number }) {
  return fetch('/api/clock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(coords),
  });
}

export default function ClockPage() {
  const [phase, setPhase] = useState<'loading' | 'unlinked' | 'ready' | 'confirming' | 'done' | 'error'>('loading');
  const [username, setUsername] = useState('');
  const [clockedIn, setClockedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [resultMsg, setResultMsg] = useState('');
  const [resultAction, setResultAction] = useState<'in' | 'out' | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/clock');
      const data = await res.json();
      if (!res.ok) throw new Error();
      if (!data.linked) {
        setPhase('unlinked');
        return;
      }
      setUsername(data.username ?? '');
      setClockedIn(data.clockedIn);
      setCheckInTime(data.checkIn ?? null);
      setPhase('ready');
    } catch {
      setErrorMsg('Failed to load your status. Try again.');
      setPhase('error');
    }
  }, []);

  const started = useRef(false);

  useEffect(() => {
    // The one-time code must only be sent once, even when React re-runs effects in dev
    if (started.current) return;
    started.current = true;

    // Opened from the owner's one-time link: link this phone first, then drop the code from the URL
    const code = new URLSearchParams(window.location.search).get('enroll');
    if (!code) {
      loadStatus();
      return;
    }

    window.history.replaceState(null, '', '/clock');
    fetch('/api/clock/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        if (!res.ok) {
          // A used or expired link is harmless on a phone that is already linked
          const data = await res.json();
          const status = await fetch('/api/clock').then((r) => r.json());
          if (!status.linked) {
            setErrorMsg(data.error || 'Failed to link this phone.');
            setPhase('error');
            return;
          }
        }
        loadStatus();
      })
      .catch(() => {
        setErrorMsg('Network error. Please try again.');
        setPhase('error');
      });
  }, [loadStatus]);

  // Elapsed timer when clocked in
  useEffect(() => {
    if (!clockedIn || !checkInTime) return;
    const update = () => setElapsed(formatDuration(checkInTime));
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [clockedIn, checkInTime]);

  async function handleClock() {
    setPhase('confirming');

    try {
      // On the shop Wi-Fi this succeeds straight away; otherwise the server asks for GPS
      let res = await postClock({});
      let data = await res.json();

      if (res.status === 403 && data.needsLocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            })
          );
          res = await postClock({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          data = await res.json();
        } catch {
          // Location denied or unavailable — show the server's explanation
        }
      }

      if (res.status === 401) {
        setPhase('unlinked');
        return;
      }

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

  // ── Phone not linked to an employee ───────────────────────────────────────
  if (phase === 'unlinked') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-6" style={{ background: '#0f172a', color: '#f1f5f9' }}>
        <h1 className="text-2xl font-bold">AutoSpa <span style={{ color: '#38bdf8' }}>L&apos;Exception</span></h1>
        <div className="text-5xl">📱</div>
        <h2 className="text-xl font-bold text-center">This phone is not set up yet</h2>
        <p className="text-center" style={{ color: '#94a3b8' }}>
          Ask the owner to link this phone to your name. They will show you a code to scan.
        </p>
      </div>
    );
  }

  // ── Confirming / verifying location ───────────────────────────────────────
  if (phase === 'confirming') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-4" style={{ background: '#0f172a', color: '#f1f5f9' }}>
        <div className="w-12 h-12 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <p style={{ color: '#94a3b8' }}>Checking you are at the shop…</p>
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
          Works on the shop Wi-Fi, or with location turned on at the shop
        </p>
      </div>
    </div>
  );
}

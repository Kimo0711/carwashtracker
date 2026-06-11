'use client';

import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';

export default function CheckinDisplay() {
  const [url, setUrl] = useState('');

  useEffect(() => {
    setUrl(`${window.location.origin}/clock`);
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}
    >
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold tracking-tight" style={{ color: '#f8fafc' }}>
          AutoSpa <span style={{ color: '#38bdf8' }}>L&apos;Exception</span>
        </h1>
        <p className="mt-2 text-xl" style={{ color: '#94a3b8' }}>
          Employee Check-In / Check-Out
        </p>
      </div>

      <div
        id="qr-card"
        className="rounded-3xl p-10 flex flex-col items-center"
        style={{ background: '#1e293b', border: '1px solid #334155', boxShadow: '0 0 60px rgba(56,189,248,0.1)' }}
      >
        {url ? (
          <>
            <div className="rounded-2xl p-5 bg-white">
              <QRCode value={url} size={280} />
            </div>
            <p className="mt-6 text-2xl font-semibold" style={{ color: '#f1f5f9' }}>
              Scan to clock in / out
            </p>
            <p className="mt-1 text-sm font-mono" style={{ color: '#475569' }}>
              {url}
            </p>
          </>
        ) : (
          <div className="w-72 h-72 rounded-2xl flex items-center justify-center" style={{ background: '#0f172a' }}>
            <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      <button
        onClick={() => window.print()}
        className="mt-8 px-8 py-3 rounded-2xl font-semibold text-lg transition-all active:scale-95"
        style={{ background: '#0ea5e9', color: '#fff' }}
      >
        Print QR Code
      </button>

      <p className="mt-4 text-sm" style={{ color: '#334155' }}>
        Print this page and post it at the shop entrance
      </p>
    </div>
  );
}

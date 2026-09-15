'use client';

import { FormEvent, useState } from 'react';

export default function AgentLoginPage() {
  const [key, setKey] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/agent/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey: key }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || 'Login failed');
      window.location.href = '/agent';
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#050505', color: '#eee', fontFamily: 'Arial, Helvetica, sans-serif', padding: 24 }}>
      <form onSubmit={login} style={{ width: 'min(420px, 100%)', background: '#0b0b0b', border: '1px solid #292929', padding: 28 }}>
        <div style={{ fontSize: 10, letterSpacing: '.28em', color: '#777', marginBottom: 8 }}>GLOOMCAKE HQ</div>
        <h1 style={{ margin: '0 0 8px', fontSize: 26 }}>Release Agent</h1>
        <p style={{ color: '#888', fontSize: 12, lineHeight: 1.5 }}>Enter the private agent access key configured in Vercel.</p>
        <input
          type="password"
          autoComplete="current-password"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="Agent access key"
          style={{ width: '100%', background: '#050505', border: '1px solid #333', color: '#eee', padding: 12, margin: '14px 0' }}
        />
        <button disabled={busy || !key} style={{ width: '100%', padding: 12, border: '1px solid #ddd', background: '#eee', color: '#080808', fontWeight: 700, cursor: 'pointer' }}>
          {busy ? 'CHECKING…' : 'ENTER AGENT'}
        </button>
        {message ? <div style={{ marginTop: 14, color: '#ffb3b3', fontSize: 12 }}>{message}</div> : null}
      </form>
    </main>
  );
}

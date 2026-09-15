'use client';

import { upload } from '@vercel/blob/client';
import { useEffect, useState } from 'react';

type Check = { ready: boolean; label: string; required: string };
type Readiness = {
  ok: boolean;
  ready: boolean;
  checks: Record<string, Check>;
  defaults: Record<string, string>;
};

type Settings = { logoUrl?: string | null; updatedAt?: string };

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'logo.png';
}

export default function SetupPage() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);

  async function load() {
    const [readyResponse, settingsResponse] = await Promise.all([
      fetch('/api/agent/readiness', { cache: 'no-store' }),
      fetch('/api/agent/settings', { cache: 'no-store' }),
    ]);
    const readyJson = await readyResponse.json();
    const settingsJson = await settingsResponse.json();
    setReadiness(readyJson);
    if (settingsJson.ok) setSettings(settingsJson.settings || {});
  }

  useEffect(() => { void load(); }, []);

  async function uploadLogo() {
    if (!logo) return;
    setBusy(true);
    setProgress(0);
    setMessage('Uploading exact approved logo…');
    try {
      const blob = await upload(`gloomcake-agent/incoming/logo/${Date.now()}-${safeName(logo.name)}`, logo, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        contentType: logo.type || 'image/png',
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      const response = await fetch('/api/agent/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: blob.url }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || 'Could not save logo setting');
      setSettings(json.settings);
      setLogo(null);
      setMessage('Exact approved GloomCake logo saved. Future branding will use this file, never a generated approximation.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Logo setup failed');
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  async function syncAnalytics() {
    setBusy(true);
    setMessage('Syncing Metricool performance data…');
    try {
      const response = await fetch('/api/analytics/sync');
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || 'Analytics sync failed');
      setMessage(`Analytics synced for ${json.results?.length || 0} release(s).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Analytics sync failed');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/agent/login', { method: 'DELETE' });
    window.location.href = '/agent/login';
  }

  return (
    <main style={{ minHeight: '100vh', background: '#050505', color: '#eee', fontFamily: 'Arial, Helvetica, sans-serif', padding: 28 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', borderBottom: '1px solid #242424', paddingBottom: 18, marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '.28em', color: '#777' }}>GLOOMCAKE HQ</div>
            <h1 style={{ margin: '5px 0', fontSize: 28 }}>Agent System Setup</h1>
            <div style={{ color: '#777', fontSize: 12 }}>Everything required for autonomous releases, rendering and publishing.</div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <a href="/agent" style={{ color: '#ccc', fontSize: 11 }}>RELEASE AGENT</a>
            <button onClick={() => void logout()} style={{ background: 'transparent', color: '#888', border: 0, cursor: 'pointer', fontSize: 11 }}>LOG OUT</button>
          </div>
        </header>

        <section style={{ border: '1px solid #272727', background: '#0b0b0b', padding: 20, marginBottom: 18 }}>
          <div style={{ fontSize: 12, letterSpacing: '.14em', marginBottom: 14 }}>SYSTEM READINESS</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {readiness ? Object.entries(readiness.checks).map(([key, check]) => (
              <div key={key} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 12, border: '1px solid #222', padding: 12 }}>
                <b style={{ color: check.ready ? '#b8f7c2' : '#ffb0b0', fontSize: 11 }}>{check.ready ? 'READY' : 'NEEDS SETUP'}</b>
                <div>
                  <div style={{ fontSize: 12 }}>{check.label}</div>
                  {!check.ready ? <div style={{ color: '#777', fontSize: 10, marginTop: 4 }}>{check.required}</div> : null}
                </div>
              </div>
            )) : <div style={{ color: '#777', fontSize: 12 }}>Checking…</div>}
          </div>
          {readiness?.ready ? <div style={{ marginTop: 14, padding: 12, border: '1px solid #31583b', color: '#b8f7c2', fontSize: 12 }}>SYSTEM READY FOR END-TO-END AUTONOMOUS RELEASES.</div> : null}
        </section>

        <section style={{ border: '1px solid #272727', background: '#0b0b0b', padding: 20, marginBottom: 18 }}>
          <div style={{ fontSize: 12, letterSpacing: '.14em', marginBottom: 8 }}>OFFICIAL GLOOMCAKE LOGO</div>
          <p style={{ color: '#888', fontSize: 12, lineHeight: 1.5 }}>Upload the exact approved transparent PNG once. The artwork generator never types, redraws or approximates the GloomCake logo. This exact file is composited only after artwork approval.</p>
          {settings.logoUrl ? <img src={settings.logoUrl} alt="Configured GloomCake logo" style={{ width: 180, height: 100, objectFit: 'contain', background: '#070707', border: '1px solid #242424', padding: 10, marginBottom: 12 }} /> : null}
          <input type="file" accept="image/png" onChange={(event) => setLogo(event.target.files?.[0] || null)} />
          <button disabled={busy || !logo} onClick={() => void uploadLogo()} style={{ display: 'block', marginTop: 12, padding: '11px 16px', border: '1px solid #ddd', background: '#eee', color: '#090909', fontWeight: 700, cursor: 'pointer' }}>SAVE EXACT LOGO</button>
          {progress > 0 && progress < 100 ? <div style={{ color: '#888', fontSize: 11, marginTop: 8 }}>UPLOAD {progress}%</div> : null}
        </section>

        <section style={{ border: '1px solid #272727', background: '#0b0b0b', padding: 20 }}>
          <div style={{ fontSize: 12, letterSpacing: '.14em', marginBottom: 8 }}>PERFORMANCE FEEDBACK LOOP</div>
          <p style={{ color: '#888', fontSize: 12, lineHeight: 1.5 }}>Metricool performance is synced daily. Prior results are used only as weak strategic evidence; they cannot override the GloomCake anti-repetition visual rules.</p>
          <button disabled={busy} onClick={() => void syncAnalytics()} style={{ padding: '11px 16px', border: '1px solid #444', background: '#111', color: '#eee', fontWeight: 700, cursor: 'pointer' }}>SYNC ANALYTICS NOW</button>
        </section>

        {message ? <div style={{ marginTop: 16, color: '#bbb', whiteSpace: 'pre-wrap', fontSize: 12 }}>{message}</div> : null}
      </div>
    </main>
  );
}

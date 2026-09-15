'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Mode = 'bars' | 'wave' | 'ring';
type ClipJob = { id: string; start: number; duration: number; score?: number | null; label: string; format: string; renderMode: Mode };
type Campaign = { trackTitle: string; catalog: string; clips: ClipJob[]; social: Record<string,string>; status: string };

declare global {
  interface Window {
    __GLOOMCAKE_AUTOMATION__?: {
      applyConfig: (config: Record<string, unknown>) => Promise<void>;
      seek: (seconds: number) => Promise<number>;
      play: () => Promise<void>;
      pause: () => void;
      state: () => { audioReady: boolean; duration: number; currentTime: number; recording: boolean };
      renderClip: (job: { start: number; duration: number; mode?: Mode; filename?: string }) => Promise<void>;
    };
  }
}

function mmss(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioFileRef = useRef<File | null>(null);
  const [mode, setMode] = useState<Mode>('bars');
  const [accent, setAccent] = useState('#63f3ff');
  const [sensitivity, setSensitivity] = useState(1.25);
  const [audioReady, setAudioReady] = useState(false);
  const [trackName, setTrackName] = useState('NO AUDIO LOADED');
  const [catalog, setCatalog] = useState('GC-038');
  const [lyrics, setLyrics] = useState('');
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('idle');
  const [windows, setWindows] = useState<Array<{start:number;duration:number;score:number;label:string}>>([]);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [renderingId, setRenderingId] = useState<string | null>(null);

  const ensureAudioGraph = async () => {
    if (analyserRef.current || !audioRef.current) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const source = ctx.createMediaElementSource(audioRef.current);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.82;
    const mediaDest = ctx.createMediaStreamDestination();
    source.connect(analyser);
    analyser.connect(ctx.destination);
    analyser.connect(mediaDest);
    analyserRef.current = analyser;
    audioCtxRef.current = ctx;
    mediaDestRef.current = mediaDest;
  };

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#020408';
      ctx.fillRect(0, 0, w, h);
      const analyser = analyserRef.current;
      const data = new Uint8Array(analyser?.frequencyBinCount || 128);
      if (analyser) analyser.getByteFrequencyData(data);
      const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.55);
      glow.addColorStop(0, accent + '22');
      glow.addColorStop(1, '#00000000');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = accent;
      ctx.fillStyle = accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 16;
      const energy = data.reduce((a, b) => a + b, 0) / Math.max(1, data.length) / 255;
      if (mode === 'bars') {
        const bars = 42;
        for (let i = 0; i < bars; i++) {
          const v = ((data[Math.floor(i * data.length / bars)] || 0) / 255) * sensitivity;
          const bh = Math.max(2, v * h * 0.62);
          const bw = w / bars - 3;
          ctx.globalAlpha = 0.35 + v * 0.65;
          ctx.fillRect(i * (w / bars) + 1.5, h - bh, Math.max(1, bw), bh);
        }
      } else if (mode === 'wave') {
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const i = Math.floor((x / w) * (data.length - 1));
          const v = ((data[i] || 0) / 255) * sensitivity;
          const y = h / 2 + Math.sin(x * 0.035 + performance.now() * 0.002) * (22 + v * h * 0.22);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        const r = Math.min(w, h) * (0.18 + Math.min(0.22, energy * sensitivity * 0.3));
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.05) {
          const i = Math.floor((a / (Math.PI * 2)) * (data.length - 1));
          const v = ((data[i] || 0) / 255) * sensitivity;
          const rr = r + v * 55;
          const x = w / 2 + Math.cos(a) * rr;
          const y = h / 2 + Math.sin(a) * rr;
          a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#dffcff';
      ctx.font = '600 12px Arial';
      ctx.fillText('GLOOMCAKE', 24, 34);
      ctx.fillStyle = '#81939c';
      ctx.font = '10px Arial';
      ctx.fillText(trackName.toUpperCase(), 24, 52);
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [mode, accent, sensitivity, trackName]);

  const makeRecorder = async (filename: string) => {
    await ensureAudioGraph();
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('Canvas missing');
    const canvasStream = canvas.captureStream(60);
    const tracks = [...canvasStream.getVideoTracks()];
    const audioTrack = mediaDestRef.current?.stream.getAudioTracks()[0];
    if (audioTrack) tracks.push(audioTrack);
    const stream = new MediaStream(tracks);
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => {
        const url = URL.createObjectURL(new Blob(chunks, { type: mime }));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        resolve();
      };
    });
    return { recorder, stopped };
  };

  const renderClip = async (job: { start:number; duration:number; mode?:Mode; filename?:string }) => {
    if (!audioRef.current) return;
    if (job.mode) setMode(job.mode);
    await ensureAudioGraph();
    if (audioCtxRef.current?.state === 'suspended') await audioCtxRef.current.resume();
    audioRef.current.currentTime = job.start;
    const filename = job.filename || `${trackName}-${Math.round(job.start)}s.webm`;
    const { recorder, stopped } = await makeRecorder(filename);
    recorderRef.current = recorder;
    recorder.start(250);
    setRecording(true);
    await audioRef.current.play();
    await new Promise(r => setTimeout(r, job.duration * 1000));
    audioRef.current.pause();
    if (recorder.state !== 'inactive') recorder.stop();
    setRecording(false);
    await stopped;
  };

  useEffect(() => {
    window.__GLOOMCAKE_AUTOMATION__ = {
      applyConfig: async (config) => {
        if (typeof config.mode === 'string' && ['bars','wave','ring'].includes(config.mode)) setMode(config.mode as Mode);
        if (typeof config.accent === 'string') setAccent(config.accent);
        if (typeof config.sensitivity === 'number') setSensitivity(config.sensitivity);
      },
      seek: async (seconds) => { if (audioRef.current) audioRef.current.currentTime = seconds; return audioRef.current?.currentTime || 0; },
      play: async () => { await ensureAudioGraph(); await audioRef.current?.play(); },
      pause: () => audioRef.current?.pause(),
      state: () => ({ audioReady, duration: audioRef.current?.duration || 0, currentTime: audioRef.current?.currentTime || 0, recording }),
      renderClip,
    };
  }, [audioReady, recording, mode, trackName]);

  const loadAudio = async (file?: File) => {
    if (!file || !audioRef.current) return;
    audioFileRef.current = file;
    audioRef.current.src = URL.createObjectURL(file);
    setTrackName(file.name.replace(/\.[^.]+$/, ''));
    setAudioReady(true);
    setCampaign(null);
    setWindows([]);
    audioRef.current.onloadedmetadata = () => setDuration(audioRef.current?.duration || 0);
    await ensureAudioGraph();
  };

  const analyzeAudio = async () => {
    const file = audioFileRef.current;
    if (!file) return;
    setAnalysisStatus('analyzing');
    const ab = await file.arrayBuffer();
    const ctx = new AudioContext();
    const buf = await ctx.decodeAudioData(ab.slice(0));
    const ch = buf.getChannelData(0);
    const sr = buf.sampleRate;
    const stepSec = 0.5;
    const step = Math.floor(sr * stepSec);
    const bins: Array<{t:number;rms:number;delta:number}> = [];
    let prev = 0;
    for (let i = 0; i < ch.length; i += step) {
      let sum = 0;
      const end = Math.min(ch.length, i + step);
      for (let j = i; j < end; j += 4) sum += ch[j] * ch[j];
      const n = Math.max(1, Math.ceil((end - i) / 4));
      const rms = Math.sqrt(sum / n);
      const delta = Math.max(0, rms - prev);
      bins.push({ t: i / sr, rms, delta });
      prev = rms;
    }
    const maxRms = Math.max(...bins.map(b => b.rms), 0.0001);
    const scored = bins.map(b => ({ ...b, score: (b.rms / maxRms) * 0.72 + Math.min(1, b.delta / maxRms * 4) * 0.28 }))
      .sort((a,b) => b.score - a.score);
    const picks: typeof scored = [];
    for (const item of scored) {
      if (item.t < 8 || item.t > buf.duration - 8) continue;
      if (picks.every(p => Math.abs(p.t - item.t) >= 18)) picks.push(item);
      if (picks.length === 3) break;
    }
    picks.sort((a,b) => a.t - b.t);
    const labels = ['Hook / early payoff', 'Mid-track lift', 'Final pressure'];
    const next = picks.map((p,i) => ({ start: Math.max(0, p.t - 4), duration: i === 2 ? 13 : 16, score: Number(p.score.toFixed(3)), label: labels[i] }));
    setDuration(buf.duration);
    setWindows(next);
    setAnalysisStatus('ready');
    await ctx.close();
  };

  const buildCampaign = async () => {
    if (!audioFileRef.current) return;
    if (!windows.length) await analyzeAudio();
    const activeWindows = windows.length ? windows : [];
    const res = await fetch('/api/campaign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackTitle: trackName, catalog, audioFilename: audioFileRef.current.name, durationSec: duration, lyrics, windows: activeWindows })
    });
    const data = await res.json();
    if (data.ok) setCampaign(data.campaign);
  };

  useEffect(() => {
    if (analysisStatus === 'ready' && windows.length && !campaign && audioFileRef.current) {
      fetch('/api/campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackTitle: trackName, catalog, audioFilename: audioFileRef.current.name, durationSec: duration, lyrics, windows })
      }).then(r => r.json()).then(d => d.ok && setCampaign(d.campaign));
    }
  }, [analysisStatus, windows]);

  const renderJob = async (job: ClipJob) => {
    setRenderingId(job.id);
    await renderClip({ start: job.start, duration: job.duration, mode: job.renderMode, filename: `${catalog}-${job.id}-${trackName.replace(/\s+/g,'_')}.webm` });
    setRenderingId(null);
  };

  const toggleRecord = async () => {
    if (!audioReady) return;
    if (recording && recorderRef.current) {
      recorderRef.current.stop(); setRecording(false); return;
    }
    const { recorder } = await makeRecorder(`${trackName}-visualizer.webm`);
    recorderRef.current = recorder;
    recorder.start(250); setRecording(true);
  };

  const clipRows = campaign?.clips || windows.map((w,i) => ({ id:`clip-${i+1}`, ...w, format:'9:16', renderMode:(['ring','wave','bars'][i] || 'wave') as Mode }));

  return <main className="shell">
    <header><div><b>GLOOMCAKE</b><span>PROMO MANAGER / AUDIO VISUALIZER</span></div><i>{campaign ? 'CAMPAIGN READY' : 'GC SYSTEM ONLINE'}</i></header>
    <section className="workspace">
      <aside>
        <label className="upload">AUDIO<input type="file" accept="audio/*" onChange={e => loadAudio(e.target.files?.[0])} /></label>
        <label>TRACK<input value={trackName === 'NO AUDIO LOADED' ? '' : trackName} placeholder="Track title" onChange={e => setTrackName(e.target.value)} /></label>
        <label>CATALOG<input value={catalog} onChange={e => setCatalog(e.target.value)} /></label>
        <label>LYRICS<textarea rows={7} value={lyrics} onChange={e => setLyrics(e.target.value)} placeholder="Paste lyrics (optional)" /></label>
        <button disabled={!audioReady || analysisStatus==='analyzing'} onClick={analyzeAudio}>{analysisStatus==='analyzing' ? 'ANALYZING AUDIO…' : 'ANALYZE + PICK CLIPS'}</button>
        <button disabled={!audioReady} onClick={buildCampaign}>BUILD CAMPAIGN</button>
        <label>VISUAL MODE<select value={mode} onChange={e => setMode(e.target.value as Mode)}><option value="bars">Spectrum Bars</option><option value="wave">Signal Wave</option><option value="ring">Eclipse Ring</option></select></label>
        <label>ACCENT<input type="color" value={accent} onChange={e => setAccent(e.target.value)} /></label>
        <label>SENSITIVITY<input type="range" min="0.5" max="3" step="0.05" value={sensitivity} onChange={e => setSensitivity(Number(e.target.value))} /></label>
        <button onClick={async () => { await ensureAudioGraph(); if (audioRef.current?.paused) audioRef.current.play(); else audioRef.current?.pause(); }}>{audioReady ? 'PLAY / PAUSE' : 'LOAD AUDIO'}</button>
        <button className={recording ? 'recording' : ''} disabled={!audioReady} onClick={toggleRecord}>{recording ? 'STOP RECORDING' : 'RECORD VIDEO + AUDIO'}</button>
      </aside>
      <div className="stage"><canvas ref={canvasRef} /><div className="meta"><span>{trackName}</span><span>{duration ? mmss(duration) : '--:--'} / 60 FPS / 9:16 READY</span></div></div>
    </section>

    {(clipRows.length > 0 || campaign) && <section style={{maxWidth:1200,margin:'20px auto',padding:'0 20px'}}>
      <h2 style={{fontSize:14,letterSpacing:2}}>AGENT OUTPUT</h2>
      <div style={{display:'grid',gap:10}}>
        {clipRows.map((c:any) => <div key={c.id} style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:12,alignItems:'center',padding:12,border:'1px solid #1a2a31',background:'#05090d'}}>
          <div><b>{c.label}</b><div style={{fontSize:12,opacity:.65}}>{mmss(c.start)} → {mmss(c.start+c.duration)} · {c.renderMode} · score {c.score ?? '—'}</div></div>
          <button onClick={() => { if(audioRef.current){ audioRef.current.currentTime=c.start; audioRef.current.play(); }}}>PREVIEW</button>
          <button disabled={!!renderingId} onClick={() => renderJob(c)}>{renderingId===c.id ? 'RENDERING…' : 'RENDER CLIP'}</button>
        </div>)}
      </div>
      {campaign?.social && <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:10,marginTop:12}}>
        {Object.entries(campaign.social).map(([network,text]) => <div key={network} style={{padding:12,border:'1px solid #1a2a31',background:'#05090d'}}><b>{network.toUpperCase()}</b><pre style={{whiteSpace:'pre-wrap',fontFamily:'inherit',fontSize:12}}>{text}</pre></div>)}
      </div>}
    </section>}
    <audio ref={audioRef} crossOrigin="anonymous" />
  </main>;
}

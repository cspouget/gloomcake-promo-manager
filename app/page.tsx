'use client';

import { useEffect, useRef, useState } from 'react';

type Mode = 'bars' | 'wave' | 'ring';

declare global {
  interface Window {
    __GLOOMCAKE_AUTOMATION__?: {
      applyConfig: (config: Record<string, unknown>) => Promise<void>;
      seek: (seconds: number) => Promise<number>;
      play: () => Promise<void>;
      pause: () => void;
      state: () => { audioReady: boolean; duration: number; currentTime: number; recording: boolean };
    };
  }
}

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [mode, setMode] = useState<Mode>('bars');
  const [accent, setAccent] = useState('#63f3ff');
  const [sensitivity, setSensitivity] = useState(1.25);
  const [audioReady, setAudioReady] = useState(false);
  const [trackName, setTrackName] = useState('NO AUDIO LOADED');
  const [recording, setRecording] = useState(false);

  const ensureAudioGraph = async () => {
    if (analyserRef.current || !audioRef.current) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const source = ctx.createMediaElementSource(audioRef.current);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.82;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    analyserRef.current = analyser;
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
      ctx.letterSpacing = '2px';
      ctx.fillText('GLOOMCAKE', 24, 34);
      ctx.fillStyle = '#81939c';
      ctx.font = '10px Arial';
      ctx.fillText(trackName.toUpperCase(), 24, 52);
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [mode, accent, sensitivity, trackName]);

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
      state: () => ({ audioReady, duration: audioRef.current?.duration || 0, currentTime: audioRef.current?.currentTime || 0, recording })
    };
  }, [audioReady, recording]);

  const loadAudio = async (file?: File) => {
    if (!file || !audioRef.current) return;
    audioRef.current.src = URL.createObjectURL(file);
    setTrackName(file.name.replace(/\.[^.]+$/, ''));
    setAudioReady(true);
    await ensureAudioGraph();
  };

  const toggleRecord = () => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio) return;
    if (recorderRef.current && recording) {
      recorderRef.current.stop();
      setRecording(false);
      return;
    }
    const canvasStream = canvas.captureStream(60);
    const tracks = [...canvasStream.getVideoTracks()];
    const stream = new MediaStream(tracks);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      const url = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${trackName || 'gloomcake'}-visualizer.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
  };

  return <main className="shell">
    <header><div><b>GLOOMCAKE</b><span>AUDIO VISUALIZER / PROMO RENDERER</span></div><i>GC SYSTEM ONLINE</i></header>
    <section className="workspace">
      <aside>
        <label className="upload">AUDIO<input type="file" accept="audio/*" onChange={e => loadAudio(e.target.files?.[0])} /></label>
        <label>VISUAL MODE<select value={mode} onChange={e => setMode(e.target.value as Mode)}><option value="bars">Spectrum Bars</option><option value="wave">Signal Wave</option><option value="ring">Eclipse Ring</option></select></label>
        <label>ACCENT<input type="color" value={accent} onChange={e => setAccent(e.target.value)} /></label>
        <label>SENSITIVITY<input type="range" min="0.5" max="3" step="0.05" value={sensitivity} onChange={e => setSensitivity(Number(e.target.value))} /></label>
        <button onClick={async () => { await ensureAudioGraph(); if (audioRef.current?.paused) audioRef.current.play(); else audioRef.current?.pause(); }}>{audioReady ? 'PLAY / PAUSE' : 'LOAD AUDIO'}</button>
        <button className={recording ? 'recording' : ''} disabled={!audioReady} onClick={toggleRecord}>{recording ? 'STOP RECORDING' : 'RECORD VIDEO'}</button>
      </aside>
      <div className="stage"><canvas ref={canvasRef} /><div className="meta"><span>{trackName}</span><span>60 FPS / 9:16 READY</span></div></div>
    </section>
    <audio ref={audioRef} crossOrigin="anonymous" />
  </main>;
}

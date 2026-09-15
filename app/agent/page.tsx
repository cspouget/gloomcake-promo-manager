'use client';

import { upload } from '@vercel/blob/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './agent.module.css';

type ClipJob = {
  id: string;
  start: number;
  duration: number;
  score?: number | null;
  label: string;
  format: string;
  renderMode: string;
  videoUrl?: string | null;
};

type CreativeDirection = {
  emotionalCore: string;
  concepts: string[];
  rejectedConcept: number;
  selectedConcept: number;
  artworkPrompt: string;
  socialAngle: string;
};

type SocialPackage = {
  tiktok: string;
  instagram: string;
  youtubeShortTitle: string;
  youtubeShortDescription: string;
  soundcloudDescription: string;
  soundcloudTags: string[];
};

type Release = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  trackTitle: string;
  catalog: string;
  lyrics?: string;
  durationSec?: number | null;
  audioUrl: string;
  creative?: CreativeDirection | null;
  artOnlyUrl?: string | null;
  brandedArtworkUrl?: string | null;
  clips: ClipJob[];
  social?: SocialPackage | null;
  approvals: {
    artworkApprovedAt?: string | null;
    campaignApprovedAt?: string | null;
    publishApprovedAt?: string | null;
  };
  publish?: {
    metricoolBrandId?: string | null;
    scheduledPostIds?: string[];
    scheduledAt?: string | null;
  };
  error?: string | null;
};

const LIVE_STATES = new Set([
  'draft',
  'creative-directing',
  'analyzing-audio',
  'branding',
  'rendering',
  'approved-for-publishing',
]);

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
}

function time(seconds: number) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
}

export default function AgentPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trackTitle, setTrackTitle] = useState('');
  const [catalog, setCatalog] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);
  const [artFeedback, setArtFeedback] = useState('');
  const [manualArtFile, setManualArtFile] = useState<File | null>(null);

  const selected = useMemo(
    () => releases.find((release) => release.id === selectedId) || null,
    [releases, selectedId],
  );

  const loadReleases = useCallback(async (keepSelection = true) => {
    try {
      const response = await fetch('/api/releases', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || 'Could not load releases');
      const next = (json.releases || []) as Release[];
      setReleases(next);
      setSelectedId((current) => {
        if (keepSelection && current && next.some((item) => item.id === current)) return current;
        return next[0]?.id || null;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load releases');
    }
  }, []);

  const refreshSelected = useCallback(async () => {
    if (!selectedId) return;
    try {
      const response = await fetch(`/api/releases/${selectedId}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || 'Could not refresh release');
      const release = json.release as Release;
      setReleases((items) => {
        const exists = items.some((item) => item.id === release.id);
        const next = exists
          ? items.map((item) => (item.id === release.id ? release : item))
          : [release, ...items];
        return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not refresh release');
    }
  }, [selectedId]);

  useEffect(() => {
    void loadReleases(false);
  }, [loadReleases]);

  useEffect(() => {
    if (!selected || !LIVE_STATES.has(selected.status)) return;
    const timer = window.setInterval(() => void refreshSelected(), 3500);
    return () => window.clearInterval(timer);
  }, [selected, refreshSelected]);

  async function uploadFile(file: File, purpose: 'audio' | 'art') {
    const pathname = `gloomcake-agent/incoming/${purpose}/${Date.now()}-${safeName(file.name)}`;
    const blob = await upload(pathname, file, {
      access: 'public',
      handleUploadUrl: '/api/upload',
      multipart: file.size > 10 * 1024 * 1024,
      contentType: file.type || undefined,
      onUploadProgress: ({ percentage }) => setUploadPercent(Math.round(percentage)),
    });
    return blob.url;
  }

  async function createRelease() {
    if (!audioFile || !trackTitle.trim() || !catalog.trim()) {
      setMessage('Track title, catalog number, and audio file are required.');
      return;
    }
    setBusy(true);
    setMessage('Uploading master audio…');
    setUploadPercent(0);
    try {
      const audioUrl = await uploadFile(audioFile, 'audio');
      setMessage('Starting autonomous release workflow…');
      const response = await fetch('/api/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackTitle: trackTitle.trim(),
          catalog: catalog.trim(),
          lyrics: lyrics.trim() || undefined,
          audioUrl,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || 'Could not create release');
      setSelectedId(json.releaseId);
      setMessage('Release started. Audio analysis + creative direction are running in the background.');
      setTrackTitle('');
      setCatalog('');
      setLyrics('');
      setAudioFile(null);
      setUploadPercent(0);
      await loadReleases(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Release creation failed');
    } finally {
      setBusy(false);
    }
  }

  async function postAction(path: string, body?: unknown) {
    setBusy(true);
    setMessage('Processing…');
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || 'Action failed');
      setMessage('Action accepted. The release agent is continuing in the background.');
      await refreshSelected();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function replaceArtwork() {
    if (!selected || !manualArtFile) return;
    setBusy(true);
    setMessage('Uploading replacement artwork…');
    setUploadPercent(0);
    try {
      const artOnlyUrl = await uploadFile(manualArtFile, 'art');
      const response = await fetch(`/api/releases/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artOnlyUrl }),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || 'Could not replace artwork');
      setManualArtFile(null);
      setUploadPercent(0);
      setMessage('Replacement artwork is now the approval candidate.');
      await refreshSelected();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Artwork upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div>
          <div className={styles.eyebrow}>GLOOMCAKE HQ / RELEASE AUTOMATION</div>
          <h1 className={styles.title}>Release Agent</h1>
          <div className={styles.sub}>Song in → creative direction → artwork approval → branding → promo renders → approval → scheduling.</div>
        </div>
        <a className={styles.link} href="/">OPEN VISUALIZER ↗</a>
      </header>

      <div className={styles.grid}>
        <aside>
          <section className={styles.panel}>
            <h2>NEW RELEASE</h2>
            <label className={styles.field}>
              <span>TRACK TITLE</span>
              <input value={trackTitle} onChange={(event) => setTrackTitle(event.target.value)} placeholder="Who Else but Me?" />
            </label>
            <label className={styles.field}>
              <span>CATALOG</span>
              <input value={catalog} onChange={(event) => setCatalog(event.target.value)} placeholder="GC-038" />
            </label>
            <label className={styles.field}>
              <span>MASTER AUDIO</span>
              <input type="file" accept="audio/*,.wav,.flac,.mp3,.m4a" onChange={(event) => setAudioFile(event.target.files?.[0] || null)} />
            </label>
            <label className={styles.field}>
              <span>LYRICS / NOTES — OPTIONAL</span>
              <textarea value={lyrics} onChange={(event) => setLyrics(event.target.value)} placeholder="Paste lyrics or creative notes…" />
            </label>
            <button className={`${styles.button} ${styles.accent}`} disabled={busy || !audioFile} onClick={() => void createRelease()}>
              {busy ? 'WORKING…' : 'START RELEASE AGENT'}
            </button>
            {uploadPercent > 0 && uploadPercent < 100 ? <div className={styles.status}>UPLOAD {uploadPercent}%</div> : null}
            {message ? <div className={styles.status}>{message}</div> : null}
          </section>

          <section className={styles.panel} style={{ marginTop: 18 }}>
            <h2>RELEASES</h2>
            <div className={styles.releaseList}>
              {releases.map((release) => (
                <div
                  key={release.id}
                  className={`${styles.releaseItem} ${selectedId === release.id ? styles.active : ''}`}
                  onClick={() => setSelectedId(release.id)}
                >
                  <b>{release.trackTitle}</b>
                  <span>{release.catalog} · {release.status.replaceAll('-', ' ').toUpperCase()}</span>
                </div>
              ))}
              {!releases.length ? <div className={styles.status}>No releases yet.</div> : null}
            </div>
          </section>
        </aside>

        <section className={`${styles.panel} ${styles.detail}`}>
          {!selected ? (
            <div className={styles.empty}>Start a release or select one from the queue.</div>
          ) : (
            <>
              <div className={styles.hero}>
                <div>
                  {selected.brandedArtworkUrl || selected.artOnlyUrl ? (
                    <img className={styles.cover} src={selected.brandedArtworkUrl || selected.artOnlyUrl || ''} alt={`${selected.trackTitle} artwork`} />
                  ) : (
                    <div className={`${styles.cover} ${styles.empty}`}>ARTWORK PENDING</div>
                  )}
                </div>

                <div className={styles.meta}>
                  <div className={styles.eyebrow}>{selected.catalog}</div>
                  <h1>{selected.trackTitle}</h1>
                  <span className={styles.pill}>{selected.status.replaceAll('-', ' ').toUpperCase()}</span>
                  {selected.durationSec ? <span className={styles.sub}>MASTER LENGTH · {time(selected.durationSec)}</span> : null}
                  {selected.error ? <div className={styles.error}>{selected.error}</div> : null}

                  {selected.creative ? (
                    <>
                      <div className={styles.sub}><b>EMOTIONAL CORE</b><br />{selected.creative.emotionalCore}</div>
                      <div className={styles.concepts}>
                        {selected.creative.concepts.map((concept, index) => (
                          <div key={index} className={`${styles.concept} ${index === selected.creative?.rejectedConcept ? styles.rejected : ''}`}>
                            {index === selected.creative?.selectedConcept ? 'SELECTED — ' : index === selected.creative?.rejectedConcept ? 'REJECTED — ' : ''}{concept}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}

                  {selected.status === 'awaiting-artwork-approval' && selected.artOnlyUrl ? (
                    <>
                      <div className={styles.actions}>
                        <button className={`${styles.button} ${styles.accent}`} disabled={busy} onClick={() => void postAction(`/api/releases/${selected.id}/approve-artwork`)}>APPROVE ART + FINISH CAMPAIGN</button>
                      </div>
                      <label className={styles.field}>
                        <span>REGENERATION FEEDBACK — OPTIONAL</span>
                        <input value={artFeedback} onChange={(event) => setArtFeedback(event.target.value)} placeholder="Less creepy, warmer, radically different composition…" />
                      </label>
                      <button className={`${styles.button} ${styles.danger}`} disabled={busy} onClick={() => void postAction(`/api/releases/${selected.id}/regenerate-artwork`, { feedback: artFeedback })}>REJECT + GENERATE DIFFERENT ART</button>
                      <label className={styles.field} style={{ marginTop: 18 }}>
                        <span>OR USE YOUR OWN / CHAT-APPROVED ART</span>
                        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setManualArtFile(event.target.files?.[0] || null)} />
                      </label>
                      <button className={styles.button} disabled={busy || !manualArtFile} onClick={() => void replaceArtwork()}>UPLOAD REPLACEMENT ART</button>
                    </>
                  ) : null}

                  {selected.status === 'awaiting-campaign-approval' ? (
                    <button className={`${styles.button} ${styles.accent}`} disabled={busy} onClick={() => void postAction(`/api/releases/${selected.id}/approve-campaign`)}>
                      APPROVE CAMPAIGN + SCHEDULE
                    </button>
                  ) : null}

                  {LIVE_STATES.has(selected.status) ? <div className={styles.status}>Agent is running. This page can be closed; processing continues durably on the server.</div> : null}
                  {selected.status === 'scheduled' ? <div className={styles.status}>Campaign scheduled through Metricool {selected.publish?.scheduledAt ? `at ${new Date(selected.publish.scheduledAt).toLocaleString()}` : ''}.</div> : null}
                  <div className={styles.actions}>
                    <button className={styles.button} disabled={busy} onClick={() => void refreshSelected()}>REFRESH</button>
                  </div>
                </div>
              </div>

              {selected.clips?.length ? (
                <div className={styles.clips}>
                  {selected.clips.map((clip) => (
                    <div className={styles.clip} key={clip.id}>
                      {clip.videoUrl ? <video src={clip.videoUrl} controls playsInline /> : <div className={`${styles.cover} ${styles.empty}`}>RENDER PENDING</div>}
                      <b>{clip.label}</b>
                      <span>{time(clip.start)} → {time(clip.start + clip.duration)} · {clip.duration.toFixed(0)}s</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {selected.social ? (
                <div className={styles.copy}>
                  <h2>CAMPAIGN COPY</h2>
                  <pre><b>TIKTOK</b>{'\n'}{selected.social.tiktok}</pre>
                  <pre><b>INSTAGRAM</b>{'\n'}{selected.social.instagram}</pre>
                  <pre><b>YOUTUBE SHORT</b>{'\n'}{selected.social.youtubeShortTitle}{'\n\n'}{selected.social.youtubeShortDescription}</pre>
                  <pre><b>SOUNDCLOUD</b>{'\n'}{selected.social.soundcloudDescription}{'\n\n'}{selected.social.soundcloudTags.join(' · ')}</pre>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

import { put } from '@vercel/blob';
import { Sandbox } from '@vercel/sandbox';
import type { ClipJob } from './types';

const SAMPLE_RATE = 2000;
const CLIP_SECONDS = 16;

function validateMediaUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.blob.vercel-storage.com')) {
    throw new Error('Media must be stored in the connected Vercel Blob store');
  }
  return url.toString();
}

async function createMediaSandbox() {
  const snapshotId = process.env.SANDBOX_SNAPSHOT_ID;
  if (snapshotId) {
    return Sandbox.create({
      source: { type: 'snapshot', snapshotId },
      persistent: false,
      timeout: 4 * 60 * 1000,
      resources: { vcpus: 4 },
    });
  }
  return Sandbox.create({
    persistent: false,
    timeout: 4 * 60 * 1000,
    resources: { vcpus: 4 },
  });
}

async function ensureFfmpeg(sandbox: Sandbox) {
  const check = await sandbox.runCommand('bash', ['-lc', 'test -x ./ffmpeg']);
  if (check.exitCode === 0) return;
  const install = await sandbox.runCommand('bash', [
    '-lc',
    'curl -fsSL https://johnvansickle.com/ffmpeg/releases/ffmpeg-7.0.2-amd64-static.tar.xz | tar -xJ --strip-components=1',
  ]);
  if (install.exitCode !== 0) throw new Error(`FFmpeg install failed: ${await install.stderr()}`);
}

async function download(sandbox: Sandbox, url: string, filename: string) {
  validateMediaUrl(url);
  const result = await sandbox.runCommand('curl', ['-fsSL', '-o', filename, url]);
  if (result.exitCode !== 0) throw new Error(`Media download failed: ${await result.stderr()}`);
}

function chooseWindows(pcm: Buffer, durationSec: number): ClipJob[] {
  const sampleCount = Math.floor(pcm.length / 4);
  const samplesPerBucket = Math.max(1, Math.floor(SAMPLE_RATE * 0.5));
  const buckets: number[] = [];
  for (let offset = 0; offset < sampleCount; offset += samplesPerBucket) {
    let sum = 0;
    const end = Math.min(sampleCount, offset + samplesPerBucket);
    for (let i = offset; i < end; i++) {
      const value = pcm.readFloatLE(i * 4);
      sum += value * value;
    }
    buckets.push(Math.sqrt(sum / Math.max(1, end - offset)));
  }

  const bucketSec = 0.5;
  const spanBuckets = Math.round(CLIP_SECONDS / bucketSec);
  const candidates: Array<{ start: number; score: number }> = [];
  for (let i = 0; i + spanBuckets < buckets.length; i += 4) {
    const window = buckets.slice(i, i + spanBuckets);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    let movement = 0;
    for (let j = 1; j < window.length; j++) movement += Math.abs(window[j] - window[j - 1]);
    movement /= Math.max(1, window.length - 1);
    const position = (i * bucketSec) / Math.max(durationSec, 1);
    const middleBias = position > 0.08 && position < 0.94 ? 0.01 : 0;
    candidates.push({ start: i * bucketSec, score: mean + movement * 0.9 + middleBias });
  }

  candidates.sort((a, b) => b.score - a.score);
  const chosen: Array<{ start: number; score: number }> = [];
  for (const candidate of candidates) {
    if (chosen.every((item) => Math.abs(item.start - candidate.start) >= 22)) chosen.push(candidate);
    if (chosen.length === 3) break;
  }

  if (chosen.length < 3) {
    for (const ratio of [0.18, 0.48, 0.78]) {
      const start = Math.max(0, Math.min(durationSec - CLIP_SECONDS, durationSec * ratio));
      if (chosen.every((item) => Math.abs(item.start - start) >= 12)) chosen.push({ start, score: 0 });
      if (chosen.length === 3) break;
    }
  }

  return chosen.slice(0, 3).map((item, index) => ({
    id: `clip-${index + 1}`,
    start: Math.round(item.start * 10) / 10,
    duration: Math.min(CLIP_SECONDS, Math.max(6, durationSec - item.start)),
    score: Math.round(item.score * 100000) / 100000,
    label: ['STRONGEST MOMENT', 'SECOND CUT', 'THIRD CUT'][index],
    format: '9:16',
    renderMode: ['wave', 'bars', 'ring'][index] as ClipJob['renderMode'],
  }));
}

export async function analyzeAudio(audioUrl: string, durationHint?: number | null) {
  const sandbox = await createMediaSandbox();
  try {
    await ensureFfmpeg(sandbox);
    await download(sandbox, audioUrl, 'input.audio');

    let durationSec = durationHint || 0;
    if (!durationSec) {
      const probe = await sandbox.runCommand('./ffprobe', [
        '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', 'input.audio',
      ]);
      if (probe.exitCode === 0) durationSec = Number.parseFloat((await probe.stdout()).trim());
    }
    if (!Number.isFinite(durationSec) || durationSec <= 0) throw new Error('Could not determine audio duration');

    const decode = await sandbox.runCommand('./ffmpeg', [
      '-y', '-i', 'input.audio', '-vn', '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 'f32le', 'analysis.f32',
    ]);
    if (decode.exitCode !== 0) throw new Error(`Audio analysis decode failed: ${await decode.stderr()}`);
    const pcm = await sandbox.readFileToBuffer({ path: 'analysis.f32' });
    if (!pcm) throw new Error('Audio analysis output missing');

    return { durationSec, clips: chooseWindows(pcm, durationSec) };
  } finally {
    await sandbox.stop();
  }
}

export async function renderClips(input: {
  releaseId: string;
  audioUrl: string;
  artworkUrl: string;
  clips: ClipJob[];
}): Promise<ClipJob[]> {
  const sandbox = await createMediaSandbox();
  try {
    await ensureFfmpeg(sandbox);
    await Promise.all([
      download(sandbox, input.audioUrl, 'track.audio'),
      download(sandbox, input.artworkUrl, 'cover.jpg'),
    ]);

    const rendered: ClipJob[] = [];
    for (const clip of input.clips) {
      const outputName = `${clip.id}.mp4`;
      const filter = [
        "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.00035,1.045)':d=1:s=1080x1920:fps=30,format=yuv420p[bg]",
        '[1:a]asplit=2[aout][awave]',
        '[awave]showwaves=s=900x220:mode=line:colors=white@0.72:rate=30,format=rgba[wave]',
        '[bg][wave]overlay=(W-w)/2:H-h-180[v]',
      ].join(';');

      const command = await sandbox.runCommand('./ffmpeg', [
        '-y',
        '-loop', '1', '-i', 'cover.jpg',
        '-ss', String(clip.start), '-t', String(clip.duration), '-i', 'track.audio',
        '-filter_complex', filter,
        '-map', '[v]', '-map', '[aout]',
        '-t', String(clip.duration),
        '-r', '30',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21',
        '-c:a', 'aac', '-b:a', '192k',
        '-movflags', '+faststart',
        outputName,
      ]);
      if (command.exitCode !== 0) throw new Error(`Render failed for ${clip.id}: ${await command.stderr()}`);

      const video = await sandbox.readFileToBuffer({ path: outputName });
      if (!video) throw new Error(`Rendered file missing for ${clip.id}`);
      const blob = await put(`gloomcake-agent/releases/${input.releaseId}/clips/${outputName}`, video, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'video/mp4',
      });
      rendered.push({ ...clip, videoUrl: blob.url });
    }
    return rendered;
  } finally {
    await sandbox.stop();
  }
}

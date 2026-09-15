import { list, put } from '@vercel/blob';
import type { ReleasePatch, ReleaseRecord } from './types';

const PREFIX = 'gloomcake-agent/releases/';

function pathname(id: string) {
  return `${PREFIX}${id}.json`;
}

function cacheBusted(url: string) {
  const join = url.includes('?') ? '&' : '?';
  return `${url}${join}v=${Date.now()}`;
}

export async function saveRelease(release: ReleaseRecord): Promise<ReleaseRecord> {
  release.updatedAt = new Date().toISOString();
  await put(pathname(release.id), JSON.stringify(release, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
  return release;
}

export async function getRelease(id: string): Promise<ReleaseRecord | null> {
  const result = await list({ prefix: pathname(id), limit: 1 });
  const blob = result.blobs.find((item) => item.pathname === pathname(id));
  if (!blob) return null;
  const response = await fetch(cacheBusted(blob.url), { cache: 'no-store' });
  if (!response.ok) return null;
  return (await response.json()) as ReleaseRecord;
}

export async function patchRelease(id: string, patch: ReleasePatch): Promise<ReleaseRecord | null> {
  const current = await getRelease(id);
  if (!current) return null;
  const next: ReleaseRecord = {
    ...current,
    ...patch,
    approvals: patch.approvals ? { ...current.approvals, ...patch.approvals } : current.approvals,
    publish: patch.publish ? { ...current.publish, ...patch.publish } : current.publish,
    updatedAt: new Date().toISOString(),
  };
  return saveRelease(next);
}

export async function listReleases(limit = 40): Promise<ReleaseRecord[]> {
  const result = await list({ prefix: PREFIX, limit });
  const records = await Promise.all(
    result.blobs
      .filter((blob) => blob.pathname.endsWith('.json'))
      .map(async (blob) => {
        try {
          const response = await fetch(cacheBusted(blob.url), { cache: 'no-store' });
          if (!response.ok) return null;
          return (await response.json()) as ReleaseRecord;
        } catch {
          return null;
        }
      }),
  );
  return records
    .filter((record): record is ReleaseRecord => Boolean(record))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { listReleases, saveRelease } from '../../../lib/agent/store';
import type { ReleaseRecord } from '../../../lib/agent/types';
import { prepareReleaseWorkflow } from '../../../workflows/process-release';

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'release';
}

export async function GET() {
  const releases = await listReleases();
  return NextResponse.json({ ok: true, releases });
}

export async function POST(request: Request) {
  const body = await request.json() as {
    trackTitle?: string;
    catalog?: string;
    audioUrl?: string;
    lyrics?: string;
    durationSec?: number;
  };

  if (!body.trackTitle?.trim() || !body.catalog?.trim() || !body.audioUrl?.trim()) {
    return NextResponse.json({ ok: false, error: 'trackTitle, catalog, and audioUrl are required' }, { status: 400 });
  }

  const id = `${slug(body.trackTitle)}-${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const release: ReleaseRecord = {
    id,
    version: 1,
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    trackTitle: body.trackTitle.trim(),
    catalog: body.catalog.trim().toUpperCase(),
    lyrics: body.lyrics?.trim() || undefined,
    durationSec: body.durationSec || null,
    audioUrl: body.audioUrl,
    creative: null,
    artOnlyUrl: null,
    brandedArtworkUrl: null,
    clips: [],
    social: null,
    approvals: {},
    publish: {},
    error: null,
  };

  await saveRelease(release);
  const run = await start(prepareReleaseWorkflow, [id]);
  return NextResponse.json({ ok: true, releaseId: id, runId: run.runId, release }, { status: 202 });
}

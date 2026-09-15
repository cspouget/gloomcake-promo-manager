import { NextResponse } from 'next/server';
import { getRelease, patchRelease } from '../../../../lib/agent/store';
import type { ReleasePatch } from '../../../../lib/agent/types';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const release = await getRelease(id);
  if (!release) return NextResponse.json({ ok: false, error: 'Release not found' }, { status: 404 });
  return NextResponse.json({ ok: true, release });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const allowed: ReleasePatch = {};
  if (typeof body.lyrics === 'string') allowed.lyrics = body.lyrics;
  if (body.social && typeof body.social === 'object') allowed.social = body.social;
  if (Array.isArray(body.clips)) allowed.clips = body.clips;
  if (typeof body.artOnlyUrl === 'string') {
    allowed.artOnlyUrl = body.artOnlyUrl;
    allowed.brandedArtworkUrl = null;
    allowed.approvals = { artworkApprovedAt: null, campaignApprovedAt: null, publishApprovedAt: null };
    allowed.status = 'awaiting-artwork-approval';
    allowed.error = null;
  }
  const release = await patchRelease(id, allowed);
  if (!release) return NextResponse.json({ ok: false, error: 'Release not found' }, { status: 404 });
  return NextResponse.json({ ok: true, release });
}

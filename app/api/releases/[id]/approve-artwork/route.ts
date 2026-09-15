import { NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { getRelease, patchRelease } from '../../../../../lib/agent/store';
import { finishReleaseWorkflow } from '../../../../../workflows/process-release';

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const current = await getRelease(id);
  if (!current) return NextResponse.json({ ok: false, error: 'Release not found' }, { status: 404 });
  if (!current.artOnlyUrl) return NextResponse.json({ ok: false, error: 'There is no artwork to approve' }, { status: 409 });

  const approvedAt = new Date().toISOString();
  const release = await patchRelease(id, {
    approvals: { artworkApprovedAt: approvedAt },
    status: 'branding',
    error: null,
  });
  const run = await start(finishReleaseWorkflow, [id]);
  return NextResponse.json({ ok: true, release, runId: run.runId }, { status: 202 });
}

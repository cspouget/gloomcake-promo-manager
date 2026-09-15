import { NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { getRelease, patchRelease } from '../../../../../lib/agent/store';
import { publishReleaseWorkflow } from '../../../../../workflows/publish-release';

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const current = await getRelease(id);
  if (!current) return NextResponse.json({ ok: false, error: 'Release not found' }, { status: 404 });
  if (current.status !== 'awaiting-campaign-approval') {
    return NextResponse.json({ ok: false, error: `Campaign is not ready for approval (status: ${current.status})` }, { status: 409 });
  }
  if (!current.clips.length || current.clips.some((clip) => !clip.videoUrl)) {
    return NextResponse.json({ ok: false, error: 'Rendered campaign clips are incomplete' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const release = await patchRelease(id, {
    approvals: { campaignApprovedAt: now, publishApprovedAt: now },
    status: 'approved-for-publishing',
    error: null,
  });
  const run = await start(publishReleaseWorkflow, [id]);
  return NextResponse.json({ ok: true, release, runId: run.runId }, { status: 202 });
}

import { NextResponse } from 'next/server';
import { generateArtOnly } from '../../../../../lib/agent/creative';
import { getRelease, patchRelease } from '../../../../../lib/agent/store';

export const maxDuration = 120;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const release = await getRelease(id);
  if (!release) return NextResponse.json({ ok: false, error: 'Release not found' }, { status: 404 });
  if (!release.creative) return NextResponse.json({ ok: false, error: 'Creative direction is missing' }, { status: 409 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY is not configured' }, { status: 503 });

  const body = await request.json().catch(() => ({})) as { feedback?: string };
  const feedback = body.feedback?.trim();
  const prompt = `${release.creative.artworkPrompt}\n\nThe previous image was rejected. Create a SUBSTANTIALLY DIFFERENT visual interpretation while preserving the GloomCake taste system. Do not reuse the previous composition or obvious motif.${feedback ? `\nSpecific feedback: ${feedback}` : ''}`;
  const artOnlyUrl = await generateArtOnly(id, prompt);
  const updated = await patchRelease(id, {
    artOnlyUrl,
    brandedArtworkUrl: null,
    approvals: { artworkApprovedAt: null, campaignApprovedAt: null, publishApprovedAt: null },
    status: 'awaiting-artwork-approval',
    error: null,
  });
  return NextResponse.json({ ok: true, release: updated });
}

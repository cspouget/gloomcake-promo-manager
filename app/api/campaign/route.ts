import { NextRequest, NextResponse } from 'next/server';

type CampaignInput = {
  trackTitle?: string;
  catalog?: string;
  audioFilename?: string;
  durationSec?: number;
  lyrics?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CampaignInput;
  const trackTitle = body.trackTitle?.trim();
  const catalog = body.catalog?.trim();

  if (!trackTitle || !catalog) {
    return NextResponse.json({ ok: false, error: 'trackTitle and catalog are required' }, { status: 400 });
  }

  const hookPhrase = body.lyrics?.match(/Who else but me\??/i)?.[0] || trackTitle;

  return NextResponse.json({
    ok: true,
    campaign: {
      trackTitle,
      catalog,
      audioFilename: body.audioFilename || null,
      durationSec: body.durationSec || null,
      status: 'awaiting-agent-services',
      stages: [
        { id: 'ingest', status: body.audioFilename ? 'ready' : 'needs_audio' },
        { id: 'audio-analysis', status: 'not-connected' },
        { id: 'artwork', status: 'not-connected' },
        { id: 'clip-selection', status: 'not-connected' },
        { id: 'visualizer-render', status: 'browser-ready' },
        { id: 'social-copy', status: 'ready', seed: hookPhrase },
        { id: 'approval', status: 'pending' },
        { id: 'metricool-scheduling', status: 'not-connected' },
      ],
    },
  });
}

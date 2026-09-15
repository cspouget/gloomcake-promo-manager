import { NextRequest, NextResponse } from 'next/server';

type ClipWindow = { start: number; duration: number; score?: number; label?: string };
type CampaignInput = {
  trackTitle?: string;
  catalog?: string;
  audioFilename?: string;
  durationSec?: number;
  lyrics?: string;
  windows?: ClipWindow[];
};

function copyFor(title: string, catalog: string, lyrics = '') {
  const hook = lyrics.match(/who else but me\??/i)?.[0] || title;
  return {
    tiktok: `${hook}.\n\n${title} — GloomCake\n${catalog}\n\n#GloomCake #ExperimentalHipHop #BassMusic #UndergroundMusic`,
    instagram: `${title} — GloomCake\n${catalog}\n\nWeird original. Slightly difficult.\n\n#GloomCake #ExperimentalHipHop #ExperimentalBass #UndergroundMusic`,
    youtube: `${title} — GloomCake (${catalog})\n\nExperimental hip-hop / bass from GloomCake.\n\n#GloomCake #ExperimentalHipHop #BassMusic`,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CampaignInput;
  const trackTitle = body.trackTitle?.trim();
  const catalog = body.catalog?.trim();
  if (!trackTitle || !catalog) {
    return NextResponse.json({ ok: false, error: 'trackTitle and catalog are required' }, { status: 400 });
  }

  const windows = (body.windows || []).slice(0, 3).map((w, i) => ({
    id: `clip-${i + 1}`,
    start: Math.max(0, Number(w.start.toFixed(2))),
    duration: Math.min(30, Math.max(8, Number(w.duration.toFixed(2)))),
    score: w.score ?? null,
    label: w.label || ['Primary Hook', 'Energy Lift', 'Final Pressure'][i] || `Clip ${i + 1}`,
    format: '9:16',
    renderMode: ['ring', 'wave', 'bars'][i] || 'wave',
  }));

  return NextResponse.json({
    ok: true,
    campaign: {
      trackTitle,
      catalog,
      audioFilename: body.audioFilename || null,
      durationSec: body.durationSec || null,
      status: windows.length ? 'ready-for-approval' : 'needs-audio-analysis',
      clips: windows,
      social: copyFor(trackTitle, catalog, body.lyrics || ''),
      stages: [
        { id: 'ingest', status: body.audioFilename ? 'ready' : 'needs_audio' },
        { id: 'audio-analysis', status: windows.length ? 'ready' : 'needs_analysis' },
        { id: 'artwork', status: 'approval_required' },
        { id: 'clip-selection', status: windows.length ? 'ready' : 'needs_analysis' },
        { id: 'visualizer-render', status: windows.length ? 'ready' : 'waiting' },
        { id: 'social-copy', status: 'ready' },
        { id: 'approval', status: 'pending' },
        { id: 'metricool-scheduling', status: 'export_ready' },
      ],
    },
  });
}

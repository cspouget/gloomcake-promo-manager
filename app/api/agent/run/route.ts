import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { GLOOMCAKE_VISUAL_BRAND } from '../../../../lib/agent/brand';

type AgentRequest = {
  trackTitle: string;
  catalog: string;
  lyrics?: string;
  durationSec?: number;
  audioUrl?: string;
  referenceImageUrls?: string[];
  clipWindows?: Array<{ start: number; duration: number; score?: number; label?: string }>;
};

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function fallbackWindows(duration = 180) {
  const starts = [0.18, 0.48, 0.78].map((p) => Math.max(0, Math.min(duration - 16, duration * p)));
  return starts.map((start, i) => ({
    id: `clip-${i + 1}`,
    start: Math.round(start * 10) / 10,
    duration: 16,
    label: ['HOOK', 'BUILD / DROP', 'FINAL PRESSURE'][i],
    format: '9:16',
    renderMode: ['wave', 'bars', 'ring'][i],
  }));
}

export async function POST(req: Request) {
  const body = (await req.json()) as AgentRequest;
  if (!body.trackTitle?.trim() || !body.catalog?.trim()) {
    return NextResponse.json({ ok: false, error: 'trackTitle and catalog are required' }, { status: 400 });
  }

  const clips = (body.clipWindows?.length ? body.clipWindows : fallbackWindows(body.durationSec)).slice(0, 3).map((c, i) => ({
    id: `clip-${i + 1}`,
    start: c.start,
    duration: c.duration || 16,
    score: c.score ?? null,
    label: c.label || ['HOOK', 'BUILD / DROP', 'FINAL PRESSURE'][i],
    format: '9:16',
    renderMode: ['wave', 'bars', 'ring'][i] as 'wave' | 'bars' | 'ring',
  }));

  let creative = {
    emotionalCore: 'identity, absurd confidence, self-awareness and instability held together by humor',
    concepts: [
      'An ordinary object behaving physically impossible in a beautiful mundane environment.',
      'A tactile editorial still life where one familiar material appears to possess a private inner life.',
      'A quiet public space containing one impossible but non-threatening visual contradiction.'
    ],
    rejectedConcept: 2,
    selectedConcept: 1,
    artworkPrompt: `${GLOOMCAKE_VISUAL_BRAND}\n\nCreate ART ONLY for ${body.trackTitle}. No text, logos, catalog numbers, mirrors, masks, portals or generic cyberpunk.`,
    socialAngle: 'weird original / nobody like me',
  };

  if (openai) {
    const response = await openai.responses.create({
      model: 'gpt-5.6-terra',
      input: [
        {
          role: 'system',
          content: `${GLOOMCAKE_VISUAL_BRAND}\n\nYou are the release creative director. Return strict JSON only.`
        },
        {
          role: 'user',
          content: `TRACK: ${body.trackTitle}\nCATALOG: ${body.catalog}\nDURATION: ${body.durationSec ?? 'unknown'}\nLYRICS:\n${body.lyrics || '(none supplied)'}\n\nReturn JSON with emotionalCore, concepts (exactly 3 one-sentence concepts), rejectedConcept (0-based index), selectedConcept (0-based index, cannot equal rejectedConcept), artworkPrompt (art only; explicitly no text/logo/catalog), socialAngle.`
        }
      ],
      text: { format: { type: 'json_object' } }
    });
    try {
      creative = JSON.parse(response.output_text);
    } catch {}
  }

  let artwork: { status: string; imageBase64?: string; prompt: string } = {
    status: openai ? 'ready-to-generate' : 'needs-openai-key',
    prompt: creative.artworkPrompt,
  };

  if (openai && process.env.GENERATE_ARTWORK_ON_RUN === 'true') {
    const image = await openai.images.generate({
      model: 'gpt-image-2',
      prompt: creative.artworkPrompt,
      size: '1024x1024',
      quality: 'high',
    });
    const b64 = image.data?.[0]?.b64_json;
    if (b64) artwork = { status: 'generated-awaiting-approval', imageBase64: b64, prompt: creative.artworkPrompt };
  }

  const baseCaption = `${body.trackTitle}\n\n${creative.socialAngle}\n\n#GloomCake #ExperimentalHipHop #UndergroundHipHop #ExperimentalBass`;

  return NextResponse.json({
    ok: true,
    agent: 'gloomcake-release-agent',
    version: '0.2',
    release: {
      trackTitle: body.trackTitle,
      catalog: body.catalog,
      audioUrl: body.audioUrl || null,
      durationSec: body.durationSec || null,
    },
    creative,
    artwork,
    clips,
    social: {
      tiktok: baseCaption,
      instagram: baseCaption,
      youtubeShort: `${body.trackTitle} — GloomCake | ${body.catalog}`,
      soundcloud: `Experimental hip-hop dragged through huge low-end, hollow space and warped bass.\n\n${body.catalog} — GloomCake`,
    },
    approval: {
      requiredBeforeBranding: true,
      requiredBeforePublishing: true,
      status: 'awaiting-artwork-approval',
    },
    nextActions: [
      'approve-artwork',
      'composite-exact-logo-title-catalog',
      'render-selected-clips',
      'approve-social-package',
      'schedule-through-metricool',
      'collect-analytics-and-iterate'
    ],
  });
}

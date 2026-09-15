import OpenAI from 'openai';
import { put } from '@vercel/blob';
import { GLOOMCAKE_VISUAL_BRAND } from './brand';
import type { CreativeDirection } from './types';

function client() {
  return process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
}

export function fallbackCreative(trackTitle: string): CreativeDirection {
  return {
    emotionalCore: 'self-recognition, unstable confidence, humor and intimacy held together by strange calm',
    concepts: [
      'An ordinary object behaving physically impossible in a beautiful mundane environment.',
      'A tactile editorial still life where one familiar material appears to possess a private inner life.',
      'A quiet public space containing one impossible but non-threatening visual contradiction.',
    ],
    rejectedConcept: 2,
    selectedConcept: 1,
    artworkPrompt: `${GLOOMCAKE_VISUAL_BRAND}\n\nTRACK: ${trackTitle}\nCreate ONE square album artwork concept only. No text, logo, catalog number, fake typography, mirrors, masks, portals, generic cyberpunk, generic gothic horror, or literal title illustration. Make the image feel tactile, photographed, restrained, strange and emotionally ambiguous.`,
    socialAngle: 'weird original / nobody like me',
  };
}

export async function developCreative(input: {
  trackTitle: string;
  catalog: string;
  lyrics?: string;
  durationSec?: number | null;
  performanceLearnings?: string;
}): Promise<CreativeDirection> {
  const openai = client();
  if (!openai) return fallbackCreative(input.trackTitle);

  const response = await openai.responses.create({
    model: 'gpt-5.6-terra',
    reasoning: { effort: 'medium' },
    input: [
      {
        role: 'system',
        content: `${GLOOMCAKE_VISUAL_BRAND}\n\nYou are the GloomCake release creative director. You MUST develop three radically different visual concepts, explicitly reject the most predictable one, and choose one of the other two. Artwork is generated without typography or branding. Prior performance signals may influence strategic judgment but must NEVER cause repeated subjects, compositions, motifs, portals, masks, mirrors, faces, color schemes, or literal remakes. Return JSON only.`,
      },
      {
        role: 'user',
        content: `TRACK: ${input.trackTitle}\nCATALOG: ${input.catalog}\nDURATION: ${input.durationSec ?? 'unknown'} seconds\nLYRICS:\n${input.lyrics || '(none supplied)'}\n\nPERFORMANCE LEARNINGS:\n${input.performanceLearnings || 'No historical campaign data yet.'}\n\nReturn an object with exactly these fields: emotionalCore (string), concepts (array of exactly 3 one-sentence concepts), rejectedConcept (0-based integer), selectedConcept (0-based integer, different from rejectedConcept), artworkPrompt (detailed image prompt that explicitly forbids text/logo/catalog), socialAngle (short phrase).`,
      },
    ],
    text: { format: { type: 'json_object' } },
  });

  try {
    const parsed = JSON.parse(response.output_text) as CreativeDirection;
    if (!Array.isArray(parsed.concepts) || parsed.concepts.length !== 3) throw new Error('Invalid concepts');
    if (parsed.selectedConcept === parsed.rejectedConcept) throw new Error('Selected rejected concept');
    if (![0, 1, 2].includes(parsed.selectedConcept) || ![0, 1, 2].includes(parsed.rejectedConcept)) throw new Error('Invalid concept index');
    parsed.artworkPrompt = `${parsed.artworkPrompt}\n\nHARD OUTPUT RULE: ART ONLY. Absolutely no title, words, lettering, logo, GloomCake name, catalog number, watermark, label copy, UI, border text, fake brand marks, or signatures.`;
    return parsed;
  } catch {
    return fallbackCreative(input.trackTitle);
  }
}

export async function generateArtOnly(releaseId: string, prompt: string): Promise<string> {
  const openai = client();
  if (!openai) throw new Error('OPENAI_API_KEY is not configured');

  const result = await openai.images.generate({
    model: 'gpt-image-2.5-sunburst',
    prompt,
    size: '1024x1024',
    quality: 'high',
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error('Image generation returned no image data');

  const image = Buffer.from(b64, 'base64');
  const blob = await put(`gloomcake-agent/releases/${releaseId}/art/art-only.png`, image, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'image/png',
  });
  return blob.url;
}

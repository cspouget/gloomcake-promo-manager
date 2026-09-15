import { analyzeAudio, renderClips } from '../lib/agent/media';
import { buildPerformanceLearnings } from '../lib/agent/analytics';
import { brandApprovedArtwork } from '../lib/agent/branding';
import { developCreative, generateArtOnly } from '../lib/agent/creative';
import { buildSocialPackage } from '../lib/agent/social';
import { getRelease, listReleases, patchRelease } from '../lib/agent/store';

export async function prepareReleaseWorkflow(releaseId: string) {
  'use workflow';

  await analyzeReleaseStep(releaseId);
  await creativeDirectionStep(releaseId);
  return { releaseId, status: 'awaiting-artwork-approval' };
}

export async function finishReleaseWorkflow(releaseId: string) {
  'use workflow';

  await brandArtworkStep(releaseId);
  await renderPromoClipsStep(releaseId);
  await finalizeCampaignStep(releaseId);
  return { releaseId, status: 'awaiting-campaign-approval' };
}

async function analyzeReleaseStep(releaseId: string) {
  'use step';

  const release = await getRelease(releaseId);
  if (!release) throw new Error('Release not found');
  await patchRelease(releaseId, { status: 'analyzing-audio', error: null });
  const analysis = await analyzeAudio(release.audioUrl, release.durationSec);
  await patchRelease(releaseId, {
    durationSec: analysis.durationSec,
    clips: analysis.clips,
  });
  return analysis;
}

async function creativeDirectionStep(releaseId: string) {
  'use step';

  const release = await getRelease(releaseId);
  if (!release) throw new Error('Release not found');
  await patchRelease(releaseId, { status: 'creative-directing', error: null });

  const priorReleases = await listReleases(30);
  const performanceLearnings = buildPerformanceLearnings(priorReleases.filter((item) => item.id !== releaseId));
  const creative = await developCreative({
    trackTitle: release.trackTitle,
    catalog: release.catalog,
    lyrics: release.lyrics,
    durationSec: release.durationSec,
    performanceLearnings,
  });
  const social = buildSocialPackage({
    trackTitle: release.trackTitle,
    catalog: release.catalog,
    socialAngle: creative.socialAngle,
  });

  if (!process.env.OPENAI_API_KEY) {
    await patchRelease(releaseId, {
      creative,
      social,
      status: 'blocked',
      error: 'OPENAI_API_KEY is required for autonomous artwork generation',
    });
    throw new Error('OPENAI_API_KEY is required for autonomous artwork generation');
  }

  const artOnlyUrl = await generateArtOnly(releaseId, creative.artworkPrompt);
  await patchRelease(releaseId, {
    creative,
    social,
    artOnlyUrl,
    status: 'awaiting-artwork-approval',
    error: null,
  });
  return { artOnlyUrl, creative };
}

async function brandArtworkStep(releaseId: string) {
  'use step';

  const release = await getRelease(releaseId);
  if (!release) throw new Error('Release not found');
  if (!release.approvals.artworkApprovedAt) throw new Error('Artwork has not been approved');
  if (!release.artOnlyUrl) throw new Error('Approved artwork is missing');

  await patchRelease(releaseId, { status: 'branding', error: null });
  const brandedArtworkUrl = await brandApprovedArtwork({
    releaseId,
    artOnlyUrl: release.artOnlyUrl,
    trackTitle: release.trackTitle,
    catalog: release.catalog,
  });
  await patchRelease(releaseId, { brandedArtworkUrl });
  return brandedArtworkUrl;
}

async function renderPromoClipsStep(releaseId: string) {
  'use step';

  const release = await getRelease(releaseId);
  if (!release) throw new Error('Release not found');
  if (!release.brandedArtworkUrl) throw new Error('Branded artwork is missing');
  if (!release.clips.length) throw new Error('No promo clip windows were selected');

  await patchRelease(releaseId, { status: 'rendering', error: null });
  const clips = await renderClips({
    releaseId,
    audioUrl: release.audioUrl,
    artworkUrl: release.brandedArtworkUrl,
    clips: release.clips,
  });
  await patchRelease(releaseId, { clips });
  return clips;
}

async function finalizeCampaignStep(releaseId: string) {
  'use step';

  const release = await getRelease(releaseId);
  if (!release) throw new Error('Release not found');
  const allRendered = release.clips.length > 0 && release.clips.every((clip) => Boolean(clip.videoUrl));
  if (!allRendered) throw new Error('Campaign clips are incomplete');
  await patchRelease(releaseId, {
    status: 'awaiting-campaign-approval',
    error: null,
  });
  return true;
}

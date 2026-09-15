import type { ReleaseRecord } from './types';

const BASE = 'https://app.metricool.com/api/v2/scheduler/posts';

function config() {
  const token = process.env.METRICOOL_API_TOKEN;
  const userId = process.env.METRICOOL_USER_ID || '5303244';
  const blogId = process.env.METRICOOL_BLOG_ID || '6885961';
  const timezone = process.env.METRICOOL_TIMEZONE || 'America/New_York';
  if (!token) throw new Error('METRICOOL_API_TOKEN is not configured');
  return { token, userId, blogId, timezone };
}

function localDate(dayOffset: number, hour: number, timezone: string) {
  const d = new Date(Date.now() + dayOffset * 86_400_000);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}T${String(hour).padStart(2, '0')}:00:00`;
}

async function scheduleOne(body: Record<string, unknown>) {
  const { token, userId, blogId } = config();
  const response = await fetch(`${BASE}?blogId=${encodeURIComponent(blogId)}&userId=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Mc-Auth': token,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch {}
  if (!response.ok) throw new Error(`Metricool scheduling failed (${response.status}): ${text.slice(0, 800)}`);
  return parsed;
}

export async function scheduleRelease(release: ReleaseRecord) {
  const { timezone } = config();
  const videos = release.clips.filter((clip) => clip.videoUrl);
  if (!videos.length) throw new Error('No rendered videos are available');
  if (!release.social) throw new Error('Social package is missing');

  const created: unknown[] = [];
  const tiktokHours = [10, 18, 12];
  const youtubeHours = [16, 16, 16];

  for (let i = 0; i < videos.length; i++) {
    const clip = videos[i];
    const dayOffset = i + 1;

    created.push(await scheduleOne({
      publicationDate: { dateTime: localDate(dayOffset, tiktokHours[i] || 10, timezone), timezone },
      text: release.social.tiktok,
      providers: [{ network: 'tiktok' }],
      media: [clip.videoUrl],
      saveExternalMediaFiles: true,
      autoPublish: true,
      draft: false,
      shortener: false,
      tiktokData: {
        disableComment: false,
        disableDuet: false,
        disableStitch: false,
        privacyOption: 'PUBLIC_TO_EVERYONE',
        commercialContentThirdParty: false,
        commercialContentOwnBrand: false,
        title: release.trackTitle,
        autoAddMusic: false,
        isAigc: true,
      },
    }));

    created.push(await scheduleOne({
      publicationDate: { dateTime: localDate(dayOffset, youtubeHours[i] || 16, timezone), timezone },
      text: release.social.youtubeShortDescription,
      providers: [{ network: 'youtube' }],
      media: [clip.videoUrl],
      saveExternalMediaFiles: true,
      autoPublish: true,
      draft: false,
      shortener: false,
      youtubeData: {
        title: release.social.youtubeShortTitle,
        type: 'short',
        privacy: 'public',
        madeForKids: false,
        isAiGeneratedContent: true,
        category: 'MUSIC',
        tags: ['GloomCake', 'experimental hip hop', 'experimental bass', release.trackTitle],
      },
    }));
  }

  return { timezone, created };
}

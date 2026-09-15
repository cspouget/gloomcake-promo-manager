import type { ReleaseRecord } from './types';

const API = 'https://app.metricool.com/api';
const POSTS = `${API}/v2/scheduler/posts`;

type BestTimesResponse = {
  data?: Array<{
    dayOfWeek?: number;
    bestTimesByHour?: Array<{ hourOfDay?: number; value?: number }>;
  }>;
};

type PostingSlot = {
  dateTime: string;
  timezone: string;
  score: number;
};

function config() {
  const token = process.env.METRICOOL_API_TOKEN;
  const userId = process.env.METRICOOL_USER_ID || '5303244';
  const blogId = process.env.METRICOOL_BLOG_ID || '6885961';
  const timezone = process.env.METRICOOL_TIMEZONE || 'America/New_York';
  if (!token) throw new Error('METRICOOL_API_TOKEN is not configured');
  return { token, userId, blogId, timezone };
}

function localDateParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isoDayOfWeek(year: number, month: number, day: number) {
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return ((jsDay + 6) % 7) + 1;
}

function futureCalendarDays(timezone: string, count = 9) {
  const today = localDateParts(new Date(), timezone);
  const base = Date.UTC(today.year, today.month - 1, today.day);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(base + (index + 1) * 86_400_000);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    return { year, month, day, key: dateKey(year, month, day), dayOfWeek: isoDayOfWeek(year, month, day) };
  });
}

async function getBestPostingSlots(provider: 'tiktok' | 'youtube', count: number): Promise<PostingSlot[]> {
  const { token, userId, blogId, timezone } = config();
  const days = futureCalendarDays(timezone, 9);
  const start = `${days[0].key}T00:00:00`;
  const end = `${days[days.length - 1].key}T23:59:59`;
  const params = new URLSearchParams({ userId, blogId, start, end, timezone });

  try {
    const response = await fetch(`${API}/v2/scheduler/besttimes/${provider}?${params.toString()}`, {
      headers: { 'X-Mc-Auth': token },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Best-times request returned ${response.status}`);
    const payload = await response.json() as BestTimesResponse;
    const byDay = new Map<number, Array<{ hour: number; score: number }>>();
    for (const row of payload.data || []) {
      if (!row.dayOfWeek) continue;
      const hours = (row.bestTimesByHour || [])
        .filter((item) => Number.isInteger(item.hourOfDay) && typeof item.value === 'number')
        .map((item) => ({ hour: item.hourOfDay as number, score: item.value as number }));
      byDay.set(row.dayOfWeek, hours);
    }

    const candidates: PostingSlot[] = [];
    for (const day of days) {
      for (const hour of byDay.get(day.dayOfWeek) || []) {
        candidates.push({
          dateTime: `${day.key}T${String(hour.hour).padStart(2, '0')}:00:00`,
          timezone,
          score: hour.score,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const chosen: PostingSlot[] = [];
    const usedDates = new Set<string>();
    for (const slot of candidates) {
      const day = slot.dateTime.slice(0, 10);
      if (usedDates.has(day)) continue;
      chosen.push(slot);
      usedDates.add(day);
      if (chosen.length >= count) break;
    }
    if (chosen.length >= count) return chosen;
  } catch {
    // Fall through to conservative known-good defaults if best-times is temporarily unavailable.
  }

  const defaults = provider === 'tiktok' ? [10, 18, 12] : [16, 16, 16];
  return days.slice(0, count).map((day, index) => ({
    dateTime: `${day.key}T${String(defaults[index] ?? defaults[0]).padStart(2, '0')}:00:00`,
    timezone,
    score: 0,
  }));
}

async function scheduleOne(body: Record<string, unknown>) {
  const { token, userId, blogId } = config();
  const response = await fetch(`${POSTS}?blogId=${encodeURIComponent(blogId)}&userId=${encodeURIComponent(userId)}`, {
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

  const [tiktokSlots, youtubeSlots] = await Promise.all([
    getBestPostingSlots('tiktok', videos.length),
    getBestPostingSlots('youtube', videos.length),
  ]);
  const created: unknown[] = [];

  for (let i = 0; i < videos.length; i++) {
    const clip = videos[i];
    const tiktokSlot = tiktokSlots[i];
    const youtubeSlot = youtubeSlots[i];

    created.push(await scheduleOne({
      publicationDate: { dateTime: tiktokSlot.dateTime, timezone },
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
      publicationDate: { dateTime: youtubeSlot.dateTime, timezone },
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

  return { timezone, tiktokSlots, youtubeSlots, created };
}

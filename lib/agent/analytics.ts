import type { ReleaseAnalytics, ReleaseRecord } from './types';

function metricoolConfig() {
  const token = process.env.METRICOOL_API_TOKEN;
  const userId = process.env.METRICOOL_USER_ID || '5303244';
  const blogId = process.env.METRICOOL_BLOG_ID || '6885961';
  const timezone = process.env.METRICOOL_TIMEZONE || 'America/New_York';
  if (!token) throw new Error('METRICOOL_API_TOKEN is not configured');
  return { token, userId, blogId, timezone };
}

function localIso(value: Date) {
  return value.toISOString().slice(0, 19);
}

function findPostArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const object = value as Record<string, unknown>;
  for (const key of ['data', 'posts', 'items', 'value', 'result']) {
    if (Array.isArray(object[key])) return object[key] as unknown[];
  }
  for (const child of Object.values(object)) {
    const nested = findPostArray(child);
    if (nested.length) return nested;
  }
  return [];
}

function numericMetric(object: Record<string, unknown>, names: string[]) {
  for (const [key, value] of Object.entries(object)) {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, '');
    if (names.includes(normalized) && typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}

function scorePost(post: unknown) {
  if (!post || typeof post !== 'object') return 0;
  const object = post as Record<string, unknown>;
  const views = numericMetric(object, ['views', 'view', 'videoviews', 'plays', 'playcount', 'impressions', 'reach']);
  const likes = numericMetric(object, ['likes', 'likecount']);
  const comments = numericMetric(object, ['comments', 'commentcount']);
  const shares = numericMetric(object, ['shares', 'sharecount']);
  const saves = numericMetric(object, ['saves', 'saved', 'favorites', 'favourites']);
  const clicks = numericMetric(object, ['clicks', 'linkclicks']);
  return views + likes * 8 + comments * 18 + shares * 28 + saves * 24 + clicks * 16;
}

export async function fetchReleaseAnalytics(release: ReleaseRecord): Promise<ReleaseAnalytics> {
  const { token, userId, blogId, timezone } = metricoolConfig();
  const anchor = release.publish?.scheduledAt ? new Date(release.publish.scheduledAt) : new Date(release.createdAt);
  const from = new Date(anchor.getTime() - 24 * 60 * 60 * 1000);
  const to = new Date();
  const params = new URLSearchParams({
    userId,
    blogId,
    from: localIso(from),
    to: localIso(to),
    timezone,
  });
  const response = await fetch(`https://app.metricool.com/api/v2/analytics/brand-summary/posts?${params.toString()}`, {
    headers: { 'X-Mc-Auth': token, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  const text = await response.text();
  let raw: unknown = text;
  try { raw = JSON.parse(text); } catch {}
  if (!response.ok) throw new Error(`Metricool analytics failed (${response.status}): ${text.slice(0, 600)}`);

  const posts = findPostArray(raw);
  const score = posts.reduce((total, post) => total + scorePost(post), 0);
  return {
    syncedAt: new Date().toISOString(),
    from: from.toISOString(),
    to: to.toISOString(),
    postCount: posts.length,
    score: Math.round(score),
    raw,
  };
}

export function buildPerformanceLearnings(releases: ReleaseRecord[]) {
  const measured = releases
    .filter((release) => release.analytics?.score && release.creative)
    .sort((a, b) => (b.analytics?.score || 0) - (a.analytics?.score || 0))
    .slice(0, 5);

  if (!measured.length) return 'No prior campaign performance data is available yet. Do not invent performance conclusions.';

  return [
    'Prior GloomCake campaign signals. Treat these as weak evidence, not rules; do not repeat subjects or compositions merely because a release performed well:',
    ...measured.map((release, index) => {
      const clipPositions = release.durationSec
        ? release.clips.map((clip) => `${Math.round((clip.start / release.durationSec!) * 100)}%`).join(', ')
        : 'unknown';
      return `${index + 1}. ${release.trackTitle} (${release.catalog}) — campaign score ${release.analytics?.score}; emotional core: ${release.creative?.emotionalCore}; social angle: ${release.creative?.socialAngle}; chosen clip positions: ${clipPositions}.`;
    }),
  ].join('\n');
}

import { NextResponse } from 'next/server';
import { fetchReleaseAnalytics } from '../../../../lib/agent/analytics';
import { listReleases, patchRelease } from '../../../../lib/agent/store';

export const maxDuration = 120;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (!process.env.METRICOOL_API_TOKEN) {
    return NextResponse.json({ ok: false, error: 'METRICOOL_API_TOKEN is not configured' }, { status: 503 });
  }

  const releases = (await listReleases(60)).filter((release) => ['scheduled', 'published'].includes(release.status));
  const results: Array<{ id: string; ok: boolean; postCount?: number; score?: number | null; error?: string }> = [];

  for (const release of releases) {
    try {
      const analytics = await fetchReleaseAnalytics(release);
      await patchRelease(release.id, { analytics });
      results.push({ id: release.id, ok: true, postCount: analytics.postCount, score: analytics.score });
    } catch (error) {
      results.push({ id: release.id, ok: false, error: error instanceof Error ? error.message : 'Analytics sync failed' });
    }
  }

  return NextResponse.json({ ok: true, syncedAt: new Date().toISOString(), results });
}

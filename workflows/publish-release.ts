import { getRelease, patchRelease } from '../lib/agent/store';
import { scheduleRelease } from '../lib/agent/metricool';

export async function publishReleaseWorkflow(releaseId: string) {
  'use workflow';

  const result = await scheduleMetricoolStep(releaseId);
  return { releaseId, status: 'scheduled', result };
}

async function scheduleMetricoolStep(releaseId: string) {
  'use step';

  const release = await getRelease(releaseId);
  if (!release) throw new Error('Release not found');
  if (!release.approvals.campaignApprovedAt || !release.approvals.publishApprovedAt) {
    throw new Error('Campaign has not been approved for publishing');
  }

  try {
    const scheduled = await scheduleRelease(release);
    const ids = scheduled.created.flatMap((item: any) => {
      const candidates = [item?.id, item?.uuid, item?.data?.id, item?.data?.uuid].filter(Boolean);
      return candidates.map(String);
    });
    await patchRelease(releaseId, {
      status: 'scheduled',
      publish: {
        metricoolBrandId: process.env.METRICOOL_BLOG_ID || '6885961',
        scheduledPostIds: ids,
        scheduledAt: new Date().toISOString(),
      },
      error: null,
    });
    return scheduled;
  } catch (error) {
    await patchRelease(releaseId, {
      status: 'blocked',
      error: error instanceof Error ? error.message : 'Metricool scheduling failed',
    });
    throw error;
  }
}

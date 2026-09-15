import { list, put } from '@vercel/blob';

const SETTINGS_PATH = 'gloomcake-agent/system/settings.json';

export type AgentSettings = {
  logoUrl?: string | null;
  updatedAt?: string;
};

export async function getAgentSettings(): Promise<AgentSettings> {
  const result = await list({ prefix: SETTINGS_PATH, limit: 1 });
  const blob = result.blobs.find((item) => item.pathname === SETTINGS_PATH);
  if (!blob) return {};
  try {
    const join = blob.url.includes('?') ? '&' : '?';
    const response = await fetch(`${blob.url}${join}v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return {};
    return (await response.json()) as AgentSettings;
  } catch {
    return {};
  }
}

export async function saveAgentSettings(patch: AgentSettings): Promise<AgentSettings> {
  const current = await getAgentSettings();
  const next: AgentSettings = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await put(SETTINGS_PATH, JSON.stringify(next, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
  return next;
}

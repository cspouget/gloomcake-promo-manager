import { createHash, timingSafeEqual } from 'node:crypto';

export const AGENT_SESSION_COOKIE = 'gc_agent_session';

export function configuredAccessKey() {
  return process.env.AGENT_ACCESS_KEY || '';
}

export function sessionTokenForKey(key: string) {
  return createHash('sha256').update(`${key}:gloomcake-release-agent-session:v1`).digest('hex');
}

export function expectedSessionToken() {
  const key = configuredAccessKey();
  return key ? sessionTokenForKey(key) : '';
}

export function accessKeyMatches(candidate: string) {
  const expected = configuredAccessKey();
  if (!expected || !candidate) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(candidate);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionTokenMatches(candidate?: string | null) {
  const expected = expectedSessionToken();
  if (!expected || !candidate || candidate.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
}

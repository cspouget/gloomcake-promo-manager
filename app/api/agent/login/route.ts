import { NextResponse } from 'next/server';
import { accessKeyMatches, AGENT_SESSION_COOKIE, configuredAccessKey, sessionTokenForKey } from '../../../../lib/agent/auth';

export async function POST(request: Request) {
  if (!configuredAccessKey()) {
    return NextResponse.json({ ok: false, error: 'AGENT_ACCESS_KEY is not configured on this deployment' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({})) as { accessKey?: string };
  if (!body.accessKey || !accessKeyMatches(body.accessKey)) {
    return NextResponse.json({ ok: false, error: 'Invalid access key' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AGENT_SESSION_COOKIE,
    value: sessionTokenForKey(body.accessKey),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: AGENT_SESSION_COOKIE, value: '', path: '/', maxAge: 0 });
  return response;
}

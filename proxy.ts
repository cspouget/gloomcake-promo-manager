import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const COOKIE = 'gc_agent_session';

function expectedToken() {
  const key = process.env.AGENT_ACCESS_KEY || '';
  return key ? createHash('sha256').update(`${key}:gloomcake-release-agent-session:v1`).digest('hex') : '';
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/agent/login') return NextResponse.next();

  const expected = expectedToken();
  if (!expected) {
    if (process.env.VERCEL_ENV === 'production') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ ok: false, error: 'Release Agent security is not configured. Set AGENT_ACCESS_KEY in Vercel.' }, { status: 503 });
      }
      return new NextResponse('Release Agent setup required: configure AGENT_ACCESS_KEY in Vercel.', { status: 503 });
    }
    return NextResponse.next();
  }

  const session = request.cookies.get(COOKIE)?.value;
  if (session === expected) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
  }

  const login = new URL('/agent/login', request.url);
  login.searchParams.set('next', pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    '/agent/:path*',
    '/api/releases/:path*',
    '/api/agent/settings/:path*',
    '/api/agent/run/:path*',
    '/api/campaign/:path*',
  ],
};

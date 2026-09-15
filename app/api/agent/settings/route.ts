import { NextResponse } from 'next/server';
import { getAgentSettings, saveAgentSettings } from '../../../../lib/agent/settings';

export async function GET() {
  const settings = await getAgentSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(request: Request) {
  const body = await request.json() as { logoUrl?: string | null };
  const patch: { logoUrl?: string | null } = {};
  if (body.logoUrl === null) patch.logoUrl = null;
  if (typeof body.logoUrl === 'string') {
    const url = new URL(body.logoUrl);
    if (url.protocol !== 'https:') {
      return NextResponse.json({ ok: false, error: 'Logo URL must use HTTPS' }, { status: 400 });
    }
    patch.logoUrl = url.toString();
  }
  const settings = await saveAgentSettings(patch);
  return NextResponse.json({ ok: true, settings });
}

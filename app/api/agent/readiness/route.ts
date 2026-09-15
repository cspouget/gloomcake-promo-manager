import { existsSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getAgentSettings } from '../../../../lib/agent/settings';

export async function GET() {
  const bundledLogo = existsSync(path.join(process.cwd(), 'public', 'GloomCake_Official_Logo_MASTER_TRANSPARENT.png'));
  let configuredLogo = false;
  try {
    const settings = await getAgentSettings();
    configuredLogo = Boolean(settings.logoUrl);
  } catch {
    configuredLogo = false;
  }

  const checks = {
    security: {
      ready: Boolean(process.env.AGENT_ACCESS_KEY),
      label: 'Private Release Agent access lock',
      required: 'AGENT_ACCESS_KEY',
    },
    openai: {
      ready: Boolean(process.env.OPENAI_API_KEY),
      label: 'OpenAI creative direction + artwork generation',
      required: 'OPENAI_API_KEY',
    },
    blob: {
      ready: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      label: 'Vercel Blob media + persistent release state',
      required: 'Connect a Vercel Blob store',
    },
    logo: {
      ready: bundledLogo || configuredLogo || Boolean(process.env.GLOOMCAKE_LOGO_URL),
      label: 'Exact approved GloomCake logo',
      required: 'Upload the official logo once in Release Agent system setup',
    },
    metricool: {
      ready: Boolean(process.env.METRICOOL_API_TOKEN),
      label: 'Autonomous TikTok + YouTube scheduling and analytics',
      required: 'METRICOOL_API_TOKEN',
    },
    sandbox: {
      ready: Boolean(process.env.VERCEL_ENV),
      label: 'Vercel Sandbox audio analysis + video rendering',
      required: 'Deploy this project on Vercel',
    },
  };

  const ready = Object.values(checks).every((check) => check.ready);
  return NextResponse.json({
    ok: true,
    ready,
    checks,
    defaults: {
      metricoolUserId: process.env.METRICOOL_USER_ID || '5303244',
      metricoolBlogId: process.env.METRICOOL_BLOG_ID || '6885961',
      timezone: process.env.METRICOOL_TIMEZONE || 'America/New_York',
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    },
  });
}

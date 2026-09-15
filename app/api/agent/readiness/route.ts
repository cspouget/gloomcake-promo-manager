import { existsSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

export async function GET() {
  const bundledLogo = existsSync(path.join(process.cwd(), 'public', 'GloomCake_Official_Logo_MASTER_TRANSPARENT.png'));
  const checks = {
    openai: {
      ready: Boolean(process.env.OPENAI_API_KEY),
      label: 'OpenAI creative + artwork generation',
      requiredEnv: 'OPENAI_API_KEY',
    },
    blob: {
      ready: Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_ENV),
      label: 'Vercel Blob media + release persistence',
      requiredEnv: 'Connected Vercel Blob store',
    },
    logo: {
      ready: bundledLogo || Boolean(process.env.GLOOMCAKE_LOGO_URL),
      label: 'Exact approved GloomCake logo',
      requiredEnv: bundledLogo ? null : 'GLOOMCAKE_LOGO_URL',
    },
    metricool: {
      ready: Boolean(process.env.METRICOOL_API_TOKEN),
      label: 'Autonomous TikTok + YouTube scheduling',
      requiredEnv: 'METRICOOL_API_TOKEN',
    },
    sandbox: {
      ready: Boolean(process.env.VERCEL_ENV),
      label: 'Vercel Sandbox audio analysis + rendering',
      requiredEnv: 'Deploy on Vercel',
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
    },
  });
}

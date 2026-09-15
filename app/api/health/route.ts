import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'gloomcake-promo-manager',
    version: '0.2.0',
    capabilities: {
      visualizer: true,
      campaignOrchestrator: true,
      audioAnalysis: false,
      artworkGeneration: false,
      socialScheduling: false,
    },
    timestamp: new Date().toISOString(),
  });
}

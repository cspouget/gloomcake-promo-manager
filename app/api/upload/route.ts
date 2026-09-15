import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: [
          'audio/wav',
          'audio/x-wav',
          'audio/mpeg',
          'audio/mp4',
          'audio/flac',
          'image/png',
          'image/jpeg',
          'image/webp',
          'video/webm',
          'video/mp4',
        ],
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ pathname, purpose: 'gloomcake-release-agent' }),
      }),
      onUploadCompleted: async () => {
        // Agent job creation is intentionally separate so an upload can be retried safely.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 },
    );
  }
}

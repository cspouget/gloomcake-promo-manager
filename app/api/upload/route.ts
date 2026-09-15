import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith('gloomcake-agent/incoming/')) {
          throw new Error('Invalid upload path');
        }
        return {
          allowedContentTypes: [
            'audio/wav',
            'audio/x-wav',
            'audio/mpeg',
            'audio/mp4',
            'audio/x-m4a',
            'audio/flac',
            'image/png',
            'image/jpeg',
            'image/webp',
            'video/webm',
            'video/mp4',
            'video/quicktime',
          ],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ pathname, purpose: 'gloomcake-release-agent' }),
        };
      },
      onUploadCompleted: async () => {
        // The release is created explicitly after upload, so retries remain idempotent.
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

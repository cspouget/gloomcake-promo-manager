import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AGENT_SESSION_COOKIE, configuredAccessKey, sessionTokenMatches } from '../../../lib/agent/auth';

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  const bodyType = (body as unknown as { type?: string }).type || '';

  // Vercel Blob calls this same endpoint after upload completion. Only the browser's
  // client-token request requires the private agent session; the signed completion
  // callback remains available to the Blob service itself.
  if (bodyType !== 'blob.upload-completed') {
    const key = configuredAccessKey();
    if (!key && process.env.VERCEL_ENV === 'production') {
      return NextResponse.json({ ok: false, error: 'AGENT_ACCESS_KEY is not configured' }, { status: 503 });
    }
    if (key) {
      const cookieStore = await cookies();
      const session = cookieStore.get(AGENT_SESSION_COOKIE)?.value;
      if (!sessionTokenMatches(session)) {
        return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
      }
    }
  }

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

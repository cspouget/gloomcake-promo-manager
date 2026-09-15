import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { put } from '@vercel/blob';
import { getAgentSettings } from './settings';

function esc(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c] || c));
}

async function loadOfficialLogo(): Promise<Buffer> {
  const localPath = path.join(process.cwd(), 'public', 'GloomCake_Official_Logo_MASTER_TRANSPARENT.png');
  try {
    return await readFile(localPath);
  } catch {
    const settings = await getAgentSettings();
    const logoUrl = settings.logoUrl || process.env.GLOOMCAKE_LOGO_URL;
    if (!logoUrl) {
      throw new Error('Official GloomCake logo is not configured. Upload it once in Release Agent system setup.');
    }
    const response = await fetch(logoUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not download the configured official GloomCake logo');
    return Buffer.from(await response.arrayBuffer());
  }
}

export async function brandApprovedArtwork(input: {
  releaseId: string;
  artOnlyUrl: string;
  trackTitle: string;
  catalog: string;
}): Promise<string> {
  const artResponse = await fetch(input.artOnlyUrl, { cache: 'no-store' });
  if (!artResponse.ok) throw new Error('Could not download approved artwork');
  const artBuffer = Buffer.from(await artResponse.arrayBuffer());

  const logoBuffer = await loadOfficialLogo();
  const logo = await sharp(logoBuffer)
    .resize({ width: 360, height: 360, fit: 'contain', withoutEnlargement: true })
    .png()
    .toBuffer();

  const title = esc(input.trackTitle.toUpperCase());
  const catalog = esc(input.catalog.toUpperCase());
  const svg = Buffer.from(`
    <svg width="3000" height="3000" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur"/>
          <feOffset dy="6" result="offset"/>
          <feComponentTransfer><feFuncA type="linear" slope="0.65"/></feComponentTransfer>
          <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <text x="165" y="2770" font-family="Arial, Helvetica, sans-serif" font-size="132" font-weight="700" letter-spacing="4" fill="#f3f2ec" filter="url(#shadow)">${title}</text>
      <text x="2835" y="205" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="66" font-weight="500" letter-spacing="8" fill="#f3f2ec" filter="url(#shadow)">${catalog}</text>
    </svg>
  `);

  const output = await sharp(artBuffer)
    .resize(3000, 3000, { fit: 'cover' })
    .composite([
      { input: svg, top: 0, left: 0 },
      { input: logo, top: 3000 - 165 - 360, left: 3000 - 165 - 360 },
    ])
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
    .toBuffer();

  const blob = await put(`gloomcake-agent/releases/${input.releaseId}/art/official-cover.jpg`, output, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'image/jpeg',
  });
  return blob.url;
}

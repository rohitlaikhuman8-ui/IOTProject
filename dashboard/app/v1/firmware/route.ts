import { createHash } from 'node:crypto';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const releases = 'https://github.com/rohitlaikhuman8-ui/IOTProject/releases/download';
const maxImage = 1310720;
const version = z.string().regex(/^[a-f0-9]{40}$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const image = z.object({ version, sha256, size: z.coerce.number().int().min(1).max(maxImage) });
const manifest = image.extend({ board: z.literal('esp32dev'), storageSchema: z.literal(2), url: z.string().url() });

function imageUrl(commit: string) {
  return `${releases}/fleet-${commit}/esp32dev-${commit}.bin`;
}

async function readBounded(response: Response, maximum: number) {
  if (!response.ok || !response.body || Number(response.headers.get('content-length')) > maximum) {
    await response.body?.cancel();
    throw new Error('Upstream response rejected');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) throw new Error('Upstream response too large');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length);
}

// Firmware is public, like its GitHub source/assets. This is a fixed repository
// origin, not an arbitrary URL proxy. Device ingestion remains authenticated.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const binary = url.searchParams.has('version');
  const parsed = binary ? image.safeParse(Object.fromEntries(url.searchParams)) : null;
  if (parsed && !parsed.success) return Response.json({ error: 'invalid image reference' }, { status: 400 });
  try {
    if (parsed?.success) {
      const ref = parsed.data;
      const response = await fetch(imageUrl(ref.version), { cache: 'no-store', signal: AbortSignal.timeout(25000) });
      const bytes = await readBounded(response, ref.size);
      if (bytes.length !== ref.size || createHash('sha256').update(bytes).digest('hex') !== ref.sha256) {
        throw new Error('Image validation failed');
      }
      return new Response(new Uint8Array(bytes), { headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(bytes.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Vercel-CDN-Cache-Control': 'public, s-maxage=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      } });
    }
    // Bound redirect-cache staleness without using GitHub's rate-limited API.
    const upstream = `${releases}/firmware-latest/manifest.json?poll=${Math.floor(Date.now() / 60000)}`;
    const response = await fetch(upstream, { cache: 'no-store', signal: AbortSignal.timeout(25000) });
    const data = manifest.parse(JSON.parse((await readBounded(response, 2048)).toString('utf8')));
    if (data.url !== imageUrl(data.version)) throw new Error('Unexpected release origin');
    const target = new URL('/v1/firmware', url.origin);
    target.search = new URLSearchParams({ version: data.version, sha256: data.sha256, size: String(data.size) }).toString();
    return Response.json({ ...data, url: target.toString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'firmware origin temporarily unavailable' }, {
      status: 502, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' },
    });
  }
}

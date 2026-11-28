import { z } from 'zod';
import { authenticated } from '../../../../lib/session';
import { exportJobAuthenticated, exportSnapshot } from '../../../../lib/exports';
import { exportBackups } from '../../../../lib/fleet';
import { dayBounds, istDate } from '../../../../lib/export-format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!await authenticated()) return Response.json({ error: 'sign in required' }, { status: 401 });
  try {
    const backups = await exportBackups().find().sort({ verifiedAt: -1 }).limit(14).toArray();
    return Response.json({ configured: Boolean(process.env.EXPORT_JOB_SECRET), backups },
      { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('Backup status unavailable', (error as Error).name);
    return Response.json({ error: 'backup status unavailable' }, { status: 503 });
  }
}
const receipt = z.object({ date: z.string(), snapshot: z.string().datetime(),
  rows: z.number().int().min(0).max(1000000), bytes: z.number().int().min(1).max(50000000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), fileId: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/) }).strict();
export async function POST(request: Request) {
  if (!exportJobAuthenticated(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (Number(request.headers.get('content-length')) > 2048) return Response.json({ error: 'invalid length' }, { status: 413 });
  const parsed = receipt.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid receipt' }, { status: 400 });
  try {
    dayBounds(parsed.data.date); exportSnapshot(parsed.data.snapshot);
    if (parsed.data.date >= istDate()) throw new Error();
  } catch { return Response.json({ error: 'invalid date or snapshot' }, { status: 400 }); }
  try {
    await exportBackups().updateOne({ _id: parsed.data.date }, { $set: { ...parsed.data, verifiedAt: new Date() } }, { upsert: true });
    return Response.json({ accepted: true });
  } catch (error) {
    console.error('Backup receipt unavailable', (error as Error).name);
    return Response.json({ error: 'backup receipt temporarily unavailable' }, { status: 503 });
  }
}

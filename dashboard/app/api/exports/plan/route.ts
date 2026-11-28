import { events, exportBackups } from '../../../../lib/fleet';
import { exportJobAuthenticated, exportSnapshot } from '../../../../lib/exports';
import { istDate } from '../../../../lib/export-format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!exportJobAuthenticated(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  let since: Date;
  try {
    since = new Date(new URL(request.url).searchParams.get('since') || Date.now() - 7 * 86400000);
    if (!Number.isFinite(+since) || +since > Date.now() || since.getUTCFullYear() < 2020) throw new Error();
  } catch { return Response.json({ error: 'invalid since timestamp' }, { status: 400 }); }
  try {
    const snapshot = exportSnapshot(null);
    const today = istDate(snapshot);
    const changed = await events().aggregate<{ _id: string }>([
      { $match: { receivedAt: { $gte: since, $lte: snapshot } } },
      { $group: { _id: { $dateToString: { date: { $cond: [{ $gt: ['$sampledAt', 0] },
        { $toDate: { $multiply: ['$sampledAt', 1000] } }, '$receivedAt'] }, format: '%Y-%m-%d', timezone: 'Asia/Kolkata' } } } },
      { $match: { _id: { $lt: today } } }, { $sort: { _id: 1 } }, { $limit: 201 },
    ], { maxTimeMS: 45000 }).toArray();
    if (changed.length > 200) return Response.json({ error: 'backfill exceeds 200 days; use a narrower since window' }, { status: 422 });
    // Yesterday is always considered: today's receipts may be absent from the
    // changed-day set on the next run after its watermark has advanced.
    const yesterday = istDate(new Date(today + 'T00:00:00+05:30').getTime() - 1);
    const prior = await exportBackups().findOne({ _id: yesterday });
    const yesterdayComplete = prior && prior.snapshot >= new Date(today + 'T00:00:00+05:30').toISOString();
    const dates = [...new Set([...changed.map(row => row._id), ...(yesterdayComplete ? [] : [yesterday])])].sort();
    return Response.json({ snapshot: snapshot.toISOString(), dates, since: since.toISOString(), timezone: 'Asia/Kolkata' },
      { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('Export plan unavailable', (error as Error).name);
    return Response.json({ error: 'export plan temporarily unavailable' }, { status: 503 });
  }
}

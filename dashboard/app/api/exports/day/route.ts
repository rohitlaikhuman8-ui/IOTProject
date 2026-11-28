import { events, nodeId } from '../../../../lib/fleet';
import { exportAuthenticated, exportCursor, exportFilter, exportSnapshot } from '../../../../lib/exports';
import { CSV_HEADER, recordCsv } from '../../../../lib/export-format';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!await exportAuthenticated(request)) return Response.json({ error: 'sign in required' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  let date: string, node: string, snapshot: Date, cursor: ReturnType<typeof exportCursor>;
  let filter: ReturnType<typeof exportFilter>;
  try {
    date = params.get('date') || '';
    node = params.get('node') || '';
    if (node) nodeId.parse(node);
    snapshot = exportSnapshot(params.get('snapshot'));
    filter = exportFilter(date, snapshot, node);
    cursor = exportCursor(params.get('cursor'), date, snapshot.toISOString(), node);
  } catch {
    return Response.json({ error: 'invalid date, node, snapshot or cursor' }, { status: 400 });
  }
  try {
    const paged = cursor ? { $and: [filter, { $or: [
      { receivedAt: { $gt: new Date(cursor.at) } },
      { receivedAt: new Date(cursor.at), _id: { $gt: cursor.id } },
    ] }] } : filter;
    const [records, total] = await Promise.all([
      events().find(paged).sort({ receivedAt: 1, _id: 1 }).limit(1001).maxTimeMS(45000).toArray(),
      cursor ? Promise.resolve(undefined) : events().countDocuments(filter, { maxTimeMS: 45000 }),
    ]);
    const more = records.length > 1000;
    const page = records.slice(0, 1000);
    const last = page.at(-1);
    const nextCursor = more && last ? Buffer.from(JSON.stringify({ at: last.receivedAt.toISOString(),
      id: last._id, date, snapshot: snapshot.toISOString(), node })).toString('base64url') : null;
    return Response.json({ date, node, snapshot: snapshot.toISOString(), header: CSV_HEADER,
      csv: page.map(recordCsv).join(''), rows: page.length, total, nextCursor,
      filename: `sensor-data-${date}${node ? '-' + node : ''}.csv` },
    { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('Daily export unavailable', (error as Error).name);
    return Response.json({ error: 'export temporarily unavailable; retry without saving partial data' }, { status: 503 });
  }
}

import { event, events, secretMatches } from '../../../lib/fleet';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  const length = Number(request.headers.get('content-length'));
  if (!Number.isInteger(length) || length < 1 || length > 1024) {
    return Response.json({ error: 'invalid length' }, { status: 413 });
  }
  const data = event.safeParse(await request.json().catch(() => null));
  if (!data.success) return Response.json({ error: 'invalid telemetry' }, { status: 400 });
  try {
    const keys = JSON.parse(process.env.NODE_SECRETS_JSON || '{}');
    const auth = request.headers.get('authorization') || '';
    if (!auth.startsWith('Bearer ') || !secretMatches(keys?.[data.data.nodeId], auth.slice(7))) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }
    const _id = data.data.nodeId + ':' + data.data.eventId;
    try {
      await events().updateOne({ _id }, { $setOnInsert: { ...data.data, receivedAt: new Date() } },
        { upsert: true, writeConcern: { w: 'majority' } });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
    return Response.json({ accepted: true });
  } catch (error) {
    console.error('Telemetry unavailable', (error as Error).name);
    return Response.json({ error: 'temporarily unavailable' }, { status: 503, headers: { 'Retry-After': '15' } });
  }
}

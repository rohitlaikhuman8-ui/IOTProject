import { heartbeat, nodes, nodeSecrets, secretMatches } from '../../../lib/fleet';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  const length = Number(request.headers.get('content-length'));
  if (!Number.isInteger(length) || length < 1 || length > 2048) {
    return Response.json({ error: 'invalid length' }, { status: 413 });
  }
  const parsed = heartbeat.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid heartbeat' }, { status: 400 });
  try {
    const keys = nodeSecrets();
    const auth = request.headers.get('authorization') || '';
    if (!auth.startsWith('Bearer ') || !secretMatches(keys[parsed.data.nodeId], auth.slice(7))) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }
    const data = parsed.data;
    data.neighbors = [...new Set(data.neighbors)].filter(id => id !== data.nodeId && id in keys);
    try {
      await nodes().updateOne({ _id: data.nodeId },
        { $set: { ...data, lastSeen: new Date() } }, { upsert: true, writeConcern: { w: 'majority' } });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
    return Response.json({ accepted: true });
  } catch (error) {
    console.error('Heartbeat unavailable', (error as Error).name);
    return Response.json({ error: 'temporarily unavailable' }, { status: 503 });
  }
}

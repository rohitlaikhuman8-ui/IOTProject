import { heartbeat, nodes, notifications, nodeSecrets, secretMatches, ONLINE_TIMEOUT_MS } from '../../../lib/fleet';

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
    const now = new Date();
    let previous;
    try {
      previous = await nodes().findOneAndUpdate({ _id: data.nodeId },
        { $set: { ...data, lastSeen: now } }, { upsert: true, returnDocument: 'before', writeConcern: { w: 'majority' } });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
    if (data.bootId) {
      await notifications().updateOne({ _id: data.nodeId + ':boot:' + data.bootId }, { $setOnInsert: {
        nodeId: data.nodeId, kind: 'startup', at: now, message: 'Node started and reached the cloud',
      } }, { upsert: true });
    }
    const previousSeen = Math.max(previous?.lastSeen?.getTime() || 0, previous?.lastMeasurementAt?.getTime() || 0);
    if (previousSeen && now.getTime() - previousSeen > ONLINE_TIMEOUT_MS) {
      // Preserve the outage even when nobody had the dashboard open.
      await notifications().updateOne({ _id: data.nodeId + ':offline:' + previousSeen }, { $setOnInsert: {
        nodeId: data.nodeId, kind: 'offline', at: new Date(previousSeen + ONLINE_TIMEOUT_MS),
        message: 'No cloud report received before the presence timeout',
      } }, { upsert: true });
    }
    if (!previous || now.getTime() - previousSeen > ONLINE_TIMEOUT_MS) {
      const session = data.bootId || String(Math.floor(now.getTime() / ONLINE_TIMEOUT_MS));
      await notifications().updateOne({ _id: data.nodeId + ':online:' + session + ':' + (previous?.lastSeen?.getTime() || 0) },
        { $setOnInsert: { nodeId: data.nodeId, kind: 'online', at: now, message: 'Cloud reporting connected or resumed' } }, { upsert: true });
    }
    return Response.json({ accepted: true, serverTime: now.getTime(), timezone: 'Asia/Kolkata' });
  } catch (error) {
    console.error('Heartbeat unavailable', (error as Error).name);
    return Response.json({ error: 'temporarily unavailable' }, { status: 503 });
  }
}

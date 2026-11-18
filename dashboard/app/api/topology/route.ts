import { authenticated } from '../../../lib/session';
import { nodes, notifications, events, nodeSecrets, nodeId, ONLINE_TIMEOUT_MS } from '../../../lib/fleet';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!await authenticated()) return Response.json({ error: 'sign in required' }, { status: 401 });
  try {
    const registered = Object.keys(nodeSecrets());
    const selected = nodeId.safeParse(new URL(request.url).searchParams.get('node'));
    const historyNodes = selected.success ? registered.filter(id => id === selected.data) : registered;
    const states = await nodes().find({ _id: { $in: registered } }).toArray();
    const now = Date.now();
    for (const state of states) {
      const seen = Math.max(state.lastSeen?.getTime() || 0, state.lastMeasurementAt?.getTime() || 0);
      if (seen && now - seen > ONLINE_TIMEOUT_MS) {
        await notifications().updateOne({ _id: state._id + ':offline:' + seen }, { $setOnInsert: {
          nodeId: state._id, kind: 'offline', at: new Date(seen + ONLINE_TIMEOUT_MS),
          message: 'No cloud report received before the presence timeout',
        } }, { upsert: true });
      }
    }
    const [history, recent] = await Promise.all([
      notifications().find({ nodeId: { $in: historyNodes } }).sort({ at: -1 }).limit(100).toArray(),
      events().find({ nodeId: { $in: historyNodes } }).sort({ receivedAt: -1 }).limit(100).toArray(),
    ]);
    const indexed = new Map(states.map(state => [state._id, state]));
    return Response.json({
      serverTime: now,
      onlineTimeoutMs: ONLINE_TIMEOUT_MS,
      notifications: history,
      events: recent,
      nodes: registered.map(id => {
        const state = indexed.get(id);
        if (!state) return { nodeId: id, lastSeen: null };
        const seen = Math.max(state.lastSeen?.getTime() || 0, state.lastMeasurementAt?.getTime() || 0);
        return { ...state, lastSeen: seen ? new Date(seen).toISOString() : null };
      }),
    }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('Topology unavailable', (error as Error).name);
    return Response.json({ error: 'temporarily unavailable' }, { status: 503 });
  }
}

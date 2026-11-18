import { authenticated } from '../../../lib/session';
import { nodes, nodeSecrets } from '../../../lib/fleet';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  if (!await authenticated()) return Response.json({ error: 'sign in required' }, { status: 401 });
  try {
    const registered = Object.keys(nodeSecrets());
    const states = await nodes().find({ _id: { $in: registered } }).toArray();
    const indexed = new Map(states.map(state => [state._id, state]));
    return Response.json({
      serverTime: Date.now(),
      nodes: registered.map(id => {
        const state = indexed.get(id);
        return state ? { ...state, lastSeen: state.lastSeen.toISOString() } : { nodeId: id, lastSeen: null };
      }),
    }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    console.error('Topology unavailable', (error as Error).name);
    return Response.json({ error: 'temporarily unavailable' }, { status: 503 });
  }
}

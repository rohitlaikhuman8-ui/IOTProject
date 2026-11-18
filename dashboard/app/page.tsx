import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHmac, randomBytes } from 'node:crypto';
import { events, nodeId, secretMatches } from '../lib/fleet';

export const dynamic = 'force-dynamic';

function signature(payload: string) {
  return createHmac('sha256', process.env.DASHBOARD_PASSWORD || '').update(payload).digest('hex');
}

async function signIn(form: FormData) {
  'use server';
  if (!secretMatches(process.env.DASHBOARD_PASSWORD, String(form.get('password') || ''))) {
    redirect('/?error=1');
  }
  const expires = Date.now() + 8 * 60 * 60 * 1000;
  const payload = expires + '.' + randomBytes(16).toString('hex');
  (await cookies()).set('fleet_session', payload + '.' + signature(payload), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
    path: '/', maxAge: 8 * 60 * 60,
  });
  redirect('/');
}

async function signOut() {
  'use server';
  (await cookies()).delete('fleet_session');
  redirect('/');
}

export default async function Page({ searchParams }: { searchParams: Promise<{ node?: string; error?: string }> }) {
  const { node, error } = await searchParams;
  const token = (await cookies()).get('fleet_session')?.value || '';
  const [expires, nonce, mac] = token.split('.');
  if (!process.env.DASHBOARD_PASSWORD || !nonce || !(Number(expires) > Date.now()) ||
      !secretMatches(signature(expires + '.' + nonce), mac)) {
    return <main><h1>ESP32 fleet</h1><form action={signIn}>
      <label>Dashboard password <input name="password" type="password" required /></label>{' '}
      <button>Sign in</button>{error && <p role="alert">Password rejected.</p>}
    </form></main>;
  }
  const selected = nodeId.safeParse(node);
  const db = events();
  const [nodes, rows] = await Promise.all([
    db.aggregate<{ _id: string; lastSeen: Date; value: number; version: string; count: number }>([
      { $sort: { receivedAt: -1 } },
      { $group: { _id: '$nodeId', lastSeen: { $first: '$receivedAt' },
        value: { $first: '$value' }, version: { $first: '$version' }, count: { $sum: 1 } } },
      { $sort: { lastSeen: -1 } }, { $limit: 200 },
    ]).toArray(),
    db.find(selected.success ? { nodeId: selected.data } : {}).sort({ receivedAt: -1 }).limit(100).toArray(),
  ]);
  const date = (value: Date) => value.toISOString().replace('T', ' ').slice(0, 19);
  return <main>
    <form action={signOut}><button>Sign out</button></form>
    <h1>ESP32 fleet</h1>
    <h2>Nodes</h2>
    <table cellPadding="8"><thead><tr><th>Node</th><th>Last upload (UTC)</th><th>Value</th><th>Firmware</th><th>Samples</th></tr></thead>
      <tbody>{nodes.map(n => <tr key={n._id}><td><a href={'/?node=' + n._id}>{n._id}</a></td>
        <td>{date(n.lastSeen)}</td><td>{n.value}</td><td>{n.version.slice(0, 12)}</td><td>{n.count}</td></tr>)}</tbody></table>
    {!nodes.length && <p>No nodes have uploaded telemetry yet.</p>}
    <h2>{selected.success ? selected.data : 'Recent telemetry'}</h2>
    {selected.success && <a href="/">Show all nodes</a>}
    <table cellPadding="8"><thead><tr><th>Received (UTC)</th><th>Sampled (UTC)</th><th>Node</th><th>Value</th><th>Uptime (ms)</th><th>Reset code</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row._id}><td>{date(row.receivedAt)}</td>
        <td>{row.sampledAt ? date(new Date(row.sampledAt * 1000)) : 'Unavailable'}</td>
        <td>{row.nodeId}</td><td>{row.value}</td><td>{row.uptimeMs}</td><td>{row.resetReason}</td></tr>)}</tbody></table>
  </main>;
}

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomBytes } from 'node:crypto';
import { nodeId, nodeSecrets, secretMatches } from '../lib/fleet';
import { signature, authenticated } from '../lib/session';
import Topology from './topology';
import DailyExports from './daily-exports';
import { istDate } from '../lib/export-format';

export const dynamic = 'force-dynamic';

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
  if (!await authenticated()) {
    return <main><h1>ESP32 fleet</h1><form action={signIn}>
      <label>Dashboard password <input name="password" type="password" required /></label>{' '}
      <button>Sign in</button>{error && <p role="alert">Password rejected.</p>}
    </form></main>;
  }
  const selected = nodeId.safeParse(node);
  return <main>
    <form action={signOut}><button>Sign out</button></form>
    <h1>ESP32 fleet</h1>
    <DailyExports today={istDate()} yesterday={istDate(new Date(istDate() + 'T00:00:00+05:30').getTime() - 1)}
      nodeIds={Object.keys(nodeSecrets())} selectedNode={selected.success ? selected.data : undefined} />
    <Topology selectedNode={selected.success ? selected.data : undefined} />
  </main>;
}

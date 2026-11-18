import { cookies } from 'next/headers';
import { createHmac } from 'node:crypto';
import { secretMatches } from './fleet';

export function signature(payload: string) {
  return createHmac('sha256', process.env.DASHBOARD_PASSWORD || '').update(payload).digest('hex');
}

export async function authenticated() {
  const token = (await cookies()).get('fleet_session')?.value || '';
  const [expires, nonce, mac] = token.split('.');
  return Boolean(process.env.DASHBOARD_PASSWORD && nonce && Number(expires) > Date.now() &&
    secretMatches(signature(expires + '.' + nonce), mac));
}

import { Filter } from 'mongodb';
import { z } from 'zod';
import { authenticated } from './session';
import { secretMatches, TelemetryRecord } from './fleet';
import { dayBounds, istDate } from './export-format';

export function exportJobAuthenticated(request: Request) {
  const auth = request.headers.get('authorization') || '';
  return auth.startsWith('Bearer ') && secretMatches(process.env.EXPORT_JOB_SECRET, auth.slice(7));
}
export async function exportAuthenticated(request: Request) {
  return exportJobAuthenticated(request) || await authenticated();
}
export function exportSnapshot(value: string | null) {
  const date = value ? new Date(value) : new Date(Date.now() - 10000);
  if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now() || date.getFullYear() < 2020) throw new Error('invalid snapshot');
  return date;
}
export function exportFilter(date: string, snapshot: Date, node?: string): Filter<TelemetryRecord> {
  const { start, end } = dayBounds(date);
  if (date > istDate()) throw new Error('future date');
  return {
    ...(node ? { nodeId: node } : {}), receivedAt: { $lte: snapshot },
    $or: [
      { sampledAt: { $gte: start.getTime() / 1000, $lt: end.getTime() / 1000 } },
      { sampledAt: { $exists: false }, receivedAt: { $gte: start, $lt: end, $lte: snapshot } },
    ],
  };
}
const cursorSchema = z.object({ at: z.string().datetime(), id: z.string().regex(/^esp32-[a-f0-9]{12}:[a-f0-9]{32}$/),
  date: z.string(), snapshot: z.string(), node: z.string() }).strict();
export function exportCursor(value: string | null, date: string, snapshot: string, node: string) {
  if (!value) return undefined;
  if (value.length > 700) throw new Error('invalid cursor');
  const cursor = cursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString()));
  if (cursor.date !== date || cursor.snapshot !== snapshot || cursor.node !== node) throw new Error('cursor scope mismatch');
  return cursor;
}

import { createHash, timingSafeEqual } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { z } from 'zod';

export const nodeId = z.string().regex(/^esp32-[a-f0-9]{12}$/);
export const event = z.object({
  nodeId,
  eventId: z.string().regex(/^[a-f0-9]{32}$/),
  uptimeMs: z.number().int().nonnegative(),
  sampledAt: z.number().int().min(1577836800).max(4102444800).optional(),
  value: z.number().finite(),
  sensitivity: z.number().min(0.01).max(100),
  resetReason: z.number().int().nonnegative(),
  version: z.string().max(64),
});

type Record = z.infer<typeof event> & { _id: string; receivedAt: Date };
let client: MongoClient | undefined;

export function events() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is missing');
  client ??= new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 });
  return client.db(process.env.MONGODB_DATABASE || 'esp32_fleet').collection<Record>('events');
}

export function secretMatches(expected: unknown, supplied: string) {
  if (typeof expected !== 'string' || expected.length < 24 || !supplied) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(expected), digest(supplied));
}

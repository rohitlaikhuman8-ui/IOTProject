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
  bootId: z.string().regex(/^[a-f0-9]{32}$/).optional(),
  kind: z.enum(['sample', 'movement']).default('sample'),
  movementDelta: z.number().finite().min(0).optional(),
  sensor: z.literal('ADXL345').optional(),
  unit: z.literal('m/s2').optional(),
  acceleration: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite(),
  }).optional(),
});

type TelemetryRecord = z.infer<typeof event> & { _id: string; receivedAt: Date };
export const heartbeat = z.object({
  nodeId,
  uptimeMs: z.number().int().nonnegative(),
  version: z.string().min(1).max(64),
  ssid: z.string().max(32),
  rssi: z.number().int().min(-127).max(0),
  channel: z.number().int().min(1).max(14),
  storageReady: z.boolean(),
  sensorReady: z.boolean(),
  logRecords: z.number().int().min(0).max(256),
  neighbors: z.array(nodeId).max(16),
  bootId: z.string().regex(/^[a-f0-9]{32}$/).optional(),
  pendingRecords: z.number().int().min(0).max(256).optional(),
  timeSynced: z.boolean().optional(),
  mode: z.enum(['running', 'setup', 'updating']).optional(),
  acceleration: z.object({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() }).optional(),
  value: z.number().finite().optional(),
});
export type NodeState = z.infer<typeof heartbeat> & {
  _id: string; lastSeen: Date;
  lastMeasurement?: z.infer<typeof event>;
  lastMeasurementAt?: Date;
};
type Notice = { _id: string; nodeId: string; kind: 'movement' | 'startup' | 'online' | 'offline';
  at: Date; message: string; eventId?: string; value?: number; movementDelta?: number };
let client: MongoClient | undefined;

function database() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is missing');
  client ??= new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 });
  return client.db(process.env.MONGODB_DATABASE || 'esp32_fleet');
}

export function events() { return database().collection<TelemetryRecord>('events'); }
export function nodes() { return database().collection<NodeState>('nodes'); }
export function notifications() { return database().collection<Notice>('notifications'); }
export const ONLINE_TIMEOUT_MS = 90000;

export function nodeSecrets(): Record<string, string> {
  return z.record(nodeId, z.string().min(24)).parse(JSON.parse(process.env.NODE_SECRETS_JSON || '{}'));
}

export function secretMatches(expected: unknown, supplied: string) {
  if (typeof expected !== 'string' || expected.length < 24 || !supplied) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(expected), digest(supplied));
}

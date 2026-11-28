// Pure formatting shared by export routes and their boundary tests.
export const IST_OFFSET_MS = 330 * 60 * 1000;
export function istDate(value: Date | number = Date.now()) {
  return new Date(Number(value) + IST_OFFSET_MS).toISOString().slice(0, 10);
}
export function istTimestamp(value: Date | number) {
  return new Date(Number(value) + IST_OFFSET_MS).toISOString().replace('Z', '+05:30');
}
export function dayBounds(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('invalid date');
  const start = new Date(date + 'T00:00:00+05:30');
  if (!Number.isFinite(start.getTime()) || istDate(start) !== date || date < '2020-01-01') throw new Error('invalid date');
  return { start, end: new Date(start.getTime() + 86400000) };
}
export const CSV_COLUMNS = ['date_ist', 'time_source', 'captured_at_ist', 'received_at_ist',
  'node_id', 'event_id', 'event_kind', 'movement_detected', 'x_m_s2', 'y_m_s2', 'z_m_s2',
  'acceleration_magnitude_m_s2', 'reported_value_m_s2', 'movement_delta_m_s2', 'sensitivity',
  'firmware_version', 'calibration_revision', 'boot_id', 'uptime_ms', 'reset_reason'];
export function csvCell(value: string | number | undefined) {
  let text = value === undefined ? '' : String(value);
  // Quoting alone does not prevent spreadsheet formula execution.
  if (typeof value === 'string' && /^[=+@\-\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export const CSV_HEADER = CSV_COLUMNS.map(csvCell).join(',') + '\r\n';
export type ExportRecord = {
  sampledAt?: number; receivedAt: Date; nodeId: string; eventId: string; kind?: string;
  acceleration?: { x: number; y: number; z: number }; value: number; movementDelta?: number;
  sensitivity: number; version: string; calibrationRevision?: string; bootId?: string;
  uptimeMs: number; resetReason: number;
};
export function recordCsv(record: ExportRecord) {
  const captured = record.sampledAt ? record.sampledAt * 1000 : undefined;
  const a = record.acceleration;
  return [istDate(captured ?? record.receivedAt.getTime()), captured === undefined ? 'server_receipt_fallback' : 'device_capture',
    captured === undefined ? '' : istTimestamp(captured), istTimestamp(record.receivedAt), record.nodeId,
    record.eventId, record.kind || 'sample', record.kind === 'movement' ? 1 : 0,
    a?.x, a?.y, a?.z, a ? Math.hypot(a.x, a.y, a.z) : undefined, record.value,
    record.movementDelta, record.sensitivity, record.version, record.calibrationRevision,
    record.bootId, record.uptimeMs, record.resetReason].map(csvCell).join(',') + '\r\n';
}

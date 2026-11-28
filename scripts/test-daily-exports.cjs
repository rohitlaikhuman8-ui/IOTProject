// Focused boundary tests, including the exact Apps Script shipped to users.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../dashboard/node_modules/typescript');
function moduleFile(path, requireFn = require) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: requireFn, Buffer, Date, console, Request, Response, URL });
  return exports;
}
const format = moduleFile('dashboard/lib/export-format.ts');
assert.equal(format.dayBounds('2026-11-28').start.toISOString(), '2026-11-27T18:30:00.000Z');
assert.equal(format.dayBounds('2026-11-28').end.toISOString(), '2026-11-28T18:30:00.000Z');
assert.throws(() => format.dayBounds('2026-02-30'));
assert.throws(() => format.dayBounds('2026-2-3'));
assert.equal(format.istDate(Date.parse('2026-11-27T18:29:59Z')), '2026-11-27');
assert.equal(format.istDate(Date.parse('2026-11-27T18:30:00Z')), '2026-11-28');
assert.equal(format.csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
assert.equal(format.csvCell(-4.5), '"-4.5"');
assert.equal(format.csvCell('a,b\nc'), '"a,b\nc"');
const record = { receivedAt: new Date('2026-11-28T05:00:00Z'), sampledAt: Date.parse('2026-11-26T20:00:00Z') / 1000,
  nodeId: 'esp32-3013a5f4e9d4', eventId: 'a'.repeat(32), kind: 'movement', acceleration: { x: 3, y: 4, z: 0 },
  value: 10, sensitivity: 2, version: '=unsafe', uptimeMs: 10, resetReason: 1 };
assert.ok(format.recordCsv(record).startsWith('"2026-11-27","device_capture"'));
assert.ok(format.recordCsv(record).includes('"5","10"')); // physical magnitude and sensitivity-scaled value stay separate.
assert.ok(format.recordCsv({ ...record, sampledAt: undefined }).startsWith('"2026-11-28","server_receipt_fallback",""'));

const { DRIVE_SCRIPT } = moduleFile('dashboard/lib/drive-script.ts');
const fleet = moduleFile('dashboard/lib/fleet.ts', name => name === 'mongodb' ? require('../dashboard/node_modules/mongodb') :
  name === 'zod' ? require('../dashboard/node_modules/zod') : require(name));
assert.ok(fleet.event.safeParse({ ...record, bootId: 'b'.repeat(32), calibrationRevision: 'n4-v1' }).success);
assert.ok(!fleet.event.safeParse({ ...record, nodeId: 'bad' }).success);
assert.ok(!fleet.event.safeParse({ ...record, value: Infinity }).success);
assert.ok(!fleet.event.safeParse({ ...record, sensitivity: 0 }).success);
new vm.Script(DRIVE_SCRIPT);
let pages = [], saved = [], props = new Map(), updates = [];
const bytes = text => Array.from(Buffer.from(text));
const blob = (text, mime, name) => ({ getBytes: () => bytes(text), text, name });
const folder = { getFilesByName: () => ({ hasNext: () => false }), createFile: data => {
  saved.push(data); return { getId: () => 'verified_file_1234', getBlob: () => data };
} };
const context = {
  Date, console: { log() {} }, PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.get(k),
    setProperty: (k,v) => props.set(k,v), deleteProperty: k => props.delete(k) }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  DriveApp: { getFolderById: () => folder },
  Utilities: { newBlob: blob, DigestAlgorithm: { SHA_256: 'sha256' },
    computeDigest: (_, data) => Array.from(require('node:crypto').createHash('sha256').update(Buffer.from(data)).digest()), sleep() {} },
  UrlFetchApp: { fetch: (url, options) => {
    assert.ok(url.startsWith('https://fleet.example/api/exports/'));
    assert.equal(options.headers.Authorization, 'Bearer test-job-secret');
    let data;
    if (url.includes('/plan')) data = { dates: ['2026-11-27'], snapshot: '2026-11-28T01:00:00.000Z' };
    else if (url.includes('/backup')) { updates.push(JSON.parse(options.payload)); data = { accepted: true }; }
    else { data = pages.shift(); assert.ok(data, 'unexpected page request'); }
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify(data) };
  } },
};
vm.createContext(context); vm.runInContext(DRIVE_SCRIPT, context);
props.set('FLEET_ORIGIN', 'https://fleet.example'); props.set('FLEET_SECRET', 'test-job-secret'); props.set('FLEET_FOLDER_ID', 'folder');
function page(rows, total, nextCursor = null, csv = '"node","value"\r\n') {
  return { date: '2026-11-27', node: '', snapshot: '2026-11-28T01:00:00.000Z', header: 'node,value\r\n', csv, rows, total, nextCursor };
}
pages = [page(1, 2, 'next'), page(1, undefined)];
context.runFleetBackup();
assert.equal(saved.length, 1); assert.equal(updates[0].rows, 2);
assert.equal(saved[0].getBytes()[0], 239, 'real UTF-8 BOM, not a literal escape');
assert.equal(props.get('FLEET_WATERMARK'), '2026-11-28T01:00:00.000Z');
assert.ok(!props.has('FLEET_PENDING_PLAN'));

pages = [page(1, 2)]; props.delete('FLEET_WATERMARK');
assert.throws(() => context.runFleetBackup(), /count mismatch/);
assert.equal(saved.length, 1, 'no incomplete replacement');
assert.ok(props.has('FLEET_PENDING_PLAN'), 'failed date retained for retry');
assert.ok(!props.has('FLEET_WATERMARK'), 'watermark must not skip failed data');
pages = [page(1, 2, 'same'), page(1, undefined, 'same')];
assert.throws(() => context.runFleetBackup(), /cursor did not advance/);
assert.equal(saved.length, 1);

pages = [page(0, 0, null, '')];
context.runFleetBackup();
assert.equal(saved.length, 2); assert.equal(updates[1].rows, 0, 'empty day explicitly saved with a header');
console.log('PASS: IST boundaries, invalid dates, CSV escaping/formula protection, late/unsynced timestamps, paginated Drive readback, failed-count/cursor preservation, empty-day export');

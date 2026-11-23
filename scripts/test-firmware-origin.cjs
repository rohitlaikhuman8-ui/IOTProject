const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { createHash } = require('node:crypto');
const source = path.resolve(__dirname, '../dashboard/app/v1/firmware/route.ts');
const requireAtRoute = createRequire(source);
const ts = requireAtRoute('typescript');
const compiled = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleResult = { exports: {} };
new Function('require', 'exports', 'module', compiled)(requireAtRoute, moduleResult.exports, moduleResult);
const { GET } = moduleResult.exports;
const originalFetch = global.fetch;
const bytes = Buffer.from('representative firmware bytes');
const commit = 'a'.repeat(40);
const hash = createHash('sha256').update(bytes).digest('hex');
const reference = { version: commit, sha256: hash, size: bytes.length };
const base = 'https://github.com/rohitlaikhuman8-ui/IOTProject/releases/download';
const manifest = { ...reference, board: 'esp32dev', storageSchema: 2,
  url: `${base}/fleet-${commit}/esp32dev-${commit}.bin` };
const request = query => new Request('https://fleet.example/v1/firmware' + (query ? '?' + new URLSearchParams(query) : ''));
(async () => {
  try {
    global.fetch = async () => { throw new Error('Must reject before fetching'); };
    assert.equal((await GET(request({ version: '../../private' }))).status, 400);
    global.fetch = async url => {
      assert.ok(String(url).startsWith(base + '/firmware-latest/manifest.json?poll='));
      return Response.json(manifest);
    };
    const result = await GET(request());
    assert.equal(result.status, 200);
    const advertised = await result.json();
    assert.equal(new URL(advertised.url).origin, 'https://fleet.example');
    assert.equal(advertised.sha256, hash);
    global.fetch = async () => Response.json({ ...manifest, url: 'http://127.0.0.1/private' });
    assert.equal((await GET(request())).status, 502);
    global.fetch = async () => new Response('x', { headers: { 'Content-Length': '9999999' } });
    assert.equal((await GET(request())).status, 502);
    global.fetch = async url => { assert.equal(url, manifest.url); return new Response(bytes); };
    const binary = await GET(request(reference));
    assert.equal(binary.status, 200);
    assert.deepEqual(Buffer.from(await binary.arrayBuffer()), bytes);
    assert.match(binary.headers.get('Cache-Control'), /immutable/);
    assert.equal((await GET(request({ ...reference, sha256: 'b'.repeat(64) }))).status, 502);
    assert.equal((await GET(request({ ...reference, size: bytes.length - 1 }))).status, 502);
    console.log('Firmware origin: invalid references, origin restriction, size bounds, hash validation and binary delivery passed.');
  } finally { global.fetch = originalFetch; }
})().catch(error => { console.error(error); process.exitCode = 1; });

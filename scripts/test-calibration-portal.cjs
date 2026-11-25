// Offline client-contract check. This does not open a physical node's portal.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

(async () => {
  const source = fs.readFileSync('firmware/src/main.cpp', 'utf8');
  const html = source.match(/R"HTML\(([\s\S]*?)\)HTML"/)[1];
  const settings = {
    node: 'esp32-000000000001', version: 'fixture', token: 'fixture-token',
    ssid: 'Fixture network', base: 'https://example.com', endpoint: '/v1/telemetry',
    interval: 10, sensitivity: 1, touch: 30, motionThreshold: 1.5,
    calibration: { enabled: true, revision: 'fixture-v1', bias: [.1, -.2, -1.7], scale: [.99, .97, 1.02] },
  };
  let saved;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/') return route.fulfill({ contentType: 'text/html', body: html });
      if (path === '/settings') return route.fulfill({ json: settings });
      if (path === '/status') return route.fulfill({ json: { nodeId: settings.node, connection: 'Fixture', pending: 0, timeIst: 'Fixture time' } });
      if (path === '/logs') return route.fulfill({ json: [] });
      if (path === '/calibration') {
        saved = route.request().postDataJSON();
        return route.fulfill({ contentType: 'text/plain', body: 'Calibration saved. Restarting.' });
      }
      return route.abort();
    });
    await page.goto('http://192.168.4.1/');
    await page.getByText('Active revision: fixture-v1', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Wi-Fi SSID', { exact: true }).inputValue(), settings.ssid);
    assert.equal(await page.getByLabel('Y bias (m/s²)', { exact: true }).inputValue(), '-0.2');
    await page.getByLabel('Calibration revision', { exact: true }).fill('fixture-v2');
    await page.getByLabel('X bias (m/s²)', { exact: true }).fill('0.125');
    await page.getByRole('button', { name: 'Save calibration and restart', exact: true }).click();
    await page.locator('#calibrationReply').getByText('Calibration saved. Restarting.', { exact: true }).waitFor();
    assert.deepEqual(saved, { token: settings.token, nodeId: settings.node, revision: 'fixture-v2', bias: [.125, -.2, -1.7], scale: [.99, .97, 1.02] });
    assert.deepEqual(errors, []);
    console.log('PASS: portal loads active coefficients and submits the intended node, token, revision and numeric axes without changing network fields.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });

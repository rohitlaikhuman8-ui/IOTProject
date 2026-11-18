// Run from the repository root. Screenshots contain no credentials.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

async function main() {
  const output = path.resolve('docs/images');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const origin = process.env.DASHBOARD_URL || 'https://esp32-fleet-iot-project3.vercel.app';
    const accessFile = process.env.DOCS_ACCESS_FILE;
    const access = accessFile ? JSON.parse(fs.readFileSync(accessFile, 'utf8')) : null;
    await page.goto(access?.url || origin, { waitUntil: 'networkidle' });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.getByLabel('Dashboard password').waitFor();
    await page.screenshot({ path: path.join(output, 'dashboard-login.png'), fullPage: true });

    const env = fs.readFileSync('dashboard/.env.local', 'utf8');
    const password = env.match(/^DASHBOARD_PASSWORD=(.+)$/m)?.[1].trim();
    if (!password) throw new Error('Local dashboard password is missing');
    await page.getByLabel('Dashboard password').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('heading', { name: 'Nodes', exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'dashboard-nodes.png'), fullPage: true });
    console.log('Captured the deployed sign-in and authenticated dashboard.');

    const source = fs.readFileSync('firmware/src/main.cpp', 'utf8');
    const html = source.match(/R"HTML\(([\s\S]*?)\)HTML"/)?.[1];
    if (!html) throw new Error('Firmware portal HTML was not found');
    const fixture = {
      node: 'esp32-012345abcdef', version: 'usb-dev', ssid: 'YOUR_WIFI_SSID',
      base: origin, endpoint: '/v1/telemetry',
      ota: 'https://github.com/rohitlaikhuman8-ui/IOTProject/releases/download/firmware-latest/manifest.json',
      sensitivity: 1, touch: 30, interval: 60, token: 'documentation-fixture',
    };
    await page.route('http://portal.docs/**', route => {
      const settings = route.request().url().endsWith('/settings');
      return route.fulfill({
        status: 200, contentType: settings ? 'application/json' : 'text/html',
        body: settings ? JSON.stringify(fixture) : html,
      });
    });
    await page.goto('http://portal.docs/', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(output, 'provisioning-reference.png'), fullPage: true });
    console.log('Captured portal HTML using documented sample settings, without hardware.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });

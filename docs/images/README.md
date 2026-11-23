# Documentation screenshots

| File | Source |
| --- | --- |
| `dashboard-login.png` | Live deployed application sign-in on November 23, 2026 |
| `dashboard-nodes.png` | Live authenticated dashboard after the November 23 OTA acceptance |
| `dashboard-topology.png` | Live topology with the current node online and older node last seen |
| `dashboard-ist-history.png` | Live IST telemetry and movement history on verified release 408a075 |
| `dashboard-offline.png` | Physical node offline after its cloud uplink was paused in setup mode |
| `provisioning-reference.png` | Actual `PortalPage` HTML extracted from firmware, rendered with sample settings |
| `portal-live.png` | Real November 23 node, live settings/status/recent logs, password fields left blank |

`provisioning-reference.png` is a documentation reference rendered without hardware, with placeholder identity and SSID values. `portal-live.png` is the separate real-device capture. Screenshot capture avoids showing passwords, access links, or authentication cookies.

## Regenerate

Run from the repository root with Node.js and Playwright available:

```powershell
npm install --no-save --package-lock=false --prefix .build/docs-browser playwright
$env:PLAYWRIGHT_MODULE_PATH = (Resolve-Path .build/docs-browser/node_modules/playwright).Path
node .build/docs-browser/node_modules/playwright/cli.js install chromium
node scripts/capture-docs.cjs
```

The script reads the local ignored `dashboard/.env.local` for its dashboard password. It never writes the value into screenshot content or console output. Keep that local file private.

For a protected deployment, obtain an authorized temporary Vercel share link and place it in an ignored JSON file such as `work/capture-access.json`:

```json
{"url":"YOUR_TEMPORARY_AUTHORIZED_VERCEL_SHARE_URL"}
```

Then run:

```powershell
$env:DOCS_ACCESS_FILE = 'work/capture-access.json'
node scripts/capture-docs.cjs
```

The browser uses the temporary link to establish authorized access, then captures pages at their clean origin URL. The link and browser session are excluded from Git. Review images before publishing them if your fleet contains sensitive identifiers or measurements.

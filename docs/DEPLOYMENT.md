# Dashboard and API deployment

## Current resources

The Vercel project is `esp32-fleet` under `iot-project3`. Production runs at `https://esp32-fleet-iot-project3.vercel.app`. The Next.js source is `dashboard/`.

Atlas contains the free `esp32-fleet` cluster in `US_EAST_1`. Database user `esp32_fleet_vercel` has read/write access to `esp32_fleet`. The connection string is stored in Vercel's server environment.

The original Vercel deployment used a source upload through the API. A Git push alone does not link that Vercel project to GitHub. Follow the Git connection steps below for subsequent automatic dashboard deployments.

During COM5 commissioning, linking the repository returned a Vercel error requiring a GitHub Login Connection. Connect GitHub in Vercel account authentication settings, then retry the existing project's Git connection. The current live application was deployed through a source upload. Root Directory is configured as `dashboard` for repository builds.

The public `/v1/firmware` GET route relays only this repository's published firmware channel. It requires no new secrets or Render service. GitHub Actions remains the publisher. The route validates manifest origin/schema/size and checks binary size/SHA-256 before serving an immutable reference. Keep production platform access available to the ESP32; dashboard sessions and authenticated node ingestion still apply to their existing routes. Firmware transfers count toward Vercel usage. See [firmware operations](FIRMWARE.md#vercel-firmware-origin) for behavior and local checks.

The third node's credential was activated by redeployment `dpl_5jZ1VtFCbTuBrRCKqjCCZobpTdTf` on November 23. The fourth was activated by `dpl_C31oWXRvr5vNqacNBUtfTG1bVpHm` on November 24. Both reached Ready using the existing tested application source and updated Production environment. `NODE_SECRETS_JSON` now has four separate node entries; earlier entries were retained. Secrets are not documented or committed. The firmware channel remains release `408a075`; registration/documentation changes alone do not publish new firmware.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Authenticated Atlas SRV connection string |
| `MONGODB_DATABASE` | Database name, defaults to `esp32_fleet` |
| `NODE_SECRETS_JSON` | JSON object mapping exact Node IDs to individual secrets |
| `DASHBOARD_PASSWORD` | Shared dashboard password and session-signing secret |

An example node mapping uses placeholder values:

```json
{
  "esp32-012345abcdef": "REPLACE_WITH_RANDOM_SECRET_FOR_THIS_NODE",
  "esp32-fedcba543210": "REPLACE_WITH_ANOTHER_RANDOM_SECRET"
}
```

Generate each secret locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep the result private and provision the same secret on that node. Preserve existing entries when adding nodes. Unknown IDs are rejected. Use a distinct random dashboard password with at least 24 characters.

## Atlas setup

1. Select the project and cluster in Atlas.
2. Create a Database Access user with `readWrite` limited to `esp32_fleet`.
3. Copy the Drivers connection string and insert the URL-encoded user credentials.
4. Configure Network Access for the deployment's egress. The existing owner-approved free-tier setup permits `0.0.0.0/0` and requires database authentication.
5. Add the URI to Vercel as a server-only sensitive variable.
6. Add query indexes through the Atlas collection interface or an authenticated mongosh session.

```javascript
use esp32_fleet
db.events.createIndex({ receivedAt: -1 })
db.events.createIndex({ nodeId: 1, receivedAt: -1 })
```

Atlas's default unique `_id` index provides ingestion deduplication. The additional indexes support dashboard queries.

## Connect Vercel to GitHub

1. Open the existing `esp32-fleet` Vercel project.
2. In Settings → Git, connect `rohitlaikhuman8-ui/IOTProject`.
3. Set Root Directory to `dashboard`, framework to Next.js, and Node.js to 22.
4. Set the production branch to `main`.
5. Set the required variables for Production. Use separate credentials and a separate database for Preview/Development if enabling those environments.
6. Redeploy and wait for Ready.
7. Open the production URL, sign in, and confirm the Nodes and Recent telemetry sections render.

Production access was changed with owner approval so ESP32 requests can reach the application. Preview deployments retain Vercel authentication. The dashboard still requires its password, and telemetry/heartbeats still require individual node secrets.

## Local development

```powershell
Set-Location dashboard
Copy-Item .env.example .env.local
# Fill in development configuration in your editor.
npm install
npm run dev
```

Open `http://localhost:3000`. For a production build:

```powershell
npm run build
npm start
```

Keep `.env.local` private. The checked-in `.env.example` contains placeholders.

## Optional CLI deployment

Use the existing project when linking.

```powershell
Set-Location dashboard
npx vercel login
npx vercel link --scope iot-project3
npx vercel deploy --prod
```

Choose `esp32-fleet` in the interactive link prompt. Confirm the target before publishing. The normal Vercel Git integration can handle future deployments without this CLI procedure.

## Apply configuration changes

Production variable changes take effect on a new deployment. Redeploy after modifying the node map, URI, or dashboard password. Password rotation invalidates previous dashboard session signatures on the new deployment.

The application has no migration script. Back up Atlas before changing the telemetry schema.

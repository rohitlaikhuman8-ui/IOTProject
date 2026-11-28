# Daily CSV downloads and Google Drive copies

## What is collected

The dashboard exports Atlas telemetry into `sensor-data-YYYY-MM-DD.csv`. Each file covers **00:00 inclusive to the next 00:00 exclusive in Asia/Kolkata (IST)**. All-node exports include historical readings from retired nodes; an optional Node ID filter produces a separate per-node file. This is a cloud export, not the ESP32's rolling 256-record local journal.

Rows contain the IST date, timestamp source, capture/receipt timestamps with `+05:30`, Node ID, event ID, sample/movement kind, movement flag, corrected X/Y/Z, acceleration magnitude, reported sensitivity-scaled value, movement delta, sensitivity, firmware/calibration revisions, boot ID, uptime and reset reason. Negative numeric accelerations remain numeric. Text fields are CSV-escaped and protected against spreadsheet formula injection. Files use UTF-8 with a BOM and CRLF rows for Excel compatibility.

The day follows the device's recorded `sampledAt` when available. If the device had no valid capture clock, the day uses server `receivedAt`; the capture column is blank and `time_source=server_receipt_fallback`. The server timestamp is always retained separately. No capture timestamp is invented. This does not prove the device clock was externally accurate.

## Download from the dashboard

1. Sign in to the [production dashboard](https://esp32-fleet-iot-project3.vercel.app/).
2. In **Daily data files**, choose an IST date. Yesterday is selected initially.
3. Choose all nodes or a specific Node ID and press **Download CSV**.
4. Wait for the complete record count. The file is saved only after all pages finish and the count matches. Cancel or retry after an error; partial files are not offered as complete.
5. Open the CSV in Excel or import it as UTF-8 CSV. Keep Node ID and event ID when combining files so duplicate imports can be identified.

Today is an incomplete period; download again after midnight. A zero-row file has a header and explicitly means no received records matched the period, not that every sensor was healthy. Downloads include the full queried day, not only the dashboard's 100 recent readings.

Each download fixes a server snapshot ten seconds behind its first request and reads bounded 1,000-record pages with stable receipt-time/event-ID ordering. Pages must retain the same date/node/snapshot and advance their cursor. The browser validates the final count and limits assembled data to approximately 50 MB/one million rows; choose a node if a file exceeds the limit. A concurrent in-flight insert can cause a count mismatch; retry rather than accepting a partial result.

## Automatic Google Drive copies

The implementation uses a Google Apps Script running in the owner's Google account. It does **not** need the laptop online or a Render service. A dedicated private folder has been created: [ESP32 daily data](https://drive.google.com/drive/folders/1LS4ujcesuNqdK9BGF88hMt_6bEfhb6y8). Sharing is not made public.

**A folder and installed code alone do not activate automation. Google authorization and a successfully installed trigger are required.** The dashboard shows “awaiting Google authorization and the first verified backup” until a real job receipt exists. The initial implementation checkpoint leaves this explicit; see the dated validation section for actual activation status.

### One-time activation

1. Sign in to the dashboard and select **Download private Google Drive setup script**.
2. Treat `PRIVATE-fleet-drive-setup.gs` as a password. It contains a dedicated export credential. Never commit, share or paste it into a public issue/chat/document. The setup route requires a dashboard session; node credentials cannot download it.
3. Open [Google Apps Script](https://script.google.com/home/start) in the Google account that owns the folder. Create a new standalone project named **ESP32 daily data backup**.
4. Replace the editor's sample code with the complete downloaded script. Save it.
5. Select **configureFleetExport** and run it once. Review and approve the Google permissions yourself. If organizational restrictions or a Google warning prevent approval, stop and report it; do not claim the backup is active.
6. This saves configuration in Script Properties, opens the existing folder, creates one hourly trigger for `runFleetBackup`, and attempts the first backup immediately. Re-running it replaces only that project's own backup trigger.
7. Check **Executions** for success and **Triggers** for the hourly job. Check the folder for CSVs and the dashboard for **Last verified backup**. Successful backup means Drive bytes were read back and matched the generated SHA-256 before a server receipt was recorded.

The Apps Script needs Google Drive, external HTTPS requests and trigger-management permissions. The dedicated export token can read telemetry exports and record backup receipts; it cannot authenticate node ingestion or sign in to the dashboard. Do not grant editor access to the script to people who should not have that token. Google triggers run as their creator; exact execution minute is not guaranteed. [Installable triggers](https://developers.google.com/apps-script/guides/triggers/installable), [authorization](https://developers.google.com/apps-script/guides/services/authorization).

### Daily schedule, delayed uploads and retries

The hourly job exports **completed days only**. A newly completed day is picked up on a later hourly run after midnight IST. Today is deliberately excluded from automatic daily files. On first activation it considers receipts from the preceding seven days plus yesterday; older dates can always be downloaded manually or backfilled using the procedure below.

A receipt watermark finds newly received telemetry. If a node uploads a reading whose recorded capture date is older, the plan refreshes that earlier day's file, even when it is older than seven days. Yesterday is checked for a completed snapshot even if no new receipts appeared. Once a closed day's verified snapshot covers the whole period and no new readings arrive for that day, it is not unnecessarily rewritten each hour.

One filename is maintained per day in the dedicated folder. A complete validated CSV is prepared before replacing an existing file. A Drive readback length/hash check precedes acknowledgement. Duplicate names cause a failure rather than choosing an arbitrary file. Files may change when delayed data arrives; preserve a separately named copy if an immutable analysis snapshot is needed. This export process is not a versioned disaster-recovery backup of the database.

Only after every date in a plan is verified does the receipt watermark advance. A failed or time-budget-limited plan remains in Script Properties and resumes at its remaining dates on the next trigger. An incomplete date restarts from page one, preserving the previous complete file. Network/429/5xx fetches receive bounded retries. Plans are limited to 200 changed days; larger backfills require smaller windows.

Apps Script currently allows six minutes per execution and 50 MB per URL Fetch response. This job uses a four-minute collection budget and 45 MB assembled-data guard. Large files or sustained multi-day backlogs may need a dedicated worker; do not remove guards to silently truncate files. Drive updates use media upload because `File.setContent` has a 10 MB limit. [Google quotas](https://developers.google.com/apps-script/guides/services/quotas), [Drive File documentation](https://developers.google.com/apps-script/reference/drive/file).

### Backfill an older period

Manual downloads work for any date still present in Atlas. To regenerate older Drive files, first allow any existing pending plan to finish. In Apps Script **Project Settings → Script Properties**, set `FLEET_WATERMARK` to an earlier UTC ISO timestamp covering the receipts of interest, then run `runFleetBackup`. The plan uses **receipt time** for discovery, not just capture date. Use successive windows if more than 200 dates change. Do not delete a pending plan to hide a failed export.

## Configuration and deployment

Vercel production variables:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI`, `MONGODB_DATABASE` | Existing private database connection/database |
| `DASHBOARD_PASSWORD` | Existing dashboard sign-in |
| `EXPORT_JOB_SECRET` | Distinct random secret, at least 32 characters; server-side only |
| `EXPORT_PUBLIC_ORIGIN` | `https://esp32-fleet-iot-project3.vercel.app` |
| `EXPORT_DRIVE_FOLDER_ID` | Existing private folder ID; optional for other installations |

Use Vercel Secret variables for credentials, scoped to production; do not prefix them `NEXT_PUBLIC_`. `.env.local` remains ignored. The setup download injects the production origin/token and optional folder ID into the script. The repository template [drive-script.ts](../dashboard/lib/drive-script.ts) contains no live credential.

API routes:

| Route | Authentication and behavior |
| --- | --- |
| `GET /api/exports/day?date=YYYY-MM-DD&node=...` | Dashboard session or export Bearer token; returns one bounded CSV page, count and next cursor |
| `GET /api/exports/plan?since=UTC-ISO` | Export Bearer token only; changed completed dates and a fixed snapshot |
| `GET /api/exports/backup` | Dashboard session only; most recent 14 verified-copy receipts |
| `POST /api/exports/backup` | Export Bearer token only; record readback-verified file ID/hash/count |
| `GET /api/exports/setup` | Dashboard session only; private setup download containing the export token |

The token grants access to all historical telemetry exports. The receipt endpoint trusts the authorized job's readback report; the server does not independently fetch Drive. Stored receipts are evidence of the reported completed copy, not a continuous Google health check. A receipt older than 36 hours is highlighted as needing attention. Check Google Executions to confirm trigger health after authorization revocation or account changes.

Required supporting indexes (additive, do not replace `_id` uniqueness):

```javascript
db.events.createIndex({ receivedAt: 1, _id: 1 })
db.events.createIndex({ sampledAt: 1, receivedAt: 1, _id: 1 })
db.events.createIndex({ nodeId: 1, receivedAt: 1, _id: 1 })
```

Build and checks from the repository root, with Node/npm available:

```powershell
npm ci --prefix dashboard
node scripts/test-daily-exports.cjs
node scripts/test-export-routes.cjs
npm run build --prefix dashboard
```

The optional read-only API integration test uses the private local `DASHBOARD_PASSWORD` and `EXPORT_JOB_SECRET`. If no local Mongo URI exists, compare its recorded count independently through Atlas; production Secrets are not extracted just to reproduce local development.

```powershell
node scripts/test-export-api.cjs https://esp32-fleet-iot-project3.vercel.app 2026-11-27 work/daily-export-production-check.json
```

Export test CSVs and private setup files stay under ignored `work/`. Only sanitized count/hash/check results belong in `docs/`. Dashboard changes do not require reflashing the ESP32s or publishing a firmware update.

## Troubleshooting and operation

| Symptom | Action |
| --- | --- |
| No CSV offered / export fails | Keep prior files; check sign-in, connection and API status, then retry. A complete count is required. |
| Zero rows | Verify IST date/node and actual Atlas delivery. An offline node may not yet have uploaded; local storage is bounded. |
| Reading appears on another day | Inspect `time_source`, capture time and receipt time. Unsynchronized records intentionally use receipt time. |
| Earlier file changes | Delayed uploads refreshed that capture date. Use event IDs to deduplicate imports and keep analysis snapshots separately. |
| Awaiting first backup | Complete Google authorization, verify trigger creation and run `runFleetBackup`. A folder alone is insufficient. |
| Backup stale / stopped | Inspect Apps Script Executions, authorization, quota, Drive capacity and Vercel API health. Keep pending plan/watermark intact. |
| HTTP 401 in Google job | Export token differs from Vercel. Download the current private setup and rerun configuration in the same project. |
| HTTP redirect/login page | Confirm the production origin is used and ingestion/export routes remain accessible under app authentication. Do not weaken dashboard authentication. |
| Duplicate filename | Inspect contents and ownership in the dedicated folder; retain evidence and resolve manually before retrying. |
| Drive hash/count mismatch | Do not acknowledge or advance the watermark. Retain the error and retry; inspect existing file/version history if necessary. |
| Quota or runtime limit | Allow the next trigger to resume; use narrower files/windows or provision a worker if a single date cannot finish. |
| Folder access denied | Verify the trigger creator owns/has access to the configured folder; do not make the folder public. |
| Change Google account/folder | Stop that project's backup trigger, grant the intended account access deliberately, update folder property/config and verify a fresh copy before retiring the old setup. |

To rotate the export token: replace `EXPORT_JOB_SECRET` in Vercel, redeploy, download a fresh private setup script, configure the existing Google project again, and verify a new receipt. Old setup files stop working. This does not change Wi-Fi, node secrets or the dashboard password. To stop automation, remove only `runFleetBackup`'s trigger in that Google project; manual dashboard exports continue. Existing CSVs are retained.

## Validation checkpoint — November 28, 2026

The production build and focused tests pass for IST midnight/date validation, formula-safe CSV, distinct magnitude/scaled values, late and unsynchronized timestamps, ingestion-schema compatibility, paginated Google-job collection, Drive hash readback, failed-count/cursor preservation, watermark retry behavior and zero-row files. Google services in these focused tests are mocks; this does not establish Google authorization or a real installed trigger.

Dependency checks initially found existing Zod/PostCSS advisories. Zod was updated to the patched 4.x line and PostCSS overridden to a patched compatible 8.x line; the locked install now reports zero known audit vulnerabilities. Ingestion schema acceptance/rejection and the production TypeScript/build checks were rerun. The live deployment/export result and Google activation status are recorded below as they are verified.

### Live deployment and actual daily file — verified

Production deployment `dpl_BXbhFbpXfWUPTqE2XfzbGfFpHRmi`, source commit `3ef9b83`, reached READY and serves the existing production domains. The first deployment `dpl_9Fjfo9ZPZG8yMJTXQouBGk9GBaQD` failed before switching traffic because uploaded source files were flattened while the project expected root directory `dashboard`; the retry preserved that directory. No firmware source/channel was changed.

The authenticated [browser screenshot](images/dashboard-daily-exports-2026-11-28.png) records a completed **6,307-reading November 27 download** and the explicit awaiting-authorization backup state. The independent seven-page API export produced **2,177,581 bytes**, SHA-256 `bf79c0c3e3e36f77f4e9260cbcac8a91ea432f4e3b4ed75017f95f117fa41001`. Every CSV row parsed into the expected 20 columns with unique node/event IDs and the requested date. Separate Atlas aggregation matched per-node counts: Node 1 **1,625**, Node 2 **1,621**, Node 3 **1,615**, Node 4 **1,446**. There were **62 movement rows**. Counts represent received historical data, not uninterrupted 24-hour coverage.

Anonymous export/setup/status requests were rejected; the job token could not download private setup, and a dashboard session could not access the job-only plan. Invalid dates/nodes and cross-date cursors were rejected. Node-filtered export and actual automatic-plan queries succeeded. The focused actual-route tests separately checked the 1,001-record page boundary and tied receipt-time cursor ordering. Initial Node pooled-fetch verification failed/stalled; the fresh-socket bounded HTTP test completed. The browser download and independent Atlas result are separate confirmations. [Sanitized validation evidence](calibration/daily-export-verification-2026-11-28.json) retains the results and deployment failure.

A first real [November 27 CSV](https://drive.google.com/file/d/1XE-Xc0bPG6QKmKBXXfSIrJvU0GFRhJme/view?usp=drivesdk) was uploaded through the authorized Drive connector into the dedicated folder. Connector metadata readback confirmed its filename, CSV MIME type, parent folder and 2,177,581-byte size. A full raw Drive download then matched the original SHA-256 exactly. This initial connector copy **does not create an automatic-job success receipt or prove a scheduled trigger**. Google Apps Script authorization, trigger installation and the first real job hash-readback receipt remain pending. The dashboard intentionally continues to display that pending state.

At this November 28 checkpoint the dashboard showed all four nodes with last-seen timestamps from approximately **14:57 IST on November 27**. It did not show them online; this export verification uses historical records and makes no new hardware-connectivity claim. Bring them online for new collection when ready. No device was reset/reconfigured for this feature.

### Prepared Google project — authorization pending

The standalone [ESP32 daily data backup project](https://script.google.com/home/projects/1Gmonp8RUhPc_a_XQqYBI5j1J01JqkWB5sm44zCY7PZoUhNwoJSCh7O4K/edit) was created in the signed-in owner's Google account. The complete private setup script was installed/saved and the project renamed. Running the selected `configureFleetExport` reached Google's **Review permissions** prompt. **No permission grant, installed trigger or actual scheduled-job receipt has been verified yet.** The owner must review/approve Google access, then the first execution and Drive readback need verification. Do not create a second project or re-copy the token unnecessarily; continue from this existing editor. Its link grants no access by itself, and the private code/token is not stored in Git.

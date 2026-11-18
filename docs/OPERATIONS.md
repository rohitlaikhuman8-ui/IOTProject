# Operating procedures

## Commission a node

1. Complete the first USB application and filesystem flash in [hardware](HARDWARE.md).
2. Read the Node ID and temporary AP password from USB serial at 115200 baud.
3. Generate an individual random secret.
4. Add the exact ID and secret to Vercel's Production `NODE_SECRETS_JSON`, preserving other entries.
5. Redeploy Vercel and wait for Ready.
6. Join the ESP32 setup Wi-Fi and open `http://192.168.4.1/`.
7. Enter Wi-Fi credentials, backend origin, ingest path, node secret, OTA URL, sensitivity, threshold, and sample interval.
8. Save. The firmware commits settings to NVS and restarts after approximately one second.
9. Reconnect the computer to its normal network.
10. Sign in to the dashboard, reload after a sample interval, and find the node.
11. Check its value, firmware version, timestamps, and reset reason.
12. Record commissioning details in the private inventory.

The first sample is scheduled immediately. Upload waits for Wi-Fi and time sync. Events recorded before synchronization omit sample time, while the API adds server receive time.

## Configure a running node

1. Connect USB serial to read the temporary AP password.
2. Hold the GPIO 4 pad continuously for four seconds.
3. Join the printed setup network and open the panel.
4. Modify settings, save, and wait for the restart.

Blank Wi-Fi password retains the old password when the SSID is unchanged. Blank API secret retains the old secret. Select the explicit checkbox to use an open Wi-Fi network.

The AP allows one client and expires after 15 minutes. Setup mode pauses station networking, uploads, and OTA. Sampling continues. Normal networking resumes after the AP expires.

| Setting | Accepted value |
| --- | --- |
| SSID | 1–32 characters |
| Wi-Fi password | 8–64 characters, or explicit open network |
| Backend base | HTTPS origin without a path |
| Endpoint | Path beginning with one slash, up to 100 characters |
| Node secret | 24–128 characters, use at least 32 random characters |
| OTA URL | Empty to disable checks, or an HTTPS URL |
| Sensitivity | 0.01–100 |
| Touch threshold | 1–65,535 |
| Sample interval | 10–86,400 seconds |

Invalid submissions return 400 and leave saved configuration in place. Reopen the page after a form-token error.

## Use the dashboard

Open the production URL and sign in using the operator password. Sessions expire after eight hours.

- Nodes lists IDs, last receive times, latest values, firmware prefixes, and database sample counts.
- Click an ID to filter the latest telemetry table.
- Show all nodes removes the filter.
- Reload fetches current data.
- Sign out removes the session cookie.

The view limits nodes to 200 and events to 100. Displayed times use UTC. Last upload is server receive time, so a newly received backlog may contain older measurements.

## Export local logs

Enter setup mode, join the AP, click Download local log, and save the NDJSON file privately. Verify each line parses before destructive recovery.

```powershell
Invoke-WebRequest -Uri http://192.168.4.1/log -OutFile .\esp32-log.ndjson
$records = Get-Content .\esp32-log.ndjson | ForEach-Object { $_ | ConvertFrom-Json }
$records | Sort-Object sampledAt,uptimeMs | Select-Object nodeId,eventId,sampledAt,value
```

Export includes pending and acknowledged records. Downloading preserves them. Export order is unspecified, and the record contents do not include their filename's acknowledgment state.

## Offline operation

Local samples continue while Wi-Fi is unavailable. Upload failure backoff grows from five seconds to five minutes, plus up to 2.999 seconds of jitter. After success, the next queued upload is scheduled after 500 ms.

At 256 records, acknowledged history is reclaimed first. If every record is pending, new samples are skipped. At the default interval, 256 samples cover about 4 hours 16 minutes. Capacity remains finite.

Restore Wi-Fi and watch the dashboard count increase as the backlog drains. Retrying an accepted event does not increment the database count again.

## Rotate a node secret

1. Generate a new secret privately.
2. Enter it in the device portal while setup mode pauses uploads.
3. Update the matching Vercel Production node-map entry and redeploy.
4. Save the device settings and let it restart.
5. Confirm queued records upload and retire the previous secret.

If the portal expires before deployment finishes, a temporary mismatch returns 401 and records stay queued. Correct the settings before the queue fills.

## Rotate dashboard access

Change Vercel's Production `DASHBOARD_PASSWORD`, redeploy, and store the new value privately. Update the existing ignored `dashboard/.env.local` copy when used by local tooling. New signatures invalidate previous sessions.

## Storage recovery

Inspect serial output and supply stability if LittleFS fails to mount. Export logs if readable. Use `uploadfs` only after accepting replacement of the log partition. Application-only flashing preserves settings and logs when the partition layout stays unchanged.

## Release acceptance

Use a bench node to check normal sampling, Wi-Fi interruption, queued delivery, restart persistence, a complete OTA update, and rollback. Record Node ID and release SHA for each check. Physical checks still require an actual board.

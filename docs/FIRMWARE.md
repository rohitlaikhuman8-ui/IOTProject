# Firmware and OTA

## Build configuration

| Component | Version or target |
| --- | --- |
| PlatformIO Core | 6.1.18 in GitHub Actions |
| Espressif32 platform | 6.10.0 |
| Framework | Arduino ESP32 2.0.17 family supplied by the platform |
| Board | Classic `esp32dev`, 4 MB flash |
| ArduinoJson | 7.3.1 |
| Filesystem | LittleFS |
| Serial baud | 115200 |

Local builds use version `usb-dev`. The release workflow generates a Git-ignored header containing the exact commit SHA.

## Source responsibilities

| Function | Responsibility |
| --- | --- |
| `setup()` | Identity, NVS, filesystem, portal routes, rollback state |
| `loop()` | Watchdog, touch, acquisition, local sampling, portal and Wi-Fi |
| `fleetUpload` task | Telemetry retries and OTA, with its own watchdog subscription |
| `fleetStatus` task | Independent heartbeat scheduling and watchdog subscription |
| `saveSettings()` | Validate and persist one configuration record |
| `saveSample()` | Create and commit a local telemetry record |
| `scanLog()` | Rebuild filename index at boot, then select pending/acknowledged records in RAM |
| `uploadOne()` | Upload one event and record local acknowledgment |
| `startPortal()` | Start temporary AP and captive DNS |
| `exportLog()` | Stream local committed records |
| `diagnoseStorage()` | Validate retained JSON and measure read latency without opening the AP |
| `closePortal()` | Close AP/DNS/server while retaining NVS settings and station Wi-Fi |
| `checkOta()` | Fetch manifest and verify the new application |

## Timing

- Touch activates setup after four continuous seconds.
- The AP expires after 15 minutes and accepts one client.
- Wi-Fi reconnects start every 30 seconds.
- Upload failures retry from five seconds to five minutes with jitter.
- The first OTA check is scheduled around 60–120 seconds after boot.
- Successful OTA checks schedule the next check after 15 minutes plus up to 30 seconds of jitter.
- Failed OTA checks retry after two minutes plus up to 30 seconds of jitter.
- The task watchdog timeout is 45 seconds.
- The loop task stack is explicitly 16 KiB. OTA manifest and transfer buffers are heap-allocated to leave stack space for TLS.
- Hardware brownout detection is enabled by the board framework.

An independent status task reports presence while the upload task handles telemetry and OTA. The main loop services the sensor, touch and portal. Filesystem operations are mutex protected. Cloud POSTs use the ESP-IDF HTTP client with bounded timeouts, and OTA uses the pinned Arduino transport.

## Persistence

The device writes a complete event to `/littlefs/new.tmp`, flushes, syncs, closes, and renames it to a `p-<20-digit sequence>` file for a sample or `m-<20-digit sequence>` for movement. After a 2xx acknowledgment, it renames that file to `s-<sequence>` in the same directory. Pending movement is selected ahead of ordinary samples. A mutex-protected RAM index is rebuilt from committed filenames on each boot and updated after successful file changes.

Storage schema 2 distributes these filenames across `/log0` through `/log7`, selected by sequence modulo eight. This bounds each directory to roughly 32 records at the 256-record limit. On first boot, legacy root records are moved by atomic rename without changing content, sequence or acknowledgment state. Interrupted migration is resumed by scanning both layouts; failed moves and collisions preserve the original file. No formatting is used for migration.

OTA manifests for this revision must include `storageSchema: 2`. Older updaters can install this revision, but the new updater rejects manifests lacking the compatible schema. This prevents automatic downgrade to old firmware that ignores the new directories. A rollback must retain schema-2 storage support. The three-minute boot-health window starts after setup and migration finish.

Up to 256 records are retained. Acknowledged history is reclaimed first. An all-pending log skips new samples. An interrupted temporary file is ignored on restart. NVS namespace `fleet` stores `config` and the previously attempted OTA version.

Committed records are read in bounded blocks of at most 1024 bytes. The portal renders at most 30 recent records without retaining 30 parsed JSON documents simultaneously. The RAM index also tracks file sizes, allowing full-log export to send a Content-Length header immediately and stream each record using bulk reads/writes. During the handler, main-loop logging/reclamation pauses and workers may only rename acknowledgment markers, so the indexed record contents and sizes remain stable. Filesystem locks are released between records. Disconnected clients, short writes or a three-minute transfer deadline stop delivery without changing history. Old temporary export files are removed on boot.

Portal status/log polling waits for each request cycle to finish before scheduling the next one. This avoids overlapping requests when a flash operation or a slow client delays a response.

The recent-log response reserves bounded output space while holding the TLS budget mutex. A failed reservation or a busy update returns 503 for retry instead of emitting incomplete JSON. Sorting uses filename indices rather than a duplicate string list.

## OTA release procedure

The release workflow runs for firmware or release-workflow changes pushed to `main`. The initial project push qualifies. Documentation-only commits do not publish firmware.

1. Checkout the commit and install pinned PlatformIO.
2. Generate the version header with the commit SHA.
3. Build the application.
4. Calculate SHA-256 and byte count.
5. Publish `esp32dev-<sha>.bin` under tag `fleet-<sha>`.
6. Publish or replace `manifest.json` under stable tag `firmware-latest`.

A rerun reuses an already published commit-specific binary. The workflow uses GitHub's `GITHUB_TOKEN` with `contents: write`. Actions must be enabled and permitted to create releases.

Example manifest, with placeholders and illustrative size:

```json
{
  "board": "esp32dev",
  "storageSchema": 2,
  "version": "<40-character commit SHA>",
  "url": "https://github.com/rohitlaikhuman8-ui/IOTProject/releases/download/fleet-<sha>/esp32dev-<sha>.bin",
  "sha256": "<64-character SHA-256>",
  "size": 1111376
}
```

Provision this stable URL on nodes:

```text
https://github.com/rohitlaikhuman8-ui/IOTProject/releases/download/firmware-latest/manifest.json
```

Public release assets download without a GitHub credential on devices.

GitHub asset redirects include long signed URLs. The download path permits verified HTTPS redirect URLs up to 4096 characters, while operator-configured origins and manifest URLs retain the shorter configuration limit. Every redirect is still certificate verified.

## Inspect a release

Open the GitHub Actions run and inspect the build and publish steps. After completion, verify the published asset locally:

```powershell
$manifestUrl = 'https://github.com/rohitlaikhuman8-ui/IOTProject/releases/download/firmware-latest/manifest.json'
$manifest = Invoke-RestMethod $manifestUrl
$manifest | Format-List
Invoke-WebRequest $manifest.url -OutFile firmware-release.bin
$hash = (Get-FileHash firmware-release.bin -Algorithm SHA256).Hash.ToLowerInvariant()
if ($hash -ne $manifest.sha256) { throw 'Firmware hash mismatch' }
if ((Get-Item firmware-release.bin).Length -ne $manifest.size) { throw 'Firmware length mismatch' }
```

Compare the dashboard firmware prefixes to the release SHA after a node update window.

## Device update and confirmation

The firmware follows at most five verified HTTPS redirect hops. It rejects the wrong board, unchanged version, a previously attempted failed version, incorrect length, or incorrect hash. It writes the inactive application slot and selects it only after a complete validated download.

A pending boot checks readable storage, the sensor identity, Wi-Fi, plausible time, and a successful cloud heartbeat. It confirms after at least 20 seconds. If conditions remain unmet after three minutes, it requests rollback. Reset before confirmation can also cause bootloader rollback.

The cloud heartbeat uses an acknowledged Atlas status write. This health check still does not verify sensor calibration or every device operation. Verify failed-image rollback on the exact board and bootloader being used.

## Rollback

For a confirmed faulty release, create a new commit that reverts it:

```powershell
git switch -c fix/revert-firmware
git revert <bad-firmware-commit>
git push -u origin fix/revert-firmware
```

Review and merge to publish a distinct SHA. A failed attempted version is suppressed locally, so publishing a corrected new SHA provides recovery.

USB recovery should export logs first when possible and upload only the application. Keep the partition layout unchanged to preserve NVS and LittleFS.

OTA updates the application image. Changes to the bootloader, partition layout, hardware family, Secure Boot, or flash encryption need a separate compatibility procedure.

# Verification record

## Recorded checks

| Date | Check | Result |
| --- | --- | --- |
| 2026-11-13 | PlatformIO classic ESP32 build | Passed, 48,644 bytes RAM, 1,104,805 bytes application flash reported |
| 2026-11-13 | Vercel production build | Ready |
| 2026-11-18 | Atlas cluster inspection | Free cluster active and unpaused |
| 2026-11-18 | Repository inspection | Public repository, initial README-only main preserved as parent history |
| 2026-11-18 | GitHub main publication | Project published in commit `594619c41076f64f949307df7f92d6f9651bf479` |
| 2026-11-18 | GitHub firmware release | Build and publish job completed successfully in [run 44276342243](https://github.com/rohitlaikhuman8-ui/IOTProject/actions/runs/44276342243) |
| 2026-11-18 | Published OTA integrity | Downloaded public manifest and 1,111,296-byte binary, matching size and SHA-256 |
| 2026-11-18 | Browser documentation capture | Actual sign-in and authenticated empty fleet view captured through temporary authorized Vercel access |
| 2026-11-18 | Portal screenshot | Firmware HTML rendered with sample settings, without a connected board |

The original screenshots captured an empty fleet. The refreshed screenshots show the connected ADXL345 node after commissioning.

The source compiled successfully before this documentation handoff and again in GitHub Actions. The first OTA release and stable manifest have been published.

The verified release SHA-256 is `ec15b44494bf3353a998856138118cfa1ece8f37f4b0b6f1bd06e5f52eb59a62`. It identifies the binary for commit `594619c41076f64f949307df7f92d6f9651bf479`.

## Bench acceptance procedure

Perform these steps on a classic ESP32 with the intended power supply and pad.

1. Flash application and initial filesystem, record Node ID.
2. Register a secret, provision Wi-Fi and API settings.
3. Verify one sensor reading and matching dashboard event.
4. Restart and verify saved configuration and local history.
5. Disconnect Wi-Fi, collect samples, restart, restore Wi-Fi, and confirm backlog delivery.
6. Retry an accepted event and confirm its database count stays one.
7. Export logs and parse each nonempty line as JSON.
8. Fill a controlled offline queue to confirm capacity handling.
9. Interrupt power during sampling on a bench fixture and inspect retained records after restart.
10. Publish a known-good OTA, observe version change, then validate failed-boot rollback on the bench.
11. Repeat touch checks with the final enclosure and wiring.

Record the board model, Node ID, commit SHA, expected behavior, observed behavior, and timestamps. A stable supply and safe fixture are required for controlled power interruption.

## Outstanding deployment work

- Calibrate the ADXL345 with a reference and multiple orientations.
- Complete the bench checks above.
- Link the existing Vercel project to GitHub if automatic dashboard deployments are desired.
- Validate additional physical nodes and independent networks before relying on radio-neighbor links.

## COM5 hardware observations

The connected ESP32-D0WD-V3 uses Node ID `esp32-d01de2f4e9d4`. ADXL345 responded at 0x53 with DEVID 0xE5. Firmware and initial LittleFS uploads verified their flash hashes. BOOT was not required. The node persisted configuration and records across reset, connected to Sensor Testing, and received HTTP 200 for heartbeats. Sensor values responded to orientation changes, but calibration remains open.

The Atlas-backed browser check found the node with working sensor and storage, an active independent uplink on Wi-Fi channel 1, and no radio neighbors. Replaying its actual latest measurement returned 200 while the recorded event count stayed at 41. An unsigned request to the topology endpoint returned 401.

## OTA failure found during commissioning

The first physical OTA test exposed a loop-task stack-canary panic during TLS processing. The node rebooted and resumed sampling. The repair sets a 16 KiB loop stack and moves the 2 KiB manifest and 1 KiB transfer buffers to the heap. Serial status now includes minimum free stack, free heap, and pending verification. Boot confirmation also requires a successful cloud heartbeat.

The serial diagnostic tool leaves RTS/DTR inactive when opening the port and only resets the board when explicitly requested. This avoids interrupting a pending OTA boot during observation.

The next physical check exposed a separate URL validation limit on GitHub's long signed asset redirects. The download path was updated to accept up to 4096 characters while retaining HTTPS and certificate checks. Operator-configured URLs keep their existing limit.

A private USB configuration command also timed out during commissioning. The firmware's UART receive buffer was enlarged to 4 KiB. The helper pauses network work in setup mode, paces long commands, and requires an explicit persistence acknowledgment.

## Successful physical OTA

The repaired firmware downloaded and verified the 1,150,416-byte GitHub image, then rebooted the COM5 board into version `7f9ae6336ce4fc26ab20ef4d680910cf4e18ab63`. Serial output confirmed the new version, ADXL345 detection, continued sampling, and a successful HTTP 200 cloud heartbeat. This exercised the actual GitHub redirect, image transfer, SHA-256 verification, flash selection, and reboot.

Final serial status confirmed `pendingVerification: false`, `wifiConnected: true`, `storageReady: true`, ADXL345 address 83 (0x53), 133 retained records, 9,692 bytes minimum free loop stack, and 219,112 bytes free heap. The final Atlas-backed topology reported the same release version and healthy sensor/storage.

A subsequent release-manifest lookup encountered a transient TLS error and deferred its check safely. Cloud heartbeats recovered with 200 and the accepted firmware continued running. That earlier single-loop firmware could expire the presence timeout during synchronous OTA work. The later revision below separates status reporting.

## Offline presence check

Entering the actual setup AP paused the node's station networking while local samples continued. The dashboard showed zero online nodes with a heartbeat age of 88,293 ms, and its offline graph was captured. This exercised real node disconnection rather than a simulated browser fixture.

## Presence, IST and movement revision

The November 18 follow-up separates sensor/portal work, telemetry/OTA, and status reporting. Presence uses accepted server reports with a 90-second window. The browser polls every three seconds and formats timestamps in Asia/Kolkata. Server response dates and SNTP synchronize the node on boot without blocking initial uploads.

Bench development exposed watchdog resets with the initial Arduino cloud transport and allocation failures when two TLS handshakes ran together. Cloud POSTs now use the native ESP-IDF HTTP client and share a handshake mutex. Repeated LittleFS directory walks were also replaced by a boot-rebuilt filename index. Those failed development builds were not published as fleet OTA releases.

The physical tilt test produced three movement records in Atlas with server receive times 16:53:06, 16:53:10 and 16:53:15 IST. Their movement deltas were approximately 2.666, 9.349 and 11.028 m/s². The authenticated live dashboard returned matching movement notifications and telemetry. These are real sensor events, not inserted fixtures.

The production dashboard build reached Ready with live node status, IST history, highlighted motion and per-node filtering. The documentation screenshot tool rendered the current portal HTML with sample values. The real AP returned HTTP 200 status, settings and recent logs. A full 256-record export exceeded the first 60-second check. The export path was changed to bounded bulk reads and short filesystem lock periods. Physical portal acceptance is recorded separately when completed.

A 460800-baud USB transfer stopped midway during development. Several retries at 115200 completed and verified flash hashes, but later 115200 transfers also stopped with “chip stopped responding.” A cable/USB-power check was requested before further recovery flashing. The configured upload speed is 115200. Successful transfers did not require BOOT-button intervention.

After the operator reseated the USB connection, recovery uploads completed and verified the image hashes. The node resumed authenticated heartbeat and telemetry reporting with saved settings and 256 retained local records. No filesystem upload or full-chip erase was used during these application recovery attempts.

The recent-log endpoint returned 30 valid records. A subsequent full export exposed a status-task watchdog timeout while the filesystem mutex was held. The latest uploaded revision releases the mutex between snapshot records and reports snapshot progress on serial. Its OTA-enabled configuration also compiles, using 50,436 bytes RAM and 1,212,613 bytes application flash. Complete physical export acceptance remains open. Portal requests were still intermittent during the last laptop/AP check.

## Session checkpoint and next work

This is the historical November 18 checkpoint. The November 23 results below supersede its pending portal/export checks.

At the operator's request, repeated portal tests stopped. Wi-Fi credentials and settings remain saved in NVS, and committed local records remain in LittleFS. The bench image identifies itself as `usb-dev-ist-motion` and has fleet OTA checks disabled while under validation. The deployed dashboard already includes IST, Online/Last-seen status and movement notification history. The candidate firmware and documentation are saved on `fix/presence-ist-portal`; the stable main OTA channel has not been replaced by these test builds.

Next session:

1. Confirm the existing Wi-Fi connection and fresh cloud status without reopening setup.
2. Diagnose intermittent AP HTTP requests and complete one full export with uninterrupted heartbeats and no watchdog reset.
3. Perform one save/reboot check through setup, preserving blank password/secret fields, and restore the production OTA manifest URL.
4. Rebuild with OTA enabled, publish the verified changes to main, observe GitHub Actions, and install/confirm the release on the physical node.
5. Update this verification record and capture the final real portal screenshot. Sensor calibration, additional-node tests and controlled power-cut/rollback checks remain separate deployment acceptance work.

## November 23 hardware verification

COM5 held a different ESP32, `esp32-7839a3f4e9d4`, initially running a standalone ADXL345 sketch. Its boot/settings/application region was backed up in verified smaller reads; the original application's checksum and validation SHA both passed. Long serial reads failed at both 460800 and 115200 baud, while smaller sections succeeded with a retry. The private backup is excluded from Git.

The new node received a distinct API secret and registration, preserving the older node and its history. The production Vercel redeployment reached Ready. Firmware and initial filesystem uploads verified their flash hashes without needing BOOT. Permanent USB configuration was acknowledged, followed by reboot, automatic Wi-Fi association, HTTP 200 telemetry/heartbeat, healthy ADXL345 at 0x53, and IST synchronization.

Manual sensor sampling exercised retention. A read-only check validated 231 records in 114,817 ms. The revised storage loader migrated 253 existing files into eight directories without formatting. A subsequent check validated all 256 retained records with zero errors in 36,340 ms, while cloud acknowledgments continued. Node-specific AP names now include all 12 ID digits, avoiding same-vendor suffix collisions.

An interrupted export exposed blocking in the framework's generic file-stream helper. The replacement sends Content-Length immediately from cached file sizes, uses bulk record reads and bounded writes, and stops on disconnect. Controlled cancellation completed without reboot or record deletion. A full real download then transferred 256 unique records in 28,345 ms. The browser displayed 30 recent records and live IST/cloud status. The real screenshot is `images/portal-live.png`.

The settings form was submitted with the existing SSID and blank password/API-secret fields. It returned “Settings saved. Restarting.” The node rebooted and resumed authenticated reporting with saved credentials. The laptop was restored to Sensor Testing. Earlier download interruptions coincided with manual Windows reconnection to the router during the transfer; the successful test left the laptop on the AP until completion.

The tested application has OTA support compiled in, with the manifest URL left empty until the verified schema-2 release is published. Final release/OTA results are appended after publication. Calibration, additional physical radio peers, and controlled power-cut/failed-image rollback acceptance remain open.

## OTA transport recovery

Commit `6ea5e313fba008d41d36ccc3795bf1bcdcc4b531` was published successfully by [Actions run 45153032416](https://github.com/rohitlaikhuman8-ui/IOTProject/actions/runs/45153032416). Its 1,222,096-byte asset matched the public manifest SHA-256. Device installation did not complete during the first checks: the OTA transport could wait only one second for a mutex held by cloud requests.

During a later network outage, all 256 slots became pending. Existing unsent records were preserved; new samples could not be retained once the finite buffer filled. Network restoration resumed authenticated reporting. The transport repair reuses verified cloud connections, allows longer cold connections, and gives OTA a fifteen-second lock wait. Idle cloud TLS state is released before OTA or memory-intensive portal logging. Slow HTTP Date replies cannot overwrite an already plausible clock.

The repair build uploaded over USB with image-hash verification, without filesystem formatting or clearing settings. It retained all 256 records, reconnected automatically and returned 200 from both cloud endpoints. Warm requests were typically 0.6–0.9 seconds, and pending records decreased from 255 to 235 during initial observation. The final published repair and its OTA acceptance are recorded below after validation.

Release `f0683497fbd91289819cd9abf21d4f5bd3e80e10` passed [Actions run 45192734018](https://github.com/rohitlaikhuman8-ui/IOTProject/actions/runs/45192734018). The downloaded asset was 1,222,800 bytes and matched SHA-256 `9856e3984df04c6af7734a699fa8c4716aecd9d96336167fc7f19ed59f539b57`. Before reboot, the pending queue reached 149 records. A device check retrieved the manifest and binary headers through verified redirects, but did not finish installation. A concurrent heartbeat emitted a certificate-verification error and recovered; the old application continued reporting. The old build lacked a diagnostic for the exact download failure. The next repair defers background cloud TLS throughout OTA and adds explicit allocation/transfer/validation diagnostics and progress. This does not weaken certificate verification.

The OTA memory-budget repair compiled with 50,476 bytes RAM and 1,216,861 bytes application flash. Its USB upload verified hashes, retained 256 records and saved settings, and resumed cloud reporting with setup inactive. The pending queue reached 125 records. Commit `6fefd18a279183938f4733803c6eae0b0292fdbd` passed [Actions run 45194312895](https://github.com/rohitlaikhuman8-ui/IOTProject/actions/runs/45194312895). Its public 1,223,328-byte asset matched SHA-256 `9de73cd19137df376d4011bcfb10ac44fafe1c1231f4c79565f8e123fb1ee6bf`. The stable manifest was verified before enabling it on the node.

The next physical OTA attempt progressed beyond 786,432 bytes without the earlier concurrent-heartbeat TLS error. At 20:00 IST a 1,024-byte read returned 576 bytes, causing the strict read-length check to abort with 346,784 bytes remaining and no flash-write error. The existing application resumed authenticated heartbeat reporting at 20:00:03. The downloader was changed to accept partial reads with bounded inactivity/total deadlines, preserving exact length and hash validation.

The partial-read build compiled with 50,476 bytes RAM and 1,217,069 bytes application flash. Application recovery over USB verified image hashes, retained 256 records, and resumed IST-synchronized reporting. Its release commit `722aac8dd99c6abea796d7353a579c5b26f49a10` passed [Actions run 45195442957](https://github.com/rohitlaikhuman8-ui/IOTProject/actions/runs/45195442957). The downloaded public asset was 1,223,504 bytes and matched SHA-256 `ea2efc04114278f0a3661551ff6dd7f073d55a4b2b325c2c18721e31c417c2b0`.

The first partial-read attempt continued through intermittent reads and passed 1,048,576 bytes. At 20:08:20 IST its three-minute total deadline expired with 147,280 bytes remaining. No flash-write error occurred, and the old application resumed HTTP 200 reporting. During the download, serial status showed Wi-Fi connected at -34 dBm, healthy sensor/storage, 256 retained records, setup inactive and continued sampling. The deferred cloud heartbeat exceeded the dashboard's online threshold; this was an update window, not a Wi-Fi disconnection. A further check was requested without opening setup or resetting configuration.

That retry reached 393,216 bytes but stopped at 20:10:22 after the 15-second inactivity threshold, with 813,904 bytes remaining. Cloud reporting recovered again. The measured slow/stalling connection justified increasing the bounds to 30 seconds without data and ten minutes total, while retaining watchdog servicing. OTA also temporarily disables modem sleep and restores its previous mode after a non-rebooting check. These changes do not bypass certificate, size or hash checks.

The slow-network build compiled with 50,476 bytes RAM and 1,217,285 bytes application flash. USB recovery verified hashes and retained the local journal/configuration. Commit `94121482ba1aaec5d01e3c23996ec915138fb502` passed [Actions run 45197354953](https://github.com/rohitlaikhuman8-ui/IOTProject/actions/runs/45197354953). Its public 1,223,744-byte binary matched SHA-256 `fa261c26b6282ecc03b2f65eaae857706789943fa6470c1ca080abb1991e5229`. The pinned DIO SDK configuration defines `CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=1`; the physical pending-boot result is checked separately below.

Three subsequent checks reached the first GitHub redirect but failed its next connection after approximately five seconds. Telemetry remained reachable. The TCP connection allowance was increased to 15 seconds and the TLS handshake allowance to 12 seconds, with resolved-host/IP/elapsed/heap diagnostics on failure. The five-second failure pattern supports investigating connection establishment; it does not prove a certificate fault or a blocked host.

### Completed physical OTA acceptance

The connection-diagnostic build compiled with 50,476 bytes RAM and 1,217,529 bytes application flash, and its USB recovery verified hashes. With the saved stable channel configured, it fetched both verified GitHub redirect chains and downloaded release `94121482ba1aaec5d01e3c23996ec915138fb502`. Binary download headers arrived at 20:21:20 IST; at 20:22:07 serial confirmed `OTA verified`, the exact version and all 1,223,744 bytes. The node rebooted into that release at 20:22:08, rebuilt its existing 256-record journal at 20:22:19, resumed HTTP 200 heartbeat/telemetry, and printed `OTA boot confirmed: storage, sensor and cloud heartbeat healthy` at 20:22:40. No captive portal or BOOT-button intervention was required. This verifies a successful pending-image acceptance; deliberate failed-image rollback and controlled power cuts remain separate open tests.

Authenticated dashboard verification at approximately 20:23:40 IST showed release `9412148`, mode running, zero pending records, healthy sensor/storage, synchronized time, fresh telemetry, and persisted new movement notifications. The older node's last-seen timestamp remained November 18.

The tested connection-timeout repair was published as `a7003f04a4bb025518994eea3390d3a284976cf4` by [Actions run 45199023650](https://github.com/rohitlaikhuman8-ui/IOTProject/actions/runs/45199023650). Its 1,223,984-byte asset matched SHA-256 `132b88e013557d7af1cb21ec461ee7b229443838795e282f6806043f1c9d07d3`. A cached stable manifest response still returned the prior version, while a fresh query returned the new release and the GitHub asset update time agreed. The OTA-installed older release then timed out on another five-second connection. The published timeout-fix binary was used for USB bootstrap, retaining NVS/LittleFS. Manifest advertised/running-version logging was added to distinguish stale channel responses in subsequent checks.

Release `f20b2e9049181f68e0140d682f87767969c7e7e6` passed [Actions run 45199804050](https://github.com/rohitlaikhuman8-ui/IOTProject/actions/runs/45199804050). Its 1,224,048-byte asset matched SHA-256 `6a9a478591e80171587226216f35ca2acd6ba926caf24802360f9a262a7a0b19`. USB bootstrap of the published `a7003f0` binary verified hashes; status confirmed that version, 256 records, zero pending records, saved Wi-Fi, synchronized time and setup inactive. A later direct GitHub check timed out at `release-assets.githubusercontent.com` / `185.199.109.133` after 15,014 ms with 151,072 bytes free heap. Vercel reporting continued/recovered. This motivated an alternative reachable origin, rather than weakening TLS checks or erasing settings.

### Vercel OTA origin

The fixed-repository firmware relay passed local checks for malformed references, foreign-origin manifests, oversized responses, wrong image hashes, exact binary delivery and immutable cache headers. Next.js production compilation/type checking passed with the new `/v1/firmware` route. The framework's generated TypeScript compiler options were retained. The production source deployment `dpl_D9yVG76kiADhUCbjqMNDwQry1hnj` reached Ready. A real production manifest advertised `f20b2e9` through a same-origin binary URL; downloading its complete 1,224,048 bytes matched the published SHA-256 above. Explicit Vercel CDN caching was then added for immutable image references and type/security checks passed again. Subsequent device acceptance is recorded below.

Deployment `dpl_64bdeWVmQ81Mi8yuqqwbx6MiQ5Kq` reached Ready with explicit CDN cache headers. A real HTTP/1.0 binary request returned 200 without Content-Length or transfer encoding. Firmware was therefore adapted to bounded close-delimited manifests and manifest-sized binary downloads, retaining exact size/hash/image validation. Separately, the host serial reader's console pipe buffered enough output to delay configuration commands; it now writes routine lines only to the private transcript. Save acknowledgments and device reboots are verified explicitly. The initial Vercel provisioning command was not acknowledged before a subsequent command replaced it; the relay is configured again only after bootstrap and acknowledgment.

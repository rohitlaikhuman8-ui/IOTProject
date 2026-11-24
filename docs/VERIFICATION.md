# Verification record

## Latest commissioning checkpoint — November 24, 2026

Four nodes are registered with separate secrets on release `408a075`. The fourth, `esp32-3013a5f4e9d4`, was verified online after its November 24 installation: saved settings survived reboot, ADXL345 and storage were healthy, record integrity passed, time was synchronized, the operator's movement was persisted in notification history, and pending uploads were zero. The other three boards were not connected during this check and retained Last-seen histories. See [third-node](NODE-986AA3.md) and [fourth-node](NODE-3013A5.md) records; the older checkpoints below remain historical evidence.

## Latest verified state — November 23, 2026

At approximately 21:00 IST, COM5 node `esp32-7839a3f4e9d4` was online on release `408a075bcb8b8eb4366a380ffc283637349bcc57`, installed remotely through the Vercel firmware origin. Pending boot was confirmed, sensor/storage were healthy, all 256 retained records were present, the upload queue was empty, IST matched host time, and setup AP was inactive. The authenticated dashboard showed fresh telemetry and movement notifications. The November 18 node retained its historical last-seen state. Detailed acceptance and earlier failures follow below.

Later that evening, the operator returned `esp32-d01de2f4e9d4` to COM5. It received the same published release over USB, retained its existing identity/secret and 256 records, and resumed cloud reporting. All 256 migrated records passed validation with zero errors. The saved Vercel OTA channel returned the matching current version. The other board was unplugged and its Last-seen history remained available; the earlier 21:00 result above is a historical checkpoint, not a claim that both boards stayed powered.

The returning board's physical tilt was verified in Atlas and the authenticated dashboard API: five movement records and their matching notifications were persisted. Its 21:39 dashboard snapshot showed 111 pending records still retrying. The backlog then fell to nine at 21:44 and zero by 21:45:30 IST. Atlas confirmed mode running, the exact release, healthy sensor/storage, synchronized time and 256 retained records at that final checkpoint.

Calibration, multiple physical radio peers, controlled power cuts and failed-image rollback remain open. Successful OTA acceptance is verified; this is not a claim of full production acceptance.

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

The first close-delimited bootstrap upload stopped mid-write at 34% with “chip stopped responding.” A retry at 115200 baud completed and verified hashes without BOOT intervention. Firmware `usb-ota-origin` reported 256 records, saved Wi-Fi, healthy sensor/storage and IST. Its release `f888f16200641941e3d5855b5669a7756c8d52dd` passed [Actions run 45203356446](https://github.com/rohitlaikhuman8-ui/IOTProject/actions/runs/45203356446); the production relay advertised 1,224,208 bytes and SHA-256 `7375ea65d53f3b16a929782ae027a9a1322b18bd8867a389a7628dabdc11e751`.

The device acknowledged saved Vercel provisioning at 20:48:44 IST and rebooted. At 20:49:31 it received an unknown-length HTTP 200 manifest, parsed the expected `f888f16` version, and received HTTP 200 for the image at 20:49:36. The transfer later stalled and aborted at the 30-second inactivity bound at 20:50:50, with 1,134,104 bytes remaining. The running application/history stayed intact. A further check failed before image download. Inspection of the pinned framework showed `Stream::readBytes()` calling `timedRead()` once per byte, so OTA reads were replaced by bounded bulk TLS reads with cooperative waits. This removes that overhead; it does not guarantee recovery from an unavailable internet connection.

The operator confirmed that Sensor Testing is a mobile hotspot with stable internet. Device-side connection failures therefore remain ESP32/path observations, not proof of a general hotspot outage. The bulk-read build compiled with 50,476 bytes RAM and 1,217,905 bytes application flash. Its recovery upload verified hashes at 115200 baud and resumed authenticated heartbeat/telemetry without reopening setup. Final release and device results follow below.

### Completed Vercel OTA acceptance

Commit `408a075bcb8b8eb4366a380ffc283637349bcc57` passed [Actions run 45205127013](https://github.com/rohitlaikhuman8-ui/IOTProject/actions/runs/45205127013). The live relay advertised 1,224,352 bytes and SHA-256 `98ac1d523cb4ef7c1d1bd43e0d99c17891815059c50a3254bea62eaced0bb6e1`. The node acknowledged persistent relay configuration at 20:57:40 IST and rebooted. It retrieved the correct manifest at 20:58:30 and began the unknown-length image response at 20:58:33. Bulk reads passed 918 KB in about 31 seconds. At 20:59:14 it verified the complete size/hash/image and rebooted into the published release: a 41-second binary transfer.

The existing 256-record journal loaded at 20:59:27. Authenticated cloud reporting resumed and pending boot was confirmed at 20:59:50. Serial status at 21:00:15 reported the exact release, `pendingVerification=false`, zero pending records, healthy storage/sensor, saved Sensor Testing network, setup inactive, solid status LED, and `21:00:14 IST`. The authenticated production dashboard read at 21:00:33 confirmed the same version, mode running, zero backlog, fresh measurements, a new startup notification and movement notifications. The older node's historical last seen remained unchanged. No portal reopening, Wi-Fi re-entry or BOOT-button intervention was needed for this remote update.

The deployed relay source is in `dpl_64bdeWVmQ81Mi8yuqqwbx6MiQ5Kq`; subsequent firmware/doc commits do not require rebuilding that unchanged route. New online nodes configured with its URL follow the Actions stable channel. Offline physical nodes have not been claimed as upgraded. The real dashboard screenshots were refreshed after acceptance; the real portal screenshot remains from the earlier controlled portal test.

## Returning board on November 23

The newly connected COM5 board was identified as the existing `esp32-d01de2f4e9d4`, MAC `d4:e9:f4:e2:1d:d0`, rather than a new identity. Pre-update serial showed the older bench firmware, live ADXL345, HTTP 200 cloud reporting, 256 records and 98 pending. Its settings/partition area was privately backed up and checked before using the public `408a075` binary with verified length/hash. The first USB write failed near 95%; the retry completed with hash verification. No filesystem upload, full-chip erase or BOOT intervention was used.

The firmware migrated all 256 records at 21:17:07 IST. A persistent-configuration acknowledgment at 21:18:06 was followed by a normal reboot and a 256-record index with no migration needed. The integrity result at 21:19:05 was 256 valid, zero invalid, 29,355 ms elapsed. Authenticated production status at 21:18:52 showed the exact new release, healthy sensor/storage and synchronized time; older queued samples were being backfilled. At 21:21:07 the scheduled Vercel OTA check advertised the same version already running. The operator performed a fresh tilt, with local movement records at 21:23:45 onward. Production movement verification and latest backlog are appended below.

Atlas read-only queries confirmed five movement events captured at 21:23:44, 21:23:46, 21:23:48, 21:23:50 and 21:24:02 IST, and five notifications linked by the same event IDs. Their server-received timestamps were 21:24:05.034 through 21:24:14.677 IST. Example `c648afa86be2443b56ef8b7471c6384b` had delta 17.9351 m/s² and the exact running release. This verifies the operator's movement test independently of browser automation.

Direct Chromium navigation timed out at 30 and 60 seconds, while direct HTTP returned 200. Routing browser requests through Playwright's request client completed normal password login and a real dashboard API read. The 21:39:24 IST snapshot showed d01de2 online on `408a075`, sensor/storage healthy, synchronized time, live readings, matching movement notifications and 111 pending records. The unplugged 7839a3 node retained Last seen at 21:09:33 IST. Transport retries and new sampling continued; no records were deleted to hide the backlog. The documentation capture script now supports that optional HTTP transport and waits for DOM/UI readiness instead of global network idleness.

The same node's pending count decreased to nine at 21:44:05 and zero at 21:45:30 IST, confirmed by a direct Atlas node-state query. No pending data was discarded and the sampling interval remained ten seconds. Final screenshots were refreshed after queue recovery. This verifies this observed recovery, not a sustained-throughput guarantee for every network or sampling rate.

## Third node commissioned November 23

New MAC `d4:e9:f4:a3:6a:98` produced Node ID `esp32-986aa3f4e9d4`. Its original application/settings area was backed up privately, with retries on two read sections, and the original application checksum/hash validated. Both filesystem superblock pages were blank. A third unique node secret was added without replacing the existing entries, and Vercel redeployment `dpl_5jZ1VtFCbTuBrRCKqjCCZobpTdTf` reached Ready. The same checksum-verified public `408a075` binary and a one-time initial LittleFS image were flashed successfully; BOOT was not needed.

Persistent provisioning was acknowledged at 22:14:44 IST and followed by reboot, sensor detection at 0x53/0xE5, retained local records and authenticated HTTP 200 reporting. Serial status at 22:15:54 showed synchronized time, healthy sensor/storage, setup inactive and zero backlog. The scheduled OTA check at 22:15:56 reported matching advertised/running versions. At 22:17:24 the storage check validated all 17 then-retained records with zero errors in 607 ms.

The operator's physical tilt generated fresh database-backed movement alerts. Example `398d05f9e88ba442c6b896439b5db197` was captured at 22:19:44 and received at 22:19:46.023 IST, delta 21.13259 m/s². The authenticated dashboard API at 22:20:12 showed this node online on `408a075`, mode running, 39 records, zero pending uploads and both older registrations preserved. See [the complete node record](NODE-986AA3.md).

During the November 24 follow-up, the dashboard showed the third node's Last seen at November 23, 22:23:54 IST, with 66 records and one pending in its last report. COM5 enumerated but did not answer fleet status. A normal reset produced a different boot image, and read-only MAC identification revealed `d4:e9:f4:a5:13:30`, not the third board. The operator explicitly authorized configuring this newly connected fourth board. Historical successful checks above are not presented as current online status.

## Fourth node commissioned November 24

The new board's hardware ID is `esp32-3013a5f4e9d4`. Its compatible partition table and two blank filesystem superblock pages were checked before writing. The original boot/settings/application region was archived in 1,376,256 bytes; one read section required a retry, every section's transcript matched the MAC, and the original application checksum/hash validated. A fourth unique secret was added while retaining the other three. Vercel redeployment `dpl_C31oWXRvr5vNqacNBUtfTG1bVpHm` reached Ready.

Two long USB writes stopped near 71% and 89% with “chip stopped responding.” Recovery wrote five shorter application sections successfully, then full-image verification against the published 1,224,352-byte binary reported a matching digest. The matched bootloader/boot-selection data were verified and the previously blank filesystem initialized once. NVS and the existing partition table were retained. No BOOT intervention was required.

Permanent configuration was acknowledged at 15:08:15 IST and rebooted into the exact release, detecting ADXL345 0x53/0xE5. The first local record survived that reboot. Serial at 15:08:32 showed healthy sensor/storage, setup inactive, synchronized time and zero backlog. The 15:08:43 integrity check validated four records, zero invalid, in 93 ms. The operator tilted the device; movement event `9ebcd284363cd21db1a8a3600502c93b` was captured at 15:09:14 and received in notification history at 15:09:16.255 IST, delta 25.40308 m/s².

The authenticated production dashboard API at 15:09:44 showed all four IDs, this node online in running mode, 13 local records, zero pending uploads, healthy sensor/storage and synchronized time. Older identities/history were preserved. The scheduled Vercel OTA check at 15:09:57 matched the running version without reinstalling it. These are USB commissioning and current-version channel checks, not an additional remote-image or deliberate rollback test.

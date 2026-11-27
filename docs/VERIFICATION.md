# Verification record

## Latest commissioning checkpoint — November 24, 2026

Four nodes are registered with separate secrets on release `408a075`. The fourth, `esp32-3013a5f4e9d4`, was verified online after its November 24 installation: saved settings survived reboot, ADXL345 and storage were healthy, record integrity passed, time was synchronized, the operator's movement was persisted in notification history, and pending uploads were zero. The other three boards were not connected during this check and retained Last-seen histories. See [third-node](NODE-986AA3.md) and [fourth-node](NODE-3013A5.md) records; the older checkpoints below remain historical evidence.

In a later November 24 return check, COM5 again held the third board `esp32-986aa3f4e9d4`. It already ran the current release and resumed uploads with its saved identity/settings. All 83 then-retained records passed validation with zero errors. Its existing credential still authenticated against the four-node backend, and the saved OTA channel matched the running version. No new installation, formatting or registration was necessary. The current COM port must always be identified before choosing a node procedure.

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

## Third board reconnected November 24

MAC identification returned `d4:e9:f4:a3:6a:98`. Serial at 15:21:01 IST confirmed `408a075`, saved Wi-Fi, 75 local records, zero pending, healthy sensor/storage, synchronized IST and setup inactive. Read-only storage diagnosis around 15:22 validated 83 records, zero invalid, elapsed 8,021 ms. Authenticated dashboard data showed the same board online with fresh readings and all four registrations preserved. An intermittent transport timeout retried successfully; a later dashboard snapshot had two pending readings, so the earlier zero count is a checkpoint rather than a constant guarantee.

The saved Vercel manifest check around 15:23 advertised/running versions both matched `408a075`, with no update installation. No credential or firmware changes were made. The reconnect screenshot records the actual dashboard state separately from the fourth board's earlier screenshot. Controlled power-cut, calibration and group-test acceptance remain open.

## Basic four-node group check November 25

The completed nine-snapshot window at 13:37:47.949–13:39:52.474 IST showed all four boards online on release `408a075`, channel 1, with healthy sensor/storage/time flags, stable boot IDs and advancing measurements. Freshness was at most 9.069 seconds. Read-only Atlas queries confirmed independent stored events for every Node ID and current neighbor reports. All six pairs were mutual in six snapshots; the remaining snapshots included one-sided sightings. The original node remained in setup mode with cloud reporting active and ended with three pending records; the other three ended at zero. A laptop connection reset interrupted an earlier observer run; the repeated run completed and the authenticated dashboard rendered 4/4 online.

See the [complete group record](GROUP-CHECK-2026-11-25.md) for per-node ranges, database event IDs, live screenshots, the overlapping-edge presentation limitation and repeat procedure. This completes basic simultaneous connectivity/discovery acceptance. Calibration, controlled movement isolation, independent-network/RF separation, deliberate power-cut/rollback and sustained endurance remain open. No firmware, saved settings or production application changes were made for this check.

## Node 1 measured calibration and persistence November 25

Six operator-positioned reference windows, each with twelve unique samples, produced per-axis bias/scale estimates for `esp32-d01de2f4e9d4`. The first held-out component-up window failed the level-position screen. After the operator leveled the PCB, a second independent window passed unchanged bench criteria, with corrected mean magnitude 9.912091 m/s² (+1.075196%), corrected X/Y means -0.059972/0.270902 m/s², and acceptable stationary variation. The fit was not changed to obtain that pass. This is an offline bench screen, not a traceable accuracy certification.

The calibrated acquisition implementation was tested as `usb-calibration-bench` on that hardware before publishing firmware changes. The USB image was section-written and whole-image verified, retaining NVS/LittleFS and all 256 indexed records. Six invalid calibration requests were rejected without modifying state. Node-bound revision `n1-20261125-v1` was persisted and verified after its save/reboot and a second reset. Saved Wi-Fi and tagged HTTP 200 reporting resumed. The raw diagnostic magnitude remained approximately 7.90 m/s² while a subsequent corrected diagnostic was approximately 9.92 m/s²; these are different live reads and not an additional known-orientation validation.

Vercel production deployment `dpl_Fj4AMfugPZUQbZGKwawEpczj27Sg` reached Ready with optional revision schemas and dashboard labels. Atlas independently confirmed corrected events bearing the node revision; authenticated browser verification showed all four online with only Node 1 tagged. The [live screenshot](images/dashboard-calibration-node1.png) records the bench checkpoint. Full firmware builds and Next.js production/type checks passed; the offline portal client-contract test passed. The physical captive portal was not reopened for that fixture test.

See [complete calibration evidence and procedures](CALIBRATION.md) for source samples, coefficients, failures retained in history, installation commands, rollback semantics and remaining on-device validation/movement checks. Nodes 2–4 remain individually uncalibrated.

### Published firmware and installed-correction validation

Release `795d041b2daf1b4d9e1448890c7ef16c3de0c8f7` passed [Actions run 45584124521](https://github.com/rohitlaikhuman8-ui/IOTProject/actions/runs/45584124521). The 1,233,520-byte artifact matched SHA-256 `ba72ecba6986f9f5dc7983a2e8655d6baf25c972dfca6efc3496bf91e1e84565`. Node 1's whole-image-verified USB installation restored its NVS calibration and retained 256 logs. Normal OTA-enabled behavior was restored; its subsequent manifest check matched the running release.

Twelve new device-corrected samples at 14:52:54–14:54:44 IST passed the same numeric level bench criteria, with mean magnitude 9.882263 m/s² (+0.771038%), X/Y means -0.063128/0.017029 m/s², stable revision/version and one post-installation boot. No second correction was applied during analysis. See [the full on-device result](calibration/node1-on-device-validation-2026-11-25.json). This establishes installed correction/persistence and one level accuracy screen; post-calibration movement/threshold, power-cut, rollback and endurance acceptance remain open.

At 14:56 IST Node 2 was stale (last report 14:49:58.180 IST); the operator was asked to check power/network before its measurements. Nodes 1/3/4 continued reporting. The new release was published for all configured OTA clients, but Nodes 3/4 still reported the old version at this checkpoint. Do not infer completed fleet rollout from a successful release workflow alone.

## Node 2 v2 supported-pose numeric bench pass — November 26

The initial Node 2 references and two November 25 validation failures were retained. The operator clarified that leveling was visual. November 26 diagnostic A/B windows did not prove a tilt-only explanation, and one A attempt with confirmed movement was excluded. A separate fresh supported-pose numeric screen passed with v1, but its mandatory installed-correction check failed magnitude: **+3.284037%** versus the unchanged ±3% criterion. V1 was not accepted; the applied revision and failed data remain auditable.

Two new stable-USB `sensor-raw` fitting windows recorded **120 measurements per Z face**, bypassing active v1 correction. They replaced only Z in candidate v2; X/Y coefficients stayed unchanged. The fit was not adjusted from a failed validation value. One fresh validation attempt recorded zero samples because the initial USB status reply was missing; it was preserved as incomplete. A clean identity read and new-file retry completed 120 fresh raw measurements, passing the original numeric limits with mean candidate-corrected magnitude **9.902535 m/s² (+0.977759%)**. The host raw sampler's bounded initial status retries, strict measurement/final checks and exclusive evidence-file creation are documented in [tools](TOOLS.md).

The USB installer saved **`n2-20261126-v2`**, verified all arrays after reboot and retained firmware `795d041`, saved Wi-Fi and 256 indexed local records. Atlas confirmed the new revision, a post-install boot and healthy synchronized reporting. Twelve new device-corrected samples at **10:42:07–10:43:57 IST** passed all recorded checks, mean magnitude **9.881484 m/s² (+0.763098%)**, mean X/Y **0.248330/-0.136077 m/s²**, with low variation. No second correction was applied during analysis.

See [the complete calibration history](CALIBRATION.md), [v2 raw-data analysis](calibration/node2-v2-validation-result-2026-11-26.json) and [device-corrected result](calibration/node2-v2-on-device-validation-2026-11-26.json). This establishes persistent applied v2 correction and a **limited supported-pose numeric bench pass**. Physical level was not externally verified; full orientation/temperature accuracy, post-calibration movement/threshold acceptance, deliberate fault/rollback and endurance remain separate work. Node 3 was requested next; no calibration values were copied to it.

An authenticated live browser/API checkpoint at **10:49 IST** confirmed both applied revision labels in the deployed dashboard. The [reviewed screenshot](images/dashboard-calibration-two-nodes.png) records three online nodes, with Node 3 still uncorrected and Node 4 last seen November 25. This is not another simultaneous four-node group test or a controlled movement test; handling notifications remain visible in history.

## Node 3 supported-pose numeric bench pass — November 26

Six completed signed raw references produced per-node candidate v1. Two interrupted USB attempts were retained and excluded; separate cloud windows used the existing twelve-sample/100-second protocol with identity revision `none`. The fresh independent offline check passed at **+1.745828%** mean magnitude error. No validation readings were used to refit the coefficients.

The guarded USB installer saved **`n3-20261126-v1`** and verified matching coefficients after reboot at approximately **11:29 IST**, retaining firmware `795d041`, saved Wi-Fi and 256 records. No reflash or portal was required. Atlas confirmed the new boot and revision. A fresh device-corrected twelve-sample/110-second window passed all original numeric and provenance checks: mean magnitude **9.939455 m/s² (+1.354238%)**, mean X/Y **0.009687 / -0.018704 m/s²**, all per-axis standard deviations below 0.15 m/s². No second correction was applied.

See [offline evidence](calibration/node3-v1-offline-validation-2026-11-26.json), [installation evidence](calibration/node3-v1-installation-2026-11-26.json), [device-corrected evidence](calibration/node3-v1-on-device-validation-2026-11-26.json) and [complete procedure/history](CALIBRATION.md). This verifies persistent applied correction and a limited supported-pose numeric screen; visual level, sparse sampling and outstanding movement/threshold, deliberate power-cut/rollback and endurance limits remain explicit.

The authenticated dashboard/API at **11:33:23 IST** showed Nodes 1/2/3 online with their own revisions; [the reviewed screenshot](images/dashboard-calibration-three-nodes.png) records that state. Node 4 remained last seen November 25 with revision `none`. This does not establish a four-node group pass or fresh controlled movement acceptance.

## Node 4 supported-pose numeric bench pass — November 26

Node 4 was verified on COM6 while COM5 remained Node 3. Six accepted raw-identity cloud references produced its own candidate; the first Y-down attempt failed the unchanged per-axis stability limit and was retained/excluded, followed by a separate full passing retry. The independent component-up offline validation passed at **-1.097407%** mean magnitude error, with no validation-data refit.

The guarded USB installer saved **`n4-20261126-v1`** and verified matching coefficients after reboot at approximately **12:24 IST**, retaining firmware `795d041`, saved Wi-Fi and 256 local records. No portal, BOOT intervention or firmware/filesystem replacement was required. Atlas confirmed the new boot/revision and restored reporting. A fresh device-corrected twelve-sample/110-second window passed all original numeric and provenance limits: mean magnitude **9.702494 m/s² (-1.062093%)**, mean X/Y **-0.083749 / -0.070640 m/s²**, and each axis's standard deviation below 0.15 m/s². No second correction was applied.

See [offline validation](calibration/node4-v1-offline-validation-2026-11-26.json), [installation evidence](calibration/node4-v1-installation-2026-11-26.json), [device validation](calibration/node4-v1-on-device-validation-2026-11-26.json) and [complete calibration history](CALIBRATION.md). All four nodes now have their own applied correction and recorded limited numeric bench screen. Visual fixture level was not externally verified, and full orientation/temperature, post-calibration movement/threshold, controlled power-cut/rollback and endurance acceptance remain open.

The authenticated dashboard/API at approximately **12:28 IST** showed all four revision labels; the [reviewed screenshot](images/dashboard-calibration-four-revisions.png) records Nodes 2/3/4 online and Node 1 last seen at **11:35:47 IST**. This is not a simultaneous four-node group pass. Node 1 must report again before the next group check; controlled movement/threshold checks precede deliberate fault/rollback work.

## Post-calibration group reporting — November 26

After the operator restored all four nodes, a declared **12:49:05–12:51:05 IST** window produced 49 unique periodic records across the fleet: 12/12/12/13 samples for Nodes 1/2/3/4, respectively, each spanning at least 110 seconds. Six Atlas health snapshots showed fresh reporting, unchanged boot IDs within the observation, expected firmware/calibration revisions, healthy sensor/storage/time flags, 256 retained records and all three peers on channel 6 for every node. Queues ranged from zero to one; all reached zero, though Node 3's final snapshot still reported one pending. The subsequent authenticated dashboard/API at approximately **12:52 IST** showed four online and zero pending for all four.

See [group procedure/results](GROUP-CHECK-2026-11-26.md), [raw evidence](calibration/postcal-group-check-2026-11-26.json) and the [reviewed dashboard capture](images/dashboard-postcal-group-2026-11-26.png). This confirms short simultaneous calibrated reporting and reciprocal discovery after Node 1 returned. Movement alerts were visible, but no operator-confirmed stillness baseline or controlled motion was performed in this window. Quiet-baseline/threshold, controlled per-node movement, power-cut/rollback and endurance acceptance remain separate work.

## Operator-confirmed stillness baseline — November 26

After the operator confirmed all four still, a separate **12:54:28–12:56:28 IST** capture recorded 49 periodic samples and zero received movement events. Node 1 had thirteen samples spanning 120 seconds; Nodes 2/3/4 had twelve spanning 110/111/110 seconds. Expected firmware/calibration revisions and stable boots were verified. Final health showed all sensors/storage/time ready and running mode; pending counts were 0/0/0/1 for Nodes 1/2/3/4. Per-axis sample standard deviations ranged approximately 0.016–0.047 m/s². No settings changed.

[Full baseline evidence](calibration/postcal-stillness-baseline-2026-11-26.json) and the [updated group procedure](GROUP-CHECK-2026-11-26.md) preserve the limited pass and its boundaries: this is not a false-alarm-rate estimate, high-rate noise characterization, physical accuracy validation or minimum-motion threshold test. Node 1's controlled movement phase was marked at **12:57:57 IST** and requested from the operator; its result remains pending. Power-cut/rollback and endurance acceptance remain open.

## Node 1 first post-calibration movement trial — November 26

The operator moved Node 1 and confirmed completion. Four fresh movement records captured **12:58:16–12:58:23 IST** had matching notifications and the expected Node ID, firmware, boot and revision. Node 2 also produced one alert at 12:58:16 IST, delta 1.532366 m/s². The operator confirmed that shared supports or wires could have disturbed it. Thus target detection/delivery is verified, but isolated-node acceptance is inconclusive; no threshold was changed and no false-positive cause is asserted. All nodes remained healthy/reporting at the subsequent checkpoint. See [trial evidence](calibration/node1-postcal-movement-trial1-2026-11-26.json) and the [movement procedure/history](MOVEMENT-CHECK-2026-11-26.md). A separated-support baseline and repeat were requested.

The operator then confirmed Node 1 on separate support. A new **13:01:14–13:03:14 IST** stillness window recorded twelve periodic samples per node, spans 109/110/110/110 seconds, with zero received movement events and expected stable firmware/revision/boot state. Health remained good; pending counts were 0/0/0/1. [Separated-support evidence](calibration/node1-isolated-baseline-2026-11-26.json) preserves this limited pass. A new isolated Node 1 movement phase was marked at **13:04:21 IST** and requested; its controlled result remains pending.

## Node 1 isolated repeat and Node 2 movement delivery — November 26

Node 1's separated-support repeat produced four fresh events captured **13:04:53–13:05:01 IST**, all with matching notifications, expected firmware/revision and stable boot. No other node movement was received through 13:05:38 IST; all four were healthy with zero pending at the follow-up checkpoint. [Node 1 repeat evidence](calibration/node1-postcal-movement-isolated-2026-11-26.json) establishes a limited isolated gross-motion delivery pass while preserving the earlier confounded trial.

Node 2 then produced two events captured **13:06:28 / 13:06:30 IST**, with matching notifications and expected revision `n2-20261126-v2`, firmware and boot. No other movement was received through 13:06:48 IST; all nodes remained healthy and queues were zero at the follow-up checkpoint. [Node 2 evidence](calibration/node2-postcal-movement-2026-11-26.json) records its limited pass. These operator-controlled tilt tests do not establish a quantified sensitivity, false-alarm rate or production acceptance. The user paused before Node 3's movement instruction; Nodes 3/4 checks and fault/rollback/endurance work remain outstanding. See the [movement procedure](MOVEMENT-CHECK-2026-11-26.md).

## Node 3/4 movement delivery and resumed fleet — November 26

On resumption, all four had setup-mode heartbeats and substantial queues. Read-only identity/status checks confirmed unchanged firmware/revisions/boots, and uploads recovered. Node 3's fallback portal was closed over its verified COM5 USB connection without changing settings. At **14:17:23 IST**, all four reported running, healthy, synchronized and zero pending. [Recovery snapshots](calibration/movement-resume-recovery-2026-11-26.json) retain the earlier queue states; this was observed recovery, not a controlled fault test.

Node 3's fresh test produced three movement events captured **14:17:43–14:17:47 IST**, each with matching notification and expected firmware/revision/boot. No other node movement was received through 14:18:03 IST; final health was good with zero queues. Node 4's test produced one event captured **14:19:03 IST**, received **14:19:06.272 IST**, delta 2.884526 m/s², with matching notification and expected state. No other movement was received through 14:19:20 IST. All nodes remained healthy with unchanged boots; Node 4's queue was zero, while later other-node in-flight counts were retained rather than claimed delivered.

See [Node 3 evidence](calibration/node3-postcal-movement-2026-11-26.json), [Node 4 evidence](calibration/node4-postcal-movement-2026-11-26.json) and [the full movement record](MOVEMENT-CHECK-2026-11-26.md). All four now have a limited isolated gross-motion detection/delivery pass. Thresholds remained unchanged; quantified minimum-motion sensitivity, false-alarm rate, settling/cooldown, full accuracy, controlled power-cut/rollback and endurance acceptance are not established by these tests.

The authenticated production dashboard/API at approximately **14:20 IST** showed all four online, saved revisions, and highlighted Node 3/4 alerts. [Reviewed screenshot](images/dashboard-postcal-movement-2026-11-26.png) records that instant with all queues zero. Later small pending values reflect separate instantaneous observations.

## Recovery and fallback-portal fix production rollout — November 26

Nodes 1–3 passed limited normal power-cycle recovery checks. Node 4's original recovery restored data/connectivity but needed portal-close intervention. The fallback fix then passed a real bench-image power-cycle repeat without intervention, a simulated 45-second station disconnect with automatic AP closure, manual USB portal preservation, and a real laptop-client takeover test that kept the setup page usable after recovery. Each post-cycle journal scan validated 256 records with zero invalid. The laptop returned to Sensor Testing. See [recovery checks](RECOVERY-CHECKS-2026-11-26.md) and [full fix validation](PORTAL-RECOVERY-FIX.md), which preserve the earlier failure and scope limits.

Production build and bench build passed. The published artifact for **`d05bb40d0aa60753ce58f1caa75c7e0c397d0edf`** matched its manifest: **1,233,952 bytes**, SHA-256 **`d733fdcf1f10135cd9cf2945d7294d084837f1392b3d9c8609a58fbf7f40003d`**. [Release workflow](https://github.com/rohitlaikhuman8-ui/IOTProject/actions/runs/45861131780) succeeded. The production artifact excludes the bench disconnect diagnostic. Node 4's identity-guarded application install preserved NVS/filesystem and passed whole-image verification after one section retry; OTA was restored. Nodes 2/3 updated over OTA after USB scheduling; Node 1 updated on its normal scheduled poll. Serial readback on Nodes 2/3 confirmed `pendingVerification=false`; Node 1's corresponding flag was not directly read over USB.

[Final adoption evidence](calibration/portal-recovery-fleet-adoption-2026-11-26.json) verifies all four release versions and saved revisions, healthy running/sensor/storage/time flags, 256 indexed records each, reciprocal three-peer listings on channel 13 and fresh stored periodic events for each current boot. At **22:27:48 IST**, authenticated dashboard/API showed four online and queues zero; the [reviewed screenshot](images/dashboard-portal-recovery-release-2026-11-26.png) records that instant. Earlier snapshot pending counts are retained separately. No bench firmware remains. This completes the observed fix rollout, not exact record-ID continuity, interrupted-write/brownout/intentional rollback, quantified threshold/false-alarm or endurance acceptance.

## Node 4 network-only queued delivery — November 27

The [clean retry](QUEUED-DATA-RETRY-2026-11-27.md) passed delivery of ten immutable selected samples. Full local export during the hotspot block had 256 records and 19–20 pending; all ten selected IDs were absent from Atlas before restoration. After operator unblocking, each appeared once with every original field unchanged, server receipt time retained separately. Node 4 eventually resumed normal reporting, and its queue reached zero by 10:51:05 IST. Final cloud snapshots showed all four healthy/running/time-synchronized with zero queues and unchanged boots, release and revisions. USB confirmed Node 4's exact calibration readback, valid IP, portal inactive, 256 local records and zero pending.

The manual portal expired normally, and recovery needed no reset/settings/firmware intervention. A transient connected flag with IP `0.0.0.0` and delayed reporting was observed before recovery; physical unblocking time was not instrumented. The planned short interval expanded awaiting operator restoration. This passes eventual selected-record network recovery on Node 4, not a bounded reconnect deadline, fleet-wide queue continuity, queue-full behavior, pending-write/brownout/intentional rollback or endurance acceptance. The prior November 26 disturbed attempt remains inconclusive.

## Node 4 selected-record exact retention — November 26

Full local exports before and after the operator-confirmed power-cycle contained 256 records each. All thirty original tracked IDs and one additional recent record survived with identical raw payload hashes. Every one of the 199 common IDs had unchanged contents; 57 older IDs outside the protected set were absent as 57 new records arrived. Export epochs were approximately 610.357 seconds apart. Same-node/firmware/calibration checks passed, and recent records showed a new boot. The first post-cycle capture stopped at queue drainage and is retained as incomplete; the independent retry captured the actual post-cycle queue without changing baseline/hash criteria. Laptop Wi-Fi was restored after both attempts.

[Comparison evidence](calibration/node4-retention-comparison-2026-11-26.json) and the [complete retention record](RECORD-RETENTION-CHECK.md) link the original bytes, metadata, failed attempt and final healthy fleet checkpoint. Four offline fault-injection tests verified rejection of changed payloads, missing recent records despite unchanged counts, and archive corruption, while allowing legitimate old-record rotation. This is exact survival of the selected records on Node 4, not permanent retention of every baseline record or pending-record interrupted-write, brownout, rollback, all-node continuity or endurance acceptance.

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

## Offline presence check

Entering the actual setup AP paused the node's station networking while local samples continued. The dashboard showed zero online nodes with a heartbeat age of 88,293 ms, and its offline graph was captured. This exercised real node disconnection rather than a simulated browser fixture.

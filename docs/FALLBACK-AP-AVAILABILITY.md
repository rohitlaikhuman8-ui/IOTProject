# Fallback AP availability — November 27, 2026

## Problem and scope

During the [pending-record power-cycle repeat](PENDING-POWER-RECOVERY-2026-11-27.md), Node 4 returned on USB with healthy storage/sensor and unchanged calibration, but the laptop could not join its fallback AP while the hotspot entry remained blocked. Status simultaneously showed `wifiConnected=true` and station IP `0.0.0.0`. The isolated post-cut local comparison was therefore incomplete. Later network recovery, a new boot and delivery of all ten original pre-cut payloads were verified separately. Preserve that failed capture; do not retrospectively mark it passed.

Code inspection found a definite readiness bug: association status alone gated network workers and recovery. The shared-radio effect of repeated station connection attempts is a plausible contributor to AP unavailability, not an electrically or RF-instrumented diagnosis. [Espressif's version-matched Wi-Fi guide](https://docs.espressif.com/projects/esp-idf/en/v4.4.4/esp32/api-guides/wifi.html) distinguishes the got-IP phase from association and describes the shared home channel in AP/STA coexistence. The installed Arduino core source was also inspected locally.

## Candidate behavior

The candidate is developed on `codex/fallback-ap-availability`. It is not released to the fleet until hardware validation is complete.

- Network readiness requires STA mode, connected status and a nonzero/nonbroadcast IPv4 address. Uploads, heartbeats, OTA, discovery, time startup, boot validation, recovery and LED status use this check. Serial retains a separate `wifiAssociated` flag so an associated/no-IP condition is visible.
- Application-controlled station retries replace background auto-reconnect. Outside setup, a failed/no-IP connection is explicitly disconnected without erasing settings and retried approximately every thirty seconds.
- If setup opens without a usable station IP, it starts in AP-only mode on channel 1. Station scans stay paused for sixty seconds. With no AP client, a saved-network probe may then run in AP/STA mode for at most fifteen seconds. Failure returns to AP-only mode; a valid IP permits normal cloud operation and the existing recovery closure checks.
- Any AP client holds the offline station pause; after the last client leaves, a fresh sixty-second interval precedes another probe. This keeps local access usable but intentionally defers cloud reconnect attempts during an offline setup-client session. Close setup when finished to resume station retries immediately, or leave the AP and wait for the next probe.
- A setup session opened while station Wi-Fi already has a valid IP retains AP/STA operation. If that station fails, it switches to the same stable AP-only recovery behavior. A client claiming an automatic portal still promotes it to manual use.
- Existing manual/automatic ownership, fifteen-minute portal expiry, fifteen-second healthy-cloud closure and update/restart protections remain. No config/calibration/storage schema changes or erasure are introduced.

Serial diagnostics add `wifiAssociated`, `wifiMode`, `apClients`, `portalStationPaused` and `portalStationProbe`. Portal `/status` adds IP readiness, client count and station-pause state, with a plain-language explanation while retries are paused. A recent historical cloud success must not be shown as connected when station IP readiness has been lost.

## Validation in progress

Production and isolated bench candidates compile for the pinned classic ESP32/Arduino 2.0.17 target. The production image excludes bench commands by default. A dedicated Node 4 image identifies itself as `usb-ap-availability-bench`, defines `FLEET_PORTAL_RECOVERY_BENCH`, and disables OTA. Never publish this image or its OTA-disabled header to the stable fleet channel.

Before the bench application install, COM6 was verified as `esp32-3013a5f4e9d4`, production `d05bb40`, with healthy Wi-Fi/storage, no active setup/pending boot validation and a low queue. The installer checks MAC `d4:e9:f4:a5:13:30`, privately backs up boot/settings, validates partition bounds, verifies each written application section and the complete image, and preserves NVS/LittleFS. Private backups and credentials stay outside Git.

Run the Windows hardware test only on that isolated bench image:

```powershell
python scripts/test-fallback-ap.py --port COM6 --node esp32-3013a5f4e9d4 --revision n4-20261126-v1 --output work/ap-availability-new-trial
```

It rejects existing evidence paths, checks identity/version/revision, uses a bench-only timed disconnect, joins the real fallback AP, verifies a complete 256-record HTTP export, stays joined beyond the sixty-second retry interval, and requires station scans to remain paused. It then restores the laptop's original network and checks manual portal ownership across station/cloud recovery. A second timed disconnect without a client checks automatic recovery and portal closure. It removes temporary profiles/private XML and records failures without exposing AP credentials. These are hardware simulation checks; actual blocked-hotspot cold-boot access and physical touch takeover need separate evidence.

**Current release status: candidate/bench validation only.** No main/fleet release is claimed, and Node 4 must be returned to production OTA behavior before treating the work as complete. Measured brownout, flash-write interruption, intentional rollback, capacity and endurance remain separate acceptance work.

## First hardware trial retained

The bench application installation completed with section and complete-image verification and no BOOT intervention. [Build evidence](calibration/ap-availability-candidate-builds-2026-11-27.json) records the production candidate at 1,236,000 bytes and bench image at 1,187,872 bytes; binary inspection found the bench disconnect command only in the bench image. These are local candidate artifacts, not released commit-stamped assets.

The [first trial](calibration/node4-ap-availability-trial1-2026-11-27.json) successfully joined the actual AP-only fallback, exported 256 distinct records in a complete 109,267-byte HTTP body, and kept a client attached for 68 seconds with station retries paused. It then failed while waiting for USB status during recovery. The test restored Sensor Testing, removed its temporary profile/private XML and closed only its own portal. This is a partial test, not a complete recovery pass.

The helper originally parsed each timed `readline()` result as a complete JSON line. A serial timeout can split a diagnostic across reads, so the revised helper accumulates bounded bytes until newline and retains timeout evidence. The original failed trial remains unchanged. A separate second trial reruns all hardware assertions; acceptance criteria were not loosened.

## Complete simulated hardware trial passed

The [second trial](calibration/node4-ap-availability-trial2-2026-11-27.json) passed all assertions, with 45 USB status observations and 17 client HTTP observations, no serial-read timeout, and a **65.235-second** continuous client hold beyond the sixty-second retry interval. Its [full exported bytes](retention/node4-ap-availability-trial2-2026-11-27.ndjson) contain 256 unique same-node records, **108,484 bytes**, SHA-256 `1110304df43b3f3567658dd3e175714a816f17fd978de82970273e4ee596e7b6`. Complete HTTP length/hash and JSON identity checks passed.

While the client remained attached, AP-only mode and station pause held and no IP readiness was falsely reported. After the laptop returned to Sensor Testing, Node 4 resumed saved-network/cloud operation while retaining manual portal ownership. A second timed disconnect without a client opened fallback, reconnected and closed it automatically. Final USB status had a valid station IP, setup inactive, healthy sensor/storage, 256 local records and unchanged calibration, with 26 pending at that instant. Later cloud preflight showed that backlog cleared; do not equate test completion with an always-zero queue. The calibration also matched the independent pre-install production snapshot exactly.

The final production candidate was rebuilt with version `usb-ap-availability-candidate` and no bench/OTA-disable flags; [build evidence](calibration/ap-availability-candidate-builds-2026-11-27.json) retains its separate size/hash and verifies the bench command is absent. Node 4 still runs the isolated bench image for the final real-network test, with OTA intentionally disabled. Nodes 1–3 remain on production `d05bb40`. No main/release change has occurred.

## Real blocked-hotspot startup test prepared

Before the final check, all four had fresh healthy reporting and Node 4's queue was zero, under bench boot `994e53c2b550afb8dc175ce38b4be77d`. The operator was asked to block only Node 4 in the hotspot, leaving USB and the other network clients unchanged. After confirmation, reverify USB identity, perform one deliberate USB reset on that exact board, and allow the AP-only fallback to start. Join using the existing privately saved AP credential, require offline IP readiness/station pause and a real connected AP client, then verify a complete 256-record local export. Restore the laptop network, remove the temporary profile, ask the operator to unblock promptly, and verify a new boot, healthy cloud recovery and no manual portal left active. A reset is part of this availability diagnostic; it is not a power-cut/write-interruption test.

## Real blocked-hotspot startup AP export passed

The operator confirmed **“Node 4 blocked for AP check.”** A cloud checkpoint showed Node 4's report stop while peers remained fresh on their original production boots. USB reverified the exact node/bench version/calibration and no AP clients or pending OTA boot validation. A single deliberate RTS reset was issued; [reset/status evidence](calibration/node4-ap-availability-cold-reset-2026-11-27.json) records the pre/post observations without publishing credentials. No power-cable change, erase or config write was used.

The restarted node reached automatic AP-only mode (`wifiMode=2`), station retries paused, no usable station IP and time synchronization pending, as expected while blocked. The Windows laptop joined its setup AP and obtained the entire 256-record local log. [Capture metadata](calibration/node4-ap-availability-cold-capture-2026-11-27.json), [raw original export](retention/node4-ap-availability-cold-2026-11-27.ndjson) and [independent validation summary](calibration/node4-ap-availability-cold-summary-2026-11-27.json) preserve complete-file/per-record hashes, the real AP client, no false cloud-ready state and local pending counts **14 before / 15 after**. A new boot absent from the previous full bench export was found with the expected bench version and saved calibration. USB coefficients before/after reset matched exactly. This passes actual blocked-startup AP availability on this hardware/hotspot, not supply interruption or flash-write safety.

The laptop returned to Sensor Testing and the temporary profile/private XML were removed. The operator was immediately asked to unblock Node 4 with USB unchanged. **Pending:** restoration confirmation, new-boot cloud recovery, final production release and actual fleet adoption. The hash-verified previous production binary remains privately available for recovery; Node 4 still temporarily runs the OTA-disabled bench image until these release stages finish.

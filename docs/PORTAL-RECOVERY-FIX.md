# Automatic fallback portal recovery — development validation

## Status

Implementation is on **`codex/fallback-portal-recovery`**, not main. Node 4 (`esp32-3013a5f4e9d4`, verified COM7) runs **`usb-portal-recovery-bench`** with OTA checks disabled for bench isolation. Other nodes remain on the published firmware. **This is not yet a fleet release.** Real power-cycle repeat and final release verification remain outstanding.

The earlier [Node 4 recovery test](RECOVERY-CHECKS-2026-11-26.md) restored data and connectivity but needed USB intervention to close fallback setup. The former implementation used the same fifteen-minute portal lifetime for manual setup and automatic network fallback.

## Changed behavior

- A missing saved configuration, four-second touch hold or USB `portal` request opens manual setup. The normal fifteen-minute lifetime remains.
- A saved-network Wi-Fi outage longer than thirty seconds opens **automatic** fallback.
- Automatic fallback closes after at least **fifteen continuous seconds connected to Wi-Fi**, plus a successful cloud request since reconnection that is less than fifteen seconds old. A disconnect restarts this recovery timer. Wi-Fi association alone does not establish cloud recovery.
- A client joining the setup AP promotes it to manual use. A touch hold or explicit USB `portal` request also preserves manual use. Automatic recovery does not close these portals. Normal lifetime and explicit close still apply.
- Pending restart and OTA activity defer automatic closure. The elapsed-time comparisons use unsigned arithmetic for `millis()` wrap. Status includes `portalAutomatic` for diagnosis.

The change does not write Wi-Fi credentials, calibration or records. `portal-close` remains available and retains saved settings. The AP remains protected as before.

## Bench implementation and evidence

The dedicated bench build defines `FLEET_PORTAL_RECOVERY_BENCH` and `FLEET_ALLOW_OTA=0`. Only that build accepts the USB-only `bench-wifi-drop` command: it temporarily disables automatic station reconnection for 45 seconds without erasing credentials, then restores retries. This is a simulated station disconnect on real hardware, not a measured RF outage or brownout. The production build does not define the bench flag and excludes this command.

[Hardware evidence](calibration/node4-portal-recovery-bench-2026-11-26.json) records 24 status observations and device messages. The fallback opened while disconnected, then closed automatically after Wi-Fi/cloud recovery, with no USB close command during the automatic phase. A subsequent USB-requested manual portal remained active during a connected observation longer than fifteen seconds, then was explicitly closed for cleanup. Final status retained revision `n4-20261126-v1`, 256 indexed records, responding sensor/storage and setup inactive. These are availability/state checks, not an exact pre/post record-ID comparison. The physical AP-client takeover branch and timer wrap were not exercised by this hardware trial.

Both configurations compiled successfully: bench binary **1,185,920 bytes**, SHA-256 `994b3880fe212967733ce11a5a101b199c4a1c3c6eb7501275aef8bd53f02f5f`; production candidate binary **1,234,096 bytes**, SHA-256 `a27aff51cd53ef534cbce3c9380ebdf85981d63318f53f58fbba2a54ab929ebe`. Node 4's boot/settings area was backed up privately and MAC/partition bounds checked before a section-verified application upload and full-image verification. NVS and LittleFS were retained; no BOOT intervention was needed. Private backups contain credentials and are excluded from Git.

## Reproduce the controlled bench check

Use an isolated, identity-verified bench node with serial access. The test deliberately disconnects that node's station and opens/closes setup; do not run during operational monitoring. Preserve a known-good firmware recovery image and private settings backup. Never publish a bench image to the fleet channel.

For the bench build, the ignored `firmware/src/release-version.h` contains:

```cpp
#define FLEET_VERSION "usb-portal-recovery-bench"
#define FLEET_ALLOW_OTA 0
#define FLEET_PORTAL_RECOVERY_BENCH 1
```

Build with `python -m platformio run -d firmware`. Installation must preserve NVS/filesystem and verify the exact target MAC and partition bounds; use the project's existing [hardware procedures](HARDWARE.md). Test with Python/pyserial installed:

```powershell
python scripts/test-portal-recovery.py --port COM7 --node esp32-3013a5f4e9d4 --revision n4-20261126-v1 --output work/portal-recovery-new-evidence.json
```

The helper rejects an existing output file, checks bench firmware/revision, records automatic opening/closure and manual preservation, then explicitly closes the manual portal for cleanup. It is a hardware integration test, not a CI simulator. Failed observations must be retained. An AP client automatically joining during the automatic phase will intentionally prevent automatic closure, so ensure the laptop/phone does not auto-join that setup SSID during this specific trial.

For production validation, remove the bench and OTA-disable definitions; release CI generates only the release version. The production candidate was compiled separately and has not been installed on Node 4 or released to the fleet yet.

## Before release

### Repeat preflight checkpoint

At **22:01:42 IST**, Node 4 on COM7 was running the bench image, connected to saved Wi-Fi, setup inactive and calibration arrays unchanged from the pre-flash status. A fresh read-only scan validated **256 records, zero invalid**, in **24,625 ms**. [Repeat preflight](calibration/node4-portal-fix-power-cycle-before-2026-11-26.json) records an instantaneous eighteen pending uploads; they are retained, not declared delivered. [Fleet snapshot](calibration/node4-portal-fix-cloud-before-2026-11-26.json) had counts 1/8/0/17 shortly beforehand, with all nodes reporting healthy/running/synchronized. These snapshots are not proof of drained queues or throughput acceptance.

Node 4's pre-repeat boot is **`64deba6b178d0fd57a6cd748cf94cb82`**. The serial check has finished. A USB-only ten-second power-cycle repeat is requested next, without any `portal-close` intervention afterward. Record both automatic connection recovery and queue behavior. Node 4 still has OTA disabled in its bench image; restore production firmware only after finalizing the release.

1. Recheck Node 4's local journal and repeat its normal USB-only power-cycle with no portal-close intervention. Confirm saved calibration, Wi-Fi, synchronized time, running mode, fresh cloud events and new boot.
2. Exercise setup-client ownership, preserving any manual session, and verify the unflagged production build has no bench command. Retain limitations for timing edge cases not exercised.
3. Update this record and [recovery results](RECOVERY-CHECKS-2026-11-26.md). Only after validation finalize main and let the existing release workflow publish the production artifact. Verify actual node adoption; a successful build alone is not a completed rollout.
4. Restore production OTA behavior on Node 4 and verify it reports the production version. The bench version must not be left as an accepted production endpoint.

Interrupted-write, measured brownout, intentional rollback and endurance acceptance remain separate work after this fix and recovery repeat.

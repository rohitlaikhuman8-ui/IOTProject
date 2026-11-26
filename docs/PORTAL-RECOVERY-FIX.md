# Automatic fallback portal recovery — development validation

## Status

The fix is finalized on main as production release **`d05bb40d0aa60753ce58f1caa75c7e0c397d0edf`**, and **all four nodes adopted it**. [Actions run 45861131780](https://github.com/rohitlaikhuman8-ui/IOTProject/actions/runs/45861131780) succeeded. Node 1 updated on its normal automatic poll, Nodes 2/3 updated through OTA after USB scheduling, and Node 4 was restored from its isolated bench image to the verified production artifact. OTA is reenabled on Node 4. [Final adoption evidence](calibration/portal-recovery-fleet-adoption-2026-11-26.json) and the [reviewed dashboard](images/dashboard-portal-recovery-release-2026-11-26.png) verify current reporting.

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

For production validation, remove the bench and OTA-disable definitions; release CI generates only the release version. The initial production candidate was compiled separately; the later published artifact and installation are recorded below.

## Completed real power-cycle and AP-client checks

The operator confirmed **“Node 4 fixed-firmware power-cycle done.”** The new boot **`05c1f980c2cbe39a020241ec79a4d0d9`** replaced `64deba6b178d0fd57a6cd748cf94cb82`. Initial serial status restored saved Wi-Fi/calibration with setup inactive while time sync was pending; subsequent cloud status at approximately **22:04:27 IST** showed running, synchronized, healthy and zero pending, without a portal-close command. Other nodes retained their preflight boot IDs. Startup was received **22:03:54.973 IST**, and fresh timestamped events under the new boot are preserved in [cloud evidence](calibration/node4-fixed-power-cycle-cloud-2026-11-26.json). The post-cycle scan validated **256 records, zero invalid**, in **23,879 ms**. [Device evidence](calibration/node4-fixed-power-cycle-result-2026-11-26.json) confirms unchanged coefficients. This is a limited normal recovery pass, not exact record-ID continuity or interrupted-write acceptance.

A separate [real AP-client ownership test](calibration/node4-portal-client-ownership-2026-11-26.json) then simulated the station disconnect, let the automatic AP open, and connected the Windows laptop to it using a temporary local Wi-Fi profile. The automatic portal became client-owned and stayed active for at least twenty seconds after station Wi-Fi recovery, longer than the automatic-close delay. An HTTP request to `http://192.168.4.1/` returned the actual setup page successfully. The laptop was restored to **Sensor Testing**; its temporary profile/private credential file were removed. An explicit portal-close was used only to clean up this separate client test, not during the power-cycle repeat. Final serial status retained calibration and normal cloud reporting. Physical touch takeover and timer wrap are not separately hardware-tested; manual USB takeover and actual AP-client ownership were tested.

The production binary was checked to exclude the bench-only `bench-wifi-drop` command; the bench binary contains it. The hardware helper compiled successfully. Original intervention-assisted recovery evidence remains intact.

## Release completion procedure

### Published artifact and verified production restoration

The public Vercel manifest advertised the expected full release SHA. The downloaded published binary was **1,233,952 bytes**, SHA-256 **`d733fdcf1f10135cd9cf2945d7294d084837f1392b3d9c8609a58fbf7f40003d`**, matching its manifest exactly. Release CI stamps the full release version; the local candidate and published artifact are separately identified. [Release evidence](calibration/portal-recovery-production-release-2026-11-26.json) records metadata and serial checkpoints.

Node 4's production installation reverified its MAC and partition bounds, backed up boot/settings privately, wrote application sections, verified the full image and retained NVS/LittleFS. One section hit a serial-stream interruption; its retry and the whole-image verification succeeded. No BOOT intervention was needed. Production serial status confirmed its saved coefficients, 256 indexed records, portal inactive and no pending boot verification. A subsequent USB `ota-check` acknowledged scheduling, confirming normal OTA behavior is enabled again.

Nodes 2/3 adopted the production version through OTA and serial readback confirmed their saved calibrations, 256 indexed records, portal inactive and `pendingVerification=false`. Node 1 remains on its scheduled polling path; do not infer its adoption from the workflow success or the other nodes' status. The numbered procedure below describes the release stages; completed hardware checks and production-restoration evidence above supersede their earlier pending states.

### Final four-node adoption — 22:27 IST

Node 1 entered updating on its normal poll at approximately **22:24:33 IST**, then reported the production version under new boot `1534b0f5c8e8d2b7b98539dcbb51b54b` by **22:25:52 IST**. No USB scheduling was used for it. Final Atlas checks verified all four expected versions/revisions, healthy sensor/storage/time, running mode, 256 indexed records each, three peer listings each on channel 13, and two fresh stored periodic events per current boot. The snapshot's pending counts were **0/0/1/0**; these are retained rather than rewritten to zero. Node 1's boot-validation flag was not directly read over USB, while its live healthy reporting and new-boot events were verified.

The authenticated production dashboard/API at **22:27:48 IST** showed **4 of 4 online**, the new version and saved calibration labels, with queues **0/0/0/0** at that later instant. The [reviewed screenshot](images/dashboard-portal-recovery-release-2026-11-26.png) preserves this checkpoint. No bench firmware remains on the fleet. This completes this fallback-recovery fix and observed production rollout; it does not establish interrupted-write, measured brownout, intentional failed-image rollback, exact record-ID continuity, quantified sensitivity/false-alarm rate or endurance acceptance.

### Repeat preflight checkpoint

At **22:01:42 IST**, Node 4 on COM7 was running the bench image, connected to saved Wi-Fi, setup inactive and calibration arrays unchanged from the pre-flash status. A fresh read-only scan validated **256 records, zero invalid**, in **24,625 ms**. [Repeat preflight](calibration/node4-portal-fix-power-cycle-before-2026-11-26.json) records an instantaneous eighteen pending uploads; they are retained, not declared delivered. [Fleet snapshot](calibration/node4-portal-fix-cloud-before-2026-11-26.json) had counts 1/8/0/17 shortly beforehand, with all nodes reporting healthy/running/synchronized. These snapshots are not proof of drained queues or throughput acceptance.

Node 4's pre-repeat boot is **`64deba6b178d0fd57a6cd748cf94cb82`**. The serial check has finished. A USB-only ten-second power-cycle repeat is requested next, without any `portal-close` intervention afterward. Record both automatic connection recovery and queue behavior. Node 4 still has OTA disabled in its bench image; restore production firmware only after finalizing the release.

1. Recheck Node 4's local journal and repeat its normal USB-only power-cycle with no portal-close intervention. Confirm saved calibration, Wi-Fi, synchronized time, running mode, fresh cloud events and new boot.
2. Exercise setup-client ownership, preserving any manual session, and verify the unflagged production build has no bench command. Retain limitations for timing edge cases not exercised.
3. Update this record and [recovery results](RECOVERY-CHECKS-2026-11-26.md). Only after validation finalize main and let the existing release workflow publish the production artifact. Verify actual node adoption; a successful build alone is not a completed rollout.
4. Restore production OTA behavior on Node 4 and verify it reports the production version. The bench version must not be left as an accepted production endpoint.

Interrupted-write, measured brownout, intentional rollback and endurance acceptance remain separate work after this fix and recovery repeat.

# Isolated write/reset, brownout and rollback checks — November 27, 2026

## Scope and equipment

The operator requested the remaining checks and confirmed **USB cable only**. Node 4 (`esp32-3013a5f4e9d4`, MAC `d4:e9:f4:a5:13:30`, verified COM6) is the isolated target. Nodes 1–3 retain production release `c0e1dc4`; the stable OTA manifest is not changed for these tests. The [completed pending-data power-cut test](PENDING-POWER-REPEAT-2026-11-27.md) remains separate evidence.

| Check | Current scope/status |
| --- | --- |
| Committed pending records across observed USB power removal | Passed separately for ten fixed Node 4 records |
| Health-timeout rollback | Persisted INVALID/original VALID selection, exact protected-record continuity and healthy zero-queue recovery verified |
| Staged incomplete temporary file followed by software reset | Passed: synced partial temporary record ignored; exact protected-record continuity and normal recovery |
| Unexpected reset of an unconfirmed image | Passed: sequence 7 ABORTED; original sequence 2 VALID selected |
| Physical cut during active flash programming | Deferred: USB hand unplug does not establish write-phase timing |
| Measured brownout threshold/recovery | Deferred: no controllable supply, rail measurement or trigger equipment available |

Do not label software-reset injection as a physical write interruption or a USB unplug as a measured brownout. Brownout detection remains enabled; it is not disabled for a test. The installed SDK config has rollback enabled and brownout level selector 0. [Espressif's version-matched configuration reference](https://docs.espressif.com/projects/esp-idf/en/v4.4.4/esp32/api-reference/kconfig.html) gives a nominal threshold for that selector, with chip variation; no voltage threshold has been measured on this board.

## Production recovery prerequisites

Before maintenance, a complete 256-record local export/recent-ID set was captured in private working evidence and the setup session closed. Node 4's sensor/storage/network and saved calibration were checked. The existing published production application is **1,235,856 bytes**, SHA-256 **`8c0003519dfce3a6c33eeac754b76a974f1523810b0e0e830ae43f53c078a124`**. It is kept locally for verification and recovery; private NVS/flash backups never go to Git.

The initial flash-reader launch failed locally because its Python process lacked the existing pyserial dependency path; it did not connect or alter hardware. A retry using the correct local environment successfully read 64 KiB of boot/NVS/partition/OTA data and reset to production. MAC/partition checks established:

- NVS at `0x9000`, size `0x5000`; OTA metadata at `0xe000`, two `0x1000` sectors.
- `app0` at `0x10000` and `app1` at `0x150000`, each `0x140000` bytes.
- LittleFS at `0x290000`, size `0x160000`.
- Selected entry sequence 2, state **VALID (2)**, slot `app1`; the inactive target is `app0`.
- Both existing entry CRCs matched the version-specific calculation.

The [isolated OTA harness](../scripts/isolated-ota-check.py) is restricted to Node 4, checks its MAC on every esptool operation, requires a hash-verified known-good image and the exact classic partition layout, and verifies the active application before touching the inactive one. It privately backs up NVS/boot/OTA and the whole filesystem; inactive sections and the full staged image must verify. It never writes the active application, NVS, filesystem, bootloader or partition layout. Node 4 may show Last seen during this planned USB-loader maintenance because its application is stopped; other nodes continue operating.

The first full-size filesystem read failed at approximately 43% with corrupt serial data. No inactive slot or selection had been written. The harness preserved the failure and returned to known production. A fresh attempt reads independent 64 KiB chunks with bounded retries, requires the exact total length and verifies the assembled backup against flash before permitting an inactive-slot write. Do not accept the original partial dump as a backup, erase the device or change acceptance criteria to hide a failed read.

The chunked retry completed all 1,441,792 bytes and verified the assembled backup against flash. Two individual read failures succeeded on bounded retry and are retained in private logs. The complete inactive production clone then passed section/whole-image checks; the active image and both metadata sectors were unchanged. [Staging evidence](calibration/node4-health-rollback-staging-2026-11-27.json), [partition preflight](calibration/node4-fault-partition-preflight-2026-11-27.json), [initial incomplete-read summary](calibration/node4-fault-backup-incomplete-2026-11-27.json), and [healthy post-staging USB state](calibration/node4-health-rollback-staged-usb-2026-11-27.json) preserve these separate results. Five offline guard checks of the actual parser rejected corrupted layout/CRCs and ignored newer INVALID/ABORTED entries; [guard evidence](calibration/node4-ota-guard-checks-2026-11-27.json) contains no private flash bytes.

The [original local metadata](calibration/node4-fault-records-before-2026-11-27.json) and [raw export](retention/node4-fault-records-before-2026-11-27.ndjson) retain the protected recent record set for later exact comparisons. No active-application mutation or journal formatting occurred during staging.

## A. Health-timeout rollback of an unconfirmed production clone

This test uses the actual production bytes in the inactive slot, not a globally published failing release. With Node 4's network deliberately blocked, the staged image cannot satisfy the production cloud-health gate. It must remain PENDING_VERIFY and, after the existing three-minute timeout, call the production invalidation/rollback API and return to the previous confirmed slot.

1. Stage and verify the clone without changing the selected production entry. Preserve the known-good active application and current valid metadata sector. Return the device to its active production image after staging.
2. Only once staging/recovery is verified, ask the operator to block Node 4 alone while leaving USB connected and peers/laptop online. A later explicit activation creates one NEW (0) entry for the verified inactive slot with a larger valid sequence, preserving the confirmed entry byte for byte in its separate sector.
3. Observe USB from the first boot without another reset. Require a complete identity-verified status with `pendingVerification=true`, no usable network/cloud gate and the expected production calibration. Record time from pending observation and the running image's automatic reset/recovery.
4. After the timeout, inspect metadata. Require the staged entry **INVALID (3)**, the original confirmed entry unchanged/selected, and known production running with `pendingVerification=false`. An ABORTED (4) state indicates an unexpected-reset path, not this health-timeout criterion; preserve it separately.
5. Ask the operator to unblock Node 4 promptly. Verify saved Wi-Fi/time/cloud recovery, exact calibration/firmware, healthy journal, new-boot telemetry and queue drainage. Do not infer success merely from a reboot or unchanged version: both slots intentionally contain the same production release, so entry/slot/state evidence is required.

The harness uses the [ESP-IDF 4.4 OTA state definitions](https://docs.espressif.com/projects/esp-idf/en/v4.4.4/esp32/api-reference/system/ota.html), [two-sector selection implementation](https://github.com/espressif/esp-idf/blob/v4.4.4/components/bootloader_support/src/bootloader_common_loader.c) and [official tool CRC calculation](https://github.com/espressif/esp-idf/blob/v4.4.4/components/app_update/otatool.py). It validates CRC behavior against real metadata before activation. Changing the inactive selection is an isolated acceptance operation; the fleet's manifest, node credentials and other devices are unchanged.

### Activation sequence correction and retained diagnostic

The operator confirmed Node 4 blocked for rollback, with USB/laptop/peers unchanged. The first activation attempt performed extra loader connections to verify/read selection after writing NEW. Entering the loader again resets the pending boot, so the selected-new read instead found **sequence 3, ABORTED (4), slot app0**, with original sequence 2/VALID app1 selected. [Diagnostic evidence](calibration/node4-health-rollback-activation-incomplete-2026-11-27.json) preserves the observed reset-induced rejection and the harness fault; it is inconclusive for the planned health-timeout test. The confirmed production sector was preserved and the device was resumed there.

The corrected activation validates the planned sector locally, writes only the opposite metadata sector using esptool's built-in written-data hash verification, and performs its one final reset. **It makes no subsequent loader connection until observation finishes.** Post-test raw state inspection supplies the independent persisted-state check. A fresh activation sequence 5/NEW targets the already verified clone; the original sequence 2/VALID sector remains byte-preserved in the planned write. [Activation evidence](calibration/node4-health-timeout-activation-2026-11-27.json) records the write verification and operator isolation checkpoint. The passive UART observer then saw `pendingVerification=true` with no usable Wi-Fi; timeout transition and final state inspection remain pending.

### Corrected timeout observation and persisted state — passed

The preceding paragraph preserves the activation checkpoint. The [passive observation](calibration/node4-health-timeout-observation-2026-11-27.json) subsequently recorded repeated complete `pendingVerification=true` states while Wi-Fi was unavailable, followed by a new non-pending boot without any intervening loader/reset command. The firmware's existing three-minute health gate was unchanged. The host first attached after activation, so its observed pending duration is shorter than the firmware timer; both durations are retained rather than equated.

[Post-observation raw state inspection](calibration/node4-health-timeout-state-result-2026-11-27.json) verified **sequence 5 / INVALID (3) / app0**, valid CRC, with original **sequence 2 / VALID (2) / app1 selected**. This satisfies the health-timeout rejection criterion, distinct from the earlier ABORTED diagnostic. The original confirmed metadata sector, NVS bytes, bootloader and partition-table bytes were unchanged. The inspection itself used a deliberate loader read/reset only after the pending-to-nonpending transition had already been observed; that maintenance reset is separate from the automatic rollback event.

The operator was asked to unblock Node 4 with USB unchanged. Saved settings/cloud recovery, journal integrity, exact protected-record comparison and queue drainage remain pending; no full end-to-end rollback acceptance is claimed until they complete. The stable manifest and all other nodes remain on production `c0e1dc4`.

The operator then confirmed **“Node 4 rollback network restored.”** [USB recovery evidence](calibration/node4-health-rollback-recovery-usb-2026-11-27.json) verified the exact saved calibration, production release, valid network, setup inactive and no pending boot validation. The [after-rollback export](retention/node4-health-rollback-after-2026-11-27.ndjson) and [capture metadata](calibration/node4-health-rollback-after-2026-11-27.json) contain 256 distinct valid committed JSON records. [Exact comparison](calibration/node4-health-rollback-record-comparison-2026-11-27.json) passed all original thirty protected records, zero missing/changed protected IDs and all **112 common records** byte-identical. The 1,901-second export interval includes planned USB-loader maintenance; old acknowledged records outside the protected set rotated and are listed separately. This does not establish indefinite full-history retention.

The backlog declined from 43 through the capture's 21/6 snapshots to zero; a fresh cloud checkpoint showed all four healthy/running/time-synchronized on `c0e1dc4`, with zero queues and unchanged peer boots. An intermediate Atlas connector query failed while laptop networking was transitioning for capture; the retry after restoration succeeded. It is retained as a verification transport failure, not a diagnosed node upload fault. **The health-timeout rollback and protected-record recovery criteria are passed.** This tests USB-staged application selection and the production health gate, not an intentionally corrupted network download or physical flash-write interruption.

Example staged commands, after installing the documented Python dependencies and using a new private evidence directory:

```powershell
python scripts/isolated-ota-check.py --action stage --port COM6 --node esp32-3013a5f4e9d4 --known-good work/ap-availability-published/firmware.bin --known-good-sha256 8c0003519dfce3a6c33eeac754b76a974f1523810b0e0e830ae43f53c078a124 --image work/ap-availability-published/firmware.bin --image-sha256 8c0003519dfce3a6c33eeac754b76a974f1523810b0e0e830ae43f53c078a124 --output work/new-health-rollback-trial
```

Activation is a separate operation requiring the operator's block confirmation; do not run this just because staging succeeded:

```powershell
python scripts/isolated-ota-check.py --action activate --port COM6 --node esp32-3013a5f4e9d4 --known-good work/ap-availability-published/firmware.bin --known-good-sha256 8c0003519dfce3a6c33eeac754b76a974f1523810b0e0e830ae43f53c078a124 --output work/new-health-rollback-trial --network-block-confirmed
```

## B. Incomplete temporary record and unexpected-reset recovery

The [probe builder](../scripts/build-partial-write-probe.py) generates a separate ignored PlatformIO project from the exact production source. It does not edit `firmware/`, its release header or the global pipeline. The probe is Node 4-specific and OTA-disabled. It refuses an unexpected target, non-pending boot, unavailable storage or an existing temporary record.

On its first pending boot, before ordinary logging/network workers start, it writes **107 bytes** of deliberately incomplete JSON to `/littlefs/new.tmp`, flushes, syncs and closes it, then reports the unique synthetic event ID and slot over USB and calls `ESP.restart()` before rename/commit or app confirmation. The expected behavior is bootloader ABORTED rejection, confirmed production selected, committed records unchanged, partial probe absent from committed exports/Atlas, and normal logging recovery. Because the partial bytes are deliberately synced before the software reset, this is a staging-boundary robustness test, not loss of power during physical flash programming.

The probe compiled successfully in `.build/partial-stage-probe-20261127`, version `usb-partial-stage-probe`, with synthetic ID `6a9ca8ba9e154154a2b719ab2fdb96fe`. Binary/patch metadata are kept with that ignored build. At this original-build checkpoint installation/execution was pending; this first build was never installed. Never publish the image or merge a test configuration into production. After the test, replace any inactive probe bytes with the verified production image while preserving the active valid image and retaining the observed rejection state for the audit.

[Sanitized build metadata](calibration/node4-partial-stage-probe-build-2026-11-27.json) records the 1,188,528-byte probe, its SHA-256 and the exact 107-byte partial payload hash. Production source files are unchanged.

A [revised observer-attachment build](calibration/node4-partial-stage-probe-r1-build-2026-11-27.json) adds a ten-second armed delay before staging, still before normal workers/commit/confirmation. It is **1,188,640 bytes**, SHA-256 `64317e903f2df479103625d8f4ba3f4dded599b6256ae9d712a1fe300f7f4c16`; the partial payload and its hash are unchanged. Activation in `--test-mode partial-stage-reset --probe-id <exact-id>` attaches a passive UART observer inside the same process after the final selection write. It requires the 107-byte/pending/slot marker, software-reset marker and confirmed production return. This scenario deliberately keeps normal network access available; it does not use a false network-block confirmation. The original probe build was never installed; the revised build below is the executed image.

A fresh [pre-probe capture](calibration/node4-partial-stage-before-2026-11-27.json) and [original log bytes](retention/node4-partial-stage-before-2026-11-27.ndjson) preserve a separate acknowledged thirty-record baseline. That preflight checkpoint preceded the revised image staging/activation below; another complete private filesystem backup was verified before writing only the inactive slot.

### Observed incomplete-file/reset result — passed

[Staging evidence](calibration/node4-partial-stage-staging-2026-11-27.json) verifies the 1,441,792-byte private filesystem backup, complete probe image and unchanged active production/selection. One inactive section stopped responding; its one bounded retry succeeded. The first activation preflight read then returned corrupt serial data and stopped **before any selection write**, resuming confirmed production. The retry reused only the verified staged image/metadata in a fresh evidence directory and independently verified both applications before activation. [USB failure summary](calibration/node4-partial-stage-usb-failures-2026-11-27.json) preserves these transport failures; incomplete dumps are not accepted as evidence.

[Activation](calibration/node4-partial-stage-activation-2026-11-27.json) wrote sequence 7 / NEW in the opposite sector. The integrated [passive UART observation](calibration/node4-partial-stage-observation-2026-11-27.json) recorded the armed delay, exact synthetic ID `6a9ca8ba9e154154a2b719ab2fdb96fe`, **107 bytes / pending=1 / app0**, software-reset marker and return to production `c0e1dc4` with no pending validation. No loader/reset intervened in that observed transition. The subsequent metadata inspection was a separate planned maintenance reset.

[Persisted state and byte comparison](calibration/node4-partial-stage-state-result-2026-11-27.json) found **sequence 7 / ABORTED (4) / app0**, valid CRC and original **sequence 2 / VALID (2) / app1 selected**. The confirmed sector, bootloader and partition table were byte-identical. Whole NVS equality was initially checked and failed: **28 bytes** differ, confined exactly to a newly allocated `WIFI_STA_DEF` entry in namespace `dhcp_state` and its allocation bitmap. Every other NVS byte, including existing fleet settings/calibration, is unchanged. Final device readback independently confirms the exact saved correction and working Wi-Fi/cloud configuration. Do not rewrite this as whole-NVS equality.

The [after export](retention/node4-partial-stage-after-2026-11-27.ndjson), [capture metadata](calibration/node4-partial-stage-after-2026-11-27.json) and [independent comparison](calibration/node4-partial-stage-record-comparison-2026-11-27.json) verify both exports contain 256 valid distinct records, **all 30 protected records unchanged, all 238 common records byte-identical, zero missing protected IDs and zero changed common IDs**, over 562.092 seconds. Older acknowledged records rotated normally. [Synthetic-record exclusion](calibration/node4-partial-stage-synthetic-exclusion-2026-11-27.json) verifies the probe ID is absent from both committed exports and an exact Node 4 Atlas query. This tests logical commitment and delivery, not physical deletion of free flash blocks.

The [post-probe journal scan](calibration/node4-partial-stage-storage-check-2026-11-27.json) found **256 valid / zero invalid**, completing in 26,382 ms. Sensor/storage were healthy, Wi-Fi had a valid address, IST/cloud recovered, setup was closed, the exact `n4-20261126-v1` correction remained installed and the queue reached zero. The diagnostic is read-only but may delay acquisition/uploads while inspecting flash.

### Cleanup and final fleet checkpoint

[Cleanup evidence](calibration/node4-partial-stage-cleanup-2026-11-27.json) verifies both application slots against the **same published 1,235,856-byte production image**, with the inactive probe removed. Boot/NVS/partition/OTA bytes stayed unchanged during cleanup; the recorded ABORTED rejection state is retained for audit and can be reused by a future normal OTA. Cleanup uses deliberate loader resets after the test and does not represent another automatic rollback. The stable OTA channel and `firmware/` source were never modified for the probe.

[Final Node 4 USB readback](calibration/node4-fault-final-usb-2026-11-27.json) and [fresh cloud checkpoint](calibration/node4-fault-final-fleet-2026-11-27.json) confirm normal production, exact saved calibration, no pending boot, setup closed and synchronized time. Final USB readback observed Node 4 drain from one pending record to zero; subsequent live cloud/dashboard checkpoints show 0–1 pending per node during ordinary ongoing acquisition, not a claim of simultaneous zero in every view. Nodes 1–3 kept their original boots throughout Node 4 maintenance. The [authenticated dashboard screenshot](images/dashboard-fault-recovery-2026-11-27.png) and [dashboard API checkpoint](calibration/node4-fault-final-dashboard-2026-11-27.json) show the resulting four-node state. The laptop returned to Sensor Testing after exports; no new Wi-Fi credentials, registration or portal configuration was needed.

### Repeating the isolated staged-file test

Use a fresh ignored build/evidence directory and a new unique 32-character lowercase hexadecimal probe ID. Keep production cloud access available. First export an acknowledged baseline and verify the target MAC, partitions, valid production image/hash and backup gates. Never reuse an activation directory after a selection write.

```powershell
python scripts/build-partial-write-probe.py --node esp32-3013a5f4e9d4 --output .build/new-partial-probe --probe-id <unique-probe-id>
python scripts/isolated-ota-check.py --action stage --port COM6 --node esp32-3013a5f4e9d4 --known-good <verified-production.bin> --known-good-sha256 <production-sha256> --image .build/new-partial-probe/.pio/build/esp32dev/firmware.bin --image-sha256 <build-metadata-sha256> --output work/new-partial-trial --test-mode partial-stage-reset --probe-id <unique-probe-id>
python scripts/isolated-ota-check.py --action activate --port COM6 --node esp32-3013a5f4e9d4 --known-good <verified-production.bin> --known-good-sha256 <production-sha256> --output work/new-partial-trial --test-mode partial-stage-reset --probe-id <unique-probe-id>
```

After the observer completes, inspect persisted state with `--action inspect --label partial-reset-after` and the same identity/known-good/output arguments. Require ABORTED/original VALID selection, protected raw-record equality, synthetic exclusion, valid journal and saved-settings/network recovery. Then run `--action restore-inactive` with those same arguments, require both production image verifications and final fleet recovery. Do not use a network-block confirmation for this scenario, reset during the passive observation, format LittleFS, erase NVS, or publish probe artifacts to the normal release channel. If a guard/USB/observer fails, preserve evidence, allow the harness to resume the valid image, verify actual state and do not claim a pass.

## C. Equipment needed before physical write/brownout acceptance

A controlled supply/switch and a way to observe the board's actual rail/write-phase trigger are needed. Identify the exact board input/regulator arrangement and remove unintended alternate supply/backfeed paths before any external-power test. Keep detector/watchdog enabled. Record rail voltage/time, trigger phase, reset reason, retained IDs/settings, journal validity and recovery. A multimeter alone does not establish the transient voltage waveform or write-phase cut timing.

No measured brownout or timed physical write interruption has been performed. Those acceptance rows stay open until suitable equipment is available; the available USB-only tests and production safeguards are not substitutes.

## Completion requirements

Preserve failed attempts and private backups, archive only sanitized state/hash/log evidence under `docs/`, and retain an exact before/after selected-record comparison. Restore Node 4 to the normal production image and OTA behavior, end only test setup sessions, return laptop Wi-Fi to Sensor Testing, verify all four nodes and update README/verification. No rollback or staged-file pass is claimed until its specific state transition, record integrity and final recovery criteria are observed.

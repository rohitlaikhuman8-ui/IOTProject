# Per-node ADXL345 calibration

## Test order and current state

| Order | Node ID | State |
| --- | --- | --- |
| 1 | `esp32-d01de2f4e9d4` | Installed on published 795d041; persistence and on-device level bench screen passed; movement/threshold acceptance remains |
| 2 | `esp32-7839a3f4e9d4` | V2 installed/reboot-verified; independent raw and on-device supported-pose numeric bench screens passed; physical-level/production limitations remain |
| 3 | `esp32-986aa3f4e9d4` | `n3-20261126-v1` installed/read back after reboot; independent offline and on-device supported-pose numeric screens passed |
| 4 | `esp32-3013a5f4e9d4` | COM6 identity verified; component-up reference recorded; remaining five faces and validation pending; revision `none` |

The other nodes can stay powered and online while one sensor is measured. Confirm each physical board's Node ID before moving it. Movement while positioning is a calibration activity; its notifications are not operational incidents.

## Measurement procedure

1. Identify the selected sensor and inspect its mounting and wiring. Support it on a nonconductive surface without stressing jumper wires. Keep power connected and avoid exposed contacts.
2. Confirm fresh cloud reports, responding sensor, available storage, synchronized time, firmware version and boot ID. Record all times in IST, retaining UTC epoch values in machine-readable data.
3. Place the sensor component-side up on a level surface. The operator must confirm positioning. Allow settling, then collect at least two minutes of new periodic samples while it stays still. Discard movement events and samples captured before settling; use capture time rather than delayed server receipt time to select the window. Deduplicate by event ID.
4. Record the measured X/Y/Z means, standard deviations and magnitude. This initial orientation is a baseline check, not a completed three-axis calibration. Board component-side up alone does not establish chip-axis direction; inspect the sensor's printed axis markings before assigning a signed axis.
5. Collect stationary windows with each marked sensor axis pointing upward and downward: +X, -X, +Y, -Y, +Z, -Z. Confirm each position separately. Use a secure nonconductive support; do not balance the board on pins or pull wires taut.
6. For each axis, calculate bias `(positiveMean + negativeMean) / 2` and scale `2 * 9.80665 / (positiveMean - negativeMean)` from acceleration in m/s². The corrected axis is `(measured - bias) * scale`. Check pose signs, repeatability and reference alignment before accepting coefficients. This is a diagonal offset/scale model, not a cross-axis or temperature calibration.
7. Apply accepted coefficients only to the matching Node ID, persist them, reboot and verify retained coefficients against repeated reference orientations. Release `408a075` predates per-axis calibration support. The subsequent calibration implementation and USB/portal procedures are described below; changing summary sensitivity is not a substitute.
8. Recheck the stationary mounted baseline, then tune movement threshold against the actual movement of interest. Verify one-node-at-a-time movement attribution while the other nodes stay stationary. Record the final thresholds, firmware, coefficient revision and validation results before moving to the next node.

At the current ten-second periodic interval, a cloud window provides relatively sparse stationary readings. It does not measure the full noise bandwidth or guarantee detection of fast vibrations. Do not infer a movement threshold solely from sparse magnitude samples; validate it against device-side movement detection and controlled motion.

Stop and repeat a window if the sensor moves, restarts, reports invalid readings or loses enough telemetry to leave insufficient fresh samples. Do not reuse another node's coefficients. Do not adjust sensitivity simply to force gravity magnitude to an expected value in one orientation.

The two-point-per-axis method follows [Analog Devices AN-1057](https://www.analog.com/en/resources/app-notes/an-1057.html). Gravity reference 9.80665 m/s² is a conventional approximation; this bench process does not establish traceable laboratory accuracy.

## Results

Measurements and acceptance decisions are added below as each operator-confirmed pose is completed. No node is marked calibrated until coefficients have been applied, persisted and independently validated.

### Node 1 initial mounted baseline — November 25

The operator initially confirmed readiness, then clarified that the ADXL345 was tilted/mounted. Seven unique periodic samples captured at **13:58:47–13:59:47 IST** were retained separately as a mounted baseline. This is a 60-second sample span, shorter than the intended reference window; it was stopped because the reference position was unsuitable. No calibration coefficient, sensitivity, threshold or firmware was changed.

| Axis | Mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | 5.501951 | 0.034411 |
| Y | -7.966082 | 0.036379 |
| Z | -4.879089 | 0.072758 |

All seven samples share the original boot ID and running release `408a075`. The spread of gravity across axes is compatible with the operator's reported tilt; it does not establish an electrical fault or determine per-axis bias. This window is **not accepted as a level reference** and does not complete calibration. [Stored sample evidence](calibration/node1-initial-mounted-2026-11-25.json) contains event IDs, capture times and server receipt times.

Next: confirm whether the sensor can be repositioned, obtain a level reference and continue the signed-axis orientations one at a time. If it cannot be rotated, document that constraint and use a restricted mounted baseline/threshold assessment; do not label that a full three-axis offset/scale calibration. Nodes 2–4 remain awaiting their own positioning and measurements.

### Node 1 component-side-up reference — November 25

The operator confirmed the ADXL345 itself was flat. After settling, the requested capture window was **14:01:10–14:03:10 IST**. Twelve unique periodic samples were captured at **14:01:17–14:03:07 IST**; selection used device capture time and excluded the earlier mounted window and movement records. All twelve retained the same boot ID and `408a075` firmware. [Complete reference evidence](calibration/node1-component-up-2026-11-25.json) includes samples and statistics.

| Axis | Mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | 0.168920 | 0.034434 |
| Y | -1.411913 | 0.047429 |
| Z | 7.792610 | 0.049263 |

Mean vector magnitude was **7.921518 m/s²**, below the conventional gravity reference. This single position cannot distinguish offsets, gain errors and residual alignment error, and does not establish a hardware failure. No coefficient was computed or applied. The next requested pose is level with the component side downward, safely supported. Remaining signed-axis windows and independent validation are still required before declaring this node calibrated. Nodes 2–4 have not yet started their own reference measurements.

### Node 1 component-side-down reference — November 25

The operator confirmed the opposite-face position. After settling, the requested capture window was **14:05:10–14:07:10 IST**. Twelve unique periodic samples were captured at **14:05:17–14:07:07 IST**, selected by device capture time. All retained the same boot ID as the component-up reference and firmware `408a075`. [Complete face-down evidence](calibration/node1-component-down-2026-11-25.json) includes the source events and statistics.

| Axis | Mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | 0.168920 | 0.052739 |
| Y | -0.165732 | 0.086806 |
| Z | -11.308048 | 0.044162 |

Mean vector magnitude was **11.310942 m/s²**. The Z sign reversal is consistent with turning the sensor over. Using these two physical faces provisionally as the positive/negative Z references gives bias **-1.757719 m/s²** and multiplicative scale **1.026839**, with correction `(rawZ - bias) * scale`. These are diagnostic estimates, **not applied or accepted final calibration**. Physical alignment still needs validation: Y means differ between the two faces, so residual tilt or other errors may affect the estimate. Do not infer Y bias or scale from this pair.

Next requested pose: securely supported vertical board with its printed **+X arrow pointing upward**. If the marking is absent or ambiguous, stop to establish the actual sensor-axis direction before assigning the pose. The -X, +Y and -Y windows, independent orientation checks, persistent firmware support and post-application validation remain open. Nodes 2–4 remain uncalibrated.

### Node 1 X-down reference — November 25

The operator initially reported X-up readiness, but the measured X sign was negative. During collection the operator clarified that the arrow was pointing **downward** and was asked to keep that position. This window is therefore recorded as **X-down**, not X-up. The actual X-up reference remains outstanding; no coefficients were calculated from a mislabeled pair.

The requested capture window was **14:09:35–14:11:35 IST**. Twelve unique periodic samples were captured at **14:09:37–14:11:27 IST**, using capture-time selection and excluding movement records. All shared the original boot ID and `408a075` firmware. [Complete X-down evidence](calibration/node1-x-down-2026-11-25.json) preserves the corrected pose description and source samples.

| Axis | Mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | -9.778210 | 0.024911 |
| Y | -0.290032 | 0.050154 |
| Z | -2.262884 | 0.066910 |

Mean vector magnitude was **10.041131 m/s²**. This provides the negative-X reference, subject to alignment and later validation. No calibration settings, firmware or movement thresholds were changed. Next: reverse this vertical position so the printed +X arrow points upward, confirm readiness, and collect a fresh X-up window. The Y-up/down references and post-application validation remain outstanding.

### Node 1 confirmed X-up reference — November 25

After correcting the earlier downward orientation, the operator confirmed the +X arrow pointing upward. Measured X became positive. The requested capture window was **14:13:15–14:15:15 IST**. Twelve unique periodic samples were captured at **14:13:18–14:15:08 IST**, selected by capture time and excluding movement events. The original boot ID and firmware `408a075` were retained. [Complete X-up evidence](calibration/node1-x-up-2026-11-25.json) includes the source measurements and provisional paired estimate.

| Axis | Mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | 10.026813 | 0.035854 |
| Y | -0.207166 | 0.038101 |
| Z | -1.733816 | 0.077069 |

Mean vector magnitude was **10.178044 m/s²**. Combined with the X-down mean -9.778210 m/s², the provisional X bias is **0.124301 m/s²** and multiplicative scale **0.990319**, using `(rawX - bias) * scale`. These estimates remain **unapplied and subject to alignment and independent validation**. No firmware, saved settings or thresholds were changed.

Four physical reference positions are now recorded for Node 1. Next: +Y arrow straight upward, then its opposite downward position, each confirmed by the operator and collected separately. Full three-axis calibration, persistent application and validation remain incomplete; Nodes 2–4 still await their own measurements.

### Node 1 Y-up reference — November 25

The operator confirmed the +Y arrow pointing upward, and measured Y was positive. The requested capture window was **14:17:20–14:19:20 IST**. Twelve unique periodic samples were captured at **14:17:28–14:19:18 IST**, selected by capture time and excluding movement events. All retained the original boot ID and firmware `408a075`. [Complete Y-up evidence](calibration/node1-y-up-2026-11-25.json) includes source events and statistics.

| Axis | Mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | 0.143423 | 0.033122 |
| Y | 9.899323 | 0.045643 |
| Z | -1.829431 | 0.035853 |

Mean vector magnitude was **10.068087 m/s²**. This records the positive-Y reference; it does not establish Y bias or scale without the opposite pose. No coefficients, firmware, saved settings or movement thresholds were changed. Five of six physical references are recorded for Node 1. Next: +Y arrow downward for a separately confirmed window, then calculate provisional three-axis coefficients, check alignment and independently validate corrections before applying them persistently. Nodes 2–4 still await their own reference measurements.

### Node 1 Y-down reference — November 25

The operator confirmed the +Y arrow downward. The requested capture window was **14:20:50–14:22:50 IST**. Twelve unique periodic samples were captured at **14:20:58–14:22:48 IST**, selected by device capture time with movement records excluded. All retained the original boot ID and firmware `408a075`. [Complete Y-down evidence](calibration/node1-y-down-2026-11-25.json) includes source events and statistics.

| Axis | Mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | 0.073305 | 0.030328 |
| Y | -10.291344 | 0.057562 |
| Z | -1.574458 | 0.102926 |

Mean vector magnitude was **10.411797 m/s²**. All six operator-positioned references are now recorded for Node 1. No settings or firmware were changed.

### Node 1 provisional six-position calculation

The [coefficient record](calibration/node1-provisional-coefficients-2026-11-25.json) identifies all six input files, firmware and Node ID, and includes corrected reference means. Each input contains at least twelve unique event IDs from the same node. The paired-axis arithmetic was checked to map the two fitted means to ±9.80665 m/s². That arithmetic check is a fit check, not independent physical validation.

| Axis | Bias to subtract (m/s²) | Multiplicative scale |
| --- | --- | --- |
| X | 0.124301375 | 0.990319447 |
| Y | -0.196010625 | 0.971404259 |
| Z | -1.757719417 | 1.026838980 |

Apply the formula `(rawAxis - bias) * scale` separately to each axis. **These coefficients are provisional, are not installed on the ESP32 and must not be copied to other nodes.**

The reference-fit corrected vector magnitudes range from approximately 9.8067 to 9.8776 m/s². The earlier component-up reference retains corrected Y approximately -1.1811 m/s², and X-down retains corrected Z approximately -0.5187 m/s². These cross-axis residuals require alignment/repeatability checks and cannot be dismissed as verified calibration. A diagonal correction does not compensate arbitrary mounting rotation or cross-axis coupling.

Next requested action is a **new** level component-up window, kept separate from the fitted references. Apply the provisional correction offline to those new samples and review repeatability, magnitude and cross-axis residuals before deciding whether any reference must be repeated. Persistent per-node firmware support, reboot validation and controlled movement checks remain open. Nodes 2–4 still await their own six reference windows.

### Node 1 independent component-up validation — November 25

The operator confirmed a new component-up position. The requested capture window was **14:25:10–14:27:10 IST**. Twelve unique periodic samples were captured at **14:25:19–14:27:09 IST**. Their event IDs are disjoint from all fitting windows; Node ID, firmware and original boot ID matched. [Raw validation samples](calibration/node1-validation-component-up-2026-11-25.json) and the [offline analysis result](calibration/node1-validation-result-2026-11-25.json) preserve the evidence.

The bench screening criteria were selected before collection: at least twelve distinct samples spanning 100 seconds, unchanged reference boot/firmware, corrected mean magnitude within 3% of 9.80665 m/s², absolute corrected X/Y mean at most 0.5 m/s² in the requested level pose, and corrected per-axis sample standard deviation at most 0.15 m/s². These are provisional project screening criteria, not a manufacturer specification or a finalized production accuracy requirement.

| Quantity | Raw mean (m/s²) | Corrected offline mean (m/s²) |
| --- | --- | --- |
| X | 0.086054 | -0.037878 |
| Y | -1.067699 | -0.846762 |
| Z | 7.900973 | 9.917922 |
| Vector magnitude (mean of sample magnitudes) | 7.973614 | 9.954343 |

Corrected mean magnitude error was **+1.506050%**, inside the 3% screen. Corrected axis sample standard deviations were 0.028550, 0.068061 and 0.045733 m/s², inside the repeatability screen. Sample identity, independence, timing and boot/firmware checks passed. The level-position screen **failed** because corrected Y magnitude 0.846762 m/s² exceeded 0.5 m/s².

**Result: validation incomplete; calibration not accepted or installed.** A residual Y component may reflect tilt, reference alignment error or sensor/model error; this window alone does not establish which. Do not zero Y from this single pose, relax the screening criterion after viewing the result, or claim the improved magnitude proves full calibration.

Next: inspect whether headers/components are tilting the PCB. Support the actual PCB level with nonconductive supports, leaving pins/wires unstressed, and independently verify alignment if possible. Confirm a corrected physical position before collecting another held-out window. If a reference is repeated and coefficients change, that changes the fit and requires a fresh independent validation window. If level cannot be established, record the limitation rather than declaring a three-axis calibration pass. Firmware, saved settings, thresholds and all other nodes remain unchanged.

### Node 1 supported-level repeat validation — November 25

After the first validation failed its level-position screen, the operator confirmed readiness with the PCB supported and level. The coefficients and screening criteria were **unchanged**. The requested capture window was **14:29:35–14:31:35 IST**. Twelve unique samples were captured at **14:29:39–14:31:29 IST**; all were separate from the six fitting windows and retained the reference boot ID and firmware. [Repeat raw samples](calibration/node1-validation-leveled-2026-11-25.json) and [repeat analysis](calibration/node1-validation-leveled-result-2026-11-25.json) preserve the complete result. The earlier unsuccessful validation is retained above.

| Quantity | Raw mean (m/s²) | Corrected offline mean (m/s²) |
| --- | --- | --- |
| X | 0.063743 | -0.059972 |
| Y | 0.082866 | 0.270902 |
| Z | 7.891412 | 9.908104 |
| Vector magnitude (mean of sample magnitudes) | 7.892242 | 9.912091 |

Corrected magnitude error was **+1.075196%**, within the unchanged 3% screen. Absolute corrected X/Y means were below 0.5 m/s². Corrected axis sample standard deviations were **0.029486, 0.038262 and 0.080890 m/s²**, below 0.15 m/s². All eleven recorded checks, including sample identity, independence, time span and matching boot/firmware, passed.

**Result: offline bench-screen pass for this held-out supported-level position.** The improvement after repositioning supports checking physical alignment, but does not prove every residual error comes from tilt. This is not a full orientation/temperature accuracy certification or an on-device calibration pass. No coefficients were refitted to this validation window.

The ESP32 still runs `408a075` and reports uncorrected measurements. Firmware support for persistent per-axis corrections, writing this node's settings, reboot persistence and on-device verification remain required. A host serial-port inventory after the test showed only Bluetooth COM3/COM4 and no ESP32 USB port. The operator was asked to connect Node 1 by data USB for the next installation/verification stage; this request does not authorize applying its coefficients to any other Node ID. Nodes 2–4 remain online and await their individual calibration windows.

## Installing and maintaining per-node corrections

Calibration-capable firmware stores a separate, single NVS `calibration` record. Network settings remain in `config`; routine SSID/password/endpoint changes do not replace calibration. A missing record means identity correction (bias zero, scale one) and revision `none`. A malformed or different-node saved record is rejected at boot with a serial warning and identity correction. Export and inspect saved coefficients if that warning occurs; do not treat the node as calibrated.

Bias values must be finite numbers between -5 and +5 m/s², and multiplicative scales between 0.5 and 1.5. The revision must contain 1–32 ASCII letters, digits, hyphens or underscores, excluding reserved `none`. Three values are required for each array, in X/Y/Z order. These bounds are guards against erroneous configuration, not sensor accuracy specifications. Values outside them require investigation rather than changing firmware limits to force acceptance.

### USB installation

Close other serial monitors. Confirm the physical Node ID, install a tested calibration-capable application without erasing NVS/LittleFS, and run from the repository root:

```powershell
.\.venv\Scripts\python.exe scripts/serial-check.py --port COM5 --command status
.\.venv\Scripts\python.exe scripts/serial-check.py --port COM5 `
  --calibration docs/calibration/node1-provisional-coefficients-2026-11-25.json `
  --revision n1-20261125-v1 --command status
.\.venv\Scripts\python.exe scripts/serial-check.py --port COM5 --command calibration
.\.venv\Scripts\python.exe scripts/serial-check.py --port COM5 --command sensor-raw
.\.venv\Scripts\python.exe scripts/serial-check.py --port COM5 --command sensor
```

The example file belongs **only** to `esp32-d01de2f4e9d4`. Create and validate a separate coefficient record for each other node before using this command. The helper checks live identity and calibration support before sending anything, requires `Calibration persisted; restarting`, then compares the saved revision and arrays after reboot. This calibration path does not open the captive portal or send network credentials. `sensor-raw` bypasses correction; `sensor` reports corrected acceleration. Different calls are different I2C measurements, so account for sensor noise and movement when comparing them.

For a manual Arduino Serial Monitor session at 115200 baud with newline endings, use:

```text
calibration
calibrate {"nodeId":"esp32-d01de2f4e9d4","revision":"n1-20261125-v1","bias":[0.124301375,-0.196010625,-1.757719417],"scale":[0.990319447,0.971404259,1.026838980]}
```

Writing is followed by reboot; acquisition uses the new immutable coefficients only after that reboot. Check sensor/storage health, clock synchronization, cloud acknowledgments, revision and pending uploads again once Wi-Fi reconnects. A serial save/readback immediately after boot may precede Wi-Fi association; it does not by itself establish cloud delivery.

### Captive portal installation or change

Open setup only when needed using the documented four-second GPIO 4 hold. Under **Sensor calibration**, verify Node ID, enter the measured revision plus three biases and three scales, then choose **Save calibration and restart**. The dedicated JSON endpoint checks the setup-interface address, page token, Node ID and numeric bounds. Saving calibration leaves network configuration and logs intact. Reconnect and verify the active revision. Normal network **Save and restart** keeps the separate calibration record unchanged.

To deliberately return to uncorrected axes, save biases `[0,0,0]` and scales `[1,1,1]` with a new explicit revision such as `identity-20261125`; record the reason. This identity revision is an intentional operator configuration and is different from missing calibration (`none`). Never use it to hide a failed calibration check.

### Effects, historical records and rollback

Correction is applied to each sensor axis before live readings, movement detection and new local/cloud events. Summary sensitivity then scales only the magnitude, as before. Each new heartbeat/event carries `calibrationRevision`; the dashboard labels absent/`none` revisions **Not applied**. Historical records retain their original values and revisions, including queued older readings uploaded later. Do not compare raw and corrected history as one uniform series. Reassess movement thresholds after calibration because detection now uses corrected axes.

Ordinary firmware updates preserve the calibration NVS key. Older `408a075` firmware ignores it and reports raw readings; reinstalling supported firmware loads the saved record again. Do not describe a firmware rollback to that older release as preserving calibrated output. Keep coefficient evidence exported before any deliberate erase or fault test.

### November 25 hardware implementation checkpoint

COM5 status identified `esp32-d01de2f4e9d4` before any writes. Its boot/settings/partition region was backed up privately and app/filesystem boundaries checked. The calibration bench image was written in five sections, then the entire application digest was verified before selecting app0. NVS and LittleFS were retained; no filesystem upload or formatting occurred. No BOOT-button intervention was required.

The bench version `usb-calibration-bench` disabled automatic OTA temporarily to prevent the older stable manifest from replacing the test image. Identity defaults were confirmed before calibration. Six invalid requests (wrong Node ID, zero scale, excessive bias, boolean bias, incomplete axis array and reserved revision) were rejected without changing calibration. All 256 retained records remained indexed.

Revision `n1-20261125-v1` was saved at approximately **14:42 IST**, and its coefficients were read back after the automatic reboot. A second reset also restored the same revision and arrays, retained 256 local records, restored saved Wi-Fi and synchronized time before cloud reporting resumed. This reset check is not a controlled interrupted-flash/power-cut test.

The backward-compatible dashboard/API deployment `dpl_Fj4AMfugPZUQbZGKwawEpczj27Sg` reached Ready. Atlas event `ac6858b52fcb06b90fd09f564fe9987c`, captured **14:42:59 IST** and received **14:43:01.401 IST**, contains corrected acceleration and `calibrationRevision: n1-20261125-v1`. It verifies tagged cloud delivery, not a new known-orientation accuracy check after connecting USB.

Firmware builds with OTA enabled and disabled passed within the app partition; the Next.js production build/type checks passed. The offline portal client-contract test passed. That fixture test does not claim a new physical captive-portal session; the operator's laptop Wi-Fi was left unchanged. Final release/version and any later on-device accuracy checks are recorded as follow-ups below.

### Published release and final on-device level check

The finalized implementation was merged to `main` only after the bench checks. [GitHub Actions run 45584124521](https://github.com/rohitlaikhuman8-ui/IOTProject/actions/runs/45584124521) passed and published release **795d041b2daf1b4d9e1448890c7ef16c3de0c8f7**. The live Vercel manifest advertised **1,233,520 bytes**, SHA-256 **ba72ecba6986f9f5dc7983a2e8655d6baf25c972dfca6efc3496bf91e1e84565**. The complete downloaded image matched both values. Node 1 received that published image over USB, with whole-image verification before boot selection; it was not represented as an additional OTA transfer test.

After boot, Node 1 reported the exact published version and restored `n1-20261125-v1`, the saved coefficients, sensor 0x53 and 256 local records. The published build uses normal OTA-enabled behavior, replacing the temporary OTA-disabled bench image. A scheduled manifest check at approximately **14:56 IST** returned matching advertised/running versions without reinstalling. During the earlier diagnostics one heartbeat timed out at its ten-second limit, then subsequent heartbeat/telemetry requests succeeded; this recovered transport failure is not omitted from the test record.

With the operator's final supported-level position and USB still connected, the requested capture window was **14:52:45–14:54:45 IST**. Twelve unique periodic samples were captured at **14:52:54–14:54:44 IST**. They all carry the published firmware version, revision `n1-20261125-v1` and one post-installation boot ID. **These axes were corrected on the ESP32; analysis did not apply the coefficients a second time.** [Complete on-device evidence](calibration/node1-on-device-validation-2026-11-25.json) includes the raw API records, statistics and checks.

| Quantity | On-device mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | -0.063128 | 0.019503 |
| Y | 0.017029 | 0.048398 |
| Z | 9.881920 | 0.038673 |

Mean sample magnitude was **9.882263 m/s²**, error **+0.771038%** against 9.80665 m/s². The unchanged numeric bench limits passed: ±3% mean magnitude, absolute mean X/Y at most 0.5 m/s², axis sample standard deviation at most 0.15 m/s², at least twelve samples spanning 100 seconds. Node ID, revision, published version, capture window and within-window boot consistency passed; event summary magnitude also matched its corrected axes at sensitivity one. An intentional firmware-installation reboot means this window correctly has a different boot/version from pre-installation references.

**Node 1 result: measured corrections installed, persistent, reporting to Atlas, and passed the single-level on-device bench screen.** Movement attribution/threshold acceptance after calibration, repeated accuracy checks in other orientations, temperature behavior, deliberate power interruption/rollback and endurance remain separate acceptance work. No claim of production certification is made from this one level window.

At the **14:56 IST** fleet checkpoint, Nodes 1, 3 and 4 had fresh reports. Node 2's last accepted report was **14:49:58.180 IST**, version `408a075`, last mode running. Its power/network status was requested from the operator before starting its calibration; the cause was not established. Nodes 3/4 still reported the previous release at that checkpoint. Publication makes the new release available to their scheduled OTA checks; it does not prove that every node has already installed it. Do not take stale node data as a new calibration window.

## Node 2 reference measurements

### Reconnect and component-side-up reference — November 25

After the operator reported Node 2 ready, Atlas showed a fresh report at **14:58:13.988 IST**, healthy sensor/storage/time flags, firmware `408a075` and a new boot ID `6201b16ae2412486cfded9859fa8b3a2`. The preceding gap's cause was not independently established. The operator subsequently explicitly confirmed **Node 2 flat ready**.

The requested capture window was **14:58:25–15:00:25 IST**. Twelve unique periodic samples were captured at **14:58:27–15:00:17 IST**. All came from the same Node ID, boot and firmware, with no applied calibration revision. No OTA/version transition occurred within the recorded samples. [Complete Node 2 face-up evidence](calibration/node2-component-up-2026-11-25.json) includes the source events and consistency checks.

| Axis | Raw mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | -0.156171 | 0.068140 |
| Y | -0.643807 | 0.110406 |
| Z | 6.909765 | 0.146168 |

Mean raw magnitude was **6.942521 m/s²**, below the conventional gravity reference. This point alone cannot determine Z bias versus scale or establish a hardware fault. Its variation was greater than Node 1's initial reference, so secure support and repeatability need attention in later windows. No coefficients were computed or applied to Node 2. Next: level component-side down, then the signed X/Y reference pairs, followed by independent validation before installation. Node 1's coefficients must not be reused.

### Node 2 component-side-down reference — November 25

The operator confirmed readiness with the opposite face downward. The requested capture window was **15:02:50–15:04:50 IST**. Twelve unique periodic samples were captured at **15:02:57–15:04:48 IST**. Node ID, boot ID and `408a075` firmware remained unchanged from the first reference; no calibration revision was applied. [Complete opposite-face evidence](calibration/node2-component-down-2026-11-25.json) contains source events and checks.

| Axis | Raw mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | -0.643807 | 0.039388 |
| Y | -0.286844 | 0.204014 |
| Z | -12.184518 | 0.041444 |

Mean magnitude was **12.206503 m/s²**. The paired faces give a provisional Z bias **-2.637376 m/s²** and scale **1.027181801**. These values are not installed or accepted final calibration. Z was relatively steady, but Y varied from 0 to -0.497197 m/s², with standard deviation 0.204014 m/s². That off-axis variation requires support/alignment and repeatability attention; do not claim a fully stationary three-axis reference or use this window to estimate Y coefficients. Repeat references if later checks show the fit is unsuitable.

Next requested position is **+X arrow upward** with the board secured against slipping and wires loose. Remaining X/Y pairs, independent validation and per-node installation are outstanding. Node 1's installed correction remains separate.

### Node 2 X-up reference — November 25

The operator confirmed +X pointing upward. The requested capture window was **15:07:05–15:09:05 IST**. Twelve unique periodic samples were captured at **15:07:08–15:08:58 IST**. All retained boot `6201b16ae2412486cfded9859fa8b3a2`, firmware `408a075` and uncorrected acquisition. [Complete X-up evidence](calibration/node2-x-up-2026-11-25.json) includes source records and consistency checks.

| Axis | Raw mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | 9.717654 | 0.019694 |
| Y | -0.019123 | 0.030510 |
| Z | -2.119462 | 0.142599 |

Mean magnitude was **9.947041 m/s²**. Initially only nine records arrived; subsequent queued uploads completed all twelve. Maximum recorded capture-to-receipt lag was **58.384 seconds**. A fresh heartbeat/node-state query confirmed the same boot and healthy sensor/storage while the backlog drained. The original capture window was retained; later arrivals were selected by capture time rather than incorrectly extending the physical measurement period. No reboot or firmware transition occurred in these records.

The measured X sign is positive as requested. This is the third recorded reference position, not a completed calibration; no X coefficients were fitted from one point. Next: +X arrow downward, followed by Y-up/down and independent validation. No settings or correction values were changed.

### Node 2 X-down interrupted attempt and stable repeat — November 25

The first requested X-down window was **15:11:30–15:13:30 IST**. Initially no selected events arrived. A node-state check at approximately 15:13 IST showed the board now running published `795d041` on new boot `cd8da16d0a1c412ff2815da16d38c21e`, healthy and synchronized. Late arrivals included both old/new boots and versions, confirming a transition during collection. This is consistent with the scheduled OTA rollout; no USB firmware write was performed on Node 2 for this transition. The [interrupted attempt](calibration/node2-x-down-interrupted-2026-11-25.json) was retained as evidence and **excluded from calibration fitting**. Cloud records were not deleted.

The operator was asked to keep X downward while collection restarted. The new requested window was **15:13:45–15:15:45 IST**, capturing twelve unique samples at **15:13:50–15:15:40 IST**. All share the new boot, `795d041` and `calibrationRevision: none`. [Stable X-down evidence](calibration/node2-x-down-2026-11-25.json) records the accepted window and checks.

| Axis | Raw/identity mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | -10.294533 | 0.031929 |
| Y | 0.124300 | 0.081744 |
| Z | -2.619847 | 0.221514 |

Mean magnitude was **10.625661 m/s²**. X was steady and negative, while off-axis Z varied more; support/alignment and independent repeatability checks remain necessary. No correction was applied to Node 2. The X pair gives provisional bias **-0.288439125 m/s²** and scale **0.980067808**, not final accepted values.

The earlier references used the raw driver in `408a075`; this repeat uses the same raw acquisition followed by identity correction in `795d041`. With revision `none`, the new wrapper subtracts zero and multiplies by one. Their versions/boots are recorded separately rather than described as one continuous run. Coefficients remain provisional until fresh validation on the current firmware checks the fit. The remaining positions are Y-up and Y-down, each on a stable boot/version within its own window.

### Node 2 Y-up reference — November 25

The operator confirmed +Y upward. The requested capture window was **15:17:55–15:19:55 IST**. Twelve unique periodic samples were captured at **15:18:00–15:19:50 IST**. They share boot `cd8da16d0a1c412ff2815da16d38c21e`, published firmware `795d041` and revision `none`; no calibration is active. [Complete Y-up evidence](calibration/node2-y-up-2026-11-25.json) includes source samples and consistency checks.

| Axis | Raw/identity mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | -0.159358 | 0.035853 |
| Y | 10.071432 | 0.044162 |
| Z | -2.154521 | 0.054901 |

Mean magnitude was **10.300711 m/s²**. Y was positive as requested, and the full window arrived without a boot or firmware transition. This is the fifth reference position. No Y bias/scale was calculated from this single point and no coefficients or settings were applied. Next: +Y downward, then provisional three-axis calculation and independent validation on fresh readings.

### Node 2 Y-down reference — November 25

The operator confirmed +Y downward. The requested capture window was **15:21:40–15:23:40 IST**. Thirteen unique periodic samples were captured at **15:21:40–15:23:40 IST**, including both endpoints of the 120-second interval. All retained boot `cd8da16d0a1c412ff2815da16d38c21e`, firmware `795d041` and revision `none`. [Complete Y-down evidence](calibration/node2-y-down-2026-11-25.json) preserves the source samples and checks; no record was dropped merely to force a twelve-sample count.

| Axis | Raw/identity mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | -0.376575 | 0.053740 |
| Y | -9.858626 | 0.031822 |
| Z | -2.909633 | 0.345084 |

Mean magnitude was **10.291082 m/s²**. Y was relatively steady and negative, but off-axis Z ranged from -2.485986 to -3.403888 m/s². This drift is flagged for alignment/support and repeatability review; it is not described as a stationary three-axis pass. No coefficients were installed.

### Node 2 provisional six-position calculation

The [provisional coefficient record](calibration/node2-provisional-coefficients-2026-11-25.json) lists the six accepted input windows and **73 distinct reference event IDs**. The interrupted X-down attempt is excluded. Each input window has one boot/version and uncorrected/identity acquisition; the version transition between separate windows is explicitly retained. The fit verifies the paired-axis means map to ±9.80665 m/s²; this is arithmetic consistency, not independent physical validation.

| Axis | Bias to subtract (m/s²) | Multiplicative scale |
| --- | --- | --- |
| X | -0.288439125 | 0.980067808 |
| Y | 0.106402907 | 0.984106551 |
| Z | -2.637376000 | 1.027181801 |

**These values are provisional, not applied and belong only to Node 2.** All values fall inside firmware configuration guards. Fit magnitudes range approximately 9.8067–9.8353 m/s², but off-axis corrected means include Y -0.7383 m/s² in the earlier component-up window and Z +0.5320 m/s² in X-up. The Y-down drift and other flagged variations remain relevant; fitting a gravity value does not establish an accurate sensor.

Next: a fresh held-out component-up window with the actual PCB firmly supported level in both directions and wires loose, without hand-holding. Use the unchanged bench screening limits (at least twelve unique samples spanning 100 seconds, corrected mean magnitude within 3%, absolute corrected X/Y mean at most 0.5 m/s², axis sample standard deviation at most 0.15 m/s²) before considering installation. Repeat unsuitable references if validation fails; do not relax limits after seeing the data or reuse Node 1's coefficients. Persistent installation, on-device verification and movement acceptance remain outstanding for Node 2.

### Node 2 first independent component-up validation — November 25

The operator confirmed readiness for a fresh supported-level component-up check. The requested capture window was **15:26:10–15:28:10 IST**, and twelve unique samples were captured at **15:26:11–15:28:01 IST**. They were disjoint from the six fitting windows and retained expected boot `cd8da16d0a1c412ff2815da16d38c21e`, firmware `795d041` and revision `none`. [Raw independent evidence](calibration/node2-validation-component-up-2026-11-25.json) and [offline analysis](calibration/node2-validation-result-2026-11-25.json) retain the criteria and checks.

| Quantity | Raw mean (m/s²) | Corrected offline mean (m/s²) |
| --- | --- | --- |
| X | -0.028685 | 0.254577 |
| Y | -0.940212 | -1.029981 |
| Z | 6.957573 | 9.855757 |
| Vector magnitude (mean of sample magnitudes) | 7.021062 | 9.912833 |

Corrected mean magnitude error was **+1.082768%**, inside the unchanged 3% bench screen. Corrected axis sample standard deviations were **0.028254, 0.046675 and 0.045748 m/s²**, inside the 0.15 m/s² repeatability screen. Identity, independent events, timing, expected boot/version and uncorrected-input checks passed. The level-position screen **failed** because absolute corrected Y 1.029981 m/s² exceeded 0.5 m/s². Improved magnitude alone does not pass full validation.

**Node 2 remains uncalibrated: provisional values are not accepted or installed.** Tilt, reference alignment or model/sensor error may explain the residual; this window alone cannot distinguish them. The operator was asked to inspect headers/components and support the actual PCB level in both directions before another held-out check. Do not refit or zero Y from this one pose, or relax limits to obtain a pass. If alignment can be independently verified and the residual persists, repeat the suspect reference orientations and investigate the fit; any changed coefficients require fresh validation.

### Node 2 supported-level repeat validation — November 25

The operator confirmed readiness after re-supporting the PCB. Coefficients and numeric screening criteria were unchanged. The requested capture window was **15:31:00–15:33:00 IST**. Twelve unique periodic samples were captured at **15:31:01–15:32:51 IST**, with the same expected boot `cd8da16d0a1c412ff2815da16d38c21e`, firmware `795d041` and revision `none`. [Repeat raw evidence](calibration/node2-validation-leveled-2026-11-25.json) and [repeat analysis](calibration/node2-validation-leveled-result-2026-11-25.json) retain the full results; the earlier unsuccessful window remains separate.

| Quantity | Raw mean (m/s²) | Corrected offline mean (m/s²) |
| --- | --- | --- |
| X | 0.057369 | 0.338915 |
| Y | -0.478074 | -0.575188 |
| Z | 6.938450 | 9.836114 |
| Vector magnitude (mean of sample magnitudes) | 6.955369 | 9.858903 |

Corrected magnitude error improved to **+0.532829%**, inside the 3% screen. Corrected axis sample standard deviations **0.025271, 0.054425 and 0.054173 m/s²** passed the 0.15 m/s² repeatability screen. Identity, independence, timing, stable expected boot/firmware and uncorrected-input checks passed. The level-position screen still **failed**: corrected Y magnitude **0.575188 m/s²** exceeded the unchanged **0.5 m/s²** limit by approximately 0.075188 m/s². Corrected X was inside the limit.

**Validation remains incomplete; nothing was installed or refitted.** Improvement after repositioning is useful evidence but does not establish that all residual error is tilt, nor that the coefficients are accurate. The operator was asked whether level was established with a spirit level/verified fixture or only visually. Establish that reference before repeating more nominally level windows. If externally verified alignment still fails, revisit the flagged reference positions/model rather than tilting until the calculated X/Y values happen to be zero or changing limits after the result. Node 2 continues logging with revision `none`.

### November 26 resume and alignment diagnostic

The operator clarified that the previous leveling was **visual placement only**. A read-only fleet check showed Node 2 reporting on `795d041`, revision `none`, new boot `bbf19dc13849fcedb72c915bee52b647`, healthy sensor/storage/time flags and 41 pending records at that checkpoint. Node 1 still reported its saved `n1-20261125-v1` correction on a new boot. Node 3 reported updating from the older firmware; Node 4's latest accepted report remained November 25. These are dated observations, not a new four-node group acceptance or a diagnosed cause for any stale report.

No coefficient, threshold, firmware or network setting was changed for the resume. Before repeating another nominally level pass/fail test, the operator was asked to prepare an **in-plane 180-degree reversal diagnostic** for Node 2:

1. Position A: component side upward, PCB edges supported on firm equal-height nonconductive supports, wires loose. Mark the +Y-arrow direction on paper and confirm readiness. Collect fresh stationary data.
2. Position B: rotate the board like a clock hand by 180 degrees on the same support, keeping the component side upward and the PCB plane unchanged. The +Y arrow should point opposite its mark. Do not flip the board or tilt it to force corrected values to zero. Confirm readiness and collect a separate fresh window.
3. Check each window's Node ID, identity correction, stable boot/version, unique samples and capture times. Queued arrivals must be selected by capture time and allowed to finish uploading rather than treated as measurements of a later pose.
4. Compare the X/Y vectors with the existing coefficients unchanged. Under the fixed-plane assumption, the horizontal projection of gravity reverses sign in sensor coordinates, while fixed offsets stay with the sensor. Opposing residual vectors support a fixed-support tilt explanation; a persistent midpoint residual calls for further offset/cross-axis/reference investigation. Movement, changed supports, wire tension, noise or drift can invalidate that inference.

This is a diagnostic inference from the rotation geometry, **not a manufacturer accuracy test or a new calibration acceptance rule**. A nonzero or zero midpoint alone does not prove a hardware defect or certified accuracy. Keep the previous failed level screens and provisional coefficients unchanged. If diagnostic data later become fitting inputs, they are no longer independent validation data; fresh acceptance evidence is still required. A verified level/square fixture remains preferable for known-orientation accuracy checks. Position A/B data are not yet recorded at this planning checkpoint.

### Position A movement interruption and stationary repeat — November 26

The first requested A window was **09:59:35–10:01:35 IST**. Its readings shifted noticeably, including X/Y approximately -0.54/-0.99 to -0.08/-0.23 m/s². The operator confirmed **movement or adjustment after readiness**. The twelve observed records were retained in the [interrupted A evidence](calibration/node2-reversal-a-interrupted-2026-11-26.json) and excluded from the stationary reversal comparison. No coefficients were changed.

The operator was asked to leave the current position untouched. After settling, a new full A window was requested at **10:02:25–10:04:25 IST**, capturing twelve unique samples at **10:02:28–10:04:18 IST**. All share the expected Node ID, boot `bbf19dc13849fcedb72c915bee52b647`, firmware `795d041` and revision `none`. [Stationary A evidence](calibration/node2-reversal-a-2026-11-26.json) includes raw data, offline statistics and consistency checks.

| Axis | Raw mean (m/s²) | Corrected offline mean (m/s²) | Corrected sample standard deviation (m/s²) |
| --- | --- | --- | --- |
| X | -0.073305 | 0.210846 | 0.040618 |
| Y | -0.063743 | -0.167442 | 0.049030 |
| Z | 7.158364 | 10.062006 | 0.043789 |

With the existing provisional coefficients unchanged, mean sample magnitude was **10.065792 m/s²**, error **+2.642514%** against 9.80665 m/s². This stationary A window's numeric values fall inside the earlier magnitude, X/Y and repeatability limits. However, its mechanical level was not independently verified, and the planned position B comparison is still required to interpret the diagnostic. **No coefficient was fitted or installed, and the diagnostic is not declared a completed calibration.**

Next requested action: turn the PCB 180 degrees like a clock hand on the same supports, keep the component side upward and the board plane unchanged, and point +Y opposite its paper mark. Let wire tension settle before confirming position B readiness; do not move it during the next window.

### Position B comparison and separate supported-pose validation — November 26

The operator confirmed the in-plane 180-degree position B. Its requested window was **10:08:05–10:10:05 IST**, capturing twelve unique samples at **10:08:08–10:09:58 IST** on the same boot/version/revision as A. [Position B evidence](calibration/node2-reversal-b-2026-11-26.json) and [A/B comparison](calibration/node2-reversal-comparison-2026-11-26.json) retain the data and existing coefficient snapshot; no coefficients were refitted.

| Quantity | Corrected offline A | Corrected offline B |
| --- | --- | --- |
| Mean X (m/s²) | 0.210846 | 0.217093 |
| Mean Y (m/s²) | -0.167442 | -0.020026 |
| Mean Z (m/s²) | 10.062006 | 9.993256 |
| Mean sample magnitude (m/s²) | 10.065792 | 9.995720 |

X/Y midpoint residuals were **0.213970/-0.093734 m/s²**. The vectors did not reverse exactly. Mechanical plane/rotation assumptions were not independently measured, so this does not prove that tilt alone caused the earlier failures or establish true level. The reversal remains diagnostic evidence, not the calibration acceptance window.

A **separate fresh** supported-component-up validation was then collected on the resting B support with the original coefficients and numeric limits unchanged. The requested window was **10:12:00–10:14:00 IST**, with twelve unique samples at **10:12:08–10:13:58 IST**. These event IDs were disjoint from the fitting and A/B diagnostic windows. See [fresh raw validation](calibration/node2-validation-supported-2026-11-26.json) and [offline result](calibration/node2-validation-supported-result-2026-11-26.json).

That window passed the numeric bench screens: corrected mean magnitude **10.048273 m/s² (+2.463870%)**, mean X/Y **0.210846/0.058387 m/s²**, and corrected axis sample standard deviations **0.025060/0.070567/0.041458 m/s²**. Identity, sample count/span, expected boot/version and revision `none` checks passed. The fixture remained visually positioned rather than externally verified. This was therefore a **limited numeric supported-pose screen**, not certified known-orientation accuracy or final production acceptance. It allowed a trial installation followed by mandatory on-device verification; it did not erase the earlier failures.

### Node 2 trial installation and failed on-device magnitude screen — November 26

After no ESP32 USB port was initially detected, the operator connected Node 2 by data USB. A first serial read contained garbled/repeated output; a clean repeat identified `esp32-7839a3f4e9d4` on COM5, firmware `795d041`, identity correction, healthy sensor/storage and 256 local records. No write was made based on unidentified hardware.

The existing USB installer saved **trial revision `n2-20261126-v1`** and compared all coefficients after the automatic reboot at approximately **10:17 IST**. The firmware remained unchanged, saved Wi-Fi rejoined, and 256 local records remained indexed. No portal, filesystem upload, NVS erase or firmware reflash was used. The post-install cloud state reported the trial revision, healthy synchronized status and zero pending uploads. Example event `694734f33b3c611c5da826fa0a1e0185`, captured **10:17:49 IST** and received **10:17:52.796 IST**, contains the device-corrected axes and trial revision.

The operator confirmed a new supported-component-up check with USB connected. The requested window was **10:18:55–10:20:55 IST**, capturing twelve unique samples at **10:18:59–10:20:49 IST** on boot `6245cdaf9d6271af27736e988bbb47b6`, firmware `795d041` and trial revision `n2-20261126-v1`. [Complete device-corrected evidence](calibration/node2-on-device-validation-2026-11-26.json) preserves the checks. No second correction was applied during analysis.

| Axis | Device-corrected mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | 0.229588 | 0.025060 |
| Y | -0.402680 | 0.094209 |
| Z | 10.117660 | 0.026265 |

Mean magnitude was **10.128704 m/s²**, error **+3.284037%**, **outside the unchanged ±3% screen**. Identity, unique samples, window/span, boot/version/revision, X/Y means, variation and magnitude-versus-axis consistency passed. Installation/persistence worked, but accuracy acceptance **failed**. It must not be rounded down to a pass. Node 2 is **not accepted as calibrated**.

The trial v1 record remains active and tagged for continued bench investigation; the revision label means applied settings, not accepted accuracy. The saved arrays were rechecked. Reversible arithmetic from the device-corrected window corresponds to mean raw Z approximately **7.212545 m/s²**, versus **7.142428 m/s²** in the earlier offline validation. A later independent USB `sensor-raw` read showed Z approximately **7.2667 m/s²**. These are different captures and do not identify whether pose, reference quality, power, temperature or sensor/model behavior caused the change.

Next, repeat **both** Z reference faces under the current stable USB setup using explicit `sensor-raw` measurements, then consider a new fit and fresh validation. Do not rescale a coefficient from this one failed validation value. Keep original evidence and v1 coefficients for comparison. The operator confirmed readiness for the new component-up Z reference; collection is in progress at this checkpoint. Node 1 and all other node settings remain unchanged.

### New raw USB positive-Z fitting reference — November 26

The operator confirmed a stable component-up reference with USB connected. `scripts/capture-raw-reference.py` identified Node 2 before acquisition, then used the existing firmware's `sensor-raw` command. This bypasses the active trial correction without disabling or changing it. The host capture ran **10:26:12.042–10:28:12.049 IST**, collecting **120 raw measurements** spanning 119 seconds at approximately 1 Hz. [Raw positive-Z reference](calibration/node2-z-up-usb-2026-11-26.json) includes the source measurements and initial/final hardware state.

| Axis | Raw mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | -0.027382 | 0.021129 |
| Y | 0.072652 | 0.033044 |
| Z | 7.070401 | 0.037716 |

Z's second-half mean differed from the first half by approximately **0.008925 m/s²**. There were no missed replies, firmware/calibration state stayed unchanged, and independent cloud checks during/after capture retained boot `6245cdaf9d6271af27736e988bbb47b6`. The active telemetry revision remained `n2-20261126-v1`; the USB fitting values themselves are **raw**, not corrected cloud values.

USB observations have sequence numbers, host UTC timestamps and monotonic elapsed times; they are not fabricated Atlas event IDs or server-received telemetry. The timestamps above are host capture times displayed in IST. The sampler records data only and does not write calibration, network settings or local samples. Review stationarity and physical support before using the measurements for fitting.

No new coefficient was computed from this one face. The operator then confirmed readiness for the opposite component-down Z reference on the same USB setup. That independent fitting window is being collected before any v2 fit or validation. Keep the old v1 fit and its failed on-device check in history.

### New raw negative-Z reference and v2 candidate — November 26

With USB power retained, the operator confirmed the component-down pose. Host capture ran **10:30:57.902–10:32:57.892 IST**, recording **120 raw samples** spanning 119 monotonic seconds. [Negative-Z USB evidence](calibration/node2-z-down-usb-2026-11-26.json) retains the measurements and before/after device state. Firmware and the active v1 trial remained unchanged; there were no missed replies.

| Axis | Raw mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | -0.573683 | 0.101491 |
| Y | 0.758230 | 0.113473 |
| Z | -12.028351 | 0.054318 |

Z's second-half mean differed from its first half by **0.005105 m/s²**. Off-axis X/Y changed more (second-half changes approximately -0.133853/-0.156187 m/s²), so this does not certify exact alignment or three-axis stationarity. Only the opposite Z means enter this new Z fit; do not derive X/Y calibration from these faces.

The [v2 candidate](calibration/node2-candidate-v2-2026-11-26.json) replaces only Z with a two-point fit from the new raw means **+7.070401/-12.028351 m/s²**. Candidate Z bias is **-2.478975 m/s²**, scale **1.026941464**. Existing X/Y coefficients are unchanged. This fit uses two new raw fitting windows, **not the failed validation value**. The old v1 fit and its failure remain preserved.

**V2 is a candidate only: it has not been installed or validated.** V1 remains active for tagged bench telemetry. The operator was asked to return to a supported component-up pose for a separate fresh raw validation. Apply the candidate offline once to those raw values, with the original numeric limits unchanged. If that passes, a trial v2 save/reboot and a new device-corrected check are still required. Do not claim acceptance from fitting the two Z means to gravity.

### V2 independent raw validation and USB status retry — November 26

The operator confirmed a fresh component-up validation pose. The first capture stopped at its initial USB status check, before recording any measurement or changing settings. [The incomplete zero-sample evidence](calibration/node2-v2-validation-usb-2026-11-26.json) was retained. A separate clean serial read confirmed the correct Node 2, unchanged firmware/trial v1 and healthy state; the cloud boot remained `6245cdaf9d6271af27736e988bbb47b6`. The cause of the missing initial response was not established as a device reboot or hardware fault.

The host sampler was updated to allow at most three initial four-second status requests, still refusing a returned identity/support mismatch immediately. Final state checking and raw-response timeout behavior remain strict. A new output file was used rather than overwriting the failed evidence. Python compilation passed, and the retry completed normal initial/final status reads with no retries needed in that successful run.

The fresh host capture ran **10:37:29.706–10:39:29.703 IST**, recording **120 raw samples** over approximately 118.985 monotonic seconds. Firmware and active v1 settings stayed unchanged, and there were no missed raw replies. The validation started after both Z fitting captures ended. [Successful retry evidence](calibration/node2-v2-validation-usb-retry1-2026-11-26.json) and [offline v2 analysis](calibration/node2-v2-validation-result-2026-11-26.json) preserve the data, coefficient snapshot and checks.

| Axis | Raw mean (m/s²) | V2 corrected offline mean (m/s²) | Corrected sample standard deviation (m/s²) |
| --- | --- | --- | --- |
| X | -0.053202 | 0.230549 | 0.023470 |
| Y | -0.050013 | -0.153930 | 0.021727 |
| Z | 7.159942 | 9.898603 | 0.040702 |

Corrected mean sample magnitude was **9.902535 m/s² (+0.977759%)**. All unchanged numeric screens passed: ±3% mean magnitude, absolute mean X/Y at most 0.5 m/s² and per-axis sample standard deviation at most 0.15 m/s². Raw USB validation required at least 100 samples spanning 100 seconds, stricter in count than the earlier sparse cloud windows. Identity, state consistency, raw-input provenance and temporal separation from the Z fit also passed. V2 was applied once offline to explicit raw data; it was not refitted using this validation.

This was a **numeric supported-pose bench pass** with visually estimated support, not externally verified physical level or certified orientation/temperature accuracy. A separate installed-correction check remained mandatory.

### V2 installation and final device-corrected bench screen — November 26

The USB installer rechecked Node 2 identity before saving **`n2-20261126-v2`** from the v2 candidate file. Its normal restart restored the expected bias/scale arrays at approximately **10:40:47 IST**, on firmware `795d041`. The board retained 256 indexed records, its Wi-Fi settings and sensor response. No firmware reflash, portal reopening or network/filesystem replacement was performed. V1 was superseded; old events were not rewritten.

Atlas then reported v2, new boot `8f6540df4f4260352348b39760926dff`, healthy sensor/storage/time flags and zero pending records at the checkpoint. The operator had kept the supported component-up pose unchanged. A new cloud capture window **10:42:00–10:44:00 IST** selected twelve unique periodic samples captured at **10:42:07–10:43:57 IST**. [Full v2 on-device evidence](calibration/node2-v2-on-device-validation-2026-11-26.json) contains all records and checks.

| Axis | Device-corrected mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | 0.248330 | 0.025060 |
| Y | -0.136077 | 0.035283 |
| Z | 9.877339 | 0.042147 |

Mean sample magnitude was **9.881484 m/s² (+0.763098%)**. All original numeric screens and identity/count/span/window/boot/version/revision checks passed. Each event's summary matched its already-corrected axes; **analysis applied no second correction**.

**Current Node 2 checkpoint: v2 installed, persistent through its save/reboot, reporting to Atlas and passed the supported-pose numeric bench screen.** V1's +3.284% failed check and all incomplete/diagnostic data remain preserved. This does not certify externally measured level, full orientation/temperature accuracy, movement/threshold acceptance, deliberate power-cut/rollback or endurance. Those remain separate work, as for Node 1.

At approximately **10:45 IST**, Nodes 1/2/3 had fresh reports on `795d041`; revisions were `n1-20261125-v1`, `n2-20261126-v2` and `none`, respectively. Node 4's last accepted report was still November 25. Node 3 was requested next for identity verification and its own raw references; no calibration values were copied to it.

## Node 3 raw reference measurements — November 26

### Component-side-up USB reference

The operator connected Node 3 on COM5 and confirmed the supported component-up pose. The host sampler's first status request had no complete reply; its bounded second request verified **`esp32-986aa3f4e9d4`**, firmware `795d041` and identity revision `none` before acquisition. It then settled for ten seconds. No firmware, calibration, network setting or local log was written by the sampler.

Host capture ran **10:48:14.792–10:50:14.799 IST**, recording **120 raw measurements** spanning 119 monotonic seconds. [Complete Node 3 positive-face evidence](calibration/node3-component-up-usb-2026-11-26.json) includes initial/final state, status-request attempts and raw data. There were no missed raw replies; identity, firmware and calibration remained consistent through the window.

| Axis | Raw mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | 0.004457 | 0.020529 |
| Y | -0.031223 | 0.042922 |
| Z | 8.151477 | 0.045160 |

Z was positive as expected for this physical face. Its second-half mean differed from the first by approximately **-0.043347 m/s²**. This is only the first fitting reference, not a calibration or accuracy pass; no offsets/scales were calculated from one point and none were copied from Nodes 1/2. Next: supported component-side down with USB retained, then the signed X/Y pairs, fitting and independent validation.

### Component-down interrupted attempt and transport check

The first component-down attempt verified identity after one initial status retry, then began raw measurement. It recorded **53 samples**, first at **10:53:32.880 IST** and last at **10:54:24.887 IST**, before a raw USB response exceeded the default two-second deadline. The last progress line had reported 40, but the retained file contains 53. [Incomplete evidence](calibration/node3-component-down-usb-2026-11-26.json) preserves the exact count and timeout; it is **excluded from fitting** because it is incomplete and below the 100-sample/100-second requirements. No settings changed.

A subsequent clean `status` and `sensor-raw` probe identified the same Node 3 on `795d041`, revision `none`, healthy sensor/storage and a valid negative-Z read. Cloud boot ID `910e13f2c305bad75baa3d6f8b622131` was unchanged at that checkpoint. The timeout's cause was not established as a reboot, sensor defect, flash delay or wiring fault.

The sampler gained an explicit bounded raw-response deadline option and an immediate abort for an explicit sensor read-failure message. A separate full retry was started with **`--reply-timeout 5`**, recorded in its new evidence file. Sample count/span, physical-pose requirements, before/after state checks and calibration numeric limits were unchanged. No partial measurements were merged, and no firmware or calibration value was changed to address the host read deadline. The retry is in progress at this checkpoint.

### Completed component-down raw retry

The separate retry captured **120 raw samples** over approximately 119.016 monotonic seconds, host **10:56:52.102–10:58:52.101 IST**. [Complete retry evidence](calibration/node3-component-down-usb-retry1-2026-11-26.json) records the explicit five-second response deadline, zero missed replies and unchanged Node ID, firmware and identity revision. A subsequent cloud checkpoint retained boot `910e13f2c305bad75baa3d6f8b622131`, healthy sensor/storage and revision `none`. The retry's success does not establish the first timeout's cause.

| Axis | Raw mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | 0.123331 | 0.042788 |
| Y | -0.089239 | 0.092400 |
| Z | -11.358712 | 0.046894 |

Z's second-half mean differed by approximately **-0.007015 m/s²**. The two Z faces yield provisional bias **-1.603617917 m/s²** and scale **1.005284974**, recorded for later fitting/validation only. No coefficient was installed, and the incomplete 53-sample attempt is not part of the fit. Next: X-up/down and Y-up/down, then independent validation with unchanged numeric bench limits.

### Node 3 raw X-up reference

The operator confirmed the +X arrow upward. The host USB capture ran **11:02:09.008–11:04:09.031 IST**, recording **119 valid raw samples** spanning approximately 119.406 monotonic seconds. [X-up evidence](calibration/node3-x-up-usb-2026-11-26.json) records the five-second raw-response deadline, zero missed replies, unchanged firmware/identity correction and before/after matching Node ID.

| Axis | Raw mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | 10.051607 | 0.026340 |
| Y | -0.038862 | 0.027714 |
| Z | -2.211201 | 0.054313 |

The actual count was 119, not a forced 120; it still exceeds the unchanged 100-sample/100-second requirements. Maximum recorded host receipt gap was approximately **2.390 seconds**. No raw request exceeded its configured deadline. X was positive as requested and its second-half mean changed by only approximately -0.002454 m/s². No coefficient was computed from this one X face or applied. This is the third reference position; X-down and both Y faces remain before fitting and validation.

### Node 3 X-down USB interruption and independent cloud reference

The X-down USB attempt stopped after **47 samples**, captured approximately **11:06:05–11:06:51 IST**, when a raw reply exceeded the explicit five-second deadline. [Incomplete USB evidence](calibration/node3-x-down-usb-2026-11-26.json) is excluded from fitting. Subsequent cloud telemetry showed the same boot, firmware, revision `none`, healthy sensor/storage and zero pending uploads. The USB timeout cause remains unconfirmed; no firmware or settings were changed.

A separate cloud window was declared before capture, **11:09:05–11:11:05 IST**. This used the existing sparse cloud protocol: at least twelve unique periodic samples spanning at least 100 seconds, with consistent identity/boot/firmware/revision. Since this node still uses identity correction (`none`), its cloud acceleration axes are uncorrected fitting inputs. This provenance must be rechecked before any later cloud raw capture. The incomplete USB measurements were not merged, and their minimum-count requirement was not relaxed.

[Complete X-down cloud evidence](calibration/node3-x-down-cloud-2026-11-26.json) contains **12 unique samples spanning 110 seconds**, captured **11:09:12–11:11:02 IST**, all on boot `910e13f2c305bad75baa3d6f8b622131`, firmware `795d041`, revision `none`. Selection uses device capture time rather than receipt time; maximum receipt delay was approximately **12.423 seconds**.

| Axis | Uncorrected cloud mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | -10.020438 | 0.023063 |
| Y | -0.079679 | 0.034434 |
| Z | -1.137816 | 0.028829 |

All source/count/span/window/identity checks passed, and X remained negative. Four fitting positions are recorded; both Y faces, fitting and independent validation remain. No correction is installed. Cloud sampling is sparse and does not characterize full-band sensor noise; physical positioning remains operator-established, not externally certified.

### Node 3 raw Y-up cloud reference

The operator confirmed +Y upward. A fresh cloud window was declared as **11:15:22–11:17:22 IST**, using the same minimum twelve unique periodic samples spanning 100 seconds. [Y-up evidence](calibration/node3-y-up-cloud-2026-11-26.json) records **12 unique samples spanning 110 seconds**, captured **11:15:22–11:17:12 IST**. All samples retained the expected Node 3 identity, boot `910e13f2c305bad75baa3d6f8b622131`, firmware `795d041` and identity correction revision `none`. Its cloud axes therefore remain uncorrected fitting inputs. Maximum receipt delay was approximately **13.290 seconds**; selection used device capture time.

| Axis | Uncorrected cloud mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | 0.025497 | 0.018831 |
| Y | 9.899323 | 0.022081 |
| Z | -1.010330 | 0.057562 |

All source/count/span/window/identity checks passed, and Y remained positive. No firmware, calibration or network setting was changed. Five fitting positions are now recorded; Y-down, coefficient fitting, independent validation and installation remain. This is a fitting reference, not an accuracy acceptance result, and the sparse cloud/visual positioning limitations above still apply.

### Node 3 Y-down reference and v1 candidate

After the operator confirmed +Y downward, a new window **11:19:55–11:21:55 IST** captured **12 unique periodic cloud samples spanning 110 seconds**. [Y-down evidence](calibration/node3-y-down-cloud-2026-11-26.json) contains device capture times, server receipt times and checks. All samples retained Node 3 identity, boot `910e13f2c305bad75baa3d6f8b622131`, firmware `795d041` and identity revision `none`; Y remained negative. No calibration, firmware or network setting changed.

| Axis | Uncorrected cloud mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | 0.095615 | 0.025785 |
| Y | -10.154294 | 0.025786 |
| Z | -1.752939 | 0.089075 |

Z shifted approximately **-0.165733 m/s²** between the first and second halves, while the fitted Y axis shifted approximately **-0.012752 m/s²**. All per-axis sample standard deviations remained below 0.15 m/s². These observations are retained rather than claiming perfectly fixed orientation. Sparse sampling and visual support remain limitations.

All six completed signed references were checked for identity, firmware, raw provenance, sign and source-specific count/span requirements. [Candidate v1](calibration/node3-candidate-v1-2026-11-26.json) uses each axis's positive/negative means with `bias=(positive+negative)/2` and `scale=2*9.80665/(positive-negative)`. The interrupted component-down and X-down USB attempts are excluded. USB and cloud sample counts are retained separately; samples are not pooled across faces or transports.

| Axis | Candidate bias (m/s²) | Candidate scale |
| --- | --- | --- |
| X | 0.015584278 | 0.977145085 |
| Y | -0.127485625 | 0.978043009 |
| Z | -1.603617917 | 1.005284974 |

**Candidate only: proposed revision `n3-20261126-v1` is not installed or independently validated.** All values satisfy firmware coefficient bounds, which does not establish accuracy. Next is a fresh supported component-up validation, applying this candidate once offline to raw axes under unchanged numeric limits. Only after that passes should installation/readback/reboot and a fresh device-corrected check proceed. No validation readings have been used to fit these coefficients.

### Node 3 independent validation, installation and device check

The operator returned the sensor to a supported component-up pose. A fresh **11:25:39–11:27:39 IST** cloud window recorded twelve unique raw-identity samples spanning 110 seconds, on the unchanged pre-installation boot, firmware and revision `none`. [Offline validation](calibration/node3-v1-offline-validation-2026-11-26.json) applied the fixed candidate once, without refitting: mean sample magnitude **9.977857 m/s² (+1.745828%)**, corrected X/Y means **0.009686 / 0.018702 m/s²**. All original count/span/provenance and numeric limits passed.

The guarded USB installer then verified Node 3 identity and saved `n3-20261126-v1`. The save acknowledgment and matching coefficients were read back after its automatic reboot at approximately **11:29:14–11:29:15 IST**. [Installation evidence](calibration/node3-v1-installation-2026-11-26.json) records 256 retained logs, healthy storage, ADXL345 address 0x53 and setup inactive. Firmware, network settings and filesystem were not replaced; no BOOT intervention or captive portal was needed. The immediate readback preceded Wi-Fi reconnection; subsequent Atlas reports independently established restored connectivity and the new revision.

With the sensor left in the same supported pose, a separate **11:29:47–11:31:47 IST** window recorded twelve unique device-corrected samples spanning 110 seconds. [On-device validation](calibration/node3-v1-on-device-validation-2026-11-26.json) records stable firmware, revision and new boot `56af3af31d51a125e5258eaa2ed4c18a`.

| Axis | Device-corrected mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | 0.009687 | 0.024342 |
| Y | -0.018704 | 0.047405 |
| Z | 9.939302 | 0.038302 |

Mean sample magnitude was **9.939455 m/s² (+1.354238%)**. All unchanged screens passed: ±3% mean magnitude, absolute mean X/Y at most 0.5 m/s², per-axis standard deviation at most 0.15 m/s², and count/span/window/node/boot/version/revision checks. Event summaries matched the already-corrected axes; no second correction was applied. An **11:30:42 IST** health checkpoint showed sensor/storage/time ready, 256 retained records and zero pending uploads.

**Node 3 checkpoint: correction installed, persistent through its save/reboot, reporting to Atlas, and passed the limited supported-pose numeric bench screen.** Visual support was not externally leveled; sparse telemetry does not certify full orientation/temperature accuracy, post-calibration movement/threshold acceptance, deliberate power-cut/rollback or endurance. These remain separate work.

The authenticated live dashboard at **11:33:23 IST** showed Nodes 1/2/3 online with their respective applied revisions; Node 4 still showed last seen November 25. The [reviewed screenshot](images/dashboard-calibration-three-nodes.png) preserves this checkpoint, including Node 3's then-current two pending records (different from the earlier zero-pending health snapshot). No controlled movement test or simultaneous four-node acceptance is inferred from that screenshot.

## Node 4 raw reference measurements — November 26

### USB identity and component-up cloud reference

The operator connected Node 4 and confirmed its ADXL345 component-side up on supported, visually established level. A read-only probe showed COM5 still belonged to calibrated Node 3; **COM6** identified the intended **`esp32-3013a5f4e9d4`**. No settings were written to either board. At approximately **11:38:08 IST**, Node 4 reported firmware `795d041`, calibration disabled/revision `none`, healthy storage, sensor address 0x53, saved Wi-Fi connected, 256 retained records and setup inactive. Atlas independently confirmed current reporting, synchronized time and healthy sensor/storage on boot `d4425b16a951887969c0439a9f68a4ba`.

A new cloud window **11:38:38–11:40:38 IST** used the existing minimum twelve unique periodic samples spanning 100 seconds, selected by device capture time. [Component-up evidence](calibration/node4-component-up-cloud-2026-11-26.json) contains **12 unique samples spanning 110 seconds**, captured **11:38:39–11:40:29 IST**. Node/boot/firmware/identity-revision checks passed, so these axes are uncorrected fitting inputs. Maximum receipt delay was approximately **17.911 seconds**.

| Axis | Uncorrected mean (m/s²) | Sample standard deviation (m/s²) |
| --- | --- | --- |
| X | 0.305967 | 0.043147 |
| Y | 0.764919 | 0.048924 |
| Z | 9.363880 | 0.027451 |

Z remained positive, with a second-half minus first-half shift of approximately **0.012749 m/s²**. All per-axis standard deviations were below 0.15 m/s². This is only the first fitting reference, not a calibration accuracy pass; the nonzero sideways means are not declared corrected or accepted. No coefficient was calculated from this one face or copied from another node. Next: component-down, X/Y signed pairs, fitting and independent validation. Physical level was not externally verified, and sparse telemetry does not characterize full-band noise.

At **11:39 IST**, Nodes 2/3/4 had fresh cloud reports; Node 1's latest accepted report was **11:35:46 IST**. This session does not establish simultaneous four-node availability or group acceptance.

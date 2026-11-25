# Per-node ADXL345 calibration

## Test order and current state

| Order | Node ID | State |
| --- | --- | --- |
| 1 | `esp32-d01de2f4e9d4` | Six references recorded; leveled repeat passed offline bench screen; persistent firmware application pending |
| 2 | `esp32-7839a3f4e9d4` | Awaiting positioning and measurements |
| 3 | `esp32-986aa3f4e9d4` | Awaiting positioning and measurements |
| 4 | `esp32-3013a5f4e9d4` | Awaiting positioning and measurements |

The other nodes can stay powered and online while one sensor is measured. Confirm each physical board's Node ID before moving it. Movement while positioning is a calibration activity; its notifications are not operational incidents.

## Measurement procedure

1. Identify the selected sensor and inspect its mounting and wiring. Support it on a nonconductive surface without stressing jumper wires. Keep power connected and avoid exposed contacts.
2. Confirm fresh cloud reports, responding sensor, available storage, synchronized time, firmware version and boot ID. Record all times in IST, retaining UTC epoch values in machine-readable data.
3. Place the sensor component-side up on a level surface. The operator must confirm positioning. Allow settling, then collect at least two minutes of new periodic samples while it stays still. Discard movement events and samples captured before settling; use capture time rather than delayed server receipt time to select the window. Deduplicate by event ID.
4. Record the measured X/Y/Z means, standard deviations and magnitude. This initial orientation is a baseline check, not a completed three-axis calibration. Board component-side up alone does not establish chip-axis direction; inspect the sensor's printed axis markings before assigning a signed axis.
5. Collect stationary windows with each marked sensor axis pointing upward and downward: +X, -X, +Y, -Y, +Z, -Z. Confirm each position separately. Use a secure nonconductive support; do not balance the board on pins or pull wires taut.
6. For each axis, calculate bias `(positiveMean + negativeMean) / 2` and scale `2 * 9.80665 / (positiveMean - negativeMean)` from acceleration in m/s². The corrected axis is `(measured - bias) * scale`. Check pose signs, repeatability and reference alignment before accepting coefficients. This is a diagonal offset/scale model, not a cross-axis or temperature calibration.
7. Apply accepted coefficients only to the matching Node ID, persist them, reboot and verify retained coefficients against repeated reference orientations. The current `408a075` firmware has no per-axis calibration fields or correction application. A validated firmware change is required before coefficients can be applied persistently; changing summary sensitivity is not a substitute.
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

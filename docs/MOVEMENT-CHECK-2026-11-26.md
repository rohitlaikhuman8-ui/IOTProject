# Post-calibration movement checks — November 26, 2026

## Scope and prerequisite

The [post-calibration group check](GROUP-CHECK-2026-11-26.md) verified simultaneous uploads and reciprocal neighbor discovery. Its subsequent operator-confirmed two-minute stillness baseline recorded 49 periodic samples with no received movement events. This is a short observation, not a false-alarm-rate or minimum-detectable-motion certification. Thresholds and calibration coefficients are unchanged during these checks.

## Node 1 first movement trial: delivery verified, isolation inconclusive

The phase began at **12:57:57 IST**. The operator gently moved Node 1 (`esp32-d01de2f4e9d4`) and replied that it was done. A query through **12:58:58 IST** found four fresh Node 1 movement events, all carrying revision `n1-20261125-v1`, firmware `795d041` and its unchanged boot. Each had a matching notification with the same Node ID/event ID. [Complete trial evidence](calibration/node1-postcal-movement-trial1-2026-11-26.json) preserves all events, notifications and subsequent health.

| Node 1 event ID | Device capture IST | Server receipt IST | Movement delta (m/s²) |
| --- | --- | --- | --- |
| `2804debca11b925c0bc2714447454d04` | 12:58:16 | 12:58:18.411 | 1.660572 |
| `73c3e0a87e6545b42f4ade0eeba82106` | 12:58:19 | 12:58:20.632 | 9.396443 |
| `3e34aa2e030991fcc5d8c9b7a578767c` | 12:58:20 | 12:58:22.493 | 10.849340 |
| `f36f6ed9d500cfaa0e277a1ed09d1398` | 12:58:23 | 12:58:23.959 | 16.742130 |

Node 2 also generated event `b3eb7fcad53d18f571eacfbc394396b4`, captured **12:58:16 IST**, received **12:58:18.618 IST**, delta **1.532366 m/s²**, revision `n2-20261126-v2`, with its own matching notification. Nodes 3/4 had no received movement events in that marked interval. All four still reported healthy sensor/storage/time flags afterward; queue counts of 1/1/2/0 were retained as instantaneous state rather than claimed fully drained.

The operator confirmed **shared support or wires could have moved Node 2**. Therefore Node 1's movement detection and notification delivery are verified, but physical isolation is **inconclusive**. This does not establish a Node 2 false positive, hardware defect or identity attribution failure; the extra event remained correctly attributed to Node 2. Do not increase thresholds to hide it.

The operator was asked to isolate Node 1 on a separate nonconductive support with slack wires and keep all nodes still, then confirmed **“Node 1 isolated ready.”** A new stillness window and isolated repeat are required. Do not substitute this confounded trial for that repeat or claim completed per-node/group acceptance.

## Separated-support baseline and completed movement checks

### Separated-support baseline completed; Node 1 repeat requested

After the operator confirmed Node 1 isolated and all sensors still, a new declared **13:01:14–13:03:14 IST** window recorded **48 periodic samples**, twelve per node, and **zero received movement events**. Capture spans were 109/110/110/110 seconds for Nodes 1/2/3/4. Expected firmware, per-node revisions and stable boot provenance passed, and final sensor/storage/time flags were healthy. Pending counts at the health checkpoint were 0/0/0/1. [Complete separated-support baseline](calibration/node1-isolated-baseline-2026-11-26.json) retains all data and the limited-observation scope; no settings changed.

At **13:04:21 IST**, the isolated Node 1 repeat phase was marked before asking for about five seconds of gentle movement of that sensor only, followed by stillness. The first trial remains inconclusive for isolation and is not overwritten.

### Node 1 isolated repeat — limited pass

The operator confirmed the isolated movement was done. [Repeat evidence](calibration/node1-postcal-movement-isolated-2026-11-26.json) records four fresh Node 1 events captured **13:04:53–13:05:01 IST**, each with a matching notification and expected firmware, revision `n1-20261125-v1` and stable boot. No other node's movement event was received in the marked phase through **13:05:38 IST**. All four nodes remained healthy with zero pending records at the follow-up checkpoint. The largest observed server-receipt delay was approximately 17.612 seconds; capture and receipt times remain separate. This verifies limited isolated gross-motion detection and delivery, not a quantified minimum motion or false-alarm rate.

### Node 2 movement — limited pass

The Node 2 phase was marked at **13:06:04 IST**; the operator confirmed its movement was done. [Node 2 evidence](calibration/node2-postcal-movement-2026-11-26.json) records two events captured **13:06:28** and **13:06:30 IST**, received at **13:06:30.751** and **13:06:32.042 IST**, with deltas **4.841630** and **12.076590 m/s²**. Both had matching notifications, revision `n2-20261126-v2`, expected firmware and stable boot. No other movement event was received in that phase through **13:06:48 IST**. All four nodes remained healthy, with zero queues at the follow-up checkpoint. No thresholds changed.

The user paused before Node 3 received any movement instruction. Its earlier internal phase marker is discarded for future testing; a fresh marker must be recorded after resumption. Nodes 3/4 controlled movement checks remain outstanding.

## Remaining checks

### Resume checkpoint after the user-requested pause

At approximately **14:08 IST**, all four were reachable with their saved revisions but reported setup mode and queues **215/191/220/211** for Nodes 1/2/3/4. A later checkpoint showed **54/34/32/36**, indicating upload recovery. COM5 was reverified as Node 3, with Wi-Fi connected, setup active and a telemetry HTTP -1 transport timeout in its USB log. No credential or sensor fault was established.

The firmware opens a fallback portal after more than 30 seconds without Wi-Fi and expires it after 15 minutes; a setup heartbeat alone does not prove why connectivity was interrupted. The agent issued `portal-close` only to the verified Node 3. Subsequent serial confirmed its saved correction unchanged, portal inactive, zero pending and resumed HTTP 200 reporting. At approximately **14:16 IST**, all four reported running and healthy with queues **10/0/0/0**; Node 1's remaining ten records were not declared delivered at that checkpoint. Other portals returned to running without a close command from the agent.

[Recovery evidence](calibration/movement-resume-recovery-2026-11-26.json) retains the snapshots. Firmware, settings, calibration and retained records were not replaced; no flash, erase, reset or queue deletion was performed. This observed network/queue recovery is not the planned controlled power-cut/rollback test, and its earlier root cause remains unconfirmed. Use a fresh capture-time boundary for Node 3 after recovery; never treat backfilled historical movement as the new physical test.

At **14:17:23 IST**, a fresh preflight confirmed all four online, running, sensor/storage/time healthy and **zero pending records**, with their same boot IDs and saved revisions. This replaces the earlier ten-pending Node 1 checkpoint as the current recovery result. A **new Node 3 movement phase was marked at 14:17:23 IST (08:47:23 UTC)** before asking the operator to gently move only `esp32-986aa3f4e9d4` for about five seconds and then leave it still. COM5 was verified as this node. The physical reply and event/notification result remain pending; the pre-pause marker is not used.

1. After a pause, verify current cloud freshness, boot/revision, sensor/storage/time and pending queue state before marking the next movement phase.
2. Preserve the completed Node 1 isolated and Node 2 checks, including the earlier confounded Node 1 trial.
3. Run controlled movement and settling checks for Nodes 3/4 individually, using their full Node IDs and active revisions. Keep supports and wires mechanically independent where possible.
4. Record the mounting and motion used. A gentle gross tilt verifies that motion can trigger delivery; it does not quantify minimum detectable movement or tune a statistically justified threshold.
5. Proceed to controlled power-cut/recovery and failed-image rollback testing only after movement/threshold checks. Full orientation/temperature accuracy and endurance remain separate work.

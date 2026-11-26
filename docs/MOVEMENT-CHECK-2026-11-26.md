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

## Remaining checks

1. Record the new quiet baseline after physical separation, preserving any alerts and queue state.
2. Ask for Node 1 movement only, mark the phase before the instruction, and verify fresh events, notifications and continued reporting from the other nodes.
3. Repeat controlled movement and settling checks for Nodes 2/3/4 individually, using their full Node IDs and active revisions. Keep supports and wires mechanically independent where possible.
4. Record the mounting and motion used. A gentle gross tilt verifies that motion can trigger delivery; it does not quantify minimum detectable movement or tune a statistically justified threshold.
5. Proceed to controlled power-cut/recovery and failed-image rollback testing only after movement/threshold checks. Full orientation/temperature accuracy and endurance remain separate work.

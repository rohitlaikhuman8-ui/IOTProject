# Node 4 committed pending-record power-loss test

## Scope and current state

**Fixed pending-record baseline saved; physical power-cycle confirmation pending.** The prior [network-only test](QUEUED-DATA-RETRY-2026-11-27.md) passed ten selected records. This separate phase checks whether a fixed set of already-committed, unsent records survives removal of USB power and subsequently reaches Atlas unchanged. Manual removal is not synchronized to a flash write, so even a pass cannot establish interrupted-write or measured brownout safety.

The operator confirmed Node 4 is USB-only powered, with its ADXL345 powered from that same ESP32 and no other powered interconnection. Keep Nodes 1–3 powered and connected throughout. Do not move sensor wiring, short pins, adjust supplies or press BOOT/EN/RESET. No firmware/settings/calibration changes or erase are planned.

The [fleet preflight](calibration/node4-pending-power-fleet-before-2026-11-27.json) showed all four running, fresh, healthy and synchronized with zero queues. Node 4 remains on boot `9057c927c8ad28fec57364286a49d892`, firmware `d05bb40`, revision `n4-20261126-v1`. An identity-checked full 256-record AP export succeeded on COM6 before isolation; the [local preflight metadata](calibration/node4-pending-power-preflight-2026-11-27.json) preserves calibration and content hashes. Laptop Wi-Fi was restored to Sensor Testing. The manual setup session is deliberately open for the baseline, with its normal fifteen-minute lifetime; no credentials are published.

## Staged operating procedure

1. After local access is prepared, ask the operator to block only Node 4 (MAC `d4:e9:f4:a5:13:30`) in the hotspot. Keep power unchanged. Record a new observation boundary after confirmation and verify its cloud reports stop while peers remain fresh.
2. After roughly 100 seconds, capture the complete local log over the already-open AP. Require the expected identity/firmware/calibration/boot, 256 distinct records, nonfresh cloud status and a bounded growing pending queue. Select at least six fresh periodic samples after the boundary; retain a fixed set of up to ten complete original payloads and raw line hashes.
3. While still blocked, query Atlas for every selected ID and require none present. If access, identity, isolation or queue checks fail, restore network promptly and record an incomplete result rather than proceeding to a power cut. Preserve the immutable baseline before asking for the physical step.
4. Close all serial handles. Only then instruct the operator to unplug Node 4's USB for ten seconds and reconnect that same cable, keeping its hotspot entry blocked. Do not unblock, reconfigure or touch other wiring yet. Record the operator confirmation; this does not electrically measure the cut timing.
5. Allow boot and automatic fallback AP startup while the saved hotspot remains blocked. Rejoin its same setup AP and export its full log. Require all selected IDs still present with identical original fields and raw line hashes, and at least one boot ID absent from the entire pre-cut export. Preserve failed evidence. Never erase/reflash merely because recovery is delayed.
6. Only after the post-cut local comparison succeeds, ask the operator to unblock Node 4. Require each fixed ID stored once in Atlas with unchanged original fields, excluding server-added receipt metadata. Verify new-boot reporting, saved Wi-Fi/calibration/firmware, healthy sensor/storage/time, a readable journal and queue drainage. Verify peers' boots remain unchanged.
7. Close only this test's setup session if still active, restore laptop Wi-Fi and remove temporary profiles. Archive results under `docs/`, update README and verification records, and push finalized evidence. Keep any failed attempt distinct.

## Acceptance limits and next phases

## Before-cut isolation and baseline — completed

After the operator confirmed Node 4 blocked, the observation boundary was **10:57:13.756 IST**. Its last cloud report remained **10:56:59.218 IST**, while the other three kept fresh reports and unchanged boots. The [isolation snapshot](calibration/node4-pending-power-isolation-fleet-2026-11-27.json) is a cloud observation; its target pending value is stale and must not be substituted for the fresh local queue count.

Local HTTP export at approximately **11:05:05 IST** contained 256 distinct records, with **47 pending before / 48 after**, and `Wi-Fi reconnecting` status. The capture interval was longer than the planned roughly 100-second observation and is recorded as actually observed. Ten periodic records captured **11:03:07–11:04:38 IST** were selected on the expected original boot, firmware and revision. [Baseline metadata](calibration/node4-pending-power-before-2026-11-27.json) retains complete original fields, IDs and per-record hashes; the [raw full export](retention/node4-pending-power-before-2026-11-27.ndjson) has SHA-256 `11bfa11891ebfa337c06a29273f5d3c4c9277fba52cb0e8383fc799fbe9a07fc`.

The [Atlas absence query](calibration/node4-pending-power-absence-2026-11-27.json) returned zero documents for all ten selected IDs, with no applied limits, before the physical power-cycle instruction. The laptop returned to Sensor Testing and the temporary profile was removed. No serial handle is left open by the capture. The operator was then asked to remove only Node 4's USB for ten seconds and reconnect, **keeping its hotspot entry blocked**. No completion is assumed until confirmed and checked.

Post-cycle local payload/hash survival, a new boot, later Atlas delivery, journal integrity, final health and queue drainage are still pending. No power-loss acceptance pass is claimed.

## Remaining acceptance limits

Pending-record persistence and subsequent delivery are separate assertions; record both. Matching record counts alone is insufficient. The 256-record journal is finite, and all-pending capacity can stop new logging. This test does not establish indefinite retention, a quantified reconnect deadline, survival of an uncommitted sample, flash-write interruption, supply voltage thresholds, deliberate OTA failure/rollback or long-term endurance.

Measured brownout and write-interruption tests need suitable isolated power-switching/measurement equipment and a separate recovery plan. Failed-image rollback must use an isolated target and preserve the known-good schema-compatible application; never publish a deliberately failing image to the fleet production channel.

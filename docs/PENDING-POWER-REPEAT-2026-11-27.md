# Pending-data power-cut repeat on repaired portal — November 27, 2026

## Result: passed for ten fixed committed pending records on Node 4

All ten selected records survived the observed USB power cut with identical local payloads and raw hashes while still network-isolated, then each reached Atlas once with original fields unchanged. The new boot, saved settings/calibration, journal integrity, time/cloud recovery and zero backlog were verified. Earlier failed attempts remain unchanged. This result covers the selected committed records in this trial; interrupted writes, measured brownout, intentional rollback, other nodes' exact pending-record continuity and endurance remain separate acceptance work.

This is a fresh test on production **`c0e1dc440b9b24d856098d845483aa49904e6a7e`**, after the [fallback AP repair](FALLBACK-AP-AVAILABILITY.md). The [earlier power-cut attempts](PENDING-POWER-RECOVERY-2026-11-27.md) remain unchanged: one lacked restart evidence; another delivered selected pre-cut samples but lacked the required isolated post-cut local export. Neither is silently converted into this test's result.

At approximately **13:38 IST**, all four nodes had fresh healthy running/synchronized cloud reports, expected calibration revisions and zero pending. Node 4's reference boot is **`169f2b979be96f2ef4a46e83a27f8a86`**. The current USB path is **COM6**, physically identified and previously verified to disappear when that board's USB is removed. The operator's confirmed USB-only supply arrangement and ADXL345-from-ESP32 wiring are retained; no alternate supply or powered interconnection has been reported.

The [fresh local preflight](calibration/node4-pending-power-repeat3-preflight-2026-11-27.json) verified Node 4's complete USB identity, production release, saved calibration, healthy sensor/storage, valid Wi-Fi IP, setup initially inactive and no pending OTA boot validation. It opened one manual setup session, downloaded all 256 records plus the recent-ID list, restored the laptop to Sensor Testing and removed its temporary profile. The session is explicitly retained for this short baseline and has the normal fifteen-minute lifetime. The saved AP credential stays private; no Wi-Fi/config/calibration setting was rewritten.

The public capture helper now buffers partial USB lines until newline rather than discarding fragments at read timeouts. This same buffering approach passed the fallback hardware test; this preflight exercised it on production hardware. Before/after helpers use fresh evidence paths and preserve original exports before content validation where possible. Prior failures remain archived.

## Fixed staged procedure and criteria

1. Ask the operator to block only Node 4 in the hotspot, leaving USB connected, peers powered and the laptop online. Record a new observation boundary after confirmation. Verify target cloud reporting stops while peers remain fresh.
2. After roughly 100 seconds, join the prepared setup AP and capture the full log. Require the exact node, 256 unique records, a real AP client, no usable station IP, station retries paused, and pending count **3–64**. Select six to ten fresh periodic records after the boundary, on the expected firmware/revision/reference boot; retain their complete payloads and raw line hashes.
3. Before requesting any power change, query Atlas for every selected ID and require zero stored documents without result truncation. Preserve that immutable selection and absence evidence. Do not replace already-delivered IDs to force a pass.
4. Ask the operator to unplug USB at the already identified Node 4 and leave it disconnected. Require the operator's LEDs-off report and fresh COM6 absence while peer USB bridges remain. Only then request reconnection, **keeping the hotspot block active**. Do not press BOOT/EN/RESET or move sensor wires.
5. Allow at least the automatic fallback startup period. Read USB identity/status without resetting or changing settings, then join the repaired AP and export all 256 records while still blocked. Require all selected IDs present with identical original fields and raw hashes, and exactly one new boot absent from the entire before-cut archive. New-boot records must use the expected firmware/revision. Keep the same **3–64** bounded queue criterion. Records generated before NTP returns may legitimately lack device capture time; server receipt time remains separate.
6. Only after local survival is verified, ask the operator to unblock Node 4. Verify every selected ID reaches Atlas once with original fields unchanged, a fresh new-boot heartbeat/telemetry, saved Wi-Fi/time/calibration/firmware, healthy sensor/storage, a readable journal and queue drainage. Check peers' boots/revisions remain unchanged.
7. End only the test's portal session, restore laptop networking, remove temporary profiles/private XML, archive failures/results under `docs/`, update README/verification and push finalized documentation. If access fails, power changes unexpectedly, isolation is not verified or the bounded queue criterion fails, stop the acceptance attempt and restore connectivity promptly; do not extend the outage or erase/reflash to hide evidence.

## Isolation and immutable baseline completed

The operator confirmed **“Node 4 blocked for repaired-portal power test.”** The fresh boundary was **13:42:16.108 IST** (`1795767136.1080053`). Node 4's cloud report stayed at **13:41:31.003 IST**, while all peers continued fresh reports with unchanged boots. The [isolation fleet snapshot](calibration/node4-pending-power-repeat3-isolation-fleet-2026-11-27.json) retains those cloud observations; its stale target pending count is not the current local backlog.

The [before-cut metadata](calibration/node4-pending-power-repeat3-before-2026-11-27.json) and [full raw export](retention/node4-pending-power-repeat3-before-2026-11-27.ndjson) preserve 256 distinct same-node records, per-record hashes and ten selected fresh periodic payloads on the reference boot/production release/saved revision. Local status showed **16 pending before / 17 after**, no usable station IP, station retries paused and a real AP client. The export completed by **13:44:39 IST**; laptop Wi-Fi returned to Sensor Testing and the temporary profile was deleted.

The [Atlas query](calibration/node4-pending-power-repeat3-absence-2026-11-27.json) found zero documents for every fixed selected ID, with no applied limits, before requesting any power change. No IDs were replaced after that query. The operator was then asked to remove USB from the identified board, keep it unplugged and report both LEDs off. Physical removal, new boot, post-cut exact local survival and later cloud delivery remain pending.

**Scope:** the test concerns survival/delivery of the fixed already-committed records. Survival of an in-progress write, zero loss during an indefinite outage, a measured brownout threshold, intentional OTA rollback and endurance acceptance require separate equipment/procedures and evidence.

## Physical removal verified; reconnection pending

The operator confirmed **“Node 4 unplugged, LEDs off.”** At **13:47:32 IST**, [fresh USB enumeration](calibration/node4-pending-power-repeat3-disconnected-2026-11-27.json) verified **COM6 absent**, with COM5/COM8/COM9 still present. The indicator observation is operator-reported; the supply voltage and exact physical cutoff time were not electrically measured. This checkpoint is specific to the current immutable pending-record baseline, not reused from an earlier test.

The operator was then asked to reconnect the same cable **while keeping Node 4 blocked in the hotspot**. Do not unblock until the new boot and isolated full-log comparison are checked. Reconnection, selected-record survival, cloud delivery and recovery remain pending; COM-port disappearance alone is not a retention pass.

The paragraph above preserves that staged checkpoint. Completed reconnection and survival observations follow; no evidence from a previous attempt is substituted.

## Isolated post-cut local comparison — passed

The operator confirmed **“Node 4 reconnected, still blocked.”** [Fresh USB readback](calibration/node4-pending-power-repeat3-reconnected-usb-2026-11-27.json) reidentified COM6 as the expected production node, with exact preflight calibration coefficients, responding ADXL345/storage, no pending OTA verification and automatic AP-only fallback. No reset, reflash or settings change was commanded. Time synchronization remained pending while internet was blocked, which is expected after a real restart.

The repaired portal returned a complete [after-cut 256-record export](retention/node4-pending-power-repeat3-after-2026-11-27.ndjson) while the device remained isolated. [Capture metadata](calibration/node4-pending-power-repeat3-after-2026-11-27.json) records a real AP client, no usable station IP, paused station retries and **40 pending before / 41 after**, within the fixed 3–64 criterion. Export time was **13:49:58.690 IST**, compared with **13:44:39.409 IST** for the before-cut archive. Laptop Wi-Fi was restored and its temporary profile removed.

The [independent raw archive comparison](calibration/node4-pending-power-repeat3-local-comparison-2026-11-27.json) verified both complete-file hashes, all per-record hashes and **all ten selected IDs with identical original payloads and raw line hashes**. Every one of the **232 common records** also matched exactly; 24 older before-only IDs and 24 added IDs are listed separately. Untracked omissions are not asserted to be pending-record losses or permanent full-history retention. Exactly one new boot **`4412fae2215814b621317804360e5dcd`** was absent from the entire pre-cut archive; six local records on it had the expected production release and revision.

Before requesting network restoration, a second [Atlas query](calibration/node4-pending-power-repeat3-post-cut-absence-2026-11-27.json) again found zero documents for every fixed selected ID, without applied limits. This establishes an isolated local survival checkpoint before delivery, rather than inferring survival only from later cloud receipts.

## Network restoration and delivery

The operator confirmed **“Repaired-portal power test: network restored.”** The [USB recovery record](calibration/node4-pending-power-repeat3-recovery-usb-2026-11-27.json) verified saved Wi-Fi obtained a valid IP and fresh cloud success. Once connectivity was ready, only the completed test's manual portal session was closed; setup became inactive, saved coefficients still matched and no OTA image awaited validation.

All ten fixed pre-cut IDs then appeared **once each** in Atlas with every original field unchanged, received **13:52:37.249–13:52:48.259 IST**. [Delivery evidence](calibration/node4-pending-power-repeat3-delivery-2026-11-27.json) retains all returned documents and per-ID comparisons with no applied limits. Server-added `receivedAt` is preserved separately from original capture times/boot IDs. The read-only journal scan validated **256 records, zero invalid**, in **22,587 ms**. Node 4 reported the same new boot as the isolated local archive, healthy synchronized running state and the expected release/revision; peers kept their reference boots.

## Final recovery and cleanup — completed

The backlog decreased through 43 and 14 to **zero**. [Final USB readback at 13:55:09 IST](calibration/node4-pending-power-repeat3-final-usb-2026-11-27.json) confirmed exact saved coefficients, unchanged firmware, valid saved-network IP, responding sensor/storage, setup inactive and no pending OTA verification. [Final cloud evidence](calibration/node4-pending-power-repeat3-final-cloud-2026-11-27.json) verifies Node 4's new boot `4412fae2215814b621317804360e5dcd` and fresh stored periodic samples. At approximately **13:55:04 IST**, all four were running/healthy/synchronized on `c0e1dc4`, with queues **0/0/0/0**, 256 indexed records each and reciprocal three-peer discovery on channel 11. All three peer boots and every firmware/revision matched isolation preflight.

The [authenticated dashboard/API checkpoint](calibration/node4-pending-power-repeat3-dashboard-2026-11-27.json) at approximately **13:55:55 IST** again had zero queues and all four fresh. The [reviewed screenshot](images/dashboard-pending-power-pass-2026-11-27.png) shows all four online and live telemetry; its independently refreshed DOM includes one in-flight Node 1 record. Do not rewrite those separate observations into a promise of constant zero pending. The new-boot startup and movement history remain visible in the dashboard; handling motion was not used as another threshold acceptance test.

Laptop Wi-Fi is Sensor Testing; temporary capture profiles and private XML were removed. The completed manual setup session was closed only after a valid IP and fresh cloud success, preserving the repaired portal's recovery behavior. No firmware/config/calibration write, erase, USB reset command or pending-record deletion was used in this power-cut test. Physical USB removal was operator-performed and port-observed; voltage and exact cut duration were not electrically instrumented.

**Final acceptance: PASS for the fixed ten committed pending records on Node 4, including isolated local hash survival, once-stored exact cloud delivery and healthy recovery.** Full-history indefinite retention, other nodes' pending-record survival, uncommitted/in-progress writes, controlled brownout, isolated intentionally failed OTA rollback, quantified motion sensitivity/false alarms and endurance remain open.

## Independently recheck the archived local result

From the repository root in PowerShell, with Python installed:

```powershell
@'
import json, hashlib
from pathlib import Path
metas, logs = [], []
for phase in ("before", "after"):
    meta = json.loads(Path(f"docs/calibration/node4-pending-power-repeat3-{phase}-2026-11-27.json").read_text(encoding="utf-8"))
    body = Path(f"docs/retention/node4-pending-power-repeat3-{phase}-2026-11-27.ndjson").read_bytes()
    assert len(body) == meta["exportBytes"]
    assert hashlib.sha256(body).hexdigest() == meta["exportSha256"]
    records = {}
    for raw in body.splitlines():
        record = json.loads(raw)
        key = record["eventId"]
        assert key not in records
        assert hashlib.sha256(raw).hexdigest() == meta["recordHashes"][key]
        records[key] = record
    assert len(records) == 256
    metas.append(meta)
    logs.append(records)
for record in metas[0]["selectedRecords"]:
    key = record["eventId"]
    assert logs[0][key] == logs[1][key] == record
    assert metas[0]["recordHashes"][key] == metas[1]["recordHashes"][key]
print("PASS: ten selected records match original fields and raw hashes after power cut")
'@ | python -
```

This offline check verifies the archived local comparison. The separate absence/delivery, physical disconnect, USB and cloud checkpoints establish the other acceptance steps. Preserve the `.ndjson` bytes when copying archives; Git disables newline conversion under `docs/retention/`.

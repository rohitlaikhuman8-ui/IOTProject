# Queued-data recovery — diagnostic run, November 26, 2026

## Result

**Controlled exact-queue acceptance is inconclusive; connectivity and delayed-upload recovery were observed.** Node 4 was restored to Sensor Testing, retained production `d05bb40` and calibration `n4-20261126-v1`, and its queue reached zero at the final checkpoint. Do not treat this diagnostic run as a clean isolation or pending-record integrity pass.

## What happened

The operator reported a per-device hotspot block for Node 4, MAC `d4:e9:f4:a5:13:30`. At **23:01:24 IST**, its last cloud report was stale while the other three remained fresh. Short and extended USB reads returned repeated/garbled fragments rather than complete status. No reset, erase, firmware flash or settings write was commanded. Local log fragments indicated sampling, but did not establish exact queued IDs or a trustworthy queue count.

The agent attempted to open setup over USB. The operator then reported opening setup through GPIO4, but the laptop still could not see/join the expected `ESP32-Setup-3013a5f4e9d4` network. Windows recorded that the specified network was unavailable. [Incomplete local-capture metadata](calibration/node4-outage-local-capture-incomplete-2026-11-26.json) is preserved. The laptop was restored to Sensor Testing and the temporary Wi-Fi profile/private credential file removed. The saved AP credential had been recovered privately from the existing backup using the [documented NVS layout](https://docs.espressif.com/projects/esp-idf/en/release-v4.0/api-reference/storage/nvs_flash.html); neither that credential nor the backup is published.

Before requesting explicit restoration, a fixed query window **23:01:24–23:14:55 IST** already contained **34 Node 4 records**, including receipts around **23:10:30–23:10:45 IST**. Therefore the asserted device block was not verified as continuous. [Before-restoration evidence](calibration/node4-outage-before-restore-2026-11-26.json) records those actual results, not a fabricated empty baseline. The operator was asked to unblock Node 4 and confirmed network restoration; the confirmation checkpoint was **23:20:07 IST**, not an instrumented timestamp of the physical hotspot action.

Node 4 also changed boot from `e2f73147203cf881d1891fe378397a14` to `b91c4d50bb6c88a11fe6878e2c134fb6`, with reset reason **1**, the installed SDK's power-on enumeration. The operator initially was unsure, then confirmed the cable/power or EN/RESET was changed and described it as a mistake. Exact action/timing are unspecified. This is recorded as an accidental external power/reset disturbance, not a diagnosed firmware watchdog failure; the electrical cause was not instrumented.

## Observed recovery

[Diagnostic result and event evidence](calibration/node4-outage-recovery-diagnostic-2026-11-26.json) preserve initial/restored/final node states, queue snapshots, new-boot records and all **83 stored records** returned for the unchanged query window. The query was complete with no applied response limits. Thirty-four were present in the earlier query; forty-nine additional IDs appeared later. Sixty records carry the earlier boot and twenty-three the new boot. The maximum observed server-receipt delay was approximately **778.370 seconds**. These demonstrate delayed uploads, but no immutable pre-restoration selected-ID/payload baseline was obtained.

After restoration, valid USB status again showed saved calibration, responding ADXL345/storage, setup inactive and normal reporting. The queue was approximately **59–60**, decreased to **11–12**, briefly rose with additional in-flight activity, then reached **zero** by approximately **23:28 IST**. At the final snapshot all four were running/healthy/time-synchronized on the expected firmware/revisions, with queues **1/1/0/0**. No pending records were deliberately deleted. This is not proof that every record generated during the entire disturbed interval was retained or delivered.

The experimental outage option for the capture helper was not hardware-validated and was not promoted into the public helper. The unchanged retention helper and its previous successful selected-record test remain separate evidence. Failed attempts are preserved; do not overwrite them or reinterpret their criteria as passed.

## Clean retry prerequisites

1. Keep the same USB/power connection throughout; do not press BOOT/EN/RESET or touch wiring while the test is active. A power-cycle must be its own separately planned phase.
2. While internet still works, verify the exact Node ID/MAC, a reliable local access path and the setup AP's visibility/usability. Save the setup credential privately for the brief capture. Do not begin isolation until local access is proven.
3. Prepare the capture and verification steps completely, then pause only Node 4 for a short bounded interval (about two minutes). Other nodes and the laptop must retain internet. Confirm server reporting actually stops and local pending count grows.
4. Archive a small fixed set of fresh local pending records while still isolated. Verify those exact IDs are absent from Atlas before restoration. If local access fails or isolation is not verified, restore connectivity promptly and retain a diagnostic result rather than prolonging the outage.
5. Restore only Node 4, then verify all selected IDs and original payload fields in Atlas, event-ID uniqueness, queue drainage, unchanged firmware/calibration/boot and healthy peer reporting. Record capture time separately from server receipt time. A changing boot or unverified pause invalidates a no-reset isolation pass.
6. Only after a clean retry should pending-record power-cut/write-interruption, measured brownout and isolated failed-image rollback tests proceed. Never publish a failing test image to the production fleet.

**A clean retry has not started.** Leave Node 4 online and powered while the local access prerequisite is prepared. The rolling 256-record store is finite; this run does not establish retention capacity or indefinite no-loss behavior.

A subsequent [November 27 short retry preflight](QUEUED-DATA-RETRY-2026-11-27.md) verified all four current USB identities and Node 4's full local HTTP export before asking for any new pause. Its manual setup session was deliberately left available for a short network-only test. This does not change the diagnostic classification of the November 26 attempt.

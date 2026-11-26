# Staged recovery checks — November 26, 2026

## Current state

All four have saved calibration corrections and limited individual gross-motion notification passes. Recovery testing begins with a normal power-cycle on Node 1. Interrupted-write behavior, OTA rollback, brownout behavior and endurance remain separate tests and are not inferred from a successful restart.

Node 1 was verified on **COM5** at approximately **21:18 IST**, identity `esp32-d01de2f4e9d4`, firmware `795d041`, revision `n1-20261125-v1`, saved Wi-Fi connected, setup inactive, zero pending uploads and `pendingVerification=false`. Its read-only journal check validated **256 of 256 records, zero invalid**, in 31,267 ms. [Preflight evidence](calibration/node1-power-cycle-preflight-2026-11-26.json) contains the saved coefficients and exact results. No firmware/configuration/calibration write or reset was performed during preflight.

Read-only probes also identified Node 4 on COM7 and Node 2 on COM8. Port numbers can change after reconnection; verify Node ID every time. All four had fresh Atlas reports with healthy sensor/storage/time flags and unchanged installed revisions. These are fresh checkpoints, not proof of uninterrupted operation during the earlier pause.

## Normal power-cycle procedure

1. Finish the integrity scan and close the serial handle. Confirm the tested board's identity, stable supply and no active OTA installation. Keep other nodes powered and the saved Wi-Fi available.
2. If Node 1 is powered only by USB, disconnect its USB power for ten seconds and reconnect. If it has another power source or possible backfeed through wiring, establish its supply arrangement before proceeding; USB removal alone is not a power cut. Handle connectors, not exposed pins, and retain the sensor wiring.
3. After reconnection, re-identify the USB port and board. Read status and coefficients without resetting or reconfiguring it. Compare firmware, revision and all bias/scale values against the preflight. Confirm saved Wi-Fi reconnects without provisioning, time synchronizes, and sensor/storage are healthy.
4. Repeat the read-only integrity scan; compare retained records carefully because the rolling journal can replace acknowledged old records during normal sampling. Matching counts alone do not prove that every exact record survived. Exact continuity requires an archived pre/post record-ID comparison.
5. Verify a new boot ID, fresh device-captured telemetry and server-stamped startup/connection reporting in Atlas/dashboard. Check the other nodes remain online and record queue state honestly. A ten-second outage may be shorter than the 90-second offline timeout and need not produce an offline notification.
6. Preserve failed results, checkpoints and any recovery actions. Do not erase or reflash merely because reporting is delayed. Update this record before repeating or advancing to another node.

## Node 1 normal power-cycle result — limited pass

The operator confirmed **“Node 1 power-cycle done.”** The first USB status request returned no complete status; a separate retry identified Node 1 on COM5 at **21:21:06 IST**. Firmware, revision and all bias/scale values matched preflight exactly. Saved Wi-Fi reconnected, setup was inactive, the sensor responded at 0x53, storage was ready and no OTA image awaited validation. No configuration write or manual reset was needed.

The post-cycle read-only scan validated **256 records, zero invalid**, in **29,748 ms**. [Device result](calibration/node1-power-cycle-result-2026-11-26.json) retains status and scan. Matching valid counts establish a readable retained journal, not exact record-ID continuity in the rolling log.

[Cloud evidence](calibration/node1-power-cycle-cloud-2026-11-26.json) shows Node 1 changed from boot `c46ee4d687f0a5eb57677ed79ccd66e7` to `cb84e8a66ce1b15e361f3d0f89f65ed7`, retaining firmware `795d041` and revision `n1-20261125-v1`. A startup notification was stored at **21:20:56.925 IST**. Fresh periodic samples captured **21:21:07 / 21:21:17 / 21:21:27 IST** were received at **21:21:10.382 / 21:21:19.589 / 21:21:29.202 IST**, carrying the new boot ID. Device time was synchronized at the cloud checkpoint. Other nodes retained their preflight boot IDs and healthy running status. Queue counts were **0/0/0/1**; Node 4's pending record is not claimed delivered at that checkpoint.

An Atlas connector transport error affected the first supplementary query; retry succeeded. It is not diagnosed as an ESP32 upload failure. User-performed removal was not electrically instrumented; exact outage timing and supply voltage were not measured.

**Node 1 passed a limited normal power-cycle recovery check.** Nodes 2/3/4 still need their own checks. Exact record-ID continuity, interrupted writes, intentional brownout and failed-image rollback remain untested. Later flash-interruption and rollback tests need their own recovery plan and must not publish a deliberately failing image to the fleet-wide production channel.

## Node 2 preflight — power-cycle pending

At approximately **21:26 IST**, COM8 was reverified as **`esp32-7839a3f4e9d4`**, firmware `795d041`, revision `n2-20261126-v2`. The first USB status response was garbled and excluded; a fresh complete JSON response passed identity/version/revision checks and its bias/scale arrays matched the installed v2 candidate within serial precision. No cause for the garbled transport response is asserted. Saved Wi-Fi was connected, setup inactive, zero pending uploads and no OTA image awaiting validation.

The read-only journal scan validated **256 of 256 records, zero invalid**, in **24,290 ms**. [Node 2 preflight](calibration/node2-power-cycle-preflight-2026-11-26.json) retains status and integrity results. [Cloud preflight](calibration/node2-power-cycle-cloud-before-2026-11-26.json) records all four healthy/running with expected revisions and zero pending at that checkpoint. Node 2's pre-cycle boot ID is `8708c856fad9a30b8b50626daf39fcbc`.

**Physical Node 2 power-cycle has not started.** Follow the same normal power-cycle procedure above, using this node's verified identity and port. Confirm it is USB-only powered before removal; if it has another supply/backfeed path, establish its power arrangement first. Leave other nodes powered. After reconnection, verify identity, firmware, coefficients, Wi-Fi/time/sensor/storage, fresh cloud boot/events and journal integrity. No settings, firmware, reset or record deletion was performed in preflight. Exact record-ID continuity, interrupted writes, brownout and OTA rollback remain separate work.

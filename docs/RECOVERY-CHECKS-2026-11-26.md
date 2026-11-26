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

**Physical power-cycle result: pending.** No controlled power removal has occurred in this phase. Later flash-interruption, intentional brownout and failed-image rollback tests need their own recovery plan and evidence; they must not publish a deliberately failing image to the fleet-wide production channel.

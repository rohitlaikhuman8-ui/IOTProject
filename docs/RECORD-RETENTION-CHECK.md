# Exact local record comparison — November 26, 2026

## Scope and current status

Node 4 (`esp32-3013a5f4e9d4`, verified COM7) is being tested on production release `d05bb40` after the fallback-portal fix. The existing 256-valid-record integrity scans establish readable storage, not that particular records and their contents survived. This check archives actual local payloads and compares event IDs and exact per-line SHA-256 hashes across a normal power-cycle.

**Completed: Node 4's thirty tracked records survived the operator-confirmed normal power-cycle with identical payload hashes.** One additional recent record and every other retained common record matched too. This is selected-record retention on Node 4, not fleet-wide zero-data-loss or interrupted-write acceptance. No firmware or settings changed.

## Before-power baseline

[Full original NDJSON export](retention/node4-before-2026-11-26.ndjson) contains 256 unique local event records. [Baseline metadata](calibration/node4-retention-before-2026-11-26.json) retains byte length, complete-export SHA-256, each event's exact-line hash, serial identity/calibration and the thirty newest IDs as returned by the device's sequence-ordered recent-log endpoint. All thirty are present in the full export. Capture began only after an identity-checked zero-pending checkpoint; subsequent queue state is preserved separately.

The laptop briefly joined this node's manually opened setup AP, read `/status`, `/logs` and `/log`, verified the HTTP content length, then closed setup and restored its original Wi-Fi. A temporary local Wi-Fi profile/credential file was removed. Credentials are not printed or included in evidence. Existing manual sessions or pending OTA verification cause the helper to stop rather than taking over the session.

## Acceptance and interpretation

1. Verify the same Node ID, production firmware and saved calibration before/after. Retain original bytes and hashes; reject duplicate IDs, wrong-node data, truncated transfers or malformed JSON.
2. After the operator's normal USB-only power-cycle, capture a new full export with the same helper into a different directory. Never overwrite baseline or failed capture evidence.
3. For each of the thirty explicitly tracked baseline IDs, require presence after restart and an identical raw JSON-line SHA-256. Compare every other common ID's hash too. Report counts and exact missing/changed IDs, not just matching totals.
4. The store normally deletes its oldest acknowledged record when full. Older baseline records may therefore disappear while new records are sampled and uploaded; preserve those IDs as observed rotation rather than declaring all 256 permanent. The tracked thirty are deliberately recent. If tracking records are missing, examine elapsed time, sampling/movement rate and possible rotation before attributing loss to power removal. Do not silently replace the tracked set or relax hash checks.
5. A positive comparison establishes exact survival of the selected records and unchanged contents for the observed intersection. It does not prove survival of every acknowledged historical record indefinitely, nor of unacknowledged records during interrupted writes. Queue-loss/interrupted-write tests need separate baselines and evidence.

## Operator procedure

Keep sensor wiring connected and other nodes powered. Once baseline capture and serial/network cleanup finish, if this board is powered only by USB, disconnect Node 4 USB for ten seconds and reconnect it. If there is another supply/backfeed path, establish the arrangement first. Keep sensors still, do not change settings or issue extra sample commands, and reply promptly so normal rolling retention does not consume the recent-record observation window. Leave its portal untouched; the agent will capture the post-cycle log and restore the laptop's Wi-Fi afterward.

## Reproduce a capture

On Windows with Python and pyserial installed:

```powershell
python scripts/capture-local-log.py --port COM7 --node esp32-3013a5f4e9d4 --output work/retention-new-before
# After the separately instructed power-cycle, use a fresh output directory:
python scripts/capture-local-log.py --port COM7 --node esp32-3013a5f4e9d4 --post-cycle-baseline work/retention-new-before/metadata.json --output work/retention-new-after
python scripts/compare-local-logs.py --before work/retention-new-before --after work/retention-new-after --output work/retention-new-comparison.json
```

The helper is a hardware integration operation: it briefly changes laptop Wi-Fi, opens/closes manual setup and archives local data. It rejects an existing output directory, verifies hardware identity and complete log count, and restores the original network/profile during cleanup. A failed or partially restored capture is not acceptance evidence. Capture files contain sensor data and identifiers, not configuration secrets; review before publishing. Do not repeatedly reopen setup for ordinary logging—these sessions are solely to obtain the local retention evidence.

## Completed comparison and retained failure

The operator confirmed **“Node 4 retention power-cycle done.”** The first post-cycle attempt stopped before export because its zero-pending checkpoint was not reached. [Incomplete evidence](calibration/node4-retention-after-incomplete-2026-11-26.json) is retained and excluded. No records/settings were deleted or changed; laptop Wi-Fi was restored.

Zero pending establishes the baseline's acknowledged state, but is unnecessary for reading a post-cycle queue. The new `--post-cycle-baseline` option requires existing complete same-node baseline metadata with zero pending and permits post-cycle data capture without waiting for queue drainage. Baseline eligibility, tracked IDs and hash criteria are unchanged. A new output directory was used. The successful retry actually recorded zero pending before export and one afterward; neither count is hidden.

The baseline export at **22:37:31 IST** was 107,824 bytes; the post-cycle export at **22:47:42 IST** was 108,287 bytes, approximately **610.357 seconds** later. [Original baseline](retention/node4-before-2026-11-26.ndjson), [post-cycle bytes](retention/node4-after-2026-11-26.ndjson), [post-cycle metadata](calibration/node4-retention-after-2026-11-26.json) and [exact comparison](calibration/node4-retention-comparison-2026-11-26.json) preserve full export/per-record hashes and exact missing/added ID lists. Raw NDJSON is exempt from Git newline conversion.

| Check | Result |
| --- | --- |
| Before / after count | 256 / 256 |
| Original thirty tracked IDs | All present, all payload hashes identical |
| Additional recent record appended between list and full export | Present, hash identical |
| Common records | 199; every payload hash identical |
| Missing protected IDs / changed common payloads | 0 / 0 |
| Older baseline IDs outside protected set absent afterward | 57, explicitly listed |
| New post-baseline IDs | 57 |
| Firmware / saved calibration | Unchanged |

The comparator additionally protects baseline records on each recent boot with uptime at/after the oldest selected record, so records appended between `/logs` and `/log` are not overlooked. This test was not near uptime wrap; the ordering assumption is explicit. Older omissions outside the protected set are consistent with acknowledged-record rotation. They do not negate the exact survival of the tracked set, nor establish permanent retention of all 256 baseline records.

Latest baseline records had boot `d019d565edf9d1d1ede4f18f1c11aa66`; post-cycle recent records had boot `e2f73147203cf881d1891fe378397a14`. Serial metadata at **22:47:00 IST** showed production `d05bb40`, unchanged calibration and normal operation before the archival portal session. [Final fleet checkpoint](calibration/node4-retention-final-fleet-2026-11-26.json) showed all four running/healthy/synchronized with expected firmware/revisions and pending counts **0/0/1/0**. Setup sessions were solely for archival capture, not recovery intervention.

Four offline fault-injection tests passed: normal rotation; changed payload despite internally consistent capture hashes; missing protected record despite an unchanged total count; and corrupted export bytes. Run `python scripts/test-compare-local-logs.py`. These tests demonstrate why matching counts alone is insufficient.

This completes selected-record retention for Node 4 only. Pending-record survival during interrupted writes, exact comparisons on other nodes, longer-term capacity/retention guarantees, measured brownout, intentional rollback and endurance remain separate work. A pending-queue/network-outage test needs its own baseline and procedure.

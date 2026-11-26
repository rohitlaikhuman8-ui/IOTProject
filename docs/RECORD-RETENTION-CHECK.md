# Exact local record comparison — November 26, 2026

## Scope and current status

Node 4 (`esp32-3013a5f4e9d4`, verified COM7) is being tested on production release `d05bb40` after the fallback-portal fix. The existing 256-valid-record integrity scans establish readable storage, not that particular records and their contents survived. This check archives actual local payloads and compares event IDs and exact per-line SHA-256 hashes across a normal power-cycle.

**Baseline captured; physical power-cycle and comparison pending.** No interruption during a flash/filesystem write, brownout or failed-image rollback has been performed in this phase. No firmware or saved settings are changed by this capture.

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
python scripts/capture-local-log.py --port COM7 --node esp32-3013a5f4e9d4 --output work/retention-new-after
```

The helper is a hardware integration operation: it briefly changes laptop Wi-Fi, opens/closes manual setup and archives local data. It rejects an existing output directory, verifies hardware identity and complete log count, and restores the original network/profile during cleanup. A failed or partially restored capture is not acceptance evidence. Capture files contain sensor data and identifiers, not configuration secrets; review before publishing. Do not repeatedly reopen setup for ordinary logging—these sessions are solely to obtain the local retention evidence.

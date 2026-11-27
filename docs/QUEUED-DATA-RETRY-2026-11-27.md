# Short queued-data retry — November 27, 2026

## Preflight completed; isolation not yet started

The [previous diagnostic attempt](QUEUED-DATA-RECOVERY.md) remains inconclusive and is not overwritten. No node should be blocked until the local access path and capture steps are ready. This retry excludes power/cable/button changes; it tests network-only buffering and later delivery of a fixed local record set.

At approximately **10:31 IST**, read-only USB status identified the current ports: Node 1 `esp32-d01de2f4e9d4` on **COM9**, Node 2 `esp32-7839a3f4e9d4` on **COM5**, Node 3 `esp32-986aa3f4e9d4` on **COM8**, and Node 4 `esp32-3013a5f4e9d4` on **COM6**. All reported firmware `d05bb40`, saved calibrations, healthy sensor/storage, Wi-Fi connected, setup inactive, zero pending and no OTA boot awaiting verification. These are fresh identity checks; yesterday's port map is historical.

Node 4's setup AP was then opened while its internet still worked. An actual full 256-record HTTP export and hardware identity check succeeded; its temporary laptop profile was removed and the laptop returned to Sensor Testing. [Preflight metadata](calibration/node4-queue-retry-preflight-2026-11-27.json) preserves status, complete body length/hash and per-record hashes. The AP was deliberately left manually open using the new explicit `--keep-portal-open` option; the helper still closes its session by default and rejects taking over an existing setup session. The setup credential was refreshed privately for the AP-only follow-up capture, not printed or published. Firmware/settings/calibration were not changed.

Node 4's pre-retry cloud boot is **`9057c927c8ad28fec57364286a49d892`**. Other preflight boots and revisions are retained separately. A stale setup session from the prior day is not reused as proof of current access. The manual portal has the normal fifteen-minute lifetime; if readiness expires or the retry is delayed, recheck access before isolation.

## Fixed retry procedure and acceptance

1. The operator pauses only Node 4 in the hotspot and confirms. Record a fresh observation boundary after that confirmation. Keep the laptop/other nodes connected, every node powered and sensor wires untouched. Do not press BOOT/EN/RESET or move power cables.
2. Observe roughly 100 seconds, keeping the test near two minutes overall. Verify Node 4's cloud reports actually stop while peers stay fresh. If reports continue, local access fails or power changes, stop the controlled attempt and restore connectivity promptly.
3. Use the already-open AP and private saved credential to read Node 4's HTTP identity/status and full local log without depending on USB reads during isolation. Require a nonfresh cloud status and a pending count from 3 to 64, then choose up to ten fresh periodic records captured after the fixed boundary, with at least six qualifying records on expected firmware/calibration. Preserve their complete payloads and hashes.
4. While the device remains paused, query Atlas for **all those selected event IDs**. Require none stored; do not drop IDs already present or change the sample set to force a pass. Save the immutable local selection and absence result before asking for restoration.
5. Ask the operator to unpause Node 4 only. Verify every selected ID arrives once with the original payload fields, using server receipt times separately from device capture times. Observe queue drainage and unchanged target/peer boots, firmware, calibrations and sensor/storage/time health. A reset invalidates a no-reset isolation result.
6. Close only the test's manual portal after recovery, retain failures and update docs. No deliberate flash/write interruption or failed-image firmware is part of this phase. This is a bounded selected-queue delivery test, not an indefinite capacity or zero-loss guarantee.

**Current result: preflight only.** The actual pause, local queued-record selection, Atlas absence and post-restoration delivery checks are pending operator action.

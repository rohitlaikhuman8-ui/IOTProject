# Project tools

## Documentation screenshots

`scripts/capture-docs.cjs` captures the deployed sign-in, topology and dashboard, plus the actual portal HTML rendered with nonsecret example settings. It reads the operator password from ignored local configuration and never writes it into screenshots.

See [screenshot instructions](images/README.md) for installation and authorized access.

## Serial checks

`scripts/serial-check.py` uses pyserial at 115200 baud. It supports `--port`, `--reset`, `--samples`, `--wait`, `--command`, and `--config`. Close other programs using the port first.

```powershell
.\.venv\Scripts\python.exe scripts/serial-check.py --port COM5 --command status --wait 20
```

An explicit `--reset` toggles the reset line. USB serial drivers or board reset circuits may also react to port opening. Use a single persistent Serial Monitor session when observing long-running behavior.

The firmware also accepts `storage-check` for a read-only JSON/latency/heap check of retained records, and `portal-close` to finish maintenance without clearing configuration or rebooting. Type these commands in Serial Monitor with newline endings.

An explicit `--command` runs only that command, with no automatic sample afterward. Without `--command`, the helper retains its commissioning sequence of status, sensor readings, one manual sample, and final status.

Private JSON provisioning enters setup mode, paces long UART writes and requires a save acknowledgment. Use the portal for routine settings changes.

For measured sensor corrections, `--calibration <coefficient-file> --revision <revision>` checks the connected Node ID before writing and verifies coefficient readback after reboot, without opening setup or replacing network configuration. `--command calibration` reads the active record, and `--command sensor-raw` bypasses correction. See [calibration procedures](CALIBRATION.md) before using any other node's coefficient file.

`scripts/test-calibration-portal.cjs` tests the portal form's client contract offline using Playwright fixture responses. Run with the same Playwright setup as screenshot capture: `node scripts/test-calibration-portal.cjs`. It does not connect to a real ESP32 AP or establish hardware accuracy.

`scripts/capture-raw-reference.py` reads a stationary ADXL345 fitting reference through the USB `sensor-raw` command, bypassing any active correction without changing it. It checks the full Node ID and firmware/calibration state, settles for ten seconds, records about one raw sample per second for 120 seconds, and keeps interrupted captures as evidence. Output uses host UTC/monotonic receipt timing, not fabricated device/server telemetry timestamps. Existing evidence files are not intentionally overwritten. Review support, movement, missing responses and boot consistency before using a capture for fitting.

```powershell
.\.venv\Scripts\python.exe scripts/capture-raw-reference.py --port COM5 `
  --node esp32-7839a3f4e9d4 --pose component-up-usb-stable-z-reference `
  --output docs/calibration/node2-z-up-usb-2026-11-26.json
```

The default requires at least 100 raw measurements spanning 100 seconds before marking a raw reference recorded. This records fitting data, not a calibration pass. Use a new output filename for every repeat. A normal calibration revision remains active for telemetry during raw reference acquisition; do not mistake its cloud axes for the USB raw measurements.

The sampler aborts and preserves an incomplete capture on a raw-response timeout or observed reboot. It compares identity, firmware and calibration state before/after acquisition and saves evidence with exclusive file creation. For a critical fit, also compare the cloud boot ID before/after when available; a serial status response does not expose that boot ID. The USB raw diagnostic prints four decimal places, finer than the sensor's quantization, and is distinct from full-precision cloud JSON.

## Arduino IDE export

`scripts/export-arduino.ps1` copies the same firmware source into an ignored sketch directory.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/export-arduino.ps1
```

Use Espressif core 2.0.17, ArduinoJson 7.3.1, ESP32 Dev Module, and the correct serial port. See [the COM5 record](NODE-COM5.md).

## Firmware and dashboard directories

`firmware/platformio.ini` pins the board, framework, filesystem and ArduinoJson. `firmware/src/main.cpp` contains setup, acquisition, storage, LED, network tasks and OTA. `firmware/data/` is the initial filesystem directory.

`dashboard/` is the Next.js root. `app/page.tsx` handles sign-in and renders the live client. `app/topology.tsx` polls the authenticated status API and renders topology, node status, notifications and telemetry. `lib/fleet.ts` holds schemas and MongoDB access. `lib/time.ts` formats IST.

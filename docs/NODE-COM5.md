# Commissioning record for COM5

This record covers the November 18 commissioning and November 23 return of `esp32-d01de2f4e9d4`. Earlier on November 23, COM5 held a different board, `esp32-7839a3f4e9d4`; later the operator swapped it back to this board. A COM port is not a device identity. See [the other board record](NODE-7839A3.md).

## November 23 return and upgrade

The board returned on COM5 running `usb-dev-ist-motion`, already connected to Sensor Testing and sending HTTP 200 with 256 local records and 98 pending. Its existing registration and individual API secret were retained. It was not registered as a third node.

Before writing, the partition/NVS/boot-selection area from `0x8000` for `0x8000` bytes was backed up privately. The partition table confirmed two 1,310,720-byte application slots and the existing filesystem at `0x290000`. The verified public release `408a075bcb8b8eb4366a380ffc283637349bcc57` is 1,224,352 bytes with SHA-256 `98ac1d523cb4ef7c1d1bd43e0d99c17891815059c50a3254bea62eaced0bb6e1`.

USB bootstrap wrote only the application at `0x10000` and the standard app0 boot-selection data at `0xe000`; NVS, bootloader, partition table and LittleFS were not erased or rewritten. The first attempt stopped near 95% with “chip stopped responding.” A retry at 115200 baud completed and verified hashes without requiring BOOT.

At 21:17:07 IST all 256 legacy records had migrated into the eight-directory layout without formatting. The device resumed authenticated telemetry/heartbeat reporting. It acknowledged permanent configuration at 21:18:06 and rebooted, retaining Sensor Testing and its original individual secret. Its OTA manifest is now `https://esp32-fleet-iot-project3.vercel.app/v1/firmware`; its setup SSID is `ESP32-Setup-d01de2f4e9d4`, using the saved private AP password.

A read-only check at 21:19:05 validated all 256 retained records with zero invalid records in 29,355 ms. At 21:21:07 an automatic OTA check fetched the Vercel manifest and confirmed advertised/running versions were both `408a075`, without another image installation. The operator's subsequent tilt produced fresh local movement records. Cloud acceptance and backlog state are recorded in [verification](VERIFICATION.md). Older queued samples retain their original captured timestamps; server-received times identify later backfill uploads.

The physical tilt was verified end to end: Atlas contained five matching movement events captured between 21:23:44 and 21:24:02 IST, with corresponding notifications received between 21:24:05 and 21:24:14. For example, event `c648afa86be2443b56ef8b7471c6384b` was captured at 21:23:48 and received at 21:24:10, with movement delta 17.9351 m/s². The authenticated dashboard API returned those notifications, current sensor readings and release `408a075`. Its 21:39 snapshot showed 111 pending records; these decreased to nine at 21:44 and zero by 21:45:30 IST. Atlas confirmed online reporting, healthy sensor/storage, synchronized time and 256 retained records at the final checkpoint. Intermittent transport timeouts had retried while committed data stayed local. The other board was unplugged and retained Last-seen history.

## Hardware identity and wiring

| Item | Observed or configured value |
| --- | --- |
| Node ID | `esp32-d01de2f4e9d4` |
| USB port | COM5 |
| ESP32 chip | ESP32-D0WD-V3 revision 3.1 |
| Factory station MAC | `d4:e9:f4:e2:1d:d0` |
| Sensor | ADXL345 |
| Sensor address | `0x53` |
| Device identity register | `0xE5` |
| SDA | GPIO 21 |
| SCL | GPIO 22 |
| VCC | 3V3 |
| Ground | GND |
| Capacitive provisioning input | GPIO 4 (T0), separate pad |
| I²C bus clock | 100 kHz |
| ADXL345 mode | Full resolution, ±16 g, 100 Hz output data rate |
| Test SSID | `Sensor Testing` |
| Sample interval | 10 seconds for commissioning |
| Heartbeat interval | Five seconds, independent task |
| Sensitivity | 1 |
| Touch threshold | 30, calibrate for the attached pad |

The Node ID is the hardware efuse MAC formatted as a 64-bit hexadecimal value. Its byte order differs from the usual colon-separated station MAC. Copy the Node ID exactly.

## Upload from the command line

From the repository root with Python 3.12 installed:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install platformio==6.1.18
.\.venv\Scripts\python.exe -m platformio run -d firmware -t upload --upload-port COM5
```

The first installation also initialized LittleFS because the board had no mountable log filesystem:

```powershell
.\.venv\Scripts\python.exe -m platformio run -d firmware -t uploadfs --upload-port COM5
```

Do not repeat filesystem upload during routine updates. It replaces locally retained records.

The upload verified flash hashes and reset the board automatically. BOOT was not required for the observed uploads. If a future upload stalls at Connecting, hold BOOT until writing starts, then release it.

## Arduino IDE 2.3.10

The hardware is compatible with Arduino IDE. This repository's tested dependency stack uses Espressif Arduino core 2.0.17. Export the same source into a sketch:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/export-arduino.ps1
```

1. Open `.build/arduino/FleetNode/FleetNode.ino`.
2. In Boards Manager, select `esp32 by Espressif Systems`, version 2.0.17.
3. In Library Manager, install ArduinoJson 7.3.1.
4. Select ESP32 Dev Module and port COM5.
5. Keep the standard 4 MB partition layout with two OTA app slots and the filesystem partition.
6. Click Verify, then Upload. Close Serial Monitor during command-line uploads.
7. Open Serial Monitor at 115200 baud with newline endings.

The actual observed build and uploads used PlatformIO's pinned Arduino framework. The exported IDE sketch has the same C++ source, but its IDE build still requires checking the installed board package and settings.

## Configuration and diagnostics

SSID and Wi-Fi password are editable in every node's captive portal. Hold GPIO 4 for four seconds, use the saved per-node AP password, and open `http://192.168.4.1/`. Setup retains station Wi-Fi, shows logs and supports AP-password changes. See the [complete manual](OPERATING_MANUAL.md).

The commissioning credentials were supplied privately and persisted in NVS. Wi-Fi passwords, the individual API secret, and the discovery group key are excluded from Git.

The backend origin is `https://esp32-fleet-iot-project3.vercel.app`, with telemetry at `/v1/telemetry` and heartbeat at `/v1/heartbeat`.

Serial diagnostics:

| Command | Effect |
| --- | --- |
| `status` | Node ID, version, Wi-Fi, RSSI, address, storage, and local count |
| `sensor` | Read X/Y/Z and magnitude in m/s² |
| `sample` | Commit one real sensor sample to the local log |
| `portal` | Start the setup AP |

The private `configure {JSON}` command is intended for USB commissioning. It validates and persists configuration, then restarts. Keep the JSON in an ignored private file and use:

```powershell
.\.venv\Scripts\python.exe scripts/serial-check.py --port COM5 --config work/node-config.json --wait 20
```

The script masks temporary AP passwords in its output. To test reboot persistence:

The USB helper enters setup mode before transmitting private settings, paces long commands, and requires a persistence acknowledgment. The firmware uses a 4 KiB UART receive buffer so settings can arrive while local log writes are active.

```powershell
.\.venv\Scripts\python.exe scripts/serial-check.py --port COM5 --reset --wait 20 --samples 5
```

## Measurement meaning

X/Y/Z are physical acceleration estimates in m/s², including gravity, using the ADXL345 nominal 3.9 mg/LSB scale. The main value is `sqrt(x² + y² + z²) × sensitivity`.

The first stationary observations were around 8.2–8.4 m/s². A calibrated stationary accelerometer should be near local gravity, about 9.81 m/s². The initial reading therefore needs a proper six-orientation calibration and reference check before quantitative deployment. Motion changes the measured magnitude.

Sensitivity scales only the summary magnitude. It is not a per-axis calibration. No calibration constants were fabricated from one board orientation.

## Observed cloud verification

The registered node connected to Sensor Testing, sent successful 200 heartbeats, and appeared in the live graph with a direct Vercel uplink. The Atlas-backed view preserved its X/Y/Z readings. Replaying a recorded event returned 200 without increasing the event count. An unsigned topology request returned 401.

At the original November 18 checkpoint, only this physical ESP32 had been tested. By November 23, both registered boards had been tested individually. Simultaneous multi-node neighbor discovery still needs additional powered boards on the same radio channel. The current system provides independent uplinks and authenticated neighbor sightings. Multi-hop data forwarding is outside the implemented behavior.

## Historical OTA installed on this board

The physical node successfully downloaded, verified, and booted GitHub release `7f9ae6336ce4fc26ab20ef4d680910cf4e18ab63`. The image size was 1,150,416 bytes. Following reboot, serial identified the same Node ID and ADXL345, sampling resumed, and Vercel acknowledged the heartbeat with 200.

Earlier bench tests exposed and corrected TLS stack usage and long GitHub redirect handling. The current build uses a 16 KiB loop stack, heap-backed OTA buffers, and verified HTTPS redirects up to 4096 characters. Settings and local history remained available across the update.

The final status check showed `pendingVerification: false`, healthy storage and sensor, the configured SSID, 133 local records, 9,692 bytes minimum free stack, and approximately 219 KiB free heap. No BOOT-button intervention was required.

## November 25 calibration checkpoint

This board returned on COM5 and its live Node ID was checked before any write. Six reference positions and a fresh supported-level offline validation produced the coefficients documented in [the calibration record](CALIBRATION.md). Revision `n1-20261125-v1` was installed on calibration-capable bench firmware, read back after two reboots and confirmed in Atlas events. The separate NVS calibration record leaves saved network configuration and LittleFS intact; 256 retained records remained indexed. This checkpoint does not claim that Nodes 2–4 have been calibrated. Final published firmware and on-device orientation checks are tracked in the calibration record.

The board then received checksum-verified published release `795d041b2daf1b4d9e1448890c7ef16c3de0c8f7` over USB and restored its saved correction. Twelve device-corrected samples in a new level window passed the bench screen, mean magnitude 9.882263 m/s² (+0.771038%). The normal OTA check advertised the same release. Post-calibration movement/threshold and remaining fault/endurance tests are still separate work.

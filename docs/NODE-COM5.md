# Commissioning record for COM5

This is the November 18 historical record for `esp32-d01de2f4e9d4`. On November 23, COM5 was connected to a different board, `esp32-7839a3f4e9d4`. A COM port is not a device identity. See [the newer commissioning record](NODE-7839A3.md).

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

Only one physical ESP32 has been connected for these checks. Multi-node neighbor discovery still needs additional boards on the same radio channel. The current system provides independent uplinks and authenticated neighbor sightings. Multi-hop data forwarding is outside the implemented behavior.

## OTA installed on this board

The physical node successfully downloaded, verified, and booted GitHub release `7f9ae6336ce4fc26ab20ef4d680910cf4e18ab63`. The image size was 1,150,416 bytes. Following reboot, serial identified the same Node ID and ADXL345, sampling resumed, and Vercel acknowledged the heartbeat with 200.

Earlier bench tests exposed and corrected TLS stack usage and long GitHub redirect handling. The current build uses a 16 KiB loop stack, heap-backed OTA buffers, and verified HTTPS redirects up to 4096 characters. Settings and local history remained available across the update.

The final status check showed `pendingVerification: false`, healthy storage and sensor, the configured SSID, 133 local records, 9,692 bytes minimum free stack, and approximately 219 KiB free heap. No BOOT-button intervention was required.

# Commissioning record for COM5

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
| Heartbeat interval | 15 seconds |
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

SSID and Wi-Fi password are editable in the captive portal on every node. Hold the GPIO 4 pad for four seconds, read the temporary AP password on USB serial, join the setup AP, and open `http://192.168.4.1/`.

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

```powershell
.\.venv\Scripts\python.exe scripts/serial-check.py --port COM5 --reset --wait 20 --samples 5
```

## Measurement meaning

X/Y/Z are physical acceleration estimates in m/s², including gravity, using the ADXL345 nominal 3.9 mg/LSB scale. The main value is `sqrt(x² + y² + z²) × sensitivity`.

The first stationary observations were around 8.2–8.4 m/s². A calibrated stationary accelerometer should be near local gravity, about 9.81 m/s². The initial reading therefore needs a proper six-orientation calibration and reference check before quantitative deployment. Motion changes the measured magnitude.

Sensitivity scales only the summary magnitude. It is not a per-axis calibration. No calibration constants were fabricated from one board orientation.

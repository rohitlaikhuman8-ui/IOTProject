# Hardware and first flash

## Equipment

- Classic ESP32 DevKit with 4 MB flash and USB serial.
- Data-capable USB cable and stable power supply.
- Capacitive pad connected to GPIO 4 (T0).
- Git, Python 3.12, PlatformIO, and a 2.4 GHz Wi-Fi network.

Some DevKits expose the touch-capable pin without including a physical pad. Connect a short wire and conductive pad if needed. Consult the exact board pinout. Avoid applying external voltage to the pad. The board's mechanical BOOT button has a separate function.

## Install and build

From PowerShell:

```powershell
git clone https://github.com/rohitlaikhuman8-ui/IOTProject.git
Set-Location IOTProject
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install platformio==6.1.18
.\.venv\Scripts\python.exe -m platformio run -d firmware
.\.venv\Scripts\python.exe -m platformio device list
```

PlatformIO downloads the pinned Espressif platform, compiler, Arduino framework, and ArduinoJson on the first build. VS Code with the PlatformIO extension can also open the `firmware/` directory.

## Flash a new node

Select the USB serial port that appears when the ESP32 is connected. Replace COM5 below. Close any terminal already holding the port.

```powershell
.\.venv\Scripts\python.exe -m platformio run -d firmware -t upload --upload-port COM5
.\.venv\Scripts\python.exe -m platformio run -d firmware -t uploadfs --upload-port COM5
.\.venv\Scripts\python.exe -m platformio device monitor --port COM5 --baud 115200
```

The upload target flashes the board-specific bootloader, partition table, and application. The filesystem upload initializes LittleFS from `firmware/data/`. Repeating that step replaces retained logs.

If the bootloader waits for a connection, hold BOOT while starting upload and release it once writing begins. Some boards also need EN/RESET pressed while BOOT is held.

An illustrative serial transcript follows. These values are placeholders.

```text
Node esp32-012345abcdef, firmware usb-dev, reset 1
Setup Wi-Fi ESP32-Setup-012345abcdef password <saved-private-password>, open http://192.168.4.1
```

The AP password changes each time setup mode starts. The Node ID remains stable. If `LittleFS unavailable` appears before initial filesystem provisioning, finish the filesystem upload and reset.

## Touch calibration

1. Start with threshold 30.
2. Keep the pad released and watch for unwanted setup activation.
3. Hold the pad for four seconds and confirm setup opens.
4. If needed, print `touchRead(TouchPin)` temporarily in a development build to measure both states.
5. Choose a threshold between touched and released readings. The firmware treats readings **below** the threshold as touched.
6. Save the threshold in the portal and repeat the checks.

Sensitivity multiplies the telemetry value. The touch threshold independently controls setup activation. Pad size, wire length, moisture, and board layout affect readings.

## Sensor integration

The configured ADXL345 uses SDA GPIO 21, SCL GPIO 22, 3V3 and GND. The driver probes 0x53 and 0x1D, checks DEVID 0xE5, and reads six consecutive axis-data bytes. Its summary measurement comes from:

```cpp
event["value"] = sqrtf(x * x + y * y + z * z) * sensitivity;
```

The API preserves `acceleration.x/y/z`, sensor `ADXL345`, and unit `m/s2`. See the [connected node record](NODE-COM5.md) for the observed device and calibration notes. If the breakout exposes CS, it must be high for I²C mode. SDO determines whether the sensor uses 0x53 or 0x1D. GPIO 4 remains available for provisioning.

Calibration-capable firmware applies the node's measured per-axis bias/scale before the magnitude formula above. `sensor-raw` remains available for uncorrected acquisition diagnostics. Keep the sensor PCB level when collecting a gravity reference; headers, components or taut wires can tilt it even if the ESP32 itself lies flat. See [calibration procedures](CALIBRATION.md).

Record each node's ID, board model, firmware SHA, sensor type, location, sample interval, touch threshold, and commissioning date in a private inventory. Keep its API secret in a password manager.

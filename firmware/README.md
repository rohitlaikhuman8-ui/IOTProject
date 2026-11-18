# ESP32 firmware

Open this directory in PlatformIO, or run `python -m platformio run -d firmware` from the repository root.

| Path | Purpose |
| --- | --- |
| `platformio.ini` | Classic ESP32 platform, board, framework, filesystem, ArduinoJson |
| `src/main.cpp` | Firmware entry points and implementation |
| `data/README.txt` | Seed file for the initial LittleFS image |

The initial USB installation requires both application and filesystem uploads. Routine firmware updates preserve settings and logs.

Read [hardware and first flash](../docs/HARDWARE.md), [firmware and OTA](../docs/FIRMWARE.md), and [operations](../docs/OPERATIONS.md) before deployment. The telemetry expression is currently a demonstration touch measurement.

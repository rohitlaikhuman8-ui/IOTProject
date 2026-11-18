# IOTProject — ESP32 fleet telemetry

An ESP32 connects to Wi-Fi, records telemetry locally, uploads it over HTTPS, and receives firmware releases through OTA. A Next.js application on Vercel authenticates each node, writes samples to MongoDB Atlas, and provides a password-protected dashboard.

The hardware target is a **classic ESP32 DevKit with 4 MB flash** and an ADXL345 connected over I²C. X/Y/Z acceleration is reported in m/s², and the summary value is acceleration magnitude multiplied by sensitivity. GPIO 4 remains the capacitive setup input.

## Connected node and wiring

| Item | Value |
| --- | --- |
| Commissioned Node ID | `esp32-d01de2f4e9d4` |
| USB port | COM5 |
| Chip | ESP32-D0WD-V3 revision 3.1 |
| ADXL345 SDA | GPIO 21 |
| ADXL345 SCL | GPIO 22 |
| ADXL345 VCC | 3V3 |
| ADXL345 GND | GND |
| Detected I²C address and identity | `0x53`, DEVID `0xE5` |
| Test Wi-Fi SSID | `Sensor Testing` |
| Commissioning sample interval | 10 seconds |
| Sensor mode | Full-resolution ±16 g, 100 Hz ODR |

See the [COM5 commissioning procedure](docs/NODE-COM5.md) for exact USB upload commands, Arduino IDE export, settings, diagnostics, and observed sensor-calibration limits. Passwords and node secrets remain private. Each ESP32's SSID and password can be changed in its captive portal.

The live dashboard shows each node's direct cloud uplink and authenticated ESP-NOW neighbor sightings. Every node independently uploads through its configured Wi-Fi network. A dedicated task reports every five seconds while upload and OTA work run separately. The graph refreshes every three seconds and shows Online or Last seen in IST from accepted server reports. See [topology](docs/TOPOLOGY.md).

| Resource | Address |
| --- | --- |
| Dashboard | https://esp32-fleet-iot-project3.vercel.app/ |
| Ingest API | `POST https://esp32-fleet-iot-project3.vercel.app/v1/telemetry` |
| Repository | https://github.com/rohitlaikhuman8-ui/IOTProject |
| OTA manifest | https://github.com/rohitlaikhuman8-ui/IOTProject/releases/download/firmware-latest/manifest.json |
| Local setup panel | `http://192.168.4.1/` while connected to the device's setup AP |

## Guides

| Guide | Contents |
| --- | --- |
| [Complete operating manual](docs/OPERATING_MANUAL.md) | Adding/removing nodes, changing every setting, credentials, recovery, troubleshooting, safety and maintenance |
| [Hardware and first flash](docs/HARDWARE.md) | Board, wiring, tool installation, USB flashing, touch calibration |
| [COM5 node record](docs/NODE-COM5.md) | Actual chip, Node ID, ADXL345 wiring, upload, private provisioning |
| [Live topology](docs/TOPOLOGY.md) | Independent cloud uplinks, heartbeats, authenticated radio neighbors |
| [Deployment](docs/DEPLOYMENT.md) | Atlas, Vercel, environment variables, local development |
| [Operating procedures](docs/OPERATIONS.md) | Commissioning, provisioning, dashboard, exports, credential rotation |
| [Firmware and OTA](docs/FIRMWARE.md) | Scheduling, persistence, watchdog, brownout, releases, rollback |
| [API reference](docs/API.md) | Authentication, payloads, errors, PowerShell upload |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Portal, Wi-Fi, uploads, storage, deployment, OTA |
| [Architecture and limits](docs/ARCHITECTURE.md) | Data flow, security boundaries, retention, implementation limits |
| [Verification record](docs/VERIFICATION.md) | Recorded checks and outstanding bench checks |
| [Project tools](docs/TOOLS.md) | Serial helper, Arduino export, screenshot capture and source layout |
| [Screenshots](docs/images/README.md) | Image sources and regeneration commands |

## Architecture

```mermaid
flowchart LR
  Pad[GPIO 4 touch pad] --> ESP[ESP32]
  ESP --> NVS[NVS settings]
  ESP --> FS[LittleFS history and queue]
  ESP -->|HTTPS and node secret| API[Vercel ingest function]
  API --> Atlas[MongoDB Atlas]
  Browser[Operator browser] -->|Password| Dashboard[Vercel dashboard]
  Dashboard -->|Server-side query| Atlas
  ESP -->|HTTPS polling| Releases[GitHub Releases]
  Main[Commit to main] --> Actions[GitHub Actions]
  Actions --> Releases
```

The dashboard and ingest API share the `dashboard/` Next.js application. This deployment uses Vercel Functions for ingestion. Each device holds an individual API secret, and MongoDB credentials stay in server environment variables.

## Quick start

Commands use PowerShell from the repository root unless a command changes directories. Install Git, Python 3.12, and Node.js 22 with npm.

```powershell
git clone https://github.com/rohitlaikhuman8-ui/IOTProject.git
Set-Location IOTProject
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install platformio==6.1.18
.\.venv\Scripts\python.exe -m platformio run -d firmware
.\.venv\Scripts\python.exe -m platformio device list
```

Select the actual ESP32 serial port. On a **new device**, flash the application and initialize the filesystem.

```powershell
.\.venv\Scripts\python.exe -m platformio run -d firmware -t upload --upload-port COM5
.\.venv\Scripts\python.exe -m platformio run -d firmware -t uploadfs --upload-port COM5
.\.venv\Scripts\python.exe -m platformio device monitor --port COM5 --baud 115200
```

The `uploadfs` target replaces the filesystem and clears existing local logs. Use it for initial installation or intentional filesystem recovery after exporting logs. Routine updates use the application upload or OTA.

1. Record the `esp32-<12 lowercase hex characters>` Node ID printed on serial.
2. Generate a unique node secret and add it under that ID in Vercel's `NODE_SECRETS_JSON`. Redeploy the application to apply the change.
3. Join the device setup Wi-Fi using its saved private AP password, printed on serial when setup opens.
4. Visit `http://192.168.4.1/`, enter Wi-Fi credentials and the settings below, and save.
5. Reconnect your computer to its normal network and sign in to the dashboard.

| Portal setting | Initial value |
| --- | --- |
| Backend base URL | `https://esp32-fleet-iot-project3.vercel.app` |
| Ingest endpoint | `/v1/telemetry` |
| Node API secret | The secret registered for this Node ID |
| OTA manifest URL | `https://github.com/rohitlaikhuman8-ui/IOTProject/releases/download/firmware-latest/manifest.json` |
| Sensitivity | `1` |
| Touch threshold | `30`, then calibrate for your board |
| Sample interval | `60` seconds |

Hold the GPIO 4 capacitive pad continuously for four seconds to reopen setup. The AP expires after 15 minutes. The hardware-derived Node ID appears as a read-only value.

## Normal startup, time and movement

After power-on, local logging starts automatically. Once the saved Wi-Fi network provides internet access, the node attempts cloud delivery and reports its connection. It synchronizes time on every boot using SNTP and the verified server's HTTP Date. Local time and dashboard displays use IST. Atlas retains server-generated UTC instants so timezone conversion is applied once.

The dashboard records startup, connection/resumption, report timeouts and movement notifications. Movement rows are highlighted and use authoritative server receipt time, with device capture time retained separately when available. The ADXL345 is polled about every 20 ms, with a configurable vector-change threshold and a two-second notification cooldown.

The GPIO 2 status LED shows solid for recent cloud contact, slow blink for Wi-Fi reconnection, a double flash for Wi-Fi without recent cloud contact, fast blink for setup, and triple flash for sensor/storage trouble.

## Captive portal procedure

1. Hold the GPIO 4 touch pad for four seconds, or send `portal` through USB Serial Monitor at 115200 baud with newline endings.
2. Join `ESP32-Setup-f4e9d4` for this node using its private saved AP password.
3. Open `http://192.168.4.1/` if the captive popup does not appear.
4. Change SSID, Wi-Fi password, setup AP password, endpoint, secrets, thresholds or sample interval as needed. Blank password/secret fields preserve the saved values as described in the manual.
5. Review current IST time, connection state, pending records and recent local logs. Download the retained NDJSON log before destructive recovery.
6. Save and wait for restart, then check Online and a fresh IST timestamp in the dashboard.

The node keeps its station connection active during setup when that network is available. If saved Wi-Fi remains unavailable after about 30 seconds, a recovery AP opens while reconnection attempts continue. The [complete manual](docs/OPERATING_MANUAL.md) covers password changes, forgotten credentials, node registration/removal and failure recovery.

## Screenshots

### Dashboard sign-in

The dashboard uses `DASHBOARD_PASSWORD` from Vercel's server environment. The existing operator has a Git-ignored local copy in `dashboard/.env.local`.

![Deployed dashboard sign-in](docs/images/dashboard-login.png)

### Fleet dashboard

Topology, health, notification history and the latest 100 telemetry events refresh automatically. Click a Node ID to filter history. All displayed timestamps use IST, and server receipt time is authoritative.

![Authenticated deployed dashboard](docs/images/dashboard-nodes.png)

![Live cloud uplink and physical sensor-node status](docs/images/dashboard-topology.png)

### Device setup panel

This reference screenshot renders the **actual firmware portal HTML using sample settings**. It was captured without a connected ESP32. Wi-Fi passwords and API secrets are omitted.

![Firmware setup panel rendered with sample settings](docs/images/provisioning-reference.png)

## Local dashboard

```powershell
Set-Location dashboard
Copy-Item .env.example .env.local
# Edit .env.local with development credentials.
npm install
npm run dev
```

Open `http://localhost:3000/`. Required server variables are `MONGODB_URI`, `MONGODB_DATABASE`, `NODE_SECRETS_JSON`, and `DASHBOARD_PASSWORD`. See [deployment](docs/DEPLOYMENT.md).

## Development and releases

The initial main-branch push is authorized for this handoff. For subsequent firmware changes, create a branch and open a pull request.

```powershell
git switch -c feature/sensor-driver
# Implement the sensor and build the firmware.
git add firmware
git commit -m "Add sensor measurement driver"
git push -u origin feature/sensor-driver
```

After merge to `main`, GitHub Actions publishes a commit-specific binary and switches the stable manifest. Nodes poll at startup and approximately every 15 minutes when connected. Offline nodes apply a release after reconnecting and completing a successful check. Detailed [OTA procedures](docs/FIRMWARE.md) include failure handling and rollback.

## Directory map

```text
IOTProject/
├── .github/workflows/
│   ├── firmware-ci.yml           # Compile firmware for pull requests
│   └── firmware-release.yml      # Publish fleet OTA on main
├── firmware/
│   ├── platformio.ini            # Pinned classic ESP32 build settings
│   ├── src/main.cpp              # Provisioning, sampling, storage, retry, OTA
│   └── data/.gitkeep              # Initial LittleFS directory
├── dashboard/
│   ├── app/page.tsx              # Dashboard and password sessions
│   ├── app/layout.tsx            # HTML layout
│   ├── app/v1/telemetry/route.ts  # Authenticated, deduplicated ingestion
│   ├── lib/fleet.ts              # Schema, MongoDB client, secret comparison
│   ├── .env.example              # Placeholder configuration
│   └── package.json              # Next.js application dependencies
├── docs/                         # Procedures and screenshots
├── scripts/capture-docs.cjs       # Reproduce documentation screenshots
└── README.md
```

## Persistence and limits

- NVS stores settings as one configuration record.
- LittleFS holds up to 256 committed samples, including pending and acknowledged records. At 60-second sampling, that covers roughly 4 hours 16 minutes. Pending records take priority over acknowledged history.
- An all-pending log skips new samples until acknowledged records can be reclaimed.
- Upload retries grow from five seconds to five minutes with jitter. A stable event ID lets Atlas deduplicate delivery retries.
- Brownout detection and a 45-second task watchdog provide reset recovery. Power loss can interrupt an uncommitted measurement. Bench validation remains necessary.
- Telemetry contains ADXL345 X/Y/Z, magnitude and movement events. Topology, current sensor data and notification history refresh automatically in IST.
- OTA verifies HTTPS, board type, length, and SHA-256. Independent image signing and Secure Boot need a separate manufacturing setup.

The ADXL345 firmware has been built and flashed on the connected COM5 board. Sensor identity, live reads, Wi-Fi, and persistent local storage were exercised. Calibration, multiple-node radio behavior, controlled power cuts, and failed-image rollback still need targeted bench checks. See the [verification record](docs/VERIFICATION.md).

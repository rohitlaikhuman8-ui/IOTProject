"""Read boot output and exercise node diagnostics without modifying settings."""
import argparse
import time
import serial
import json
import sys
from pathlib import Path
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

parser = argparse.ArgumentParser()
parser.add_argument("--port", default="COM5")
parser.add_argument("--reset", action="store_true")
parser.add_argument("--samples", type=int, default=5)
parser.add_argument("--config", help="Private JSON configuration file, never committed")
parser.add_argument("--calibration", help="Per-node coefficient JSON with nodeId and coefficients")
parser.add_argument("--revision", help="Calibration revision, 1-32 letters, digits, hyphens or underscores")
parser.add_argument("--wait", type=int, default=0)
parser.add_argument("--command", choices=["status", "sensor", "sensor-raw", "calibration", "sample", "portal", "portal-close", "storage-check", "ota-check"])
args = parser.parse_args()
if args.config and args.calibration:
    parser.error("Use either --config or --calibration, not both")
calibration_payload = None
if args.calibration:
    import math
    import re
    record = json.loads(Path(args.calibration).read_text(encoding="utf-8"))
    if not args.revision or not re.fullmatch(r"[A-Za-z0-9_-]{1,32}", args.revision) or args.revision == "none":
        parser.error("--calibration requires a valid --revision other than none")
    if not re.fullmatch(r"esp32-[a-f0-9]{12}", record.get("nodeId", "")):
        parser.error("Coefficient file must identify its hardware Node ID")
    calibration_payload = {"nodeId": record["nodeId"], "revision": args.revision,
                           "bias": [], "scale": []}
    for axis in "xyz":
        for key, low, high in [("bias", -5, 5), ("scale", .5, 1.5)]:
            value = record["coefficients"][axis][key]
            if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or not low <= value <= high:
                parser.error("Invalid calibration coefficient")
            calibration_payload[key].append(value)

def drain(port, seconds):
    deadline = time.monotonic() + seconds
    observed = []
    while time.monotonic() < deadline:
        line = port.readline().decode("utf-8", errors="replace").strip()
        if line:
            observed.append(line)
            # Keep temporary AP passwords out of captured diagnostic output.
            if "Setup Wi-Fi " in line and " password " in line:
                line = line.split(" password ")[0] + " password [available on local serial]"
            print(line, flush=True)
    return observed

connection = serial.Serial(port=None, baudrate=115200, timeout=0.2)
connection.port = args.port
connection.dtr = False
connection.rts = False
connection.open()
with connection as port:
    if args.reset:
        port.dtr = False
        port.rts = True
        time.sleep(0.1)
        port.rts = False
    drain(port, 4)
    if calibration_payload:
        port.write(b"\nstatus\n")
        states = []
        for line in drain(port, 4):
            try:
                state = json.loads(line)
                if "nodeId" in state:
                    states.append(state)
            except (ValueError, TypeError):
                pass
        if not states or states[-1]["nodeId"] != calibration_payload["nodeId"]:
            raise RuntimeError("Connected hardware does not match coefficient Node ID; nothing written")
        if "calibration" not in states[-1]:
            raise RuntimeError("Firmware lacks calibration support; nothing written")
        command = ("calibrate " + json.dumps(calibration_payload, separators=(",", ":")) + "\n").encode()
        for offset in range(0, len(command), 16):
            port.write(command[offset:offset + 16])
            time.sleep(.03)
        if not any("Calibration persisted; restarting" in line for line in drain(port, 7)):
            raise RuntimeError("Calibration save not acknowledged; inspect status before retrying")
        verified = False
        for attempt in range(8):
            port.write(b"status\n")
            for line in drain(port, 3):
                try:
                    state = json.loads(line)
                    saved = state.get("calibration", {})
                    if (state.get("nodeId") == calibration_payload["nodeId"] and saved.get("enabled") is True
                            and saved.get("revision") == calibration_payload["revision"]
                            and all(abs(saved[k][i] - calibration_payload[k][i]) < 1e-5 for k in ["bias", "scale"] for i in range(3))):
                        verified = True
                except (ValueError, TypeError, KeyError, IndexError):
                    pass
            if verified:
                break
        if not verified:
            raise RuntimeError("Calibration could not be verified after reboot")
        print("Calibration revision and coefficients verified after reboot", flush=True)
    if args.config:
        # Open setup before sending paced configuration. Older single-loop
        # firmware also paused its network work while setup was active.
        port.write(b"\nportal\n")
        portal_ready = False
        for attempt in range(12):
            port.write(b"status\n")
            for line in drain(port, 3):
                if line.startswith("Setup Wi-Fi ") or '"portalActive":true' in line:
                    portal_ready = True
            if portal_ready:
                break
        if not portal_ready:
            raise RuntimeError("Setup portal did not acknowledge USB provisioning")
        configuration = json.loads(Path(args.config).read_text())
        payload = ("configure " + json.dumps(configuration, separators=(",", ":")) + "\n").encode()
        for offset in range(0, len(payload), 16):
            port.write(payload[offset:offset + 16])
            time.sleep(0.05)
        reply = drain(port, 12)
        if not any("Configuration persisted; restarting" in line for line in reply):
            raise RuntimeError("Device did not acknowledge persistent configuration")
    if args.command:
        port.write((args.command + "\n").encode())
        drain(port, 2)
    if args.wait:
        drain(port, args.wait)
    if not args.command:
        for command in ["status"] + ["sensor"] * args.samples + ["sample", "status"]:
            port.write((command + "\n").encode())
            drain(port, 1.5)

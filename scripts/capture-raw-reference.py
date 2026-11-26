"""Read a stationary raw ADXL345 reference over USB; never write settings."""
import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import re
import time

import serial

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--port", default="COM5")
parser.add_argument("--node", required=True)
parser.add_argument("--pose", required=True)
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--seconds", type=float, default=120)
parser.add_argument("--interval", type=float, default=1)
args = parser.parse_args()
if not re.fullmatch(r"esp32-[a-f0-9]{12}", args.node):
    parser.error("--node must be a full hardware Node ID")
if not math.isfinite(args.seconds) or not 100 <= args.seconds <= 600:
    parser.error("--seconds must be between 100 and 600")
if not math.isfinite(args.interval) or not .1 <= args.interval <= 2:
    parser.error("--interval must be between 0.1 and 2 seconds")
if args.output.exists():
    parser.error("Output already exists; choose a new evidence file")

def utc():
    return datetime.now(timezone.utc).isoformat()

port = serial.Serial(port=None, baudrate=115200, timeout=.1)
port.port = args.port
port.dtr = False
port.rts = False
measurements = []
record = {"nodeId": args.node, "pose": args.pose, "source": "USB sensor-raw command",
          "unit": "m/s2", "timestampSource": "Host UTC for this USB capture, not device/server receipt time",
          "requestedSeconds": args.seconds, "requestedIntervalSeconds": args.interval,
          "guardPolicy": "Abort on raw-response timeout or observed reboot; compare identity/firmware/calibration before and after",
          "status": "INCOMPLETE", "measurements": measurements}
capturing = False
failures = 0
raw_pattern = re.compile(r"^ADXL345 x=(-?\d+(?:\.\d+)?) y=(-?\d+(?:\.\d+)?) z=(-?\d+(?:\.\d+)?) magnitude=")

def reply(command, predicate, timeout=4):
    port.write((command + "\n").encode())
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        line = port.readline().decode("utf-8", errors="replace").strip()
        if capturing and line.startswith("Node esp32-"):
            raise RuntimeError("Device restarted during reference collection")
        value = predicate(line)
        if value is not None:
            return value
    return None

def parse_status(line):
    try:
        value = json.loads(line)
        if isinstance(value, dict) and "nodeId" in value:
            return value
    except ValueError:
        pass
    return None

def checked_status(attempts=1):
    for attempt in range(attempts):
        value = reply("status", parse_status)
        record.setdefault("statusRequests", []).append({"phase": "capture-end" if capturing else "capture-start",
                                                        "attempt": attempt + 1, "receivedStatus": value is not None})
        if value is None:
            if attempt + 1 < attempts:
                print("No complete status reply yet; retrying identity read without changing settings.", flush=True)
            continue
        if value.get("nodeId") != args.node or "calibration" not in value:
            raise RuntimeError("Hardware identity/support mismatch; no settings written")
        return {key: value.get(key) for key in ["nodeId", "version", "calibration", "sensorAddress", "storageReady", "logRecords", "timeIst"]}
    raise RuntimeError("No matching calibration-capable hardware status; no settings written")

try:
    port.open()
    port.reset_input_buffer()
    first = checked_status(attempts=3)
    record["initialStatus"] = first
    print("Identity verified; settling for 10 seconds. Keep the reference pose fixed.", flush=True)
    # Drain boot/network messages without exposing passwords or filling stdout.
    settling = time.monotonic() + 10
    while time.monotonic() < settling:
        port.readline()
    capturing = True
    started = time.monotonic()
    record["startedAtUtc"] = utc()
    next_sample = started
    failures = 0
    while time.monotonic() - started < args.seconds:
        if time.monotonic() < next_sample:
            time.sleep(min(.1, next_sample - time.monotonic()))
            continue
        if time.monotonic() - started >= args.seconds:
            break
        value = reply("sensor-raw", lambda line: raw_pattern.match(line), timeout=2)
        if value is None:
            failures += 1
            raise RuntimeError("Raw sensor response timed out; reference remains incomplete")
        else:
            axes = [float(v) for v in value.groups()]
            if not all(math.isfinite(v) for v in axes):
                raise RuntimeError("Nonfinite sensor data")
            measurements.append({"sequence": len(measurements), "hostTimeUtc": utc(),
                                 "elapsedSeconds": time.monotonic() - started,
                                 "acceleration": dict(zip("xyz", axes))})
            if len(measurements) % 20 == 0:
                print(f"Raw samples: {len(measurements)}, elapsed {time.monotonic()-started:.1f}s", flush=True)
        next_sample += args.interval
        if next_sample < time.monotonic():
            next_sample = time.monotonic() + args.interval
    record["endedAtUtc"] = utc()
    record["missedReplies"] = failures
    final = checked_status()
    record["finalStatus"] = final
    if final["version"] != first["version"] or final["calibration"] != first["calibration"]:
        raise RuntimeError("Firmware or calibration changed during raw reference collection")
    if len(measurements) < 100 or measurements[-1]["elapsedSeconds"] - measurements[0]["elapsedSeconds"] < 100:
        raise RuntimeError("Insufficient raw samples or measurement span")
    record["status"] = "RAW_REFERENCE_RECORDED: operator pose and stability still require review"
    print(f"Captured {len(measurements)} raw samples; firmware/calibration unchanged. No settings written.", flush=True)
except Exception as error:
    record["error"] = str(error)
    raise
finally:
    port.close()
    record["missedReplies"] = failures
    # Keep interrupted captures as evidence instead of silently dropping them.
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x", encoding="utf-8") as output:
        output.write(json.dumps(record, indent=2) + "\n")

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
parser.add_argument("--wait", type=int, default=0)
parser.add_argument("--command", choices=["status", "sensor", "sample", "portal"])
args = parser.parse_args()

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
    for command in ["status"] + ["sensor"] * args.samples + ["sample", "status"]:
        port.write((command + "\n").encode())
        drain(port, 1.5)

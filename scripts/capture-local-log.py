"""Windows hardware integration capture. Temporarily joins one ESP32 setup AP.

Reads only status/log routes; does not change saved settings. Restores the original
Wi-Fi profile and closes the manually opened portal. Never prints AP credentials.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time
import urllib.request
from xml.sax.saxutils import escape
import serial

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port', required=True)
parser.add_argument('--node', required=True)
parser.add_argument('--output', required=True, help='New evidence directory')
parser.add_argument('--post-cycle-baseline', help='Existing acknowledged baseline metadata; permits queued records in post-cycle export')
parser.add_argument('--keep-portal-open', action='store_true', help='Keep this capture session open for a separately controlled follow-up test; default closes it')
args = parser.parse_args()
if not re.fullmatch(r'esp32-[a-f0-9]{12}', args.node):
    parser.error('Invalid Node ID')
out = Path(args.output)
out.mkdir(parents=True, exist_ok=False)
profile_name = 'CodexLocalLogCapture'
profile_file = out / 'private-profile.xml'
metadata = {'nodeId': args.node, 'captureStartedEpoch': time.time()}
if args.post_cycle_baseline:
    baseline = json.loads(Path(args.post_cycle_baseline).read_text(encoding='utf-8'))
    if (baseline.get('nodeId') != args.node or
            not baseline.get('result', '').startswith('CAPTURE COMPLETE:') or
            baseline.get('portalStatusBeforeExport', {}).get('pending') != 0):
        raise RuntimeError('Post-cycle capture requires an existing same-node acknowledged baseline')
    metadata['postCycleBaseline'] = str(Path(args.post_cycle_baseline))
credentials = {}
port = serial.Serial(port=None, baudrate=115200, timeout=.2)
port.port = args.port
port.dtr = False
port.rts = False

def netsh(*command):
    return subprocess.run(['netsh', 'wlan', *command], capture_output=True,
                          text=True, timeout=20)

def wifi():
    text = netsh('show', 'interfaces').stdout
    def field(name):
        match = re.search(r'^\s*' + name + r'\s*:\s*(.+)$', text, re.M)
        return match.group(1).strip() if match else ''
    return field('SSID'), field('Profile')

def drain(seconds):
    deadline = time.monotonic() + seconds
    states = []
    while time.monotonic() < deadline:
        line = port.readline().decode(errors='replace').strip()
        match = re.match(r'Setup Wi-Fi (\S+) password (\S+), open ', line)
        if match:
            credentials.update(ssid=match.group(1), password=match.group(2))
        try:
            state = json.loads(line)
        except (ValueError, TypeError):
            continue
        if isinstance(state, dict) and 'nodeId' in state:
            if state['nodeId'] != args.node:
                raise RuntimeError('USB hardware identity mismatch; stopped')
            states.append(state)
    return states

def status():
    for _ in range(3):
        port.write(b'\nstatus\n')
        states = drain(4)
        if states:
            return states[-1]
    raise RuntimeError('No complete USB status after bounded retries')

opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
def get(path):
    for attempt in range(3):
        try:
            with opener.open('http://192.168.4.1' + path, timeout=30) as response:
                body = response.read()
                length = response.headers.get('Content-Length')
                if length is not None and len(body) != int(length):
                    raise RuntimeError('Incomplete HTTP transfer')
                return body
        except (OSError, RuntimeError):
            if attempt == 2:
                raise
            time.sleep(1)

original_ssid, original_profile = wifi()
if not original_ssid or not original_profile:
    raise RuntimeError('A connected original Wi-Fi profile is required for restoration')
metadata['originalWifiSSID'] = original_ssid
portal_opened = False
try:
    port.open()
    drain(3)
    before = status()
    metadata['serialBefore'] = before
    if before['portalActive'] or before['pendingVerification']:
        raise RuntimeError('Existing setup/update session; leave it undisturbed')
    if not before['wifiConnected'] or not before['storageReady']:
        raise RuntimeError('Saved network/storage not ready')
    port.write(b'portal\n')
    portal_opened = True
    drain(4)
    if not credentials or credentials['ssid'] != 'ESP32-Setup-' + args.node[6:]:
        raise RuntimeError('No matching AP credentials observed; nothing reconfigured')
    name, password = escape(credentials['ssid']), escape(credentials['password'])
    profile_file.write_text('<?xml version="1.0"?><WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1"><name>' + profile_name + '</name><SSIDConfig><SSID><name>' + name + '</name></SSID></SSIDConfig><connectionType>ESS</connectionType><connectionMode>manual</connectionMode><MSM><security><authEncryption><authentication>WPA2PSK</authentication><encryption>AES</encryption><useOneX>false</useOneX></authEncryption><sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>' + password + '</keyMaterial></sharedKey></security></MSM></WLANProfile>', encoding='utf-8')
    if netsh('add', 'profile', 'filename=' + str(profile_file.resolve()), 'user=current').returncode:
        raise RuntimeError('Temporary Wi-Fi profile could not be added')
    if netsh('connect', 'name=' + profile_name, 'ssid=' + credentials['ssid']).returncode:
        raise RuntimeError('Setup Wi-Fi connection request failed')
    deadline = time.monotonic() + 25
    while wifi()[0] != credentials['ssid'] and time.monotonic() < deadline:
        drain(1)
    if wifi()[0] != credentials['ssid']:
        raise RuntimeError('Laptop did not join expected setup AP')
    # Wait for a zero-pending checkpoint so baseline acknowledgments are known.
    for _ in range(8):
        state = json.loads(get('/status'))
        if state.get('nodeId') != args.node:
            raise RuntimeError('HTTP hardware identity mismatch')
        if state['pending'] == 0 or args.post_cycle_baseline:
            break
        drain(2)
    else:
        raise RuntimeError('Queue not drained; preserve partial evidence and retry later')
    metadata['portalStatusBeforeExport'] = state
    recent = json.loads(get('/logs'))
    body = get('/log')
    export_epoch = time.time()
    records, hashes = {}, {}
    for line in body.split(b'\n'):
        if not line:
            continue
        record = json.loads(line)
        key = record['eventId']
        if record['nodeId'] != args.node or key in records:
            raise RuntimeError('Wrong-node or duplicate local event ID')
        records[key] = record
        hashes[key] = hashlib.sha256(line).hexdigest()
    recent_ids = [r['eventId'] for r in recent]
    if len(records) != 256 or len(recent_ids) != 30 or len(set(recent_ids)) != 30:
        raise RuntimeError('Expected complete 256-record export and 30 recent records')
    if not all(key in records for key in recent_ids):
        raise RuntimeError('Recent IDs missing from full export')
    (out / 'log.ndjson').write_bytes(body)
    metadata.update(exportEpoch=export_epoch, exportBytes=len(body),
                    exportSha256=hashlib.sha256(body).hexdigest(),
                    recordCount=len(records), recordHashes=hashes,
                    recentIdsNewestFirst=recent_ids)
    metadata['portalStatusAfterExport'] = json.loads(get('/status'))
    if metadata['portalStatusAfterExport']['nodeId'] != args.node:
        raise RuntimeError('Final HTTP identity mismatch')
    metadata['result'] = 'CAPTURE COMPLETE: comparison and physical power-cycle are separate steps'
    print('Captured 256 local records and 30 recent event IDs; complete HTTP length verified', flush=True)
except BaseException as error:
    metadata['result'] = 'INCOMPLETE: ' + str(error)
    raise
finally:
    metadata['portalLeftOpenForFollowup'] = portal_opened and args.keep_portal_open
    if portal_opened and not args.keep_portal_open:
        port.write(b'portal-close\n')
        drain(2)
    if port.is_open:
        port.close()
    netsh('connect', 'name=' + original_profile, 'ssid=' + original_ssid)
    deadline = time.monotonic() + 30
    while wifi()[0] != original_ssid and time.monotonic() < deadline:
        time.sleep(1)
    metadata['originalNetworkRestored'] = wifi()[0] == original_ssid
    netsh('delete', 'profile', 'name=' + profile_name)
    if profile_file.exists():
        profile_file.unlink()
    metadata['captureCompletedEpoch'] = time.time()
    (out / 'metadata.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    print('Original Wi-Fi restored: ' + str(metadata['originalNetworkRestored']), flush=True)

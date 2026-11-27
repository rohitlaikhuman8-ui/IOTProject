"""Windows hardware test for an isolated ESP32 bench image; never use on production.

Requires FLEET_PORTAL_RECOVERY_BENCH=1 and FLEET_ALLOW_OTA=0. Deliberately
disconnects the station twice, downloads the local log, and restores laptop Wi-Fi.
AP credentials are read in memory from USB and never written to evidence.
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
parser.add_argument('--revision', required=True)
parser.add_argument('--output', required=True, help='New evidence directory')
args = parser.parse_args()
out = Path(args.output)
out.mkdir(parents=True, exist_ok=False)
version = 'usb-ap-availability-bench'
evidence = {'nodeId': args.node, 'scope': 'Simulated disconnect on bench hardware; stable AP access and unattended recovery', 'observations': [], 'messages': []}
credentials = {}
profile_name = 'CodexFallbackApBench'
profile = out / 'private-profile.xml'
port = serial.Serial(port=None, baudrate=115200, timeout=.15)
port.port = args.port
port.dtr = False
port.rts = False
serial_buffer = bytearray()
owns_portal = False
verified = False

def netsh(*command):
    return subprocess.run(['netsh', 'wlan', *command], capture_output=True, text=True, timeout=20)

def wifi():
    body = netsh('show', 'interfaces').stdout
    def field(key):
        found = re.search(r'^\s*' + key + r'\s*:\s*(.+)$', body, re.M)
        return found.group(1).strip() if found else ''
    return field('SSID'), field('Profile')

original_ssid, original_profile = wifi()
if not original_ssid or not original_profile:
    raise RuntimeError('Connected original laptop network required')
evidence['originalWifiSSID'] = original_ssid

def drain(seconds):
    end = time.monotonic() + seconds
    states = []
    while time.monotonic() < end:
        serial_buffer.extend(port.read(port.in_waiting or 1))
        if b'\n' not in serial_buffer:
            if len(serial_buffer) > 8192:
                raise RuntimeError('Unterminated USB diagnostic exceeds buffer bound')
            continue
        raw, _, remainder = serial_buffer.partition(b'\n')
        serial_buffer[:] = remainder
        line = raw.decode(errors='replace').strip()
        match = re.match(r'Setup Wi-Fi (\S+) password (\S+), open ', line)
        if match:
            credentials.update(ssid=match.group(1), password=match.group(2))
        if line.startswith(('Setup AP:', 'Saved Wi-Fi and cloud recovered;', 'Setup AP closed')):
            evidence['messages'].append({'hostEpoch': time.time(), 'message': line})
        try:
            state = json.loads(line)
        except (ValueError, TypeError):
            continue
        if isinstance(state, dict) and 'nodeId' in state:
            assert state['nodeId'] == args.node, 'USB identity mismatch'
            assert state['version'] == version, 'Dedicated bench image required'
            assert state['calibration']['revision'] == args.revision
            states.append(state)
            evidence['observations'].append({'hostEpoch': time.time(), 'status': state})
    return states

def status():
    for _ in range(3):
        port.write(b'\nstatus\n')
        states = drain(4)
        if states:
            return states[-1]
    raise RuntimeError('No complete status after bounded retries')

def until(predicate, seconds):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        try:
            state = status()
        except RuntimeError as error:
            evidence.setdefault('serialReadTimeouts', []).append({'hostEpoch': time.time(), 'error': str(error)})
            continue
        if predicate(state):
            return state
        drain(1)
    raise RuntimeError('Timed out waiting for hardware state')

def restore_wifi():
    netsh('connect', 'name=' + original_profile, 'ssid=' + original_ssid)
    end = time.monotonic() + 25
    while wifi()[0] != original_ssid and time.monotonic() < end:
        drain(.5)
    return wifi()[0] == original_ssid

opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
def get(path):
    with opener.open('http://192.168.4.1' + path, timeout=30) as response:
        body = response.read()
        length = response.headers.get('Content-Length')
        assert length is not None and len(body) == int(length), 'Incomplete HTTP body'
        return body

try:
    port.open()
    drain(2)
    before = status()
    assert before['wifiConnected'] and before['ip'] != '0.0.0.0'
    assert not before['portalActive'] and not before['pendingVerification']
    verified = True
    # Obtain the existing AP credential while online, then close only our session.
    owns_portal = True
    port.write(b'portal\n')
    drain(2)
    assert credentials.get('ssid') == 'ESP32-Setup-' + args.node[6:]
    port.write(b'portal-close\n')
    drain(2)
    port.write(b'bench-wifi-drop\n')
    until(lambda s: s['portalActive'] and s['portalAutomatic'] and s['portalStationPaused'] and s['wifiMode'] == 2 and not s['wifiConnected'], 65)
    print('AP-only fallback active with no station IP', flush=True)
    name, password = escape(credentials['ssid']), escape(credentials['password'])
    profile.write_text('<?xml version="1.0"?><WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1"><name>' + profile_name + '</name><SSIDConfig><SSID><name>' + name + '</name></SSID></SSIDConfig><connectionType>ESS</connectionType><connectionMode>manual</connectionMode><MSM><security><authEncryption><authentication>WPA2PSK</authentication><encryption>AES</encryption><useOneX>false</useOneX></authEncryption><sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>' + password + '</keyMaterial></sharedKey></security></MSM></WLANProfile>', encoding='utf-8')
    assert netsh('add', 'profile', 'filename=' + str(profile.resolve()), 'user=current').returncode == 0
    assert netsh('connect', 'name=' + profile_name, 'ssid=' + credentials['ssid']).returncode == 0
    deadline = time.monotonic() + 25
    while wifi()[0] != credentials['ssid'] and time.monotonic() < deadline:
        drain(.5)
    assert wifi()[0] == credentials['ssid'], 'Laptop failed to join fallback AP'
    first = json.loads(get('/status'))
    assert first['nodeId'] == args.node and not first['wifiReady'] and first['portalStationPaused']
    assert first['apClients'] > 0
    body = get('/log')
    rows = [json.loads(line) for line in body.splitlines() if line]
    assert len(rows) == 256 and len({r['eventId'] for r in rows}) == 256
    assert all(r['nodeId'] == args.node for r in rows)
    (out / 'log.ndjson').write_bytes(body)
    evidence['export'] = {'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest(), 'recordCount': len(rows)}
    # Stay joined past the 60-second station retry interval. No probe may start.
    started = time.monotonic()
    while time.monotonic() - started < 65:
        state = json.loads(get('/status'))
        assert state['nodeId'] == args.node and state['portalStationPaused'] and not state['wifiReady'] and state['apClients'] > 0
        evidence.setdefault('clientHttpObservations', []).append({'hostEpoch': time.time(), 'status': state})
        drain(3)
    evidence['clientHoldSeconds'] = time.monotonic() - started
    assert restore_wifi(), 'Original laptop network restoration failed'
    netsh('delete', 'profile', 'name=' + profile_name)
    profile.unlink(missing_ok=True)
    state = until(lambda s: s['wifiConnected'] and s['lastCloudAgeMs'] < 15000, 115)
    assert state['portalActive'] and not state['portalAutomatic'], 'AP-client ownership lost on recovery'
    evidence['manualPortalPreservedAfterRecovery'] = True
    port.write(b'portal-close\n')
    drain(2)
    print('Full log export, client scan protection and saved-network recovery passed', flush=True)
    # Repeat without a client: automatic fallback must recover and close itself.
    port.write(b'bench-wifi-drop\n')
    until(lambda s: s['portalActive'] and s['portalStationPaused'] and not s['wifiConnected'], 65)
    final = until(lambda s: s['wifiConnected'] and not s['portalActive'] and s['lastCloudAgeMs'] < 15000, 150)
    assert final['calibration'] == before['calibration'] and final['storageReady'] and final['sensorAddress'] == 83
    evidence['automaticRecoveryClosedPortal'] = True
    evidence['result'] = 'PASS: bounded simulated outage, complete fallback log export, client scan protection, manual preservation and automatic recovery'
    print(evidence['result'], flush=True)
except BaseException as error:
    evidence['result'] = 'FAIL: ' + str(error)
    raise
finally:
    try:
        evidence['originalNetworkRestored'] = restore_wifi() if port.is_open else wifi()[0] == original_ssid
        if verified and owns_portal:
            # Reverify before cleanup, never close another node's portal.
            state = status()
            if state['portalActive']:
                port.write(b'portal-close\n')
                drain(2)
    finally:
        netsh('delete', 'profile', 'name=' + profile_name)
        profile.unlink(missing_ok=True)
        port.close()
        evidence['completedEpoch'] = time.time()
        (out / 'metadata.json').write_text(json.dumps(evidence, indent=2), encoding='utf-8')

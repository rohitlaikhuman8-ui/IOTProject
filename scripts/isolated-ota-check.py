"""Classic ESP32 Node 4-only acceptance harness; never changes the fleet manifest.

Stage/verify an image in the inactive slot while preserving a hash-verified VALID
production slot, then explicitly activate NEW for the chosen acceptance scenario.
Health-timeout activation requires operator-confirmed network isolation; the
partial-stage/reset probe keeps network access available for recovery.
Private boot/NVS/filesystem backups must remain outside Git. Uses ESP-IDF 4.4's
two-sector otadata layout and CRC, independently checked against actual entries.
"""
import argparse
import binascii
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import sys
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--action', choices=['stage', 'activate', 'inspect', 'restore-inactive'], required=True)
parser.add_argument('--port', required=True)
parser.add_argument('--node', required=True)
parser.add_argument('--known-good', required=True)
parser.add_argument('--known-good-sha256', required=True)
parser.add_argument('--image')
parser.add_argument('--image-sha256')
parser.add_argument('--output', required=True)
parser.add_argument('--label', default='inspection')
parser.add_argument('--network-block-confirmed', action='store_true')
parser.add_argument('--test-mode', choices=['health-timeout', 'partial-stage-reset'], default='health-timeout')
parser.add_argument('--probe-id')
args = parser.parse_args()
if args.node != 'esp32-3013a5f4e9d4':
    parser.error('This acceptance harness is restricted to the isolated Node 4')
if not re.fullmatch(r'[A-Za-z0-9_-]+', args.label):
    parser.error('Invalid evidence label')
if args.action == 'activate' and args.test_mode == 'health-timeout' and not args.network_block_confirmed:
    parser.error('Activate only after the operator confirms Node 4 blocked')
if args.test_mode == 'partial-stage-reset' and not re.fullmatch(r'[0-9a-f]{32}', args.probe_id or ''):
    parser.error('Partial-stage reset requires the exact synthetic probe ID')
root = Path(args.output).resolve()
workspace = Path(__file__).resolve().parent.parent
if not root.is_relative_to(workspace / 'work'):
    parser.error('Private evidence output must be under the ignored work directory')
if args.action == 'stage':
    root.mkdir(parents=True, exist_ok=False)
elif not root.is_dir():
    parser.error('Existing staged evidence directory required')
loader = workspace / '.build/pio/packages/tool-esptoolpy/esptool.py'
expected_mac = 'MAC: d4:e9:f4:a5:13:30'
known = Path(args.known_good).resolve()
assert hashlib.sha256(known.read_bytes()).hexdigest() == args.known_good_sha256

def run(command, name, after='no_reset'):
    output = root / (name + '.log')
    if output.exists():
        raise RuntimeError('Evidence already exists: ' + output.name)
    with output.open('w', encoding='utf-8') as log:
        result = subprocess.run([sys.executable, str(loader), '--chip', 'esp32', '--port', args.port,
                                 '--baud', '115200', '--after', after] + command,
                                stdout=log, stderr=subprocess.STDOUT)
    text = output.read_text(encoding='utf-8', errors='replace')
    if result.returncode or expected_mac not in text:
        print('FAILED ' + name + ': ' + text[-600:], flush=True)
        raise RuntimeError('Flash operation/target verification failed; no further step')
    return text

def parse(boot):
    assert len(boot) == 0x10000
    parts = []
    for offset in range(0x8000, 0x8c00, 32):
        magic, kind, subtype, address, size = struct.unpack_from('<HBBII', boot, offset)
        if magic != 0x50aa:
            break
        parts.append((kind, subtype, address, size))
    for required in [(0, 16, 0x10000, 0x140000), (0, 17, 0x150000, 0x140000),
                     (1, 0, 0xe000, 0x2000), (1, 130, 0x290000, 0x160000)]:
        assert required in parts, 'Unexpected partition table; no mutation allowed'
    entries = []
    for sector in range(2):
        seq, state, crc = struct.unpack_from('<I20xII', boot, 0xe000 + sector * 4096)
        expected = binascii.crc32(struct.pack('<I', seq), 0xffffffff) & 0xffffffff
        entries.append({'sector': sector, 'sequence': seq, 'state': state,
                        'crcValid': crc == expected, 'slot': (seq - 1) % 2})
    valid = [e for e in entries if e['crcValid'] and e['sequence'] not in (0, 0xffffffff)
             and e['state'] not in (3, 4)]
    assert valid, 'No valid selected OTA entry'
    active = max(valid, key=lambda e: e['sequence'])
    return {'entries': entries, 'active': active, 'activeAddress': 0x10000 + active['slot'] * 0x140000,
            'inactiveAddress': 0x10000 + (1 - active['slot']) * 0x140000}

def read_boot(name, after='no_reset'):
    path = root / (name + '-private.bin')
    assert not path.exists()
    run(['read_flash', '0', '65536', str(path)], name, after)
    data = path.read_bytes()
    return data, parse(data)

def write_image(image, address, prefix):
    data = image.read_bytes()
    assert 0 < len(data) <= 0x140000
    assert address in (0x10000, 0x150000)
    for offset in range(0, len(data), 0x40000):
        part = root / f'{prefix}-{offset:08x}.bin'
        part.write_bytes(data[offset:offset + 0x40000])
        print(f'Writing inactive application section at 0x{address + offset:x}', flush=True)
        for attempt in range(2):
            try:
                text = run(['write_flash', '-z', hex(address + offset), str(part)], f'{prefix}-{offset:08x}-{attempt}')
                assert 'Hash of data verified.' in text
                break
            except (RuntimeError, AssertionError):
                if attempt:
                    raise
                print('Retrying failed inactive section once; active image unchanged', flush=True)
    run(['verify_flash', hex(address), str(image)], prefix + '-whole-verify')

def backup_filesystem():
    # Request loader no_reset between reads. A failed serial chunk is retained
    # privately and retried independently; a full flash comparison below is the
    # acceptance gate, not an assumption about serial-driver reset behavior.
    chunks = []
    for offset in range(0, 0x160000, 0x10000):
        for attempt in range(3):
            chunk = root / f'filesystem-{offset:08x}-{attempt}-private.bin'
            try:
                run(['read_flash', hex(0x290000 + offset), '65536', str(chunk)],
                    f'filesystem-{offset:08x}-{attempt}')
                data = chunk.read_bytes()
                assert len(data) == 65536
                chunks.append(data)
                break
            except (RuntimeError, AssertionError):
                if attempt == 2:
                    raise
                print('Retrying failed filesystem read chunk; no slot write yet', flush=True)
        print(f'Private filesystem backup: {offset + 65536}/{0x160000}', flush=True)
    backup = root / 'filesystem-private.bin'
    backup.write_bytes(b''.join(chunks))
    assert backup.stat().st_size == 0x160000
    run(['verify_flash', '0x290000', str(backup)], 'filesystem-backup-verify')
    return backup

def observe_partial_reset():
    # Attach inside the activation process, without another ROM-loader connect.
    # The isolated image waits ten seconds before staging the partial bytes.
    import serial
    port = serial.Serial(port=None, baudrate=115200, timeout=0)
    port.port = args.port
    port.dtr = False
    port.rts = False
    port.open()
    buffer = bytearray()
    evidence = {'startedEpoch': time.time(), 'messages': [], 'statuses': []}
    partial_seen = reset_seen = False
    next_status = 0
    try:
        end = time.monotonic() + 120
        while time.monotonic() < end:
            if time.monotonic() >= next_status:
                port.write(b'\nstatus\n')
                next_status = time.monotonic() + 3
            buffer.extend(port.read(port.in_waiting or 1))
            while b'\n' in buffer:
                line, _, remainder = buffer.partition(b'\n')
                buffer[:] = remainder
                text = line.decode(errors='replace').strip()
                if text.startswith(('BENCH ', 'Node esp32-')):
                    evidence['messages'].append({'hostEpoch': time.time(), 'message': text})
                    print(text, flush=True)
                marker = re.fullmatch(r'BENCH partial staged: id=([0-9a-f]{32}) bytes=(\d+) pending=(\d+) slot=(app[01])', text)
                if marker:
                    assert marker[1] == args.probe_id and int(marker[2]) == 107 and marker[3] == '1'
                    partial_seen = True
                    evidence['partialMarker'] = {'probeId': marker[1], 'bytes': int(marker[2]), 'pending': True, 'slot': marker[4]}
                if text == 'BENCH software reset before temporary-record commit and app confirmation':
                    reset_seen = True
                try:
                    status = json.loads(text)
                except ValueError:
                    continue
                if isinstance(status, dict) and 'nodeId' in status:
                    assert status['nodeId'] == args.node
                    evidence['statuses'].append({'hostEpoch': time.time(), 'status': status})
                    if partial_seen and reset_seen and status.get('version') == 'c0e1dc440b9b24d856098d845483aa49904e6a7e' and not status.get('pendingVerification', True):
                        evidence['result'] = 'OBSERVED: synced partial temporary record, software reset and confirmed production return; inspect metadata and records separately'
                        return evidence
            time.sleep(.03)
        raise RuntimeError('Partial-stage marker/reset/production return not observed within bounded window')
    except BaseException as error:
        evidence['result'] = 'INCOMPLETE: ' + str(error)
        raise
    finally:
        port.close()
        evidence['completedEpoch'] = time.time()
        (root / 'partial-observation.json').write_text(json.dumps(evidence, indent=2), encoding='utf-8')

resumed = False
try:
    if args.action == 'stage':
        assert args.image and args.image_sha256
        image = Path(args.image).resolve()
        data = image.read_bytes()
        assert hashlib.sha256(data).hexdigest() == args.image_sha256
        boot, layout = read_boot('before-stage')
        assert layout['active']['state'] == 2, 'Active production image must be VALID'
        run(['verify_flash', hex(layout['activeAddress']), str(known)], 'known-good-active-verify')
        print('Active production image verified; backing up filesystem privately', flush=True)
        fs_backup = backup_filesystem()
        staged = root / 'staged-image.bin'
        staged.write_bytes(data)
        write_image(staged, layout['inactiveAddress'], 'stage')
        # Prove no active selection/known-good bytes were changed by staging.
        boot_after, layout_after = read_boot('after-stage')
        assert boot_after[0xe000:0x10000] == boot[0xe000:0x10000]
        run(['verify_flash', hex(layout['activeAddress']), str(known)], 'known-good-after-stage-verify')
        metadata = {'startedFrom': layout, 'afterStage': layout_after, 'imageBytes': len(data),
                    'imageSha256': args.image_sha256, 'knownGoodSha256': args.known_good_sha256,
                    'filesystemBackupSha256': hashlib.sha256(fs_backup.read_bytes()).hexdigest(),
                    'result': 'STAGED ONLY: inactive application verified; active production and otadata preserved'}
        (root / 'stage.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
        run(['read_mac'], 'resume-known-good', 'hard_reset')
        resumed = True
        print(json.dumps(metadata), flush=True)
    elif args.action == 'activate':
        assert not (root / 'activation.json').exists(), 'Do not activate a trial twice'
        stage = json.loads((root / 'stage.json').read_text(encoding='utf-8'))
        boot, layout = read_boot('before-activate')
        assert layout['active'] == stage['startedFrom']['active'] and layout['active']['state'] == 2
        staged = root / 'staged-image.bin'
        assert hashlib.sha256(staged.read_bytes()).hexdigest() == stage['imageSha256']
        if args.test_mode == 'partial-stage-reset':
            assert b'usb-partial-stage-probe' in staged.read_bytes() and args.probe_id.encode() in staged.read_bytes()
        run(['verify_flash', hex(layout['activeAddress']), str(known)], 'active-before-activate-verify')
        run(['verify_flash', hex(layout['inactiveAddress']), str(staged)], 'inactive-before-activate-verify')
        target_sector = 1 - layout['active']['sector']
        sequence = max(e['sequence'] for e in layout['entries'] if e['crcValid'] and e['sequence'] != 0xffffffff) + 1
        while (sequence - 1) % 2 == layout['active']['slot']:
            sequence += 1
        assert sequence < 0xffffffff
        crc = binascii.crc32(struct.pack('<I', sequence), 0xffffffff) & 0xffffffff
        sector = struct.pack('<I20sII', sequence, b'\xff' * 20, 0, crc) + b'\xff' * (4096 - 32)
        sector_file = root / 'new-otadata-sector.bin'
        sector_file.write_bytes(sector)
        address = 0xe000 + target_sector * 4096
        # Validate the planned metadata locally before selection. A separate
        # loader connection after NEW can reset an unconfirmed first boot and
        # turn it ABORTED, invalidating a health-timeout test. write_flash itself
        # verifies the written bytes before its one final reset.
        updated = bytearray(boot)
        updated[address:address + 4096] = sector
        selected = parse(updated)
        preserved_offset = 0xe000 + layout['active']['sector'] * 4096
        assert updated[preserved_offset:preserved_offset + 4096] == boot[preserved_offset:preserved_offset + 4096]
        assert selected['active']['state'] == 0 and selected['active']['slot'] != layout['active']['slot']
        metadata = {'activationEpoch': time.time(), 'networkBlockOperatorConfirmed': args.network_block_confirmed,
                    'testMode': args.test_mode, 'probeId': args.probe_id,
                    'previous': layout, 'plannedNew': selected, 'knownGoodSectorPreservedInPlannedWrite': True,
                    'verificationMethod': 'esptool write_flash built-in hash verification; no subsequent loader reconnect before observation'}
        (root / 'activation.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
        result = run(['write_flash', '-z', hex(address), str(sector_file)], 'activate-new-entry', 'hard_reset')
        resumed = True
        assert 'Hash of data verified.' in result, 'No built-in selection-sector verification'
        metadata['selectionSectorWriteVerified'] = True
        (root / 'activation.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
        print('NEW image selected; observe first boot without another reset', flush=True)
        if args.test_mode == 'partial-stage-reset':
            observe_partial_reset()
    elif args.action == 'inspect':
        _, layout = read_boot(args.label, 'hard_reset')
        resumed = True
        metadata = {'checkedAtEpoch': time.time(), **layout}
        (root / (args.label + '.json')).write_text(json.dumps(metadata, indent=2), encoding='utf-8')
        print(json.dumps(metadata), flush=True)
    else:
        boot, layout = read_boot('before-restore-inactive')
        assert layout['active']['state'] == 2
        run(['verify_flash', hex(layout['activeAddress']), str(known)], 'active-before-cleanup-verify')
        write_image(known, layout['inactiveAddress'], 'restore-inactive')
        restored_boot, restored_layout = read_boot('after-restore-inactive')
        assert restored_boot == boot, 'Boot/NVS/partition/OTA bytes changed during inactive cleanup'
        run(['verify_flash', hex(layout['activeAddress']), str(known)], 'active-after-cleanup-verify')
        cleanup = {'checkedAtEpoch': time.time(), 'before': layout, 'after': restored_layout,
                   'knownGoodSha256': args.known_good_sha256, 'bothApplicationImagesVerified': True,
                   'bootNvsPartitionAndOtaBytesUnchanged': True,
                   'result': 'Both slots verified against production; inactive probe removed and rejection state retained'}
        (root / 'cleanup.json').write_text(json.dumps(cleanup, indent=2), encoding='utf-8')
        run(['read_mac'], 'resume-after-cleanup', 'hard_reset')
        resumed = True
        print('Inactive application restored to known production bytes; rejection state retained', flush=True)
except BaseException:
    if not resumed:
        # Preserve all failures; return to whatever bootloader selection is valid.
        # Never rewrite the active slot, bootloader, NVS or filesystem to hide failure.
        try:
            run(['read_mac'], 'resume-after-failure', 'hard_reset')
        except BaseException:
            print('Recovery resume failed; keep USB attached and inspect evidence', flush=True)
    raise

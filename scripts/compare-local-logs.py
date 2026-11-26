"""Compare immutable ESP32 local-log captures by event ID and exact payload bytes."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--before', required=True)
parser.add_argument('--after', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
if Path(args.output).exists():
    parser.error('Choose a new output file; evidence must not be overwritten')

def capture(directory):
    root = Path(directory)
    meta = json.loads((root / 'metadata.json').read_text(encoding='utf-8'))
    body = (root / 'log.ndjson').read_bytes()
    if not meta.get('result', '').startswith('CAPTURE COMPLETE:') or not meta.get('originalNetworkRestored'):
        raise ValueError('Incomplete capture or network restoration')
    if hashlib.sha256(body).hexdigest() != meta['exportSha256'] or len(body) != meta['exportBytes']:
        raise ValueError('Archived export length/hash mismatch')
    records, hashes = {}, {}
    for line in body.split(b'\n'):
        if not line:
            continue
        record = json.loads(line)
        key = record['eventId']
        if record['nodeId'] != meta['nodeId'] or key in records:
            raise ValueError('Wrong-node or duplicate event ID')
        records[key] = record
        hashes[key] = hashlib.sha256(line).hexdigest()
    if len(records) != 256 or hashes != meta['recordHashes']:
        raise ValueError('Capture record count or per-record hashes disagree')
    return meta, records, hashes

before, a, ah = capture(args.before)
after, b, bh = capture(args.after)
if before['nodeId'] != after['nodeId'] or before['portalStatusBeforeExport']['pending'] != 0:
    raise ValueError('Same-node acknowledged baseline required')
tracked = before['recentIdsNewestFirst']
if len(tracked) != 30 or len(set(tracked)) != 30 or not all(key in a for key in tracked):
    raise ValueError('Invalid original thirty-record tracked set')
# Include records appended between the recent-list and full-export requests.
# The device was not near uptime wrap in this test; keep this explicit limitation.
cutoffs = {}
for key in tracked:
    record = a[key]
    if record.get('bootId'):
        cutoffs[record['bootId']] = min(cutoffs.get(record['bootId'], record['uptimeMs']), record['uptimeMs'])
protected = set(tracked)
for key, record in a.items():
    boot = record.get('bootId')
    if boot in cutoffs and record['uptimeMs'] >= cutoffs[boot]:
        protected.add(key)
common = set(a) & set(b)
changed = sorted(key for key in common if ah[key] != bh[key])
missing = sorted(protected - set(b))
state_a, state_b = before['serialBefore'], after['serialBefore']
checks = {
    'trackedThirtyPresent': all(key in b for key in tracked),
    'trackedThirtyByteIdentical': all(key in b and ah[key] == bh[key] for key in tracked),
    'protectedRecentSetPresent': not missing,
    'allCommonPayloadsByteIdentical': not changed,
    'sameFirmware': state_a['version'] == state_b['version'],
    'sameCalibration': state_a['calibration'] == state_b['calibration'],
    'afterCaptureLater': after['exportEpoch'] > before['exportEpoch'],
}
passed = all(checks.values())
result = {
    'nodeId': before['nodeId'],
    'status': 'PASS: selected records survived with exact payload hashes' if passed else 'FAIL OR INCONCLUSIVE: inspect missing/changed evidence and retention timing',
    'checks': checks,
    'beforeExportEpoch': before['exportEpoch'], 'afterExportEpoch': after['exportEpoch'],
    'elapsedSeconds': after['exportEpoch'] - before['exportEpoch'],
    'beforeCount': len(a), 'afterCount': len(b), 'commonCount': len(common),
    'trackedIds': tracked, 'protectedRecentCount': len(protected),
    'missingProtectedIds': missing, 'changedCommonIds': changed,
    'removedOutsideProtectedIds': sorted(set(a) - set(b) - protected),
    'newAfterIds': sorted(set(b) - set(a)),
    'beforeExportSha256': before['exportSha256'], 'afterExportSha256': after['exportSha256'],
    'postCyclePendingAtCapture': after['portalStatusBeforeExport']['pending'],
    'limitations': 'Selected-record exact survival and common payload equality only. Older acknowledged records can rotate normally. Not permanent all-record retention, pending-record interrupted-write safety, brownout, rollback or endurance acceptance. Recent-set uptime ordering assumes no millis wrap during this short test.',
}
with Path(args.output).open('x', encoding='utf-8') as output:
    json.dump(result, output, indent=2)
print(json.dumps({key: result[key] for key in ('status', 'commonCount', 'protectedRecentCount', 'missingProtectedIds', 'changedCommonIds', 'elapsedSeconds')}))
raise SystemExit(0 if passed else 1)

"""Offline fault-injection tests for exact-record comparison; no device access."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
NODE = 'esp32-3013a5f4e9d4'

def record(i):
    return {'nodeId': NODE, 'eventId': f'{i:032x}', 'bootId': 'a' * 32,
            'uptimeMs': i * 10000, 'acceleration': {'x': i / 100}}

def write_capture(root, records, epoch):
    root.mkdir()
    lines = [json.dumps(r, separators=(',', ':')).encode() for r in records]
    body = b'\n'.join(lines) + b'\n'
    (root / 'log.ndjson').write_bytes(body)
    meta = {'result': 'CAPTURE COMPLETE: fixture', 'originalNetworkRestored': True,
            'nodeId': NODE, 'exportSha256': hashlib.sha256(body).hexdigest(),
            'exportBytes': len(body), 'exportEpoch': epoch,
            'portalStatusBeforeExport': {'pending': 0},
            'serialBefore': {'version': 'fixture-version', 'calibration': {'revision': 'fixture'}},
            'recordHashes': {r['eventId']: hashlib.sha256(line).hexdigest()
                             for r, line in zip(records, lines)},
            # 255 was appended between the recent-list and full-export requests.
            'recentIdsNewestFirst': [f'{i:032x}' for i in range(254, 224, -1)]}
    (root / 'metadata.json').write_text(json.dumps(meta), encoding='utf-8')

class ComparisonTests(unittest.TestCase):
    def run_case(self, change=None, corrupt=False):
        work = (ROOT / 'work').resolve()
        with tempfile.TemporaryDirectory(prefix='retention-comparison-', dir=work) as folder:
            root = Path(folder).resolve()
            self.assertTrue(root.is_relative_to(work))
            a, b = root / 'before', root / 'after'
            before = [record(i) for i in range(256)]
            after = [record(i) for i in range(10, 266)]
            if change:
                change(after)
            write_capture(a, before, 1000)
            write_capture(b, after, 1100)
            if corrupt:
                with (b / 'log.ndjson').open('ab') as output:
                    output.write(b'corruption')
            result_path = root / 'result.json'
            process = subprocess.run([sys.executable, str(ROOT / 'scripts/compare-local-logs.py'),
                                      '--before', str(a), '--after', str(b), '--output', str(result_path)],
                                     capture_output=True, text=True)
            result = json.loads(result_path.read_text()) if result_path.exists() else None
            return process.returncode, result

    def test_normal_rotation_and_extra_recent_record(self):
        code, result = self.run_case()
        self.assertEqual(code, 0)
        self.assertEqual(result['commonCount'], 246)
        self.assertEqual(result['protectedRecentCount'], 31)

    def test_changed_payload_with_consistent_capture_hashes_fails(self):
        def change(records):
            next(r for r in records if r['eventId'] == f'{250:032x}')['acceleration']['x'] = 999
        code, result = self.run_case(change)
        self.assertNotEqual(code, 0)
        self.assertIn(f'{250:032x}', result['changedCommonIds'])

    def test_missing_recent_record_with_same_total_count_fails(self):
        def change(records):
            records.remove(next(r for r in records if r['eventId'] == f'{255:032x}'))
            records.append(record(999))
        code, result = self.run_case(change)
        self.assertNotEqual(code, 0)
        self.assertIn(f'{255:032x}', result['missingProtectedIds'])

    def test_archive_corruption_fails(self):
        code, result = self.run_case(corrupt=True)
        self.assertNotEqual(code, 0)
        self.assertIsNone(result)

if __name__ == '__main__':
    unittest.main()

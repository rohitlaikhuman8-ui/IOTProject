"""Build an isolated Node 4-only incomplete-temporary-file/reset probe.

Generates a separate ignored PlatformIO project. Production firmware sources,
release headers and fleet manifests are never edited. This tests a staged partial
record followed by software reset, not physical interruption of flash programming.
"""
import argparse
import difflib
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--node', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--probe-id', required=True, help='32 lowercase hex characters for the never-committed synthetic record')
args = parser.parse_args()
if args.node != 'esp32-3013a5f4e9d4':
    parser.error('This probe is restricted to isolated Node 4')
if not re.fullmatch(r'[0-9a-f]{32}', args.probe_id):
    parser.error('Invalid probe ID')
workspace = Path(__file__).resolve().parent.parent
output = Path(args.output).resolve()
if not output.is_relative_to(workspace / '.build'):
    parser.error('Generated bench project must be under ignored .build')
output.mkdir(parents=True, exist_ok=False)
(output / 'src').mkdir()
source = (workspace / 'firmware/src/main.cpp').read_text(encoding='utf-8')
anchor = '  else Serial.println("LittleFS unavailable; see first-flash instructions");'
assert source.count(anchor) == 1, 'Production source changed; review probe injection before rebuilding'
partial = json.dumps({'nodeId': args.node, 'eventId': args.probe_id, 'kind': 'sample'}, separators=(',', ':'))[:-1] + ',"acceleration":'
try:
    json.loads(partial)
    raise AssertionError('Probe must remain invalid/incomplete JSON')
except json.JSONDecodeError:
    pass
injection = r'''
  // ISOLATED BENCH ONLY: pending image leaves a synced partial temporary record,
  // then resets before commit or boot confirmation. Bootloader must abort it.
  if (nodeId != "__NODE__" || !pendingVerification || !storageReady || LittleFS.exists("/new.tmp")) {
    Serial.println("BENCH partial-stage refused: target/state/storage/temp precondition");
    Serial.flush();
    for (;;) { esp_task_wdt_reset(); delay(1000); }
  }
  Serial.println("BENCH partial-stage armed; waiting ten seconds for passive UART observer");
  Serial.flush();
  delay(10000);
  {
    FilesystemLock lock;
    const char *payload = __PARTIAL_LITERAL__;
    FILE *file = fopen("/littlefs/new.tmp", "wb");
    bool complete = file && fwrite(payload, 1, strlen(payload), file) == strlen(payload);
    if (file) {
      complete = fflush(file) == 0 && complete;
      complete = fsync(fileno(file)) == 0 && complete;
      complete = fclose(file) == 0 && complete;
    }
    if (!complete) {
      Serial.println("BENCH partial-stage failed; leave evidence for recovery");
      Serial.flush();
      for (;;) { esp_task_wdt_reset(); delay(1000); }
    }
    Serial.printf("BENCH partial staged: id=__PROBE_ID__ bytes=%u pending=%d slot=%s\n",
                  static_cast<unsigned>(strlen(payload)), pendingVerification.load(), esp_ota_get_running_partition()->label);
    Serial.println("BENCH software reset before temporary-record commit and app confirmation");
    Serial.flush();
    ESP.restart();
  }
'''.replace('__NODE__', args.node).replace('__PROBE_ID__', args.probe_id).replace('__PARTIAL_LITERAL__', json.dumps(partial))
generated = source.replace(anchor, anchor + '\n' + injection)
(output / 'src/main.cpp').write_text(generated, encoding='utf-8')
(output / 'src/release-version.h').write_text('#define FLEET_VERSION "usb-partial-stage-probe"\n#define FLEET_ALLOW_OTA 0\n', encoding='utf-8')
(output / 'platformio.ini').write_text((workspace / 'firmware/platformio.ini').read_text(encoding='utf-8'), encoding='utf-8')
(output / 'probe.patch').write_text(''.join(difflib.unified_diff(source.splitlines(True), generated.splitlines(True), fromfile='production/main.cpp', tofile='isolated-probe/main.cpp')), encoding='utf-8')
env = os.environ.copy()
env['PLATFORMIO_CORE_DIR'] = str(workspace / '.build/pio')
subprocess.run([sys.executable, '-m', 'platformio', 'run', '-d', str(output)], cwd=workspace, env=env, check=True)
binary = output / '.pio/build/esp32dev/firmware.bin'
data = binary.read_bytes()
assert 0 < len(data) <= 0x140000 and b'usb-partial-stage-probe' in data
metadata = {'nodeId': args.node, 'probeId': args.probe_id, 'version': 'usb-partial-stage-probe',
            'productionSourceSha256': hashlib.sha256(source.encode()).hexdigest(),
            'generatedSourceSha256': hashlib.sha256(generated.encode()).hexdigest(),
            'partialBytes': len(partial.encode()), 'partialSha256': hashlib.sha256(partial.encode()).hexdigest(),
            'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
            'scope': 'Synced incomplete temporary file then software reset while OTA image pending; no physical flash-write/power interruption'}
(output / 'metadata.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
print(json.dumps(metadata), flush=True)

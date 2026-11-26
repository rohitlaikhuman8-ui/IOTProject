import argparse,json,time,serial
from pathlib import Path
parser=argparse.ArgumentParser(description='Hardware-only portal recovery check; requires dedicated bench firmware, not a production fleet node')
parser.add_argument('--port',required=True)
parser.add_argument('--node',required=True)
parser.add_argument('--revision',required=True)
parser.add_argument('--output',required=True)
args=parser.parse_args()
if Path(args.output).exists(): parser.error('Choose a new output file; existing evidence must be preserved')
p=serial.Serial(port=None,baudrate=115200,timeout=.2);p.port=args.port;p.dtr=False;p.rts=False;p.open()
evidence={'scope':'Bench-only 45-second Wi-Fi disconnect and manual portal preservation','nodeId':args.node,'observations':[],'messages':[]}
def drain(seconds):
 end=time.monotonic()+seconds;states=[]
 while time.monotonic()<end:
  line=p.readline().decode(errors='replace').strip()
  if 'closing automatic setup AP' in line or 'Bench Wi-Fi disconnected' in line or 'Setup AP closed' in line:
   evidence['messages'].append(line)
  try:
   s=json.loads(line)
   if s.get('nodeId')==args.node:
    assert s['version']=='usb-portal-recovery-bench'
    assert s['calibration']['revision']==args.revision
    states.append(s);evidence['observations'].append({'hostEpoch':time.time(),'status':s})
  except (ValueError,TypeError):pass
 return states
def status():
 for _ in range(3):
  p.write(b'\nstatus\n');s=drain(4)
  if s:return s[-1]
 raise RuntimeError('No complete status after bounded retries')
try:
 drain(6);s=status();assert s['wifiConnected'] and not s['portalActive']
 p.write(b'bench-wifi-drop\n');began=time.monotonic();opened=False;recovered=False
 while time.monotonic()-began<150:
  s=status()
  if s['portalActive'] and s['portalAutomatic'] and not s['wifiConnected']:opened=True
  if opened and s['wifiConnected'] and not s['portalActive']:
   recovered=True;break
 assert opened,'Fallback did not open during controlled disconnect'
 assert recovered,'Automatic portal did not close after recovered connection'
 assert any('closing automatic setup AP' in x for x in evidence['messages'])
 print('Automatic fallback opened and closed after Wi-Fi/cloud recovery',flush=True)
 p.write(b'portal\n');drain(3);s=status();assert s['portalActive'] and not s['portalAutomatic']
 drain(22);s=status();assert s['wifiConnected'] and s['portalActive'] and not s['portalAutomatic']
 evidence['manualPortalPreserved']=True
 p.write(b'portal-close\n');drain(3);s=status();assert not s['portalActive']
 assert s['storageReady'] and s['sensorAddress']==83 and s['logRecords']==256
 evidence['result']='PASS: controlled automatic recovery and USB-requested manual portal preservation'
 print(evidence['result'],flush=True)
except BaseException as error:
 evidence['result']='FAIL: '+str(error)
 raise
finally:
 with Path(args.output).open('x',encoding='utf-8') as output: output.write(json.dumps(evidence,indent=2))
 p.close()

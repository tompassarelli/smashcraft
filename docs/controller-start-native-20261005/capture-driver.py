import os,sys,time,subprocess,signal,json,fcntl,hashlib,re
from pathlib import Path
root=Path('/home/tom/code/wc3-melee/worktrees/editbox-pause-focus-20261005')
sys.path.insert(0,str(root/'tools'))
from controller_event_retention import VirtualGamepad,KernelObserver,EV_KEY,BTN_SOUTH
build=sys.argv[1];out=root/'build'/('native-'+sys.argv[2]);out.mkdir(exist_ok=False)
roots=[Path('/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData'),Path('/home/tom/.local/share/wc3-melee/client-b/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData')]
binary=root/'companion/target/debug/wc3-journal';xd='/nix/store/sappapmdp66dl0h5fqp1yw32121r2b5j-xdotool-3.20211022.1/bin/xdotool'
pad=None;observer=None;helpers=[];logs=[];recorder=None;record_log=None;events=[]
def until(predicate,reason,seconds=20):
 end=time.monotonic()+seconds
 while not predicate():
  if time.monotonic()>end:raise RuntimeError(reason)
  time.sleep(.05)
def at(t):
 remaining=(t-time.monotonic_ns())/1e9
 if remaining>0:time.sleep(remaining)
def start_button(producer):
 pad.send(EV_KEY,0x13b,1,producer,'pause-control','start-down')
 events.append({'event':'Start-down','monotonic_ns':time.monotonic_ns()})
 time.sleep(.12)
 pad.send(EV_KEY,0x13b,0,producer,'pause-control','start-up')
 events.append({'event':'Start-up','monotonic_ns':time.monotonic_ns()})
def helpers_state(state):
 return all(re.search('control sequence=\\d+ state='+state+' ',(out/f'{i}-helper.log').read_text()) for i in range(2))
try:
 started_wall=time.time_ns()
 until(lambda:all((r/f'smashcraft-journal-ready-{build}-e1-p{i}.txt').exists() and (r/f'smashcraft-journal-transport-ready-{build}-e1-p{i}.txt').exists() and 'received-mask=3 before-journal-reads=yes' in (r/f'smashcraft-journal-transport-ready-{build}-e1-p{i}.txt').read_text() for i,r in enumerate(roots)),'startup receipts absent')
 print('both clients ready',flush=True)
 record_log=(out/'record.log').open('w');record_run=Path('/run/user/1000/private-desktop.ua70lDgf')
 record_env=dict(os.environ,XDG_RUNTIME_DIR=str(record_run/'runtime'),WAYLAND_DISPLAY=(record_run/'wayland-display').read_text().strip())
 recorder=subprocess.Popen(['/run/current-system/sw/bin/wf-recorder','-f',str(out/'pause-native.mp4'),'-c','libx264','-p','preset=ultrafast','-p','threads=2','-r','30','-F','scale=1280:720'],env=record_env,stdout=record_log,stderr=record_log)
 pad=VirtualGamepad(buttons=(BTN_SOUTH,0x13b));buf=bytearray(80);fcntl.ioctl(pad.fd,(2<<30)|(80<<16)|(ord('U')<<8)|44,buf,True)
 name=buf.split(b'\0',1)[0].decode();devices=[p.name for p in (Path('/sys/devices/virtual/input')/name).iterdir() if p.name.startswith('event')];assert len(devices)==1
 device=Path('/dev/input')/devices[0];observer=KernelObserver(device,out/'kernel.jsonl');observer.start();epoch=time.monotonic_ns()+300_000_000
 for slot,r in enumerate(roots):
  log=(out/f'{slot}-helper.log').open('w');logs.append(log)
  helpers.append(subprocess.Popen([str(binary),'--device',str(device),'--out',str(r),'--ready-file',str(r/f'smashcraft-journal-ready-{build}-e1-p{slot}.txt'),'--epoch-monotonic-ns',str(epoch),'--stop-frame','600','--editbox-display',(':2' if slot==0 else ':1'),'--trace'],stdout=log,stderr=log))
 with (out/'producer.jsonl').open('w') as producer:
  at(epoch+300_000_000);pad.send(EV_KEY,BTN_SOUTH,1,producer,'before-pause','attack-down');time.sleep(.005);pad.send(EV_KEY,BTN_SOUTH,0,producer,'before-pause','attack-up')
  at(epoch+1_100_000_000);start_button(producer)
  until(lambda:helpers_state('PAUSE'),'pause barrier did not reach helpers')
  r=subprocess.run(['/run/user/1000/private-desktop.ua70lDgf/venv/bin/python','/tmp/sc-ui.py','a','wait','Paused'],capture_output=True,text=True)
  (out/'paused-ui.txt').write_text(r.stdout);assert r.returncode==0,'native paused status absent'
  events.append({'event':'native-paused','monotonic_ns':time.monotonic_ns()});print('native pause observed',flush=True)
  pad.send(EV_KEY,BTN_SOUTH,1,producer,'paused','attack-down');time.sleep(.005);pad.send(EV_KEY,BTN_SOUTH,0,producer,'paused','attack-up')
  time.sleep(.05);pad.send(EV_KEY,BTN_SOUTH,1,producer,'paused-held','attack-down');time.sleep(.3);start_button(producer);until(lambda:helpers_state('RESUME'),'resume did not reach helpers');time.sleep(.1);pad.send(EV_KEY,BTN_SOUTH,0,producer,'paused-held','attack-up')
  time.sleep(.3);pad.send(EV_KEY,BTN_SOUTH,1,producer,'after-resume','attack-down');time.sleep(.005);pad.send(EV_KEY,BTN_SOUTH,0,producer,'after-resume','attack-up')
  print('resumed, post-resume tap emitted',flush=True)
  codes=[p.wait(timeout=25) for p in helpers];assert codes==[0,0],codes
 metadata={'build':build,'epoch_monotonic_ns':epoch,'helper_sha256':hashlib.sha256(binary.read_bytes()).hexdigest(),'helper_exit_codes':codes,'events':events,'scope':'Two native clients, 600 original frames per player, 5ms taps before/during/after controller Start pause plus an attack held across resume; focused editbox remains input owner. Not physical latency or whole-window focus-loss acceptance.'}
 (out/'capture.json').write_text(json.dumps(metadata,indent=2)+'\n')
 for i,r in enumerate(roots):
  p=r/'wc3-melee-input-trace.txt';s=p.read_text();assert p.stat().st_mtime_ns>started_wall and f'start {build} ' in s and 'endfunction' in s
  (out/f'{i}-trace.txt').write_text(s)
  for p in r.glob(f'smashcraft-journal-*{build}*'):
   if p.suffix=='.txt':(out/f'{i}-{p.name}').write_bytes(p.read_bytes())
 print('helpers completed; initial native traces and control receipts retained',flush=True)
finally:
 for i,r in enumerate(roots):
  for source in list(r.glob(f'smashcraft-journal-*{build}*.txt'))+[r/'wc3-melee-input-trace.txt']:
   if source.is_file():(out/f'{i}-{source.name}').write_bytes(source.read_bytes())
 if recorder and recorder.poll() is None:recorder.send_signal(signal.SIGINT);recorder.wait(timeout=10)
 if record_log:record_log.close()
 for p in helpers:
  if p.poll() is None:p.send_signal(signal.SIGCONT);p.send_signal(signal.SIGINT)
  try:p.wait(timeout=3)
  except subprocess.TimeoutExpired:p.kill();p.wait(timeout=2)
 for log in logs:log.close()
 if observer:observer.close()
 if pad:pad.close()
 (out/'stimulus.json').write_text(json.dumps(events,indent=2)+'\n')
 print('helpers and recorder reaped; virtual pad closed',flush=True)

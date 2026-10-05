# Leave the current match and bring both signed-in clients into a fresh lobby game
# of MAP, at character selection (~112 s). Session-bound values to re-resolve
# before use: process IDs, window IDs, display numbers and store paths.
# Usage: python reload.py RUN_ID TRIAL_ID MAP.w3x  (needs tools/lobby/sc-ui.py at /tmp/sc-ui.py)
from pathlib import Path
import subprocess,os,time,shutil,hashlib,json,sys,re
py='/run/user/1000/private-desktop.ua70lDgf/venv/bin/python'
xd='/nix/store/sappapmdp66dl0h5fqp1yw32121r2b5j-xdotool-3.20211022.1/bin/xdotool'
roots=[Path('/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III'),Path('/home/tom/.local/share/wc3-melee/client-b/pfx/drive_c/users/steamuser/Documents/Warcraft III')]
private=Path('/home/tom/.local/share/smashcraft-build-inputs/input-integrity-delivery-20261005')
work=Path('/home/tom/code/smashcraft/worktrees/dev-console-20261005')
run=sys.argv[1]
assert all(c.isalnum() or c in '._-' for c in run)
source=Path(sys.argv[3]) if len(sys.argv) > 3 else private/'build'/(run+'.w3x')
assert source.is_file()
for pid in [1520922,1533110]:
 assert 'Warcraft' in Path(f'/proc/{pid}/comm').read_text()
trial=sys.argv[2]
out=work/'build'/('load-'+trial);out.mkdir(exist_ok=False)
def ui(c,op,*args):
 r=subprocess.run([py,'/tmp/sc-ui.py',c,op,*map(str,args)],capture_output=True,text=True)
 with (out/'ui.txt').open('a') as f:f.write(c+' '+op+' '+repr(args)+'\n'+r.stdout+'\n')
 if r.returncode:raise RuntimeError(r.stdout)
 print(c,op,*args,flush=True)
 return r.stdout
def keys(c,*args):
 env=dict(os.environ,DISPLAY=':2' if c=='a' else ':1',XAUTHORITY='')
 subprocess.run([xd,'windowactivate','--sync','77594625' if c=='a' else '77594625','windowraise','77594625' if c=='a' else '77594625',*args],env=env,check=True)
def wait_files(pattern,timeout):
 paths=[root/'CustomMapData'/pattern.format(slot=i) for i,root in enumerate(roots)]
 end=time.monotonic()+timeout
 while time.monotonic()<end:
  if all(p.exists() and 'endfunction' in p.read_text() for p in paths):
   for i,p in enumerate(paths):(out/f'{i}-{p.name}').write_text(p.read_text())
   return paths
  time.sleep(.2)
 raise RuntimeError('fresh boundary files missing: '+pattern)
for c in ['a','b']:
 keys(c,'key','Escape')
 for key,pat in [('F10','End Game'),('e','Quit Mission'),('q','MATCH RESULTS')]:
  keys(c,'key',key);ui(c,'wait',pat)
print('candidate sha256',hashlib.sha256(source.read_bytes()).hexdigest(),flush=True)
archive=private/'archive'/('before-'+trial);archive.mkdir(parents=True,exist_ok=False)
for slot,root in enumerate(roots):
 maps=root/'Maps/00-Smashcraft'
 olds=list(maps.glob('*.w3x'))
 assert len(olds)==1; old=olds[0]
 shutil.move(old,archive/(str(slot)+'-'+old.name))
 shutil.copyfile(source,maps/source.name)
 data=root/'CustomMapData'
 for owned in list(data.glob('smashcraft-journal-*'+run+'*'))+[data/'wc3-melee-input-trace.txt']:
  if owned.is_file():shutil.move(owned,archive/(str(slot)+'-'+owned.name))
for c in ['a','b']:ui(c,'click',155,1388);ui(c,'wait','Quick.*Filter|CREATE LOAD|CUSTOM GAMES')
ui('a','click',1510,1200);ui('a','wait','CREATE GAME')
ui('a','click',1190,365);ui('a','wait',re.escape(source.stem))
ui('a','click',400,335);keys('a','key','ctrl+a','type','--clearmodifiers','[TEST] '+run)
ui('a','wait',run.replace('-','.'))
ui('a','click',2195,1127);ui('a','wait','PLAYERS: 1/4')
ui('b','click',1470,195);keys('b','key','ctrl+a','type','--clearmodifiers',run)
ui('b','wait',r'\[TEST\]|ITEST|20261005');ui('b','click',680,385);ui('b','click',1295,1213)
ui('b','wait','PLAYERS: 2/4');ui('a','wait','PLAYERS: 2/4')
ui('a','click',2195,1127)
ui('a','wait','CONTROLS');ui('b','wait','CONTROLS')
print('Both clients at character selection; no helper running',flush=True)

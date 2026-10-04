from pathlib import Path
import time,os,signal,re,json
build="20261003T212333969582051"
roots=[Path("/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData"),Path("/home/tom/.local/share/wc3-melee/client-b/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData")]
pid=1912370
assert "Warcraft" in Path(f"/proc/{pid}/comm").read_text()
starttime=Path(f"/proc/{pid}/stat").read_text().split(") ",1)[1].split()[19]
rows=[];seen=set();signals=[];stopped_at=None;resumed=False;deadline=time.monotonic()+240
last_scan=time.monotonic_ns()
def stopped(): return re.search(r"^State:\s+T",Path(f"/proc/{pid}/status").read_text(),re.M) is not None
try:
 while time.monotonic()<deadline:
  before=time.monotonic_ns()
  for slot,root in enumerate(roots):
   for seq in range(51):
    key=(slot,seq)
    if key in seen:continue
    name=f"smashcraft-native-clock-progress-{build}-p{slot}-"+("ready" if seq==0 else f"{seq:06}")+".txt"
    p=root/name
    if not p.exists():continue
    text=p.read_text();after=time.monotonic_ns()
    if "endfunction" not in text:continue
    assert build in text and f"slot={slot}" in text
    rows.append(dict(slot=slot,sequence=seq,first_observed_ns=after,previous_scan_ns=last_scan,read_begin_ns=before,text=text));seen.add(key)
  if stopped_at is None and (0,10) in seen and (1,10) in seen:
   assert Path(f"/proc/{pid}/stat").read_text().split(") ",1)[1].split()[19]==starttime
   os.kill(pid,signal.SIGSTOP);signals.append(dict(action="stop_request",ns=time.monotonic_ns()))
   stopdeadline=time.monotonic()+1
   while not stopped():
    if time.monotonic()>stopdeadline:raise RuntimeError("stop not observed")
    time.sleep(.001)
   stopped_at=time.monotonic_ns();signals.append(dict(action="stop_observed",ns=stopped_at))
  if stopped_at is not None and not resumed and time.monotonic_ns()-stopped_at>=250000000:
   os.kill(pid,signal.SIGCONT);signals.append(dict(action="resume_request",ns=time.monotonic_ns()));resumed=True
  if (0,50) in seen and (1,50) in seen:break
  last_scan=before;time.sleep(.002)
 else:raise RuntimeError("marker timeout")
finally:
 if stopped_at is not None and not resumed:
  os.kill(pid,signal.SIGCONT);signals.append(dict(action="finally_resume",ns=time.monotonic_ns()))
 Path(__file__).with_name("observation.json").write_text(json.dumps(dict(build=build,rows=rows,signals=signals,scope="host observations bracket file visibility, not exact native callback time; compare intervals within each native clock only"),indent=2))
print(f"observed {len(rows)} receipts; signals={signals}")

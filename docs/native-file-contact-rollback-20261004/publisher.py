from pathlib import Path
import os, signal, re, sys, time, json
build=sys.argv[1];assert re.fullmatch(r"[0-9]{8}T[0-9]{15}",build)
roots=[Path("/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData"),Path("/home/tom/.local/share/wc3-melee/client-b/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData")]
# The Wurst probe exposes a build-specific ready receipt after speculative F8.
# Filename/header strings are filled from the frozen candidate contract.
ready_name=sys.argv[2];ready_header=sys.argv[3]
ready=[];deadline=time.monotonic()+300
for slot,root in enumerate(roots):
    p=root/ready_name.replace("SLOT",str(slot))
    while not p.exists():
        if time.monotonic()>deadline:raise RuntimeError("ready timeout")
        time.sleep(.01)
    text=p.read_text();assert ready_header in text and build in text;ready.append(text)
assert "Warcraft" in Path("/proc/1912370/comm").read_text()
def stopped():return re.search(r"^State:\s+T",Path("/proc/1912370/status").read_text(),re.M) is not None
signals=[];records=[]
try:
    os.kill(1912370,signal.SIGSTOP);signals.append(dict(action="stop_request",ns=time.monotonic_ns()))
    d=time.monotonic()+1
    while not stopped():
        if time.monotonic()>d:raise RuntimeError("stop not observed")
        time.sleep(.001)
    observed=time.monotonic_ns();signals.append(dict(action="stop_observed",ns=observed))
    for frame in range(1,9):
        elapsed_ns=(frame-1)*16666667+8000000
        expected_frame=1+elapsed_ns*60//1000000000;assert expected_frame==frame
        state=1 if frame in (5,6) else 0
        wire=f"V1|{frame:06}|{elapsed_ns//1000:06}|{expected_frame:06}|{state};"
        filename=sys.argv[4].replace("SEQ",f"{frame:06}")
        target=roots[1]/filename;tmp=target.with_suffix(".pending")
        with tmp.open("x") as f:
            f.write("function PreloadFiles takes nothing returns nothing\ncall BlzSetAbilityTooltip('$wsl', \""+wire+"\", 0)\nendfunction\n");f.flush();os.fsync(f.fileno())
        before=time.monotonic_ns();os.link(tmp,target);after=time.monotonic_ns();tmp.unlink();assert stopped()
        records.append(dict(elapsed_ns=elapsed_ns,expected_frame=expected_frame,wire=wire,publish_before_ns=before,publish_after_ns=after,stopped=True))
    while time.monotonic_ns()<observed+250000000:time.sleep(.001)
finally:
    os.kill(1912370,signal.SIGCONT);signals.append(dict(action="resume_request",ns=time.monotonic_ns()))
Path(__file__).with_name("publication.json").write_text(json.dumps(dict(build=build,ready=ready,records=records,signals=signals,scope="externally authored F1-F8 corpus; original F5 shield after speculative F8; host stop does not equal four-frame delay"),indent=2))
print("eight exact corpus rows atomically published while B stopped; resumed",flush=True)

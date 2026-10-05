from pathlib import Path
import time, os, signal, sys, json, re
build=sys.argv[1]
assert re.fullmatch(r"[0-9]{8}T[0-9]{15}",build)
roots=[Path("/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData"),Path("/home/tom/.local/share/wc3-melee/client-b/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData")]
records=[];signals=[];ready=[];deadline=time.monotonic()+300
for slot,root in enumerate(roots):
    p=root/f"smashcraft-live-ingress-{build}-p{slot}-ready.txt"
    while not p.exists():
        if time.monotonic()>deadline:raise RuntimeError("ready wait expired")
        time.sleep(.01)
    text=p.read_text()
    assert f"LIVE_INGRESS_READY v=1 build={build} version=0.0.15 slot={slot} " in text
    ready.append(text)
assert "Warcraft" in Path("/proc/2069007/comm").read_text()
def stopped():
    return re.search(r"^State:\s+T",Path("/proc/2069007/status").read_text(),re.M) is not None
E=time.monotonic_ns()
def wait_ns(offset):
    while (left:=E+offset-time.monotonic_ns())>0:time.sleep(min(left/1e9,.002))
def publish(index,state,offset):
    wait_ns(offset);capture=time.monotonic_ns();elapsed=capture-E
    assert 0<=elapsed//1000<=999999
    frame=1+elapsed*60//1000000000
    wire=f"V1|{index:06}|{elapsed//1000:06}|{frame:06}|{state};"
    pubs=[]
    for root in roots:
        target=root/f"smashcraft-live-ingress-{build}-{index:06}.pld"
        tmp=target.with_suffix(".pending")
        with tmp.open("x") as f:
            f.write("function PreloadFiles takes nothing returns nothing\ncall BlzSetAbilityTooltip('$wsl', \""+wire+"\", 0)\nendfunction\n");f.flush();os.fsync(f.fileno())
        before=time.monotonic_ns();os.link(tmp,target);after=time.monotonic_ns();tmp.unlink();pubs.append([before,after])
    records.append(dict(id=index,capture_ns=capture,elapsed_ns=elapsed,expected_frame=frame,wire=wire,publication_brackets_ns=pubs,stopped=stopped()))
try:
    for i,(state,offset) in enumerate([(1,20000000),(0,70000000),(1,120000000),(0,170000000)],1):publish(i,state,offset)
    wait_ns(220000000);os.kill(2069007,signal.SIGSTOP)
    signals.append(dict(action="stop_request",ns=time.monotonic_ns()))
    stop_deadline=time.monotonic()+1
    while not stopped():
        if time.monotonic()>stop_deadline:raise RuntimeError("stop not observed")
        time.sleep(.001)
    observed=time.monotonic_ns();signals.append(dict(action="stop_observed",ns=observed))
    publish(5,1,280000000);publish(6,0,350000000)
    assert stopped()
    while time.monotonic_ns()<observed+250000000:time.sleep(.001)
finally:
    os.kill(2069007,signal.SIGCONT);signals.append(dict(action="resume_request",ns=time.monotonic_ns()))
for i,(state,offset) in enumerate([(1,550000000),(0,600000000),(1,700000000),(0,750000000)],7):publish(i,state,offset)
Path(__file__).with_name("producer.json").write_text(json.dumps(dict(build=build,epoch_ns=E,ready=ready,records=records,signals=signals,oracle="frame=1+floor((capture_ns-E)*60/1e9); D=0; half-open intervals; serialized us truncates but frame uses ns"),indent=2))
print("published ten live synthetic records; verified stopped pair retained in producer evidence",flush=True)

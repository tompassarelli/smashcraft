"""OS-only publication of Wurst-validated wires; no input encoding or frame assignment."""
from pathlib import Path
import json
import os
import re
import sys
import time

build = sys.argv[1]
epoch = int(sys.argv[2])
assert re.fullmatch(r"[0-9]{8}T[0-9]{15}", build)
roots = [
    Path("/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData"),
    Path("/home/tom/.local/share/wc3-melee/client-b/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData"),
]
corpus = Path(sys.argv[3])
rows = {}
for line in corpus.read_text().splitlines():
    label, e, s, f, wire = line.split()
    assert label == "JOURNAL_CORPUS"
    if int(e) == epoch:
        key = (int(s), int(f))
        assert key not in rows and re.fullmatch(r"[A-Za-z0-9_-]+", wire)
        rows[key] = wire
assert len(rows) == 1200
deadline = time.monotonic() + 120
ready = []
for slot, root in enumerate(roots):
    receipt = root / f"smashcraft-journal-ready-{build}-e{epoch}-p{slot}.txt"
    while not receipt.exists():
        if time.monotonic() > deadline:
            raise RuntimeError(f"match-ready timeout slot {slot}")
        time.sleep(.01)
    content = receipt.read_text()
    assert f"SMASHCRAFT JOURNAL v=1 build={build} epoch={epoch} slot={slot}" in content
    assert "delay=0" in content
    ready.append(content)
records = []
origin = time.monotonic_ns()
for frame in range(1, 601):
    # Deliberately authored 60 Hz playback, not physical capture or clock calibration.
    target_ns = origin + (frame - 1) * 1_000_000_000 // 60
    remaining = target_ns - time.monotonic_ns()
    if remaining > 0:
        time.sleep(remaining / 1_000_000_000)
    for slot, root in enumerate(roots):
        wire = rows[(slot, frame)]
        target = root / f"smashcraft-journal-{build}-e{epoch}-s{slot}-n{frame}.pld"
        temporary = target.with_suffix(".pending")
        with temporary.open("x") as stream:
            stream.write("function PreloadFiles takes nothing returns nothing\n"
                         "call BlzSetAbilityTooltip('$wsl', \"" + wire + "\", 0)\n"
                         "endfunction\n")
            stream.flush()
            os.fsync(stream.fileno())
        before = time.monotonic_ns()
        os.link(temporary, target)
        after = time.monotonic_ns()
        temporary.unlink()
        records.append(dict(slot=slot, frame=frame, wire=wire,
                            target_ns=target_ns, publish_before_ns=before, publish_after_ns=after))
Path(__file__).with_name(f"publication-e{epoch}.json").write_text(json.dumps(
    dict(build=build, epoch=epoch, ready=ready, origin_ns=origin, records=records,
         scope="scripted canonical corpus; host publication brackets only; no physical capture"), indent=2))
print("Published 600 immutable canonical rows per client", flush=True)

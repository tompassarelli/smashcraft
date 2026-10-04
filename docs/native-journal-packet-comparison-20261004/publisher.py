"""Publish existing Wurst-validated canonical input files; measure only OS publication timing."""
from pathlib import Path
import json
import os
import re
import sys
import time

build, epoch_arg, count_arg, corpus_arg, output_arg = sys.argv[1:]
epoch, count = int(epoch_arg), int(count_arg)
assert re.fullmatch(r"[A-Za-z0-9._-]{1,80}", build) and count in (1, 2)
roots = [
    Path("/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData"),
    Path("/home/tom/.local/share/wc3-melee/client-b/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData"),
]
rows = {}
for line in Path(corpus_arg).read_text().splitlines():
    label, e, s, f, wire = line.split()
    assert label == ("JOURNAL_CORPUS" if count == 1 else "JOURNAL_PAIR")
    if int(e) == epoch:
        key = (int(s), int(f))
        assert key not in rows and re.fullmatch(r"[A-Za-z0-9_-]+", wire)
        rows[key] = wire
assert len(rows) == 1200 // count
for slot, root in enumerate(roots):
    receipt = root / f"smashcraft-journal-ready-{build}-e{epoch}-p{slot}.txt"
    content = receipt.read_text()
    assert f"SMASHCRAFT JOURNAL v=1 build={build} epoch={epoch} slot={slot}" in content
    assert "delay=0" in content
    for frame in range(1, 601, count):
        assert (slot, frame) in rows
        assert not (root / f"smashcraft-journal-{build}-e{epoch}-s{slot}-n{frame}.pld").exists()
records = []
origin = time.monotonic_ns()
try:
    for frame in range(1, 601, count):
        # A pair becomes available at its last row's authored capture time.
        # This includes the intentional one-frame pairing wait.
        target_ns = origin + (frame + count - 2) * 1_000_000_000 // 60
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
            records.append(dict(slot=slot, first_frame=frame, records=count,
                                target_ns=target_ns, publish_before_ns=before,
                                publish_after_ns=after, wire=wire))
finally:
    Path(output_arg).write_text(json.dumps(dict(
        build=build, epoch=epoch, records_per_packet=count, origin_ns=origin,
        records=records, scope="host publication brackets; authored 60 Hz rows; not physical capture"), indent=2))
print(f"Published {len(records)} immutable packets, {count} records each", flush=True)

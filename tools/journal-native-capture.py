#!/usr/bin/env python3
"""Feed two retained native clients through the real evdev companion boundary."""

import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time

from controller_event_retention import (
    ABS_X, BTN_SOUTH, EV_ABS, EV_KEY, KernelObserver, VirtualGamepad, wait_state,
)


def event_path(pad):
    buffer = bytearray(80)
    fcntl.ioctl(pad.fd, (2 << 30) | (80 << 16) | (ord("U") << 8) | 44, buffer, True)
    name = buffer.split(b"\0", 1)[0].decode()
    paths = [p.name for p in (Path("/sys/devices/virtual/input") / name).iterdir()
             if p.name.startswith("event") and p.name[5:].isdigit()]
    if len(paths) != 1:
        raise RuntimeError(f"unexpected interfaces on {name}: {paths}")
    return Path("/dev/input") / paths[0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--binary", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--build", required=True)
    parser.add_argument("--epoch", type=int, default=1)
    parser.add_argument("--first-frame", type=int, default=1)
    parser.add_argument("--frames", type=int, default=600)
    parser.add_argument("--client-b-pid", type=int, required=True)
    args = parser.parse_args()
    if args.frames < 400 or args.first_frame < 1:
        raise ValueError("the authored fight needs >=400 frames and a positive first frame")
    args.out.mkdir(parents=True, exist_ok=False)
    roots = [
        Path("/home/tom/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData"),
        Path("/home/tom/.local/share/wc3-melee/client-b/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData"),
    ]
    for slot, root in enumerate(roots):
        ready = root / f"smashcraft-journal-ready-{args.build}-e{args.epoch}-p{slot}.txt"
        assert f"build={args.build} epoch={args.epoch} slot={slot}" in ready.read_text()
        assert not (root / f"smashcraft-journal-{args.build}-e{args.epoch}-s{slot}-n{args.first_frame}.pld").exists()
    assert "Warcraft" in Path(f"/proc/{args.client_b_pid}/comm").read_text()
    pads, observers, helpers, streams = [], [], [], []
    paused_game = False
    events = []
    try:
        pads = [VirtualGamepad(), VirtualGamepad()]
        devices = [event_path(pad) for pad in pads]
        epoch = time.monotonic_ns() + 300_000_000
        for slot, (device, root) in enumerate(zip(devices, roots)):
            observer = KernelObserver(device, args.out / f"kernel-{slot}.jsonl")
            observer.start()
            observers.append(observer)
            stdout = (args.out / f"helper-{slot}.tsv").open("w")
            stderr = (args.out / f"helper-{slot}.stderr.txt").open("w")
            streams.extend([stdout, stderr])
            helpers.append(subprocess.Popen([
                str(args.binary.resolve()), "--device", str(device), "--out", str(root),
                "--ready-file", str(root / f"smashcraft-journal-ready-{args.build}-e{args.epoch}-p{slot}.txt"),
                "--epoch-monotonic-ns", str(epoch), "--first-frame", str(args.first_frame),
                "--stop-frame", str(args.first_frame + args.frames - 1), "--trace",
            ], stdout=stdout, stderr=stderr))
        # Values are authored device stimuli. Frame identity is assigned only
        # by the companion from the kernel timestamp, never by this producer.
        schedule = []
        for slot in range(2):
            schedule += [(5_000_000, "axis", slot, 32767 if slot == 0 else -32768),
                         (650_000_000, "axis", slot, 0)]
            for tap in range(9):
                at = 1_000_000_000 + tap * 250_000_000 + slot * 50_000_000
                schedule += [(at, "button", slot, 1), (at + 20_000_000, "button", slot, 0)]
            schedule += [(4_200_000_000, "axis", slot, -32768 if slot == 0 else 32767),
                         (8_000_000_000, "axis", slot, 0)]
        schedule += [(1_500_000_000, "stop-helper", 1, 0),
                     (1_750_000_000, "resume-helper", 1, 0),
                     (3_000_000_000, "stop-game", 1, 0),
                     (3_050_000_000, "button", 1, 1),
                     (3_130_000_000, "button", 1, 0),
                     (3_250_000_000, "resume-game", 1, 0)]
        with (args.out / "producer.jsonl").open("w") as producer:
            for at, action, slot, value in sorted(schedule):
                target = epoch + at
                remaining = target - time.monotonic_ns()
                if remaining > 0:
                    time.sleep(remaining / 1e9)
                if action in ("axis", "button"):
                    pads[slot].send(EV_ABS if action == "axis" else EV_KEY,
                                    ABS_X if action == "axis" else BTN_SOUTH, value,
                                    producer, "native-capture", f"{slot}:{action}:{value}")
                else:
                    pid = helpers[slot].pid if action.endswith("helper") else args.client_b_pid
                    stopping = action.startswith("stop")
                    os.kill(pid, signal.SIGSTOP if stopping else signal.SIGCONT)
                    if action.endswith("game"):
                        paused_game = stopping
                    state = wait_state(pid, {"T", "t"} if stopping else {"R", "S", "D"})
                    events.append(dict(action=action, pid=pid, state=state,
                                       observed_monotonic_ns=time.monotonic_ns()))
            codes = [helper.wait(timeout=5) for helper in helpers]
        if codes != [0, 0]:
            raise RuntimeError(f"companion exits {codes}; see exact helper stderr")
        for observer in observers:
            observer.close()
        observers.clear()
        summary = dict(build=args.build, epoch=args.epoch, capture_epoch_monotonic_ns=epoch,
                       first_frame=args.first_frame, frames=args.frames, helper_exit_codes=codes,
                       binary_sha256=hashlib.sha256(args.binary.read_bytes()).hexdigest(),
                       controlled_stops=events,
                       scope="two virtual devices; actual companion and native file ingress; one shared Linux host clock; not physical-controller or remote clock-alignment proof")
        (args.out / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
        print(json.dumps(summary))
    finally:
        if paused_game:
            os.kill(args.client_b_pid, signal.SIGCONT)
        for helper in helpers:
            if helper.poll() is None:
                helper.send_signal(signal.SIGCONT)
                helper.terminate()
                helper.wait(timeout=3)
        for observer in observers:
            observer.close()
        for stream in streams:
            stream.close()
        for pad in pads:
            pad.close()


if __name__ == "__main__":
    main()

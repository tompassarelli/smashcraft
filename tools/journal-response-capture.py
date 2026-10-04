#!/usr/bin/env python3
"""Native I/O boundary: evdev shield stimulus and timed compositor capture.

Run in a fresh, already-started two-client match with editbox input focused.
The existing responsiveness analyzer consumes actions.json and the NUT files.
Physical controller electronics and display scanout are outside this capture.
"""

import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import random
import re
import signal
import subprocess
import time

from controller_event_retention import ABS_Z, EV_ABS, KernelObserver, VirtualGamepad


def event_path(pad):
    buffer = bytearray(80)
    fcntl.ioctl(pad.fd, (2 << 30) | (80 << 16) | (ord("U") << 8) | 44, buffer, True)
    name = buffer.split(b"\0", 1)[0].decode()
    paths = [p.name for p in (Path("/sys/devices/virtual/input") / name).iterdir()
             if p.name.startswith("event") and p.name[5:].isdigit()]
    if len(paths) != 1:
        raise RuntimeError(f"unexpected event interfaces on {name}: {paths}")
    return Path("/dev/input") / paths[0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--build", required=True)
    parser.add_argument("--epoch", type=int, default=1)
    parser.add_argument("--actor", choices=["a", "b"], required=True)
    parser.add_argument("--private-a", type=Path, required=True)
    parser.add_argument("--private-b", type=Path, required=True)
    parser.add_argument("--data-a", type=Path, required=True)
    parser.add_argument("--data-b", type=Path, required=True)
    parser.add_argument("--trials", type=int, default=12)
    parser.add_argument("--geometry", default="600,450 1360x550")
    args = parser.parse_args()
    if not 1 <= args.trials <= 32 or args.epoch < 1:
        raise ValueError("requires 1–32 trials and a positive match epoch")
    if not re.fullmatch(r"[a-z0-9-]+", args.build):
        raise ValueError("invalid build identifier")
    if not re.fullmatch(r"\d+,\d+ \d+x\d+", args.geometry):
        raise ValueError("invalid capture geometry")
    args.out.mkdir(parents=True, exist_ok=False)
    roots = [args.data_a, args.data_b]
    runs = [args.private_a, args.private_b]
    actor = 0 if args.actor == "a" else 1
    pads, observers, helpers, recorders, streams = [], [], [], [], []
    actions, failures = [], []
    capture_epoch = None
    stop_frame = None
    started = time.monotonic_ns()
    started_wall = time.time_ns()

    def wait_until(predicate, reason, seconds=20):
        deadline = time.monotonic() + seconds
        while not predicate():
            if time.monotonic() >= deadline:
                raise RuntimeError(reason)
            time.sleep(.02)

    try:
        for slot, (root, run) in enumerate(zip(roots, runs)):
            ready = root / f"smashcraft-journal-ready-{args.build}-e{args.epoch}-p{slot}.txt"
            transport = root / f"smashcraft-journal-transport-ready-{args.build}-e{args.epoch}-p{slot}.txt"
            wait_until(lambda: ready.exists() and transport.exists(), "native readiness absent")
            if f"build={args.build} epoch={args.epoch} slot={slot}" not in ready.read_text():
                raise RuntimeError("native identity mismatch")
            if "received-mask=3 before-journal-reads=yes" not in transport.read_text():
                raise RuntimeError("two-client transport preflight absent")
            env = dict(os.environ, DISPLAY=(run / "display").read_text().strip(),
                       XAUTHORITY=(run / "xauthority").read_text().strip())
            title = subprocess.check_output(
                ["xdotool", "getactivewindow", "getwindowname"], env=env, text=True).strip()
            if title != "Warcraft III":
                raise RuntimeError(f"client {slot} is not focused")
            log = (args.out / f"{'ab'[slot]}-wayland.log").open("w")
            streams.append(log)
            capture_env = dict(env, XDG_RUNTIME_DIR=str(run / "runtime"),
                               WAYLAND_DISPLAY=(run / "wayland-display").read_text().strip(),
                               WAYLAND_DEBUG="1")
            recorders.append(subprocess.Popen([
                "wf-recorder", "--no-damage", "--geometry", args.geometry,
                "--codec", "ffv1", "-p", "threads=1", "--pixel-format", "bgr0",
                "--muxer", "nut", "--file", str(args.out / f"{'ab'[slot]}.nut"),
            ], env=capture_env, stdout=log, stderr=log))
        for slot in range(2):
            log = args.out / f"{'ab'[slot]}-wayland.log"
            wait_until(lambda: ".ready(" in log.read_text(), "compositor did not produce a frame")
        pads = [VirtualGamepad(), VirtualGamepad()]
        devices = [event_path(pad) for pad in pads]
        schedule = []
        rng = random.Random(20261005)
        elapsed = .8
        for trial in range(args.trials):
            elapsed += rng.uniform(.7, 1.0)
            schedule.extend([(elapsed, trial, 32767), (elapsed + .25, trial, 0)])
            elapsed += .25
        stop_frame = int((elapsed + 1.5) * 60) + 1
        capture_epoch = time.monotonic_ns() + 300_000_000
        for slot, (device, root, run) in enumerate(zip(devices, roots, runs)):
            observer = KernelObserver(device, args.out / f"kernel-{slot}.jsonl")
            observer.start()
            observers.append(observer)
            log = (args.out / f"helper-{slot}.log").open("w")
            streams.append(log)
            helpers.append(subprocess.Popen([
                str(args.binary.resolve()), "--device", str(device), "--out", str(root),
                "--ready-file", str(root / f"smashcraft-journal-ready-{args.build}-e{args.epoch}-p{slot}.txt"),
                "--epoch-monotonic-ns", str(capture_epoch), "--stop-frame", str(stop_frame),
                "--editbox-display", (run / "display").read_text().strip(), "--trace",
            ], env=dict(os.environ, XAUTHORITY=(run / "xauthority").read_text().strip()),
                stdout=log, stderr=log))
        with (args.out / "producer.jsonl").open("w") as producer:
            for elapsed, trial, value in schedule:
                target = capture_epoch + round(elapsed * 1e9)
                time.sleep(max(0, (target - time.monotonic_ns()) / 1e9))
                if any(helper.poll() is not None for helper in helpers):
                    raise RuntimeError("helper exited before stimulus ended")
                before = time.monotonic_ns()
                pads[actor].send(EV_ABS, ABS_Z, value, producer, "visible-response", f"{trial}:{value}")
                actions.append(dict(trial=trial, edge="press" if value else "release",
                                    start_monotonic_ns=before, end_monotonic_ns=time.monotonic_ns()))
                if not value:
                    print(f"shield trial {trial + 1}/{args.trials} emitted", flush=True)
        codes = [helper.wait(timeout=15) for helper in helpers]
        if codes != [0, 0]:
            raise RuntimeError(f"helper exit codes {codes}")
        for slot, root in enumerate(roots):
            failure = root / f"smashcraft-journal-failure-{args.build}-e{args.epoch}-p{slot}.txt"
            if failure.exists() and failure.stat().st_mtime_ns >= started_wall:
                (args.out / f"failure-{slot}.txt").write_bytes(failure.read_bytes())
                raise RuntimeError(f"client {slot} rejected controller input")
    except BaseException as error:
        failures.append(repr(error))
        raise
    finally:
        for helper in helpers:
            if helper.poll() is None:
                helper.send_signal(signal.SIGINT)
            try:
                helper.wait(timeout=3)
            except subprocess.TimeoutExpired:
                helper.kill()
                helper.wait()
                failures.append("helper required forced termination")
        for recorder in recorders:
            if recorder.poll() is None:
                recorder.send_signal(signal.SIGINT)
            try:
                if recorder.wait(timeout=10):
                    failures.append("recorder returned nonzero")
            except subprocess.TimeoutExpired:
                recorder.kill()
                recorder.wait()
                failures.append("recorder required forced termination")
        for observer in observers:
            observer.close()
        for pad in pads:
            pad.close()
        for stream in streams:
            stream.close()
        metadata = vars(args).copy()
        metadata["key"] = "q"  # Existing analyzer's shield-action identifier.
        (args.out / "actions.json").write_text(json.dumps(dict(
            args=metadata, actions=actions, failures=failures, begin_monotonic_ns=started,
            capture_epoch_monotonic_ns=capture_epoch, stop_frame=stop_frame,
            helper_sha256=hashlib.sha256(args.binary.read_bytes()).hexdigest(),
            limits=["Linux virtual evdev shield trigger, not physical hardware.",
                    "Compositor ready timestamps share the producer's host monotonic clock.",
                    "Physical scanout, separate-machine clocks and human perception are unmeasured."],
        ), default=str, indent=2) + "\n")
    print(str(args.out), flush=True)


if __name__ == "__main__":
    main()

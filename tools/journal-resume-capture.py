#!/usr/bin/env python3
"""Native evdev/control-file boundary: hold helper B across a resume publication.

Consumes the retained native-session arguments from journal-focus-capture.py.
Start both clients at stage selection; the driver starts the trace and match.
The observed kernel timestamps and native control-file metadata form the oracle.
"""

import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time

from controller_event_retention import BTN_SOUTH, EV_KEY, KernelObserver, VirtualGamepad


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--session", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--ui-driver", type=Path, default=Path("/tmp/sc-ui.py"))
    args = parser.parse_args()
    settings = json.loads(args.session.read_text())["args"]
    args.out.mkdir(parents=True, exist_ok=False)
    roots = [Path(settings["data_" + slot]) for slot in "ab"]
    runs = [Path(settings["private_" + slot]) for slot in "ab"]
    build = settings["build"]
    environments = [dict(os.environ, DISPLAY=(run / "display").read_text().strip(),
                         XAUTHORITY=(run / "xauthority").read_text().strip(),
                         XDG_RUNTIME_DIR=str(run / "runtime"),
                         WAYLAND_DISPLAY=(run / "wayland-display").read_text().strip())
                    for run in runs]
    helpers, streams, observations = [], [], []
    pad = observer = None
    started_wall = time.time_ns()

    def until(predicate, why, timeout=25):
        deadline = time.monotonic() + timeout
        while not predicate():
            failed = [(i, p.returncode) for i, p in enumerate(helpers)
                      if p.poll() is not None and p.returncode != 0]
            if failed:
                raise RuntimeError(f"helper failed: {failed}")
            if time.monotonic() > deadline:
                raise RuntimeError(why)
            time.sleep(.005)

    def at(timestamp):
        remaining = (timestamp - time.monotonic_ns()) / 1e9
        if remaining > 0:
            time.sleep(remaining)

    def controls(state):
        return all(re.search(r"control sequence=\d+ state=" + state + " ",
                             (args.out / f"helper-{i}.log").read_text()) for i in range(2))

    def command(slot, sequence):
        return roots[slot] / f"smashcraft-journal-control-{build}-e1-s{slot}-n{sequence}.txt"

    def complete(path):
        return path.exists() and path.read_text().rstrip().endswith("endfunction")

    def stamp(path):
        before = time.monotonic_ns()
        realtime = time.time_ns()
        after = time.monotonic_ns()
        metadata = path.stat()
        return dict(path=str(path), mtime_realtime_ns=metadata.st_mtime_ns,
                    sample_monotonic_before_ns=before, sample_realtime_ns=realtime,
                    sample_monotonic_after_ns=after,
                    publication_monotonic_estimate_ns=metadata.st_mtime_ns - realtime
                    + (before + after) // 2,
                    contents=path.read_text())

    try:
        for slot, key in enumerate("ab"):
            if "Warcraft" not in Path(f'/proc/{settings["pid_" + key]}/comm').read_text():
                raise RuntimeError("retained client is absent")
            subprocess.run([settings["wlrctl"], "toplevel", "focus", "title:Warcraft III"],
                           env=environments[slot], check=True, timeout=5)
        subprocess.run(["xdotool", "windowactivate", "--sync", str(settings["window_a"]),
                        "key", "ctrl+g", "key", "y"], env=environments[0], check=True, timeout=5)
        for slot, root in enumerate(roots):
            ready = root / f"smashcraft-journal-ready-{build}-e1-p{slot}.txt"
            until(lambda: complete(ready), "native startup absent")

        pad = VirtualGamepad(buttons=(BTN_SOUTH, 0x13b))
        value = bytearray(80)
        fcntl.ioctl(pad.fd, (2 << 30) | (80 << 16) | (ord("U") << 8) | 44, value, True)
        device_name = value.split(b"\0", 1)[0].decode()
        paths = [p.name for p in (Path("/sys/devices/virtual/input") / device_name).iterdir()
                 if p.name.startswith("event")]
        if len(paths) != 1:
            raise RuntimeError(f"unexpected controller interfaces: {paths}")
        device = Path("/dev/input") / paths[0]
        observer = KernelObserver(device, args.out / "kernel.jsonl")
        observer.start()
        epoch = time.monotonic_ns() + 300_000_000
        for slot, key in enumerate("ab"):
            stream = (args.out / f"helper-{slot}.log").open("w")
            streams.append(stream)
            helpers.append(subprocess.Popen([
                settings["binary"], "--device", str(device), "--out", str(roots[slot]),
                "--ready-file", str(roots[slot] / f"smashcraft-journal-ready-{build}-e1-p{slot}.txt"),
                "--epoch-monotonic-ns", str(epoch), "--stop-frame", "600", "--trace",
                "--editbox-display", environments[slot]["DISPLAY"],
                "--x11-window", str(settings["window_" + key]), "--pid", str(settings["pid_" + key]),
                "--private-wlr-app-id", settings["app_id_" + key],
            ], env=environments[slot], stdout=stream, stderr=stream))

        with (args.out / "producer.jsonl").open("w") as producer:
            def send(code, state, label):
                pad.send(EV_KEY, code, state, producer, label, "down" if state else "up")

            def tap(code, label, seconds=.005):
                send(code, 1, label)
                time.sleep(seconds)
                send(code, 0, label)

            at(epoch + 300_000_000)
            tap(BTN_SOUTH, "before-pause")
            at(epoch + 1_100_000_000)
            tap(0x13b, "pause", .12)
            until(lambda: controls("PAUSE"), "pause commit absent")
            paused_ui = subprocess.run([sys.executable, str(args.ui_driver), "a", "wait", "Paused"],
                                       capture_output=True, text=True, timeout=30)
            (args.out / "paused-ui.txt").write_text(paused_ui.stdout)
            paused_ui.check_returncode()
            tap(BTN_SOUTH, "while-paused")
            send(BTN_SOUTH, 1, "held-through-resume")
            helpers[1].send_signal(signal.SIGSTOP)
            until(lambda: "State:\tT" in Path(f"/proc/{helpers[1].pid}/status").read_text(),
                  "helper B was not stopped")
            observations.append(dict(event="helper-b-stopped", monotonic_ns=time.monotonic_ns()))
            tap(0x13b, "resume", .12)
            until(lambda: all(complete(command(slot, 3)) for slot in range(2)),
                  "native resume publication absent")
            publications = [stamp(command(slot, 3)) for slot in range(2)]
            (args.out / "resume-publications.json").write_text(json.dumps(publications, indent=2) + "\n")
            for publication in publications:
                if "state=RESUME " not in publication["contents"]:
                    raise RuntimeError("unexpected resume sequence")
            boundary = max(p["publication_monotonic_estimate_ns"] for p in publications)
            at(boundary + 80_000_000)
            send(BTN_SOUTH, 0, "held-through-resume")
            at(boundary + 210_000_000)
            tap(BTN_SOUTH, "fresh-while-helper-stopped")
            at(boundary + 360_000_000)
            observations.append(dict(event="helper-b-continued", monotonic_ns=time.monotonic_ns()))
            helpers[1].send_signal(signal.SIGCONT)
            until(lambda: controls("RESUME"), "helpers did not resume")
            at(boundary + 850_000_000)
            tap(BTN_SOUTH, "fresh-after-recovery")
            print("Resume publications and delayed-helper stimulus captured", flush=True)
            for slot, root in enumerate(roots):
                transport = root / f"smashcraft-journal-transport-ready-{build}-e1-p{slot}.txt"
                until(lambda: complete(transport), "helper readiness was not synchronized")
                if "received-mask=3 before-journal-reads=yes" not in transport.read_text():
                    raise RuntimeError("two-client startup not accepted")
            codes = [p.wait(timeout=30) for p in helpers]
            if codes != [0, 0]:
                raise RuntimeError(f"helper exit codes: {codes}")

        metadata = dict(settings=settings, capture_epoch_monotonic_ns=epoch,
                        helper_sha256=hashlib.sha256(Path(settings["binary"]).read_bytes()).hexdigest(),
                        helper_exit_codes=codes, observations=observations,
                        resume_publications=publications,
                        scope="Same-host two-client native resume with delayed B helper; software evdev, not physical response or cross-machine alignment.")
        (args.out / "capture.json").write_text(json.dumps(metadata, indent=2) + "\n")
        for slot, root in enumerate(roots):
            trace = root / "wc3-melee-input-trace.txt"
            until(lambda: complete(trace) and trace.stat().st_mtime_ns > started_wall
                  and re.search(r"1200 [0-9.]+ end", trace.read_text()) is not None,
                  "native gameplay trace incomplete", 35)
            (args.out / f"{slot}-trace.txt").write_bytes(trace.read_bytes())
        print("Both helpers completed 600 frames; native traces retained", flush=True)
    finally:
        for helper in helpers:
            if helper.poll() is None:
                helper.send_signal(signal.SIGCONT)
                helper.send_signal(signal.SIGINT)
                try:
                    helper.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    helper.kill()
                    helper.wait(timeout=2)
        for stream in streams:
            stream.close()
        if observer:
            observer.close()
        if pad:
            pad.close()
        for slot, root in enumerate(roots):
            for source in root.glob(f"smashcraft-journal-*{build}*.txt"):
                if source.stat().st_mtime_ns >= started_wall:
                    (args.out / f"{slot}-{source.name}").write_bytes(source.read_bytes())
        (args.out / "observations.json").write_text(json.dumps(observations, indent=2) + "\n")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Drive two native journal matches with one persistent helper per controller.

Starts at stage selection, or character selection with --controller-menus.
The first client walks off after short input checks; both clients use the
ordinary results/rematch flow. Capture epochs come from the game.
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

from controller_event_retention import ABS_X, BTN_SOUTH, EV_ABS, EV_KEY, KernelObserver, VirtualGamepad


def event_path(pad):
    name = bytearray(80)
    fcntl.ioctl(pad.fd, (2 << 30) | (80 << 16) | (ord("U") << 8) | 44, name, True)
    node = name.split(b"\0", 1)[0].decode()
    paths = list((Path("/sys/devices/virtual/input") / node).glob("event*"))
    if len(paths) != 1:
        raise RuntimeError(f"unexpected virtual device interfaces: {paths}")
    return Path("/dev/input") / paths[0].name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--session", type=Path, required=True)
    parser.add_argument("--build", required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--ui-driver", type=Path, default=Path("/tmp/sc-ui.py"))
    parser.add_argument("--controller-menus", action="store_true")
    args = parser.parse_args()
    cfg = json.loads(args.session.read_text())["args"]
    cfg["build"] = args.build
    args.out.mkdir(parents=True, exist_ok=False)
    data = [Path(cfg["data_" + c]) for c in "ab"]
    runs = [Path(cfg["private_" + c]) for c in "ab"]
    envs = [dict(os.environ, DISPLAY=(run / "display").read_text().strip(),
                 XAUTHORITY=(run / "xauthority").read_text().strip(),
                 XDG_RUNTIME_DIR=str(run / "runtime"),
                 WAYLAND_DISPLAY=(run / "wayland-display").read_text().strip()) for run in runs]
    pads, observers, helpers, streams, events = [], [], [], [], []
    started_wall = time.time_ns()

    def check_helpers():
        exited = [(i, p.poll()) for i, p in enumerate(helpers) if p.poll() is not None]
        if exited:
            raise RuntimeError(f"persistent helpers exited: {exited}")

    def until(test, why, timeout=30):
        deadline = time.monotonic() + timeout
        while not test():
            check_helpers()
            if time.monotonic() > deadline:
                raise RuntimeError(why)
            time.sleep(.02)

    def ui(client, operation, *values):
        result = subprocess.run([sys.executable, str(args.ui_driver), client, operation, *map(str, values)],
                                capture_output=True, text=True, timeout=35)
        with (args.out / "ui.txt").open("a") as f:
            f.write(client + " " + operation + " " + repr(values) + "\n" + result.stdout + "\n")
        result.check_returncode()
        return result.stdout

    def keys(slot, *values):
        subprocess.run(["xdotool", "windowactivate", "--sync", str(cfg["window_" + "ab"[slot]]),
                        *values], env=envs[slot], check=True, timeout=5)

    def complete(path):
        return path.exists() and path.stat().st_mtime_ns >= started_wall and path.read_text().rstrip().endswith("endfunction")

    def control(state, epoch, slot):
        return data[slot] / f"smashcraft-journal-{state}-{args.build}-e{epoch}-s{slot}.txt"

    def archive(epoch):
        target = args.out / f"epoch-{epoch}"
        target.mkdir(exist_ok=True)
        for slot, root in enumerate(data):
            for source in list(root.glob(f"smashcraft-journal-*{args.build}*")) + [root / "wc3-melee-input-trace.txt"]:
                if source.is_file() and source.stat().st_mtime_ns >= started_wall:
                    (target / f"{slot}-{source.name}").write_bytes(source.read_bytes())

    def capture_boundary(path):
        before = time.monotonic_ns()
        wall = time.time_ns()
        after = time.monotonic_ns()
        stamp = path.stat().st_mtime_ns
        return dict(path=str(path), contents=path.read_text(), mtime_realtime_ns=stamp,
                    sample_monotonic_before_ns=before, sample_realtime_ns=wall,
                    sample_monotonic_after_ns=after,
                    publication_monotonic_estimate_ns=stamp - wall + (before + after) // 2)

    try:
        for slot, c in enumerate("ab"):
            assert "Warcraft" in Path(f'/proc/{cfg["pid_" + c]}/comm').read_text()
            subprocess.run([cfg["wlrctl"], "toplevel", "focus", "title:Warcraft III"],
                           env=envs[slot], check=True, timeout=5)
            pad = VirtualGamepad(buttons=(BTN_SOUTH, 0x134, 0x13b))
            pads.append(pad)
            device = event_path(pad)
            observer = KernelObserver(device, args.out / f"kernel-{slot}.jsonl")
            observer.start()
            observers.append(observer)
            stream = (args.out / f"helper-{slot}.log").open("w")
            streams.append(stream)
            helpers.append(subprocess.Popen([
                cfg["binary"], "--device", str(device), "--out", str(data[slot]),
                "--follow-matches", "--build", args.build, "--slot", str(slot), "--trace",
                "--editbox-display", envs[slot]["DISPLAY"],
                "--x11-window", str(cfg["window_" + c]), "--pid", str(cfg["pid_" + c]),
                "--private-wlr-app-id", cfg["app_id_" + c],
            ], env=envs[slot], stdout=stream, stderr=stream))
        # The ordinary stage settings, not a physics/debug shortcut, make the
        # controlled stock-loss journey short.
        if not args.controller_menus:
            stock_text = ui("a", "wait", r"[1-9] Stock")
            stocks = int(re.search(r"([1-9])\s+Stock", stock_text, re.I)[1])
            while stocks > 1:
                ui("a", "click", 1380, 155)
                stocks -= 1
                ui("a", "wait", rf"{stocks} Stock")
        with (args.out / "producer.jsonl").open("w") as producer:
            def send(slot, kind, code, value, phase):
                pads[slot].send(kind, code, value, producer, phase, f"slot-{slot}")

            def tap(slot, phase):
                send(slot, EV_KEY, BTN_SOUTH, 1, phase)
                time.sleep(.005)
                send(slot, EV_KEY, BTN_SOUTH, 0, phase)

            def menu_button(slot, code, phase):
                send(slot, EV_KEY, code, 1, phase)
                time.sleep(.12)
                send(slot, EV_KEY, code, 0, phase)

            def menu_phase(phase):
                paths = [root / f"smashcraft-journal-menu-{args.build}-s{slot}.txt"
                         for slot, root in enumerate(data)]
                until(lambda: all(complete(p) and f"phase={phase}" in p.read_text() for p in paths),
                      f"live controller menu phase {phase} absent")
                events.append(dict(event="menu", phase=phase, contents=[p.read_text() for p in paths],
                                   observed_monotonic_ns=time.monotonic_ns()))

            def controller_select():
                menu_phase("CHARACTER")
                ui("a", "wait", "CONTROLS")
                # Move both cursors and return before selecting, then exercise
                # recall/reselect on B. These are real pad events, not menu clicks.
                for slot in range(2):
                    for direction in (32767, -32768):
                        send(slot, EV_ABS, ABS_X, direction, "menu-character-navigation")
                        time.sleep(.12)
                        send(slot, EV_ABS, ABS_X, 0, "menu-character-navigation")
                        time.sleep(.15)
                    menu_button(slot, BTN_SOUTH, "menu-character-select")
                time.sleep(.3)
                menu_button(1, 0x134, "menu-character-recall")
                time.sleep(.3)
                menu_button(1, BTN_SOUTH, "menu-character-reselect")
                time.sleep(.3)
                menu_button(0, 0x13b, "menu-character-confirm")
                menu_phase("STAGE")
                ui("a", "wait", r"STAGE|Sky.*Deck|Three.*Bridges")
                for direction in (32767, -32768):
                    send(0, EV_ABS, ABS_X, direction, "menu-stage-navigation")
                    time.sleep(.12)
                    send(0, EV_ABS, ABS_X, 0, "menu-stage-navigation")
                    time.sleep(.15)
                menu_button(0, 0x134, "menu-stage-back")
                menu_phase("CHARACTER")
                ui("a", "wait", "CONTROLS")
                menu_button(0, 0x13b, "menu-character-return")
                menu_phase("STAGE")
                ui("a", "wait", r"STAGE|Sky.*Deck|Three.*Bridges")

            if args.controller_menus:
                controller_select()

            for epoch in (1, 2):
                trace_after_wall = time.time_ns()
                # Ctrl+G only enables the diagnostic trace; controller-menu mode
                # uses no keyboard or mouse to choose, start, or rematch.
                keys(0, "key", "ctrl+g")
                if args.controller_menus:
                    menu_button(0, 0x13b, f"menu-match-{epoch}-start")
                else:
                    keys(0, "keydown", "y", "sleep", ".12", "keyup", "y")
                starts = [control("start", epoch, slot) for slot in range(2)]
                until(lambda: all(complete(p) for p in starts), f"epoch {epoch}: game-controlled start absent")
                boundaries = [capture_boundary(p) for p in starts]
                events.append(dict(event="start", epoch=epoch, publications=boundaries,
                                   observed_monotonic_ns=time.monotonic_ns()))
                deadline = max(p["publication_monotonic_estimate_ns"] for p in boundaries) + 300_000_000
                time.sleep(max(0, (deadline - time.monotonic_ns()) / 1e9))
                for slot in range(2):
                    tap(slot, f"match-{epoch}-fresh")
                time.sleep(.7)
                send(0, EV_ABS, ABS_X, -32768, f"match-{epoch}-stock-loss")
                ends = [control("end", epoch, slot) for slot in range(2)]
                until(lambda: all(complete(p) for p in ends), f"epoch {epoch}: result did not stop capture", 40)
                send(0, EV_ABS, ABS_X, 0, f"match-{epoch}-stock-loss")
                until(lambda: all(re.search(r"match_quiescent epoch=" + str(epoch) + r"(?:\s|$)",
                                            (args.out / f"helper-{slot}.log").read_text())
                                  for slot in range(2)), f"epoch {epoch}: helpers did not quiesce")
                events.append(dict(event="end", epoch=epoch,
                                   publications=[capture_boundary(p) for p in ends],
                                   observed_monotonic_ns=time.monotonic_ns()))
                ui("a", "wait", "wins|rematch")
                ui("b", "wait", "wins|rematch")
                for root in data:
                    trace = root / "wc3-melee-input-trace.txt"
                    until(lambda: complete(trace) and trace.stat().st_mtime_ns >= trace_after_wall
                          and re.search(r"1200 [0-9.]+ end", trace.read_text()) is not None,
                          f"epoch {epoch}: trace did not complete", 30)
                archive(epoch)
                check_helpers()
                if epoch == 1:
                    # A results-screen tap must not become a new-match action.
                    if args.controller_menus:
                        menu_phase("RESULT")
                        tap(0, "results-only")
                        menu_button(1, 0x13b, "menu-results-confirm")
                        controller_select()
                    else:
                        tap(0, "results-only")
                        for slot in range(2):
                            keys(slot, "keydown", "y", "sleep", ".12", "keyup", "y")
                        ui("a", "wait", "CONTROLS")
                        ui("a", "click", 1080, 600)
                        ui("b", "click", 1510, 600)
                        keys(0, "keydown", "y", "sleep", ".12", "keyup", "y")
                        ui("a", "wait", r"STAGE|Sky.*Deck|Three.*Bridges")
                print(f"Epoch {epoch}: game start, tap, stock loss and results observed", flush=True)
        result = dict(settings=cfg, helper_pids=[p.pid for p in helpers], events=events,
                      helper_sha256=hashlib.sha256(Path(cfg["binary"]).read_bytes()).hexdigest(),
                      scope="Same-host two-client native start/result/rematch with persistent Linux virtual-pad helpers; "
                            + ("controller-only game menus (keyboard diagnostic trace toggle); " if args.controller_menus
                               else "keyboard menu confirmation; ")
                            + "no physical or cross-machine alignment claim.")
        (args.out / "capture.json").write_text(json.dumps(result, indent=2) + "\n")
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
        for observer in observers:
            observer.close()
        for pad in pads:
            pad.close()
        (args.out / "events.json").write_text(json.dumps(events, indent=2) + "\n")
        archive("final")


if __name__ == "__main__":
    main()

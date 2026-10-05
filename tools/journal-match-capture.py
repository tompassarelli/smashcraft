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

from controller_event_retention import ABS_X, ABS_Y, ABS_Z, ABS_RZ, BTN_SOUTH, EV_ABS, EV_KEY, KernelObserver, VirtualGamepad, wait_state


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
    parser.add_argument("--controller-slots", action="store_true",
                        help="play CPU, EMPTY and restored HMN slots across three persistent-helper matches")
    parser.add_argument("--combat-actions", action="store_true",
                        help="exercise the full controller layout and export combat/shield evidence")
    parser.add_argument("--controller-reconnect", action="store_true",
                        help="disconnect a shielding pad, reject a decoy, and resume after neutral rearm")
    parser.add_argument("--controller-chat", action="store_true",
                        help="observe native chat, suppress chat-period input, and check fresh input after Escape")
    parser.add_argument("--chat-capture-driver", type=Path,
                        default=Path.home() / ".codex/skills/private-desktop-development-distilled/scripts/private-desktop.sh")
    parser.add_argument("--chat-open-pattern", default=r"(?:All|Allies)\s*:",
                        help="OCR evidence identifying the native chat entry before typing an unsent marker")
    args = parser.parse_args()
    if args.combat_actions and not args.controller_menus:
        parser.error("--combat-actions requires --controller-menus")
    if args.controller_reconnect and (not args.controller_menus or args.combat_actions):
        parser.error("--controller-reconnect requires --controller-menus without --combat-actions")
    if args.controller_chat and (not args.controller_menus or args.combat_actions or args.controller_reconnect):
        parser.error("--controller-chat requires --controller-menus without combat/reconnect")
    if args.controller_slots and (not args.controller_menus or args.combat_actions or args.controller_reconnect or args.controller_chat):
        parser.error("--controller-slots requires --controller-menus without combat/reconnect/chat")
    epochs = (1, 2, 3) if args.controller_slots else (1, 2)
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
    active_observers, decoys = {}, []
    buttons = ((BTN_SOUTH, 0x131, 0x133, 0x134, 0x136, 0x137, 0x13b)
               if args.combat_actions else (BTN_SOUTH, 0x134, 0x13b))
    identities = [f"smashcraft-reconnect/{args.out.name}/pad-{slot}" for slot in range(2)]
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

    def complete_trace(path, after_wall):
        if not complete(path) or path.stat().st_mtime_ns < after_wall:
            return False
        end = re.search(r"(\d+) [0-9.]+ end", path.read_text())
        return end is not None and int(end[1]) >= 1200

    def control(state, epoch, slot):
        return data[slot] / f"smashcraft-journal-{state}-{args.build}-e{epoch}-s{slot}.txt"

    def archive(epoch):
        target = args.out / f"epoch-{epoch}"
        target.mkdir(exist_ok=True)
        for slot, root in enumerate(data):
            for source in list(root.glob(f"smashcraft-journal-*{args.build}*")) + list(root.glob("smashcraft-response-p*-run*-page*.txt")) + [root / "wc3-melee-input-trace.txt"]:
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
            pad = VirtualGamepad(buttons=buttons, phys=identities[slot] if args.controller_reconnect else None)
            pads.append(pad)
            device = event_path(pad)
            observer = KernelObserver(device, args.out / f"kernel-{slot}.jsonl")
            observer.start()
            observers.append(observer)
            active_observers[slot] = observer
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

            first_selection = True

            def controller_select():
                nonlocal first_selection
                menu_phase("CHARACTER")
                ui("a", "wait", "CONTROLS")
                # Move both cursors and return before selecting, then exercise
                # recall/reselect on B. These are real pad events, not menu clicks.
                for slot in range(2):
                    for direction in ((32767,) if args.combat_actions and first_selection and slot == 1
                                      else (32767, -32768)):
                        send(slot, EV_ABS, ABS_X, direction, "menu-character-navigation")
                        time.sleep(.12)
                        send(slot, EV_ABS, ABS_X, 0, "menu-character-navigation")
                        time.sleep(.15)
                    menu_button(slot, BTN_SOUTH, "menu-character-select")
                first_selection = False
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

            def slot_selection(epoch):
                menu_phase("CHARACTER")
                ui("a", "wait", "CONTROLS")

                def masks(humans, computers):
                    expected = f"connected=3 human-fighters={humans} computers={computers} fighters={humans + computers}"
                    paths = [root / f"smashcraft-journal-menu-{args.build}-s{slot}.txt"
                             for slot, root in enumerate(data)]
                    until(lambda: all(complete(p) and "phase=CHARACTER" in p.read_text()
                                      and expected in p.read_text() for p in paths),
                          f"slot mode not observed on both clients: {expected}")
                    events.append(dict(event="slot-mode", epoch=epoch, human_fighters=humans,
                                       computers=computers, connected=3,
                                       publications=[capture_boundary(p) for p in paths]))

                # Native tags use WC3's centered 4:3 coordinate space on the
                # retained 2560x1440 desktop. The UI driver verifies pointer delivery;
                # the synchronized menu receipts verify the actual mode change.
                if epoch == 1:
                    masks(3, 0)
                    ui("b", "click", 1064, 824)
                    masks(1, 2)
                elif epoch == 2:
                    masks(1, 2)
                    ui("b", "click", 1064, 824)
                    masks(1, 0)
                    ui("a", "click", 1484, 824)
                    masks(5, 0)
                    ui("a", "click", 1484, 824)
                    masks(1, 4)
                else:
                    masks(1, 4)
                    ui("a", "click", 1484, 824)
                    masks(1, 0)
                    ui("b", "click", 1064, 824)
                    masks(3, 0)
                for slot in ((0, 1) if epoch == 3 else (0,)):
                    menu_button(slot, BTN_SOUTH, f"slot-{epoch}-character-select")
                # An already-held Attack at epoch entry must not become a fresh
                # action, including after the player's HMN fighter is restored.
                send(1, EV_KEY, BTN_SOUTH, 1, f"match-{epoch}-slot-held-entry")
                time.sleep(.2)
                time.sleep(.3)
                menu_button(0, 0x13b, f"slot-{epoch}-character-confirm")
                menu_phase("STAGE")
                stock_text = ui("a", "wait", r"[1-9] Stock")
                stocks = int(re.search(r"([1-9])\s+Stock", stock_text, re.I)[1])
                while stocks > 1:
                    ui("a", "click", 1380, 155)
                    stocks -= 1
                    ui("a", "wait", rf"{stocks} Stock")

            def combat(epoch):
                prefix = f"match-{epoch}-combat-"

                def button(slot, code, name, settle=.65):
                    menu_button(slot, code, prefix + name)
                    time.sleep(settle)

                # Archer's arrow is damage-only; Rifleman's shot also supplies a
                # native hit reaction. Both face inward from the normal spawns.
                button(0, 0x134, "special")
                button(1, 0x134, "special", 1.0)
                # Direction + LB + A selects the map's forward tilt (style 6).
                send(0, EV_KEY, 0x136, 1, prefix + "walk")
                send(0, EV_ABS, ABS_X, 32767, prefix + "right")
                button(0, BTN_SOUTH, "walk-attack", .12)
                send(0, EV_ABS, ABS_X, 0, prefix + "right")
                time.sleep(.5)
                send(0, EV_ABS, ABS_X, -32768, prefix + "left")
                time.sleep(.24)
                send(0, EV_ABS, ABS_X, 0, prefix + "left")
                send(0, EV_KEY, 0x136, 0, prefix + "walk")
                time.sleep(.3)
                button(0, 0x131, "jump-b", .9)
                button(0, 0x133, "jump-y", .9)
                send(0, EV_ABS, ABS_Y, -32768, prefix + "tap-jump")
                time.sleep(.12)
                send(0, EV_ABS, ABS_Y, 0, prefix + "tap-jump")
                time.sleep(.9)
                button(0, 0x137, "grab")
                # The RT-only interval must retain the confirmed shield after
                # releasing LT. Neutral intervals expose both shield edges.
                for code, value, name in ((ABS_Z, 32767, "shield-lt"),
                                          (ABS_RZ, 32767, "shield-both"),
                                          (ABS_Z, 0, "shield-rt-only"),
                                          (ABS_RZ, 0, "shield-release")):
                    for slot in range(2):
                        send(slot, EV_ABS, code, value, prefix + name)
                    time.sleep(.35)
                menu_button(0, 0x13b, prefix + "pause")
                def controlled(state):
                    return all(re.search(r"control sequence=\d+ state=" + state + r" ",
                                         (args.out / f"helper-{slot}.log").read_text().split(
                                             f"match_start epoch={epoch} ", 1)[-1])
                               for slot in range(2))
                until(lambda: controlled("PAUSE"), "controller pause absent")
                ui("a", "wait", "Paused")
                events.append(dict(event="combat-pause", epoch=epoch))
                menu_button(0, 0x13b, prefix + "resume")
                until(lambda: controlled("RESUME"), "controller resume absent")
                events.append(dict(event="combat-resume", epoch=epoch))
                time.sleep(.3)

            def reconnect(epoch):
                slot = epoch - 1
                prefix = f"match-{epoch}-reconnect-"
                log = args.out / f"helper-{slot}.log"
                old_path = str(event_path(pads[slot]))
                send(slot, EV_ABS, ABS_Z, 32767, prefix + "shield")
                time.sleep(.5)
                active_observers[slot].close()
                observers.remove(active_observers.pop(slot))
                pads[slot].close()
                disconnected_ns = time.monotonic_ns()
                until(lambda: "controller_disconnected " in log.read_text(), "disconnect not observed")
                decoy = VirtualGamepad(buttons=buttons, phys=identities[slot] + "-decoy")
                decoys.append(decoy)
                decoy_path = str(event_path(decoy))
                decoy.send(EV_KEY, BTN_SOUTH, 1, producer, prefix + "decoy", f"decoy-{slot}")
                time.sleep(.12)
                decoy.send(EV_KEY, BTN_SOUTH, 0, producer, prefix + "decoy", f"decoy-{slot}")
                time.sleep(.25)
                if "controller_reconnected " in log.read_text():
                    raise RuntimeError("helper bound to a different controller")
                # Hold the helper while setting the replacement's initial state,
                # so it must open an already-held device rather than race a press.
                helpers[slot].send_signal(signal.SIGSTOP)
                wait_state(helpers[slot].pid, {"T", "t"})
                replacement = VirtualGamepad(buttons=buttons, phys=identities[slot])
                pads[slot] = replacement
                device = event_path(replacement)
                observer = KernelObserver(device, args.out / f"kernel-{slot}-reconnected.jsonl")
                observer.start()
                observers.append(observer)
                active_observers[slot] = observer
                send(slot, EV_ABS, ABS_Z, 32767, prefix + "held-on-connect")
                send(slot, EV_KEY, BTN_SOUTH, 1, prefix + "held-on-connect")
                helpers[slot].send_signal(signal.SIGCONT)
                until(lambda: "controller_reconnected " in log.read_text(), "matching controller not recovered")
                connected_ns = time.monotonic_ns()
                time.sleep(.35)
                send(slot, EV_KEY, BTN_SOUTH, 0, prefix + "neutral")
                send(slot, EV_ABS, ABS_Z, 0, prefix + "neutral")
                time.sleep(.2)
                tap(slot, prefix + "fresh")
                time.sleep(.7)
                events.append(dict(event="reconnect", epoch=epoch, slot=slot,
                                   old_device=old_path, decoy_device=decoy_path,
                                   replacement_device=str(device), identity=identities[slot],
                                   disconnected_monotonic_ns=disconnected_ns,
                                   connected_monotonic_ns=connected_ns))

            def export_response(epoch):
                keys(0, "key", "ctrl+h")
                for slot, root in enumerate(data):
                    def exported():
                        pages = [p for p in root.glob(f"smashcraft-response-p{slot}-run*-page*.txt")
                                 if complete(p) and p.stat().st_mtime_ns >= trace_after_wall]
                        if not pages:
                            return False
                        header = pages[0].read_text()
                        rows = int(re.search(r" rows=(\d+)", header)[1])
                        retained = int(re.search(r" retained=(\d+)", header)[1])
                        return len(pages) == (max(rows, retained) + 149) // 150
                    until(exported, f"epoch {epoch}: response export incomplete")

            def chat(epoch):
                slot = epoch - 1
                prefix = f"match-{epoch}-chat-"
                marker = "UNSENTCHATPROBE"
                journey = dict(event="chat", epoch=epoch, slot=slot, marker=marker,
                               open_pattern=args.chat_open_pattern, observations=[],
                               policy="chat uses shared pause; suppress chat-period actions; "
                                      "close chat before resume; neutral rearm; preserve fresh input frames")
                events.append(journey)

                def publications(state):
                    found = []
                    for player in range(2):
                        matches = [p for p in data[player].glob(
                            f"smashcraft-journal-control-{args.build}-e{epoch}-s{player}-n*.txt")
                            if complete(p) and f" state={state} " in p.read_text()]
                        if len(matches) != 1:
                            return None
                        found.append(matches[0])
                    return found

                def chat_receipt(state, serial=None):
                    path = data[slot] / f"smashcraft-journal-text-ack-{args.build}-e{epoch}-p{slot}.txt"
                    if not complete(path):
                        return None
                    match = re.search(r" chat=(\d+) chatState=(\d+) chatFrame=(\d+)", path.read_text())
                    if (match and int(match[1]) > 0 and int(match[2]) == state and int(match[3]) == 1
                            and (serial is None or int(match[1]) == serial)):
                        return path
                    return None

                def observe(label):
                    path = args.out / f"chat-{epoch}-{label}.png"
                    before = time.monotonic_ns()
                    subprocess.run([str(args.chat_capture_driver), "capture", str(runs[slot]),
                                    str(path.resolve())], check=True, capture_output=True, timeout=12)
                    text = subprocess.check_output(["tesseract", str(path), "stdout", "--psm", "11"],
                                                   text=True, stderr=subprocess.DEVNULL, timeout=10)
                    # Gold native labels disappear against the animated scene
                    # in unmasked OCR; preserve both observations.
                    mask = path.with_name(path.stem + "-gold.png")
                    subprocess.run(["magick", str(path), "-fx", "(r>0.667&&g>0.588)?0:1", str(mask)],
                                   check=True, capture_output=True, timeout=10)
                    text += "\n" + subprocess.check_output(
                        ["tesseract", str(mask), "stdout", "--psm", "11"],
                        text=True, stderr=subprocess.DEVNULL, timeout=10)
                    if label in ("marker", "stimulus"):
                        # Sparse full-screen OCR splits white chat text against
                        # the battlefield. Read the native entry as one line.
                        dimensions = subprocess.check_output(
                            ["magick", "identify", "-format", "%w %h", str(path)], text=True).split()
                        width, height = map(int, dimensions)
                        crop = path.with_name(path.stem + "-entry.png")
                        geometry = f"{width * 750 // 2560}x{height * 52 // 1440}+{width * 800 // 2560}+{height * 1065 // 1440}"
                        subprocess.run(["magick", str(path), "-crop", geometry, "+repage",
                                        "-resize", "300%", str(crop)], check=True, timeout=10)
                        text += "\n" + subprocess.check_output(
                            ["tesseract", str(crop), "stdout", "--psm", "7"],
                            text=True, stderr=subprocess.DEVNULL, timeout=10)
                    (path.with_suffix(".txt")).write_text(text)
                    observation = dict(label=label, capture=str(path.resolve()), text=text,
                                       helper_log_bytes=(args.out / f"helper-{slot}.log").stat().st_size,
                                       before_monotonic_ns=before, after_monotonic_ns=time.monotonic_ns())
                    journey["observations"].append(observation)
                    return text

                observe("before")
                # Native capture/OCR can outlast a full shield's energy. Keep
                # that observation outside the hold whose release is checked.
                send(slot, EV_ABS, ABS_Z, 32767, prefix + "shield")
                time.sleep(.5)
                journey["enter_monotonic_ns"] = time.monotonic_ns()
                keys(slot, "key", "Return")
                opened = False
                try:
                    # OCR observes native UI. A delivered Enter key alone does
                    # not establish that the game opened its chat entry.
                    for attempt in range(3):
                        text = observe(f"open-{attempt}")
                        if re.search(args.chat_open_pattern, text, re.I):
                            opened = True
                            journey["opened_monotonic_ns"] = time.monotonic_ns()
                            break
                    if not opened:
                        raise RuntimeError("native chat opening unproven; inspect retained chat captures")
                    until(lambda: chat_receipt(3), "native chat visibility was not observed by the map")
                    journey["open_receipt"] = capture_boundary(chat_receipt(3))
                    serial = int(re.search(r" chat=(\d+)", journey["open_receipt"]["contents"])[1])
                    until(lambda: publications("PAUSE_COMMIT"), "chat did not establish a shared pause")
                    journey["pause_publications"] = [capture_boundary(p) for p in publications("PAUSE_COMMIT")]
                    keys(slot, "type", "--delay", "35", marker)
                    text = observe("marker")
                    if marker not in re.sub(r"\s+", "", text).upper():
                        raise RuntimeError("unsent marker absent from native chat; inspect retained capture")
                    send(slot, EV_ABS, ABS_Z, 0, prefix + "shield-release")
                    tap(slot, prefix + "suppressed")
                    # Keep one button held across close: it must not rearm until
                    # the controller becomes neutral.
                    send(slot, EV_KEY, BTN_SOUTH, 1, prefix + "held-across-close")
                    menu_button(1 - slot, 0x13b, prefix + "blocked-resume")
                    observe("stimulus")
                    if publications("RESUME"):
                        raise RuntimeError("opponent resumed gameplay while native chat was open")
                    journey["blocked_resume_no_publication"] = True
                finally:
                    journey["escape_monotonic_ns"] = time.monotonic_ns()
                    keys(slot, "key", "Escape")
                    observe("closed")
                until(lambda: chat_receipt(0, serial), "controller receiver was not restored after chat")
                journey["closed_receipt"] = capture_boundary(chat_receipt(0, serial))
                # The other neutral controller requests resume while the chat
                # player's Attack remains held; it must stay suppressed.
                menu_button(1 - slot, 0x13b, prefix + "resume")
                until(lambda: publications("RESUME"), "controller did not resume after chat closed")
                journey["resume_publications"] = [capture_boundary(p) for p in publications("RESUME")]
                until(lambda: all(" state=RESUME " in (args.out / f"helper-{player}.log").read_text()
                                  for player in range(2)), "helpers did not accept chat resume")
                time.sleep(.2)
                send(slot, EV_KEY, BTN_SOUTH, 0, prefix + "neutral")
                time.sleep(.2)
                tap(slot, prefix + "fresh")
                time.sleep(.7)
                observe("fresh")

            if args.controller_slots:
                slot_selection(1)
            elif args.controller_menus:
                controller_select()

            for epoch in epochs:
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
                if args.controller_slots:
                    time.sleep(.2)
                    send(1, EV_KEY, BTN_SOUTH, 0, f"match-{epoch}-slot-neutral")
                    time.sleep(.2)
                for slot in range(2):
                    tap(slot, f"match-{epoch}-fresh")
                time.sleep(.7)
                if args.combat_actions:
                    combat(epoch)
                if args.controller_reconnect:
                    reconnect(epoch)
                if args.controller_chat:
                    chat(epoch)
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
                    until(lambda: complete_trace(trace, trace_after_wall),
                          f"epoch {epoch}: trace did not complete", 30)
                archive(epoch)
                if args.combat_actions or args.controller_reconnect or args.controller_chat or args.controller_slots:
                    if not args.controller_slots:
                        export_response(epoch)
                        archive(epoch)
                    # Combat can outlast the first trace. Keep it intact and
                    # capture a stationary result endpoint only when necessary.
                    if not all(re.search(r"participant \d+ frame \d+ phase 3 ",
                                         (root / "wc3-melee-input-trace.txt").read_text()) for root in data):
                        final_after = time.time_ns()
                        keys(0, "key", "ctrl+t")
                        for root in data:
                            trace = root / "wc3-melee-input-trace.txt"
                            until(lambda: complete_trace(trace, final_after),
                                  f"epoch {epoch}: result trace incomplete", 35)
                        archive(f"{epoch}-result")
                check_helpers()
                if epoch != epochs[-1]:
                    # A results-screen tap must not become a new-match action.
                    if args.controller_menus:
                        menu_phase("RESULT")
                        tap(0, "results-only")
                        menu_button(1, 0x13b, "menu-results-confirm")
                        if args.controller_slots:
                            slot_selection(epoch + 1)
                        else:
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
        result = dict(settings=cfg, combat_actions=args.combat_actions, controller_reconnect=args.controller_reconnect,
                      controller_chat=args.controller_chat, controller_slots=args.controller_slots,
                      helper_pids=[p.pid for p in helpers], events=events,
                      helper_sha256=hashlib.sha256(Path(cfg["binary"]).read_bytes()).hexdigest(),
                      scope="Same-host two-client native start/result/rematch with persistent Linux virtual-pad helpers; "
                            + ("controller game navigation (keyboard diagnostic trace toggle); " if args.controller_menus
                               else "keyboard menu confirmation; ")
                            + ("ordinary combat and controller layout; " if args.combat_actions else "")
                            + ("controller removal/recreation and neutral rearm; " if args.controller_reconnect else "")
                            + ("native unsent chat with deliberate controller suppression and neutral rearm; "
                               if args.controller_chat else "")
                            + ("B fighter CPU, EMPTY and restored HMN across three epochs; native slot-tag clicks; "
                               if args.controller_slots else "")
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
        for pad in decoys:
            pad.close()
        (args.out / "events.json").write_text(json.dumps(events, indent=2) + "\n")
        archive("final")


if __name__ == "__main__":
    main()

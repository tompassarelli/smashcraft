#!/usr/bin/env python3
"""Native I/O boundary: controller focus loss, neutral rearm and window isolation.

Run with both native clients in a fresh journal match. This checks a bounded
focus interval; native traces must independently establish gameplay application.
"""

import argparse
import ctypes as c
import fcntl
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time

from controller_event_retention import (
    ABS_X, ABS_Z, BTN_SOUTH, EV_ABS, EV_KEY, KernelObserver, VirtualGamepad,
)


class KeySink:
    """An owned X11 window that records any key event mistakenly delivered to it."""

    def __init__(self, library, display):
        self.lib = c.CDLL(str(library))
        signatures = {
            "XOpenDisplay": ([c.c_char_p], c.c_void_p),
            "XDefaultRootWindow": ([c.c_void_p], c.c_ulong),
            "XCreateSimpleWindow": ([c.c_void_p, c.c_ulong, c.c_int, c.c_int,
                                    c.c_uint, c.c_uint, c.c_uint, c.c_ulong, c.c_ulong], c.c_ulong),
            "XStoreName": ([c.c_void_p, c.c_ulong, c.c_char_p], c.c_int),
            "XSelectInput": ([c.c_void_p, c.c_ulong, c.c_long], c.c_int),
            "XMapWindow": ([c.c_void_p, c.c_ulong], c.c_int),
            "XSync": ([c.c_void_p, c.c_int], c.c_int),
            "XPending": ([c.c_void_p], c.c_int),
            "XNextEvent": ([c.c_void_p, c.c_void_p], c.c_int),
            "XDestroyWindow": ([c.c_void_p, c.c_ulong], c.c_int),
            "XCloseDisplay": ([c.c_void_p], c.c_int),
        }
        for name, (args, result) in signatures.items():
            function = getattr(self.lib, name)
            function.argtypes, function.restype = args, result
        self.display = self.lib.XOpenDisplay(display.encode())
        if not self.display:
            raise RuntimeError("cannot open private X display")
        root = self.lib.XDefaultRootWindow(self.display)
        self.window = self.lib.XCreateSimpleWindow(self.display, root, 50, 50, 320, 80, 0, 0, 0)
        self.lib.XStoreName(self.display, self.window, b"Smashcraft focus trial")
        self.lib.XSelectInput(self.display, self.window, 1 | 2)
        self.lib.XMapWindow(self.display, self.window)
        self.lib.XSync(self.display, 0)
        self.events = []

    def drain(self):
        event = (c.c_long * 24)()
        while self.lib.XPending(self.display):
            self.lib.XNextEvent(self.display, c.byref(event))
            kind = c.cast(event, c.POINTER(c.c_int))[0]
            if kind in (2, 3):
                self.events.append(dict(type="press" if kind == 2 else "release",
                                        observed_monotonic_ns=time.monotonic_ns()))

    def close(self):
        self.drain()
        self.lib.XDestroyWindow(self.display, self.window)
        self.lib.XCloseDisplay(self.display)


def event_path(pad):
    value = bytearray(80)
    fcntl.ioctl(pad.fd, (2 << 30) | (80 << 16) | (ord("U") << 8) | 44, value, True)
    name = value.split(b"\0", 1)[0].decode()
    paths = [p.name for p in (Path("/sys/devices/virtual/input") / name).iterdir()
             if p.name.startswith("event") and p.name[5:].isdigit()]
    if len(paths) != 1:
        raise RuntimeError(f"unexpected evdev interfaces: {paths}")
    return Path("/dev/input") / paths[0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--build", required=True)
    parser.add_argument("--x11-library", type=Path, required=True)
    parser.add_argument("--wlrctl", type=Path, required=True)
    parser.add_argument("--epoch", type=int, default=1)
    parser.add_argument("--without-focus-loss", action="store_true",
                        help="Run ordinary tap/shield delivery to isolate focus from stream throughput")
    for slot in "ab":
        parser.add_argument(f"--private-{slot}", type=Path, required=True)
        parser.add_argument(f"--data-{slot}", type=Path, required=True)
        parser.add_argument(f"--pid-{slot}", type=int, required=True)
        parser.add_argument(f"--window-{slot}", type=int, required=True)
        parser.add_argument(f"--app-id-{slot}", required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    pads, observers, helpers, streams = [], [], [], []
    sink = None
    transitions, failures = [], []
    sink_calibration = []
    roots = [args.data_a, args.data_b]
    runs = [args.private_a, args.private_b]
    windows = [args.window_a, args.window_b]
    environments = [dict(os.environ, DISPLAY=(run / "display").read_text().strip(),
                         XAUTHORITY=(run / "xauthority").read_text().strip(),
                         XDG_RUNTIME_DIR=str(run / "runtime"),
                         WAYLAND_DISPLAY=(run / "wayland-display").read_text().strip()) for run in runs]
    epoch = None
    began_wall = time.time_ns()

    def activate(window):
        title = "Warcraft III" if window == windows[0] else "Smashcraft focus trial"
        # XSync completes X11 mapping before the compositor necessarily exposes
        # the new toplevel. Wait for that observed boundary before focusing it.
        deadline = time.monotonic() + 5
        while subprocess.run([str(args.wlrctl), "toplevel", "focus", f"title:{title}"],
                             env=environments[0], timeout=5).returncode:
            if time.monotonic() >= deadline:
                raise RuntimeError(f"private toplevel did not become focusable: {title}")
            time.sleep(.02)
        subprocess.run(["xdotool", "windowactivate", "--sync", str(window)],
                       env=environments[0], check=True, timeout=5)
        active = subprocess.check_output(["xdotool", "getactivewindow"],
                                         env=environments[0], text=True).strip()
        if active != str(window):
            raise RuntimeError("private window focus did not change")
        transitions.append(dict(window=window, observed_monotonic_ns=time.monotonic_ns()))

    try:
        for slot, root in enumerate(roots):
            ready = root / f"smashcraft-journal-ready-{args.build}-e{args.epoch}-p{slot}.txt"
            transport = root / f"smashcraft-journal-transport-ready-{args.build}-e{args.epoch}-p{slot}.txt"
            deadline = time.monotonic() + 10
            while not all(path.exists() and "endfunction" in path.read_text()
                          for path in (ready, transport)):
                if time.monotonic() >= deadline:
                    raise RuntimeError("native readiness/preflight did not complete")
                time.sleep(.02)
            if f"build={args.build} epoch={args.epoch} slot={slot}" not in ready.read_text():
                raise RuntimeError("native readiness identity mismatch")
            if "received-mask=3 before-journal-reads=yes" not in transport.read_text():
                raise RuntimeError("two-client transport preflight absent")
            if "Warcraft" not in Path(f"/proc/{[args.pid_a, args.pid_b][slot]}/comm").read_text():
                raise RuntimeError("selected native client is no longer running")
        # Mapping this test window can change focus. Restore Warcraft before
        # helpers start, and use only explicit window activation during capture.
        sink = KeySink(args.x11_library, environments[0]["DISPLAY"])
        activate(sink.window)
        subprocess.run(["xdotool", "key", "a"], env=environments[0], check=True, timeout=5)
        sink.lib.XSync(sink.display, 0)
        sink.drain()
        sink_calibration = sink.events.copy()
        if {event["type"] for event in sink_calibration} != {"press", "release"}:
            raise RuntimeError("test window did not observe its calibration key")
        sink.events.clear()
        activate(windows[0])
        pads = [VirtualGamepad(buttons=(BTN_SOUTH, 0x13b)), VirtualGamepad()]
        devices = [event_path(pad) for pad in pads]
        epoch = time.monotonic_ns() + 300_000_000
        for slot, (device, root) in enumerate(zip(devices, roots)):
            observer = KernelObserver(device, args.out / f"kernel-{slot}.jsonl")
            observer.start()
            observers.append(observer)
            stream = (args.out / f"helper-{slot}.log").open("w")
            streams.append(stream)
            helpers.append(subprocess.Popen([
                str(args.binary.resolve()), "--device", str(device), "--out", str(root),
                "--ready-file", str(root / f"smashcraft-journal-ready-{args.build}-e{args.epoch}-p{slot}.txt"),
                "--epoch-monotonic-ns", str(epoch), "--stop-frame", "300", "--trace",
                "--editbox-display", environments[slot]["DISPLAY"],
                "--x11-window", str(windows[slot]), "--pid", str([args.pid_a, args.pid_b][slot]),
                "--private-wlr-app-id", [args.app_id_a, args.app_id_b][slot],
            ], env=environments[slot], stdout=stream, stderr=stream))
        schedule = [
            (.100, "before", EV_KEY, BTN_SOUTH, 1),
            (.105, "before", EV_KEY, BTN_SOUTH, 0),
            (.650, "held-before-loss", EV_ABS, ABS_Z, 32767),
            (.800, "focus-away", 0, 0, 0),
            (.950, "unfocused-release", EV_ABS, ABS_Z, 0),
            (1.000, "unfocused-tap", EV_KEY, BTN_SOUTH, 1),
            (1.005, "unfocused-tap", EV_KEY, BTN_SOUTH, 0),
            (1.050, "unfocused-start", EV_KEY, 0x13b, 1),
            (1.055, "unfocused-start", EV_KEY, 0x13b, 0),
            (1.100, "held-through-return", EV_KEY, BTN_SOUTH, 1),
            (1.120, "axis-through-return", EV_ABS, ABS_X, 16384),
            (1.300, "focus-return", 0, 0, 0),
            (1.450, "rearm-button", EV_KEY, BTN_SOUTH, 0),
            (1.500, "rearm-axis", EV_ABS, ABS_X, 0),
            (1.800, "fresh-after-return", EV_KEY, BTN_SOUTH, 1),
            (1.805, "fresh-after-return", EV_KEY, BTN_SOUTH, 0),
        ]
        if args.without_focus_loss:
            schedule = [item for item in schedule if item[1] in (
                "before", "held-before-loss", "unfocused-release", "fresh-after-return")]
        with (args.out / "producer.jsonl").open("w") as producer:
            for elapsed, label, kind, code, value in schedule:
                time.sleep(max(0, (epoch + round(elapsed * 1e9) - time.monotonic_ns()) / 1e9))
                if any(helper.poll() is not None for helper in helpers):
                    raise RuntimeError("helper exited before focus stimulus completed")
                if label == "focus-away":
                    activate(sink.window)
                elif label == "focus-return":
                    activate(windows[0])
                else:
                    pads[0].send(kind, code, value, producer, label, f"{code}:{value}")
                sink.drain()
        codes = [helper.wait(timeout=15) for helper in helpers]
        if codes != [0, 0]:
            raise RuntimeError(f"helper exits {codes}")
        for slot, root in enumerate(roots):
            failure = root / f"smashcraft-journal-failure-{args.build}-e{args.epoch}-p{slot}.txt"
            if failure.exists() and failure.stat().st_mtime_ns >= began_wall:
                (args.out / f"failure-{slot}.txt").write_bytes(failure.read_bytes())
                raise RuntimeError(f"native client {slot} rejected input")
        sink.drain()
        if sink.events:
            raise RuntimeError(f"{len(sink.events)} key events reached the unfocused test window")
        print("focus stimulus completed; no controller keys reached test window", flush=True)
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
        for observer in observers:
            observer.close()
        for pad in pads:
            pad.close()
        for stream in streams:
            stream.close()
        if sink is not None:
            sink.close()
        (args.out / "capture.json").write_text(json.dumps(dict(
            args=vars(args), capture_epoch_monotonic_ns=epoch, transitions=transitions,
            sink_calibration=sink_calibration,
            sink_key_events=sink.events if sink else [], failures=failures,
            helper_sha256=hashlib.sha256(args.binary.read_bytes()).hexdigest(),
            scope=("Two virtual evdev pads, 300 frames; "
                   + ("ordinary delivery without focus loss" if args.without_focus_loss
                      else "one 500 ms A focus interval")
                   + "; native gameplay traces are checked separately."),
        ), default=str, indent=2) + "\n")


if __name__ == "__main__":
    main()

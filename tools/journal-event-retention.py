#!/usr/bin/env python3
"""Replay the stopped-helper counterexample against the raw evdev journal boundary."""

import argparse
import fcntl
import json
from pathlib import Path
import re
import signal
import subprocess
import time

from controller_event_retention import (
    BTN_SOUTH, EV_KEY, KernelObserver, VirtualGamepad, wait_state,
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--binary", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    pad = VirtualGamepad()
    helper = None
    observer = None
    try:
        name_buffer = bytearray(80)
        # UI_GET_SYSNAME identifies this exact virtual device, without scanning /sys.
        fcntl.ioctl(pad.fd, (2 << 30) | (80 << 16) | (ord("U") << 8) | 44,
                    name_buffer, True)
        name = name_buffer.split(b"\0", 1)[0].decode()
        parent = Path("/sys/devices/virtual/input") / name
        events = [p.name for p in parent.iterdir() if re.fullmatch(r"event\d+", p.name)]
        if len(events) != 1:
            raise RuntimeError(f"expected one event interface for {name}: {events}")
        device = Path("/dev/input") / events[0]
        observer = KernelObserver(device, args.out / "kernel-events.jsonl")
        observer.start()
        journal = args.out / "journal"
        journal.mkdir()
        epoch = time.monotonic_ns() + 75_000_000
        with (args.out / "helper.tsv").open("w") as output, \
                (args.out / "helper.stderr.txt").open("w") as errors:
            helper = subprocess.Popen([
                str(args.binary.resolve()), "--device", str(device), "--out", str(journal),
                "--build", "capture-backlog", "--epoch", "1", "--slot", "0",
                "--delay", "0", "--epoch-monotonic-ns", str(epoch),
                "--stop-frame", "30", "--trace",
            ], stdout=output, stderr=errors)
            deadline = time.monotonic() + 2
            while "source=" not in (args.out / "helper.stderr.txt").read_text():
                if helper.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError("helper did not establish evdev acquisition")
                time.sleep(0.001)
            helper.send_signal(signal.SIGSTOP)
            wait_state(helper.pid, {"T", "t"})
            stopped = time.monotonic_ns()
            with (args.out / "producer.jsonl").open("w") as producer:
                for edge in range(10):
                    target = epoch + 5_000_000 + edge * 16_000_000
                    remaining = target - time.monotonic_ns()
                    if remaining > 0:
                        time.sleep(remaining / 1e9)
                    pad.send(EV_KEY, BTN_SOUTH, int(edge % 2 == 0), producer,
                             "cold-stopped", "press" if edge % 2 == 0 else "release")
            remaining = stopped + 250_000_000 - time.monotonic_ns()
            if remaining > 0:
                time.sleep(remaining / 1e9)
            resumed = time.monotonic_ns()
            helper.send_signal(signal.SIGCONT)
            code = helper.wait(timeout=3)
            if code != 0:
                raise RuntimeError((args.out / "helper.stderr.txt").read_text())
        observer.close()
        observer = None
        rows = []
        for line in (args.out / "helper.tsv").read_text().splitlines():
            match = re.fullmatch(r"event mono_ns=(\d+) frame=(\d+) held=(\d+) pressed=(\d+) released=(\d+)", line)
            if match:
                rows.append([int(value) for value in match.groups()])
        kernel = [json.loads(line) for line in (args.out / "kernel-events.jsonl").read_text().splitlines()]
        kernel_edges = [row for row in kernel if row["type"] == EV_KEY and row["code"] == BTN_SOUTH]
        assert len(rows) == len(kernel_edges) == 10, (len(rows), len(kernel_edges))
        assert [row[0] for row in rows] == [row["kernel_monotonic_ns"] for row in kernel_edges]
        assert all(row[1] == 1 + (row[0] - epoch) * 60 // 1_000_000_000 for row in rows)
        assert all((row[3], row[4]) == ((32, 0) if i % 2 == 0 else (0, 32)) for i, row in enumerate(rows))
        packets = list(journal.glob("*-length.pld"))
        assert len(packets) == 15, len(packets)
        summary = dict(scope="cold raw evdev acquisition; helper stopped before first mapped-event read",
                       epoch_monotonic_ns=epoch, stopped_monotonic_ns=stopped,
                       resume_requested_monotonic_ns=resumed,
                       stopped_until_resume_request_ms=(resumed - stopped) / 1e6,
                       raw_edges=len(rows), kernel_edges=len(kernel_edges), frames=30,
                       paired_packets=len(packets), assigned_frames=[row[1] for row in rows],
                       retained_event_span_ms=(rows[-1][0] - rows[0][0]) / 1e6,
                       timestamp_matches_kernel=True,
                       native_decode_verified=False)
        (args.out / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
        print(json.dumps(summary))
    finally:
        if helper is not None and helper.poll() is None:
            helper.send_signal(signal.SIGCONT)
            helper.terminate()
            helper.wait(timeout=3)
        if observer is not None:
            observer.close()
        pad.close()


if __name__ == "__main__":
    main()

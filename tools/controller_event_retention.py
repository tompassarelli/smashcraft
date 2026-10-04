#!/usr/bin/env python3
"""Exercise SDL3 gamepad event retention with a Linux uinput Xbox 360 pad."""

import argparse
import csv
import fcntl
import json
import os
from pathlib import Path
import re
import select
import signal
import struct
import subprocess
import threading
import time


EV_SYN, EV_KEY, EV_ABS = 0, 1, 3
SYN_REPORT = 0
BTN_SOUTH = 0x130
ABS_X, ABS_Y, ABS_Z, ABS_RX, ABS_RY, ABS_RZ = 0, 1, 2, 3, 4, 5
UI_DEV_CREATE, UI_DEV_DESTROY = 0x5501, 0x5502
ABS_CNT = 0x40


def iow(kind, number, size=4):
    return (1 << 30) | (size << 16) | (kind << 8) | number


UI_SET_EVBIT = iow(ord("U"), 100)
UI_SET_KEYBIT = iow(ord("U"), 101)
UI_SET_ABSBIT = iow(ord("U"), 103)
EVIOCSCLOCKID = 0x400445A0
INPUT_EVENT_SIZE = struct.calcsize("@llHHi")


def monotonic_ns():
    return time.monotonic_ns()


class VirtualGamepad:
    def __init__(self, buttons=(BTN_SOUTH,), phys=None):
        self.fd = os.open("/dev/uinput", os.O_WRONLY | os.O_NONBLOCK)
        try:
            fcntl.ioctl(self.fd, UI_SET_EVBIT, EV_KEY)
            fcntl.ioctl(self.fd, UI_SET_EVBIT, EV_ABS)
            if phys is not None:
                fcntl.ioctl(self.fd, iow(ord("U"), 108, struct.calcsize("P")),
                            phys.encode() + b"\0")
            for button in buttons:
                fcntl.ioctl(self.fd, UI_SET_KEYBIT, button)
            for code in (ABS_X, ABS_Y, ABS_Z, ABS_RX, ABS_RY, ABS_RZ):
                fcntl.ioctl(self.fd, UI_SET_ABSBIT, code)
            minimum = [0] * ABS_CNT
            maximum = [0] * ABS_CNT
            for code in (ABS_X, ABS_Y, ABS_RX, ABS_RY):
                minimum[code], maximum[code] = -32768, 32767
            for code in (ABS_Z, ABS_RZ):
                minimum[code], maximum[code] = 0, 32767
            zeros = [0] * ABS_CNT
            name = b"Smashcraft Event Retention Virtual Gamepad"
            header = struct.pack("=80sHHHHI", name, 0x03, 0x045E, 0x028E, 0x0114, 0)
            body = struct.pack("=" + "i" * (ABS_CNT * 4), *(maximum + minimum + zeros + zeros))
            os.write(self.fd, header + body)
            fcntl.ioctl(self.fd, UI_DEV_CREATE)
            time.sleep(0.25)
        except BaseException:
            os.close(self.fd)
            raise

    def send(self, event_type, code, value, log_file, phase, label):
        before = monotonic_ns()
        packet = struct.pack("@llHHi", 0, 0, event_type, code, value)
        written = os.write(self.fd, packet)
        after = monotonic_ns()
        if written != len(packet):
            raise RuntimeError(f"short uinput write ({written}/{len(packet)})")
        log_file.write(
            json.dumps(
                {
                    "phase": phase,
                    "event": label,
                    "type": event_type,
                    "code": code,
                    "value": value,
                    "producer_before_write_monotonic_ns": before,
                    "producer_after_write_monotonic_ns": after,
                },
                separators=(",", ":"),
            )
            + "\n"
        )
        log_file.flush()
        self.sync()

    def sync(self):
        packet = struct.pack("@llHHi", 0, 0, EV_SYN, SYN_REPORT, 0)
        if os.write(self.fd, packet) != len(packet):
            raise RuntimeError("short uinput SYN_REPORT write")

    def close(self):
        if self.fd is not None:
            try:
                fcntl.ioctl(self.fd, UI_DEV_DESTROY)
            finally:
                os.close(self.fd)
                self.fd = None


def helper_list(binary):
    result = subprocess.run([binary, "--list"], text=True, capture_output=True, check=True)
    listing = result.stdout + result.stderr
    matches = re.findall(
        r'gamepad id=(\d+) name=Some\("Xbox 360 Controller"\) path=Some\("/dev/input/event\d+"\) vendor=Some\(1118\) product=Some\(654\)',
        listing,
    )
    if len(matches) != 1:
        raise RuntimeError("SDL --list did not identify the newly created virtual gamepad:\n" + listing)
    return int(matches[0]), listing


def proc_state(pid):
    data = Path(f"/proc/{pid}/stat").read_text()
    return data[data.rfind(")") + 2 :].split()[0]


class KernelObserver:
    """Read-only evdev observer using the same CLOCK_MONOTONIC as the producer."""

    def __init__(self, path, log_path):
        self.fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK)
        fcntl.ioctl(self.fd, EVIOCSCLOCKID, struct.pack("i", time.CLOCK_MONOTONIC))
        self.path = log_path
        self.stop = threading.Event()
        self.thread = threading.Thread(target=self.run, name="uinput-evdev-observer")
        self.error = None

    def start(self):
        self.thread.start()

    def run(self):
        try:
            with self.path.open("w", buffering=1) as log:
                while not self.stop.is_set():
                    readable, _, _ = select.select([self.fd], [], [], 0.02)
                    if not readable:
                        continue
                    data = os.read(self.fd, INPUT_EVENT_SIZE * 128)
                    for offset in range(0, len(data) - (len(data) % INPUT_EVENT_SIZE), INPUT_EVENT_SIZE):
                        sec, usec, event_type, code, value = struct.unpack_from("@llHHi", data, offset)
                        log.write(json.dumps({
                            "kernel_clock": "CLOCK_MONOTONIC",
                            "kernel_monotonic_ns": sec * 1_000_000_000 + usec * 1_000,
                            "type": event_type,
                            "code": code,
                            "value": value,
                        }, separators=(",", ":")) + "\n")
        except BaseException as error:
            self.error = repr(error)

    def close(self):
        self.stop.set()
        self.thread.join(timeout=2)
        os.close(self.fd)
        if self.thread.is_alive():
            raise RuntimeError("kernel observer did not stop")
        if self.error:
            raise RuntimeError(f"kernel observer failed: {self.error}")


def wait_state(pid, states, timeout=2.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            if proc_state(pid) in states:
                return proc_state(pid)
        except FileNotFoundError:
            return "exited"
        time.sleep(0.005)
    raise RuntimeError(f"helper PID {pid} did not reach one of states {states}")


def start_helper(binary, gamepad_id, prefix, output_dir):
    stdout_path = output_dir / f"{prefix}-helper.tsv"
    stderr_path = output_dir / f"{prefix}-helper.stderr.txt"
    stdout = stdout_path.open("w", buffering=1)
    stderr = stderr_path.open("w", buffering=1)
    process = None
    try:
        process = subprocess.Popen(
            [binary, "--watch-seconds", "30", "--gamepad", str(gamepad_id)],
            stdin=subprocess.DEVNULL,
            stdout=stdout,
            stderr=stderr,
            close_fds=True,
        )
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError(f"helper exited early with {process.returncode}; see {stderr_path}")
            if stdout_path.exists() and "record\tevent_id\tcapture_ns" in stdout_path.read_text():
                return process, stdout, stderr, stdout_path
            time.sleep(0.02)
        raise RuntimeError(f"helper PID {process.pid} did not emit its event-history header")
    except BaseException:
        if process is not None and process.poll() is None:
            process.send_signal(signal.SIGINT)
            try:
                process.wait(timeout=4)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=2)
        stdout.close()
        stderr.close()
        raise


def taps(device, log_file, phase, count, hold_ms, gap_ms):
    for index in range(count):
        device.send(EV_KEY, BTN_SOUTH, 1, log_file, phase, f"tap{index + 1}.down")
        time.sleep(hold_ms / 1000)
        device.send(EV_KEY, BTN_SOUTH, 0, log_file, phase, f"tap{index + 1}.up")
        if index + 1 != count:
            time.sleep(gap_ms / 1000)


def axis_excursions(device, log_file, phase, count, hold_ms, gap_ms):
    for index in range(count):
        device.send(EV_ABS, ABS_X, 24000, log_file, phase, f"axis{index + 1}.right")
        time.sleep(hold_ms / 1000)
        device.send(EV_ABS, ABS_X, 0, log_file, phase, f"axis{index + 1}.center")
        if index + 1 != count:
            time.sleep(gap_ms / 1000)


def stop_stimulus_resume(process, device, log_file, phase):
    os.kill(process.pid, signal.SIGSTOP)
    stopped_at = monotonic_ns()
    if wait_state(process.pid, {"T", "t"}) not in {"T", "t"}:
        raise RuntimeError("helper did not enter stopped state")
    taps(device, log_file, phase, count=5, hold_ms=4.5, gap_ms=3)
    remaining = 0.250 - (monotonic_ns() - stopped_at) / 1e9
    if remaining > 0:
        time.sleep(remaining)
    still_stopped = proc_state(process.pid)
    resumed_at_request = monotonic_ns()
    os.kill(process.pid, signal.SIGCONT)
    wait_state(process.pid, {"R", "S", "D", "I", "Z"})
    return {
        "stop_requested_monotonic_ns": stopped_at,
        "continue_requested_monotonic_ns": resumed_at_request,
        "verified_stopped_state_before_continue": still_stopped,
        "stopped_duration_ms": (resumed_at_request - stopped_at) / 1e6,
    }


def read_tsv(path):
    rows = []
    with path.open(newline="") as source:
        for line in source:
            if not line.strip() or line.startswith("#"):
                continue
            row = next(csv.reader([line], delimiter="\t"))
            if row and row[0] in {"event", "transition"}:
                rows.append(row)
    return rows


def expected_record(item):
    if item["type"] == EV_KEY and item["code"] == BTN_SOUTH:
        return "button", "South=" + ("true" if item["value"] else "false")
    if item["type"] == EV_ABS and item["code"] == ABS_X:
        return "axis", f"LeftX={item['value']}"
    raise RuntimeError(f"unexpected producer record: {item}")


def interval_stats(values):
    values = sorted(values)
    if not values:
        return None
    middle = len(values) // 2
    median = values[middle] if len(values) % 2 else (values[middle - 1] + values[middle]) / 2
    return {"min_ms": round(values[0] / 1e6, 3), "median_ms": round(median / 1e6, 3), "max_ms": round(values[-1] / 1e6, 3)}


def compare_phase(producer, helper_rows, phase, event_offset, observed_count):
    sent = [item for item in producer if item["phase"] == phase]
    all_received = [row for row in helper_rows if row[0] == "event"]
    received = all_received[event_offset : event_offset + observed_count]
    expected = [expected_record(item) for item in sent]
    actual = [(row[5], row[6]) for row in received]
    actual_strings = [f"{kind}:{value}" for kind, value in actual]
    expected_strings = [f"{kind}:{value}" for kind, value in expected]
    # Do not pair by timestamps or inferred latency: queue order is the oracle.
    same_sequence = len(received) == len(sent) and expected_strings == actual_strings
    capture_by_id = {int(row[1]): int(row[2]) for row in received}
    transition_by_id = {}
    for row in helper_rows:
        if row[0] == "transition":
            transition_by_id.setdefault(int(row[1]), []).append((row[7], row[8], row[9]))
    matched = []
    cursor = 0
    for expected_pair in expected:
        index = next((i for i in range(cursor, len(actual)) if actual[i] == expected_pair), None)
        if index is None:
            matched.append(None)
        else:
            matched.append(received[index])
            cursor = index + 1
    matched_ids = {int(row[1]) for row in matched if row is not None}
    unexpected = [row for row in received if int(row[1]) not in matched_ids]
    producer_intervals = []
    capture_intervals = []
    transition_matches = 0
    for index, item in enumerate(sent):
        if item["event"].endswith(".down") or item["event"].endswith(".right"):
            suffix = ".down" if item["event"].endswith(".down") else ".right"
            group = item["event"][: -len(suffix)]
            mate_label = group + (".up" if suffix == ".down" else ".center")
            mate = next((candidate for candidate in sent if candidate["event"] == mate_label), None)
            if mate is None:
                continue
            sent_ns = mate["producer_before_write_monotonic_ns"] - item["producer_before_write_monotonic_ns"]
            producer_intervals.append(sent_ns)
            if matched[index] is not None and matched:
                start_id = int(matched[index][1])
                mate_index = next(i for i, candidate in enumerate(sent) if candidate["event"] == mate_label)
                if matched[mate_index] is None:
                    continue
                end_id = int(matched[mate_index][1])
                capture_intervals.append(capture_by_id[end_id] - capture_by_id[start_id])
        if matched[index] is not None:
            row_id = int(matched[index][1])
            action = "Attack" if item["type"] == EV_KEY else "Right"
            pressed = "true" if item["value"] else "false"
            transition_matches += int(
                any(
                    t[0] == action and t[1] == pressed and t[2] in {"submitted", "preview"}
                    for t in transition_by_id.get(row_id, [])
                )
            )
    delta_intervals = [capture - sent for capture, sent in zip(capture_intervals, producer_intervals)]
    return {
        "phase": phase,
        "producer_events": len(sent),
        "helper_events": len(received),
        "event_ids": [int(row[1]) for row in received],
        "exact_order_and_values_match": same_sequence,
        "all_producer_events_observed_in_order": all(row is not None for row in matched),
        "unexpected_helper_events": [{"event_id": int(row[1]), "control": row[5], "value": row[6], "capture_ns": int(row[2])} for row in unexpected],
        "producer_press_or_excursion_duration": interval_stats(producer_intervals),
        "SDL_capture_press_or_excursion_duration": interval_stats(capture_intervals),
        "SDL_minus_producer_duration_delta": interval_stats(delta_intervals),
        "observed_expected_action_presses": transition_matches,
    }


def kernel_comparison(producer, kernel_path):
    with kernel_path.open() as source:
        kernel = [json.loads(line) for line in source if line.strip()]
    sent = [expected_record(item) for item in producer]
    actual_events = [
        item for item in kernel
        if (item["type"], item["code"]) in {(EV_KEY, BTN_SOUTH), (EV_ABS, ABS_X)}
    ]
    actual = [
        ("button", f"South={'true' if item['value'] else 'false'}")
        if item["type"] == EV_KEY
        else ("axis", f"LeftX={item['value']}")
        for item in actual_events
    ]
    cursor = 0
    matched = []
    for pair in sent:
        index = next((i for i in range(cursor, len(actual)) if actual[i] == pair), None)
        if index is None:
            matched.append(None)
        else:
            matched.append(index)
            cursor = index + 1
    gaps = [actual_events[index]["kernel_monotonic_ns"] - item["producer_before_write_monotonic_ns"]
            for item, index in zip(producer, matched) if index is not None]
    return {
        "clock": "both producer and evdev observer explicitly use CLOCK_MONOTONIC",
        "producer_input_events": len(sent),
        "evdev_input_events": len(actual),
        "all_producer_events_observed_in_order": all(index is not None for index in matched),
        "unexpected_evdev_events": len(actual) - sum(index is not None for index in matched),
        "producer_write_to_evdev_timestamp_ms": interval_stats(gaps),
    }


def finish_helper(process, stdout, stderr):
    if process.poll() is None:
        os.kill(process.pid, signal.SIGINT)
        try:
            process.wait(timeout=4)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=2)
    stdout.close()
    stderr.close()
    return process.returncode


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--helper", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    binary = str(args.helper.resolve(strict=True))
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    stimulus_path = output_dir / "producer.jsonl"
    observer = None
    device = VirtualGamepad()
    helpers = []
    try:
        gamepad_id, listing = helper_list(binary)
        (output_dir / "gamepad-list.txt").write_text(listing)
        device_path = re.search(rf'gamepad id={gamepad_id} .*path=Some\("([^\"]+)"\)', listing).group(1)
        observer = KernelObserver(device_path, output_dir / "kernel-events.jsonl")
        observer.start()
        with stimulus_path.open("w", buffering=1) as events:
            cold, cold_out, cold_err, cold_tsv = start_helper(binary, gamepad_id, "cold", output_dir)
            helpers.append((cold, cold_out, cold_err))
            # Cold trial: first actual controller input occurs while the helper
            # is verified stopped, so SDL's first kernel timestamp calibration
            # can be evaluated separately from its warm event path.
            cold_meta = stop_stimulus_resume(cold, device, events, "cold-first-input-during-stop")
            time.sleep(0.35)
            cold_meta["helper_pid"] = cold.pid
            cold_meta["helper_exit_code"] = finish_helper(cold, cold_out, cold_err)
            helpers.remove((cold, cold_out, cold_err))
            cold_meta["source_event_rows"] = len([r for r in read_tsv(cold_tsv) if r[0] == "event"])

            warm, warm_out, warm_err, warm_tsv = start_helper(binary, gamepad_id, "warm", output_dir)
            helpers.append((warm, warm_out, warm_err))
            taps(device, events, "warm-baseline-4_5ms-taps", count=12, hold_ms=4.5, gap_ms=65)
            axis_excursions(device, events, "warm-baseline-axis", count=5, hold_ms=16, gap_ms=65)
            time.sleep(0.35)
            warm_count_before_stop = len([r for r in read_tsv(warm_tsv) if r[0] == "event"])
            stop_meta = stop_stimulus_resume(warm, device, events, "warm-250ms-stop-input")
            time.sleep(0.35)
            stop_meta["helper_pid"] = warm.pid
            stop_meta["helper_exit_code"] = finish_helper(warm, warm_out, warm_err)
            helpers.remove((warm, warm_out, warm_err))
            warm_rows = read_tsv(warm_tsv)
            observer.close()
            observer = None
            stop_meta["source_event_rows"] = len([r for r in warm_rows if r[0] == "event"]) - warm_count_before_stop
            with stimulus_path.open() as source:
                producer = [json.loads(line) for line in source if line.strip()]
            cold_rows = read_tsv(cold_tsv)
            tap_phase = "warm-baseline-4_5ms-taps"
            axis_phase = "warm-baseline-axis"
            stop_phase = "warm-250ms-stop-input"
            tap_count = len([item for item in producer if item["phase"] == tap_phase])
            axis_count = len([item for item in producer if item["phase"] == axis_phase])
            report = {
                "selected_virtual_gamepad_id": gamepad_id,
                "cold_first_input_during_stop": cold_meta,
                "warm_250ms_stop_input": stop_meta,
                "warm_baseline_source_event_rows": warm_count_before_stop,
                "warm_total_event_rows": len([r for r in warm_rows if r[0] == "event"]),
                "warm_total_transition_rows": len([r for r in warm_rows if r[0] == "transition"]),
                "phase_comparisons": [
                    compare_phase(producer, cold_rows, "cold-first-input-during-stop", 0, cold_meta["source_event_rows"]),
                    compare_phase(producer, warm_rows, tap_phase, 0, tap_count),
                    compare_phase(producer, warm_rows, axis_phase, tap_count, max(0, warm_count_before_stop - tap_count)),
                    compare_phase(producer, warm_rows, stop_phase, warm_count_before_stop, stop_meta["source_event_rows"]),
                ],
                "kernel_observer": kernel_comparison(producer, output_dir / "kernel-events.jsonl"),
                "clock_note": "Producer timestamps use CLOCK_MONOTONIC; SDL capture_ns uses SDL's own event timestamp origin. Compare intervals and event order only, never subtract the origins.",
            }
            (output_dir / "summary.json").write_text(json.dumps(report, indent=2) + "\n")
            print(json.dumps(report, indent=2))
    finally:
        for process, stdout, stderr in helpers:
            if process.poll() is None:
                try:
                    if proc_state(process.pid) in {"T", "t"}:
                        os.kill(process.pid, signal.SIGCONT)
                except FileNotFoundError:
                    pass
            finish_helper(process, stdout, stderr)
        try:
            if observer is not None:
                observer.close()
        finally:
            device.close()


if __name__ == "__main__":
    main()

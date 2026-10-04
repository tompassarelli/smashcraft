#!/usr/bin/env python3
"""Reconcile the resume corpus against independent kernel/file timestamps."""

import argparse
from collections import Counter
import json
from pathlib import Path
import re


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path)
    args = parser.parse_args()
    root = args.capture
    metadata = json.loads((root / "capture.json").read_text())
    producer = [json.loads(line) for line in (root / "producer.jsonl").read_text().splitlines()]
    kernel = [json.loads(line) for line in (root / "kernel.jsonl").read_text().splitlines()]
    kernel = [event for event in kernel if event["type"] == 1]
    assert len(producer) == len(kernel), "stimulus and kernel key event counts differ"
    for index, (expected, actual) in enumerate(zip(producer, kernel)):
        assert (expected["code"], expected["value"]) == (actual["code"], actual["value"])
        assert expected["producer_before_write_monotonic_ns"] - 1000 <= actual["kernel_monotonic_ns"]
        # uinput timestamps the report at SYN_REPORT, which send() writes
        # after its key-write measurement. The next call starts after that SYN.
        if index + 1 < len(producer):
            assert actual["kernel_monotonic_ns"] <= producer[index + 1]["producer_before_write_monotonic_ns"]

    accepted = {"before-pause", "fresh-while-helper-stopped", "fresh-after-recovery"}
    expected_actions = []
    endpoint_checksums = []
    result = dict(scope=metadata["scope"], helper_sha256=metadata["helper_sha256"],
                  produced_key_events=len(producer), kernel_key_events=len(kernel), players=[])
    for slot in range(2):
        publication = metadata["resume_publications"][slot]
        barrier = int(re.search(r"frame=(\d+)", publication["contents"])[1])
        anchor = publication["publication_monotonic_estimate_ns"]
        log = (root / f"helper-{slot}.log").read_text()
        rows = [int(value) for value in re.findall(r"published_frame=(\d+)", log)]
        assert rows == list(range(1, 601)), f"player {slot}: missing/duplicate capture rows"
        assigned = {int(t): (int(f), int(h), int(p), int(r)) for t, f, h, p, r in re.findall(
            r"event mono_ns=(\d+) frame=(\d+) held=(\d+) pressed=(\d+) released=(\d+)", log)}
        cases = []
        for stimulus, event in zip(producer, kernel):
            if stimulus["code"] != 0x130 or stimulus["phase"] not in accepted:
                continue
            timestamp = event["kernel_monotonic_ns"]
            if stimulus["phase"] == "before-pause":
                epoch = metadata["capture_epoch_monotonic_ns"]
                first = 1
            else:
                epoch, first = anchor, barrier
            frame = first + (timestamp - epoch) * 60 // 1_000_000_000
            assert timestamp in assigned, f"player {slot}: missing {stimulus['phase']} edge"
            actual = assigned[timestamp]
            assert actual[0] == frame, f"player {slot}: expected {frame}, assigned {actual[0]}"
            assert actual[2 if stimulus["value"] else 3] & 32, "missing attack transition"
            cases.append(dict(phase=stimulus["phase"], pressed=bool(stimulus["value"]),
                              kernel_monotonic_ns=timestamp, expected_frame=frame,
                              assigned_frame=actual[0]))
            if stimulus["value"]:
                expected_actions.append((slot, frame))
        for stimulus, event in zip(producer, kernel):
            if stimulus["code"] == 0x130 and stimulus["phase"] not in accepted:
                actual = assigned.get(event["kernel_monotonic_ns"])
                assert actual is None or (actual[1] & 32, actual[2] & 32, actual[3] & 32) == (0, 0, 0), \
                    f"player {slot}: paused/held input leaked into gameplay"
        result["players"].append(dict(slot=slot, resumed_first_frame=barrier,
                                       publication_monotonic_estimate_ns=anchor,
                                       published_frames=len(rows), edges=cases))

    expected_counts = Counter(expected_actions)
    for client in range(2):
        trace = (root / f"{client}-trace.txt").read_text()
        actual_counts = Counter((int(slot), int(frame)) for slot, frame in re.findall(
            r"participant (\d+) frame (\d+) phase \d+ applied attack ", trace))
        assert actual_counts == expected_counts, f"client {client}: {actual_counts} != {expected_counts}"
        assert "journal input fail" not in trace
        assert re.findall(r"dropped (\d+)", trace) == ["0"]
        endpoints = re.findall(r"confirmed frame (\d+) state ([\d:]+)", trace)
        assert endpoints and endpoints[-1][0] == "600", f"client {client}: endpoint incomplete"
        endpoint_checksums.append(endpoints[-1][1])
    assert len(set(endpoint_checksums)) == 1, "confirmed states differ"
    result.update(native_actions=[dict(slot=slot, frame=frame) for slot, frame in expected_actions],
                  confirmed_frame=600, confirmed_checksum=endpoint_checksums[0],
                  native_trace_drops=0, unexplained_frame_retargets=0)
    (root / "summary.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

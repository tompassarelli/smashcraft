#!/usr/bin/env python3
"""Reconcile the native two-match journey against kernel and START timestamps."""

import argparse
from collections import Counter
import json
from pathlib import Path
import re


def json_lines(path):
    return [json.loads(line) for line in path.read_text().splitlines()]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path)
    args = parser.parse_args()
    root = args.capture
    metadata = json.loads((root / "capture.json").read_text())
    producer = json_lines(root / "producer.jsonl")
    result = dict(scope=metadata["scope"], helper_sha256=metadata["helper_sha256"],
                  persistent_helper_pids=metadata["helper_pids"], matches=[])
    stimuli = {}
    logs = {}
    for slot in range(2):
        produced = [event for event in producer if event["event"] == f"slot-{slot}"]
        kernel = [event for event in json_lines(root / f"kernel-{slot}.jsonl")
                  if event["type"] != 0]
        assert len(produced) == len(kernel), f"slot {slot}: producer/kernel count differs"
        for index, (sent, captured) in enumerate(zip(produced, kernel)):
            assert (sent["type"], sent["code"], sent["value"]) == (
                captured["type"], captured["code"], captured["value"])
            assert sent["producer_before_write_monotonic_ns"] - 1000 <= captured["kernel_monotonic_ns"]
            if index + 1 < len(produced):
                assert captured["kernel_monotonic_ns"] <= produced[index + 1]["producer_before_write_monotonic_ns"]
        stimuli[slot] = list(zip(produced, kernel))
        logs[slot] = (root / f"helper-{slot}.log").read_text()
        for marker in ("ready", "start", "end", "quiescent"):
            assert re.findall(r"match_" + marker + r" epoch=(\d+)", logs[slot]) == ["1", "2"], \
                f"slot {slot}: unexpected lifecycle {marker}"

    for epoch in (1, 2):
        boundary = next(event for event in metadata["events"]
                        if event["event"] == "start" and event["epoch"] == epoch)
        match = dict(epoch=epoch, players=[], native_clients=[])
        expected_actions = []
        for slot in range(2):
            section = logs[slot].split(f"match_start epoch={epoch} ", 1)[1].split(
                f"match_end epoch={epoch} ", 1)[0]
            publication = boundary["publications"][slot]
            first = int(re.search(r"frame=(\d+)", publication["contents"])[1])
            anchor = publication["publication_monotonic_estimate_ns"]
            helper_anchor = int(re.search(r"epoch_ns=(\d+)", section)[1])
            uncertainty = int(re.search(r"uncertainty_ns=(\d+)", section)[1])
            assert abs(helper_anchor - anchor) <= uncertainty, "independent START anchor disagrees"
            assigned = {int(t): (int(f), int(p), int(r)) for t, f, p, r in re.findall(
                r"event mono_ns=(\d+) frame=(\d+) held=\d+ pressed=(\d+) released=(\d+)", section)}
            edges = []
            for sent, event in stimuli[slot]:
                if sent["phase"] != f"match-{epoch}-fresh":
                    continue
                timestamp = event["kernel_monotonic_ns"]
                expected_frame = first + (timestamp - anchor) * 60 // 1_000_000_000
                assert timestamp in assigned, f"slot {slot} epoch {epoch}: missing tap edge"
                frame, pressed, released = assigned[timestamp]
                assert frame == expected_frame, f"slot {slot}: assigned {frame}, expected {expected_frame}"
                assert (pressed if sent["value"] else released) & 32, "attack transition missing"
                edges.append(dict(pressed=bool(sent["value"]), kernel_monotonic_ns=timestamp,
                                  expected_frame=expected_frame, assigned_frame=frame))
                if sent["value"]:
                    expected_actions.append((slot, frame))
            assert len(edges) == 2
            rows = [int(frame) for frame in re.findall(r"published_frame=(\d+)", section)]
            assert rows and rows == list(range(first, rows[-1] + 1)), "capture frame gap or duplicate"
            match["players"].append(dict(slot=slot, anchor_monotonic_ns=anchor,
                                         helper_anchor_difference_ns=helper_anchor - anchor,
                                         published_frames=len(rows), tap_edges=edges))
        endpoints = []
        for client in range(2):
            trace = (root / f"epoch-{epoch}" / f"{client}-wc3-melee-input-trace.txt").read_text()
            actions = Counter((int(slot), int(frame)) for slot, frame in re.findall(
                r"participant (\d+) frame (\d+) phase \d+ applied attack ", trace))
            assert actions == Counter(expected_actions), f"epoch {epoch} client {client}: actions {actions}"
            assert "journal input fail" not in trace
            assert re.findall(r"dropped (\d+)", trace) == ["0"]
            states = re.findall(r"confirmed frame (\d+) state ([\d:]+)", trace)
            assert states, "missing confirmed endpoint"
            endpoints.append(states[-1])
            match["native_clients"].append(dict(client=client, confirmed_frame=int(states[-1][0]),
                                                confirmed_checksum=states[-1][1],
                                                actions=[dict(slot=s, frame=f) for s, f in expected_actions]))
        assert endpoints[0] == endpoints[1], f"epoch {epoch}: confirmed states differ"
        result["matches"].append(match)
    result.update(native_attack_applications=8, native_trace_drops=0,
                  unexplained_frame_retargets=0, extra_result_screen_actions=0)
    (root / "summary.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

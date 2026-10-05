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
    reconnect = metadata.get("controller_reconnect", False)
    slot_modes = metadata.get("controller_slots", False)
    epochs = (1, 2, 3) if slot_modes else (1, 2)
    producer = json_lines(root / "producer.jsonl")
    result = dict(scope=metadata["scope"], helper_sha256=metadata["helper_sha256"],
                  persistent_helper_pids=metadata["helper_pids"], matches=[])
    stimuli = {}
    logs = {}
    for slot in range(2):
        produced = [event for event in producer if event["event"] == f"slot-{slot}"]
        kernel_paths = [root / f"kernel-{slot}.jsonl"]
        if reconnect:
            kernel_paths += list(root.glob(f"kernel-{slot}-reconnected.jsonl"))
        kernel = sorted((event for path in kernel_paths for event in json_lines(path)
                         if event["type"] != 0), key=lambda event: event["kernel_monotonic_ns"])
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
            assert re.findall(r"match_" + marker + r" epoch=(\d+)", logs[slot]) == [str(epoch) for epoch in epochs], \
                f"slot {slot}: unexpected lifecycle {marker}"

    for epoch in epochs:
        boundary = next(event for event in metadata["events"]
                        if event["event"] == "start" and event["epoch"] == epoch)
        match = dict(epoch=epoch, players=[], native_clients=[])
        human_fighters, computers = ((1, 2) if epoch == 1 else (1, 4) if epoch == 2 else (3, 0)) if slot_modes else (3, 0)
        if slot_modes:
            modes = [event for event in metadata["events"]
                     if event["event"] == "slot-mode" and event["epoch"] == epoch]
            expected_modes = {1: [(3, 0), (1, 2)],
                              2: [(1, 2), (1, 0), (5, 0), (1, 4)],
                              3: [(1, 4), (1, 0), (3, 0)]}[epoch]
            assert [(e["human_fighters"], e["computers"]) for e in modes] == expected_modes
            for mode in modes:
                signature = (f"connected=3 human-fighters={mode['human_fighters']} "
                             f"computers={mode['computers']} fighters={mode['human_fighters'] + mode['computers']}")
                assert len(mode["publications"]) == 2
                assert all("phase=CHARACTER" in p["contents"] and signature in p["contents"]
                           for p in mode["publications"]), "slot change was not observed on both clients"
            match["slot_modes"] = dict(connected=3, human_fighters=human_fighters, computers=computers,
                                       restored_human=epoch == 3)
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
                if sent["phase"] not in (f"match-{epoch}-fresh", f"match-{epoch}-reconnect-fresh"):
                    continue
                timestamp = event["kernel_monotonic_ns"]
                expected_frame = first + (timestamp - anchor) * 60 // 1_000_000_000
                assert timestamp in assigned, f"slot {slot} epoch {epoch}: missing tap edge"
                frame, pressed, released = assigned[timestamp]
                assert frame == expected_frame, f"slot {slot}: assigned {frame}, expected {expected_frame}"
                assert (pressed if sent["value"] else released) & 32, "attack transition missing"
                edges.append(dict(pressed=bool(sent["value"]), kernel_monotonic_ns=timestamp,
                                  expected_frame=expected_frame, assigned_frame=frame))
                if sent["value"] and human_fighters & (1 << slot):
                    expected_actions.append((slot, frame))
            assert len(edges) == (4 if reconnect and slot == epoch - 1 else 2)
            if slot_modes and slot == 1:
                held = [(sent, event) for sent, event in stimuli[slot]
                        if sent["phase"] == f"match-{epoch}-slot-held-entry"]
                neutral = [(sent, event) for sent, event in stimuli[slot]
                           if sent["phase"] == f"match-{epoch}-slot-neutral"]
                assert len(held) == len(neutral) == 1
                held_ns = held[0][1]["kernel_monotonic_ns"]
                neutral_ns = neutral[0][1]["kernel_monotonic_ns"]
                assert held[0][0]["value"] == 1 and neutral[0][0]["value"] == 0
                assert held_ns < anchor < neutral_ns < edges[0]["kernel_monotonic_ns"], "hold did not straddle START"
                assert not re.search(r"(?m)^event mono_ns=" + str(held_ns) + r" ", logs[slot]), "entry hold was admitted"
                assert f"suppressed mono_ns={held_ns} " in logs[slot], "entry hold suppression absent"
                assert all(not (pressed & 32) for timestamp, (_, pressed, _) in assigned.items()
                           if timestamp < neutral_ns), "held entry produced an attack before neutral"
                match["slot_modes"]["held_entry_suppressed"] = True
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
            human_actions = Counter({key: count for key, count in actions.items() if human_fighters & (1 << key[0])})
            assert human_actions == Counter(expected_actions), f"epoch {epoch} client {client}: actions {actions}"
            assert "journal input fail" not in trace
            assert re.findall(r"dropped (\d+)", trace) == ["0"]
            final_path = root / f"epoch-{epoch}-result" / f"{client}-wc3-melee-input-trace.txt"
            final_trace = final_path.read_text() if final_path.exists() else trace
            states = re.findall(r"confirmed frame (\d+) state ([\d:]+)", final_trace)
            assert states, "missing confirmed endpoint"
            if reconnect or slot_modes:
                assert re.search(r"(?:participant|humans) \d+ frame \d+ phase 3", final_trace), "missing actual result"
                assert len(states) >= 2 and states[-1] == states[-2], "result not stationary"
            if slot_modes:
                expected = f"connected 3 human-fighters {human_fighters} computers {computers} fighters {human_fighters + computers}"
                assert expected in trace, "native trace did not retain selected ownership"
                if epoch == 2:
                    assert not any(slot == 1 for slot, _ in actions), "EMPTY player applied an attack"
            endpoints.append(states[-1])
            match["native_clients"].append(dict(client=client, confirmed_frame=int(states[-1][0]),
                                                confirmed_checksum=states[-1][1],
                                                actions=[dict(slot=s, frame=f) for s, f in expected_actions]))
        assert endpoints[0] == endpoints[1], f"epoch {epoch}: confirmed states differ"
        if reconnect:
            slot = epoch - 1
            journey = next(event for event in metadata["events"]
                           if event["event"] == "reconnect" and event["epoch"] == epoch)
            section = logs[slot].split(f"match_start epoch={epoch} ", 1)[1].split(
                f"match_end epoch={epoch} ", 1)[0]
            assert section.count("controller_disconnected ") == 1, "missing/extra disconnect"
            assert section.count("controller_reconnected ") == 1, "missing/extra reconnect"
            assert journey["replacement_device"] != journey["decoy_device"]
            assert journey["replacement_device"] in section.split("controller_reconnected ", 1)[1].splitlines()[0]
            disconnect_frame = int(re.search(r"controller_release [^\n]*frame=(\d+)", section)[1])
            assigned = {int(t): int(f) for t, f in re.findall(r"event mono_ns=(\d+) frame=(\d+)", section)}
            shield = [event for sent, event in stimuli[slot]
                      if sent["phase"] == f"match-{epoch}-reconnect-shield"]
            assert len(shield) == 1
            shield_frame = assigned[shield[0]["kernel_monotonic_ns"]]
            pages = list((root / f"epoch-{epoch}").glob(f"{slot}-smashcraft-response-p{slot}-run*-page*.txt"))
            assert pages, "shield response observations missing"
            latest = max(int(re.search(r"-run(\d+)-", p.name)[1]) for p in pages)
            text = "\n".join(p.read_text() for p in pages if f"-run{latest}-" in p.name)
            frames = {int(v[0]): int(v[7]) for row in re.findall(r'Preload\( "A ([^"\r\n]+)', text)
                      if (v := row.split()) and v[0].isdigit()}
            observed = [(frames[int(v[0])], int(v[6])) for row in re.findall(r'Preload\( "B ([^"\r\n]+)', text)
                        if (v := row.split()) and v[0].isdigit() and int(v[0]) in frames]
            held = [state for frame, state in observed if shield_frame + 2 <= frame < disconnect_frame]
            assert len(held) >= 2 and all(state == 1 for state in held), "pre-disconnect shield absent"
            fresh_frame = match["players"][slot]["tap_edges"][-2]["assigned_frame"]
            released = [state for frame, state in observed if disconnect_frame + 2 <= frame <= fresh_frame + 5]
            assert len(released) >= 2 and all(state == 0 for state in released), "shield stuck or reactivated before neutral rearm"
            match["reconnect"] = dict(slot=slot, release_frame=disconnect_frame,
                                      confirmed_held_samples=len(held), confirmed_released_samples=len(released),
                                      original_device=journey["old_device"], replacement_device=journey["replacement_device"],
                                      decoy_device=journey["decoy_device"], fresh_attack_applied_once=True)
        result["matches"].append(match)
    result.update(native_attack_applications=sum(len(client["actions"]) for match in result["matches"]
                                                for client in match["native_clients"]), native_trace_drops=0,
                  unexplained_frame_retargets=0, extra_result_screen_actions=0)
    if slot_modes:
        result["inactive_controller_policy"] = "Retain connected-player frame stream; CPU/EMPTY fighter ignores it; rearm neutral at next epoch"
        result["slot_journey"] = "B HMN→CPU→EMPTY→HMN; temporary slot C CPU supplies opponent while B is EMPTY"
    (root / "summary.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Reconcile the native two-match journey against kernel and START timestamps."""

import argparse
from collections import Counter
import json
from pathlib import Path
import re


def json_lines(path):
    return [json.loads(line) for line in path.read_text().splitlines()]


def integrity_result(root, metadata, pair=(1, 2), tag="", window=None):
    """Issue 26: producer-clock oracle, native application and first prediction."""
    failures = []
    journey = [e for e in metadata["events"] if e.get("epoch") in pair or "epoch" not in e]
    def require(condition, message):
        if not condition:
            failures.append(message)
        return condition

    def distribution(values):
        if not values:
            return dict(n=0, p50=None, p95=None, max=None, distribution={})
        ordered = sorted(values)
        return dict(n=len(values), p50=ordered[(len(values) - 1) // 2],
                    p95=ordered[(len(values) * 95 - 1) // 100], max=max(values),
                    distribution=dict(sorted(Counter(values).items())))

    def bits(mask):
        return [1 << n for n in range(15) if mask & (1 << n)]

    def source_mask(kind, code, value):
        if not value:
            return 0
        if kind == 1:
            return {0x130: 32, 0x131: 16, 0x133: 16, 0x134: 64,
                    0x136: 16384, 0x137: 128}.get(code, 0)
        if kind == 3:
            if code == 0:
                return 1 if value < 0 else 2
            if code == 1:
                return 24 if value < 0 else 4
            return {2: 256, 5: 512}.get(code, 0)
        return 0

    producer = json_lines(root / "producer.jsonl")
    for slot in (0, 1):
        sent = [e for e in producer if e["event"] == f"slot-{slot}"]
        kernel = [e for e in json_lines(root / f"kernel-{slot}.jsonl") if e["type"] != 0]
        require(len(sent) == len(kernel), f"slot {slot}: producer/kernel edge count differs")
        for event, observed in zip(sent, kernel):
            require((event["type"], event["code"], event["value"]) ==
                    (observed["type"], observed["code"], observed["value"]),
                    f"slot {slot}: producer/kernel source order differs")
            if "producer_injected_monotonic_ns" in event:
                require(event["producer_injected_monotonic_ns"] == observed["kernel_monotonic_ns"],
                        f"slot {slot}: uinput did not preserve the producer timestamp")
    injected = [0, 0]
    losses = duplicates = reordered = stuck = correct = total = 0
    local_delays, opponent_lateness, rollback_depths, stall_lengths = [], [], [], []
    missing_local, illegal_presses, legal_presses = 0, 0, 0
    native = {}
    rollback_limits = set()
    endpoints = {}
    coverage = [set(), set()]
    same_frame_taps = [0, 0]
    for epoch in pair:
        for client in (0, 1):
            pages = list((root / f"epoch-{epoch}").glob(
                f"{client}-smashcraft-response-p{client}-run*-page*.txt"))
            if not require(bool(pages), f"epoch {epoch} client {client}: response pages absent"):
                continue
            latest = max(int(re.search(r"-run(\d+)-", p.name)[1]) for p in pages)
            pages = sorted((p for p in pages if f"-run{latest}-" in p.name),
                           key=lambda p: int(re.search(r"-page(\d+)", p.name)[1]))
            text = "\n".join(p.read_text() for p in pages)
            header = pages[0].read_text()
            retained = re.search(r"integrity retained=(\d+) dropped=(\d+)", header)
            if not require(retained is not None, f"epoch {epoch} client {client}: integrity header absent"):
                continue
            require(int(retained[2]) == 0, f"epoch {epoch} client {client}: integrity rows dropped")
            rows = [line.split() for line in re.findall(r'Preload\( "I ([^"\r\n]+)', text)]
            require(len(rows) == int(retained[1]), f"epoch {epoch} client {client}: incomplete integrity export")
            events = []
            for row in rows:
                serial, stage = int(row[0]), row[1]
                if stage == "checksum":
                    if int(row[2]) == epoch:
                        endpoints[epoch, client] = (int(row[3]), row[4], int(row[5]))
                    continue
                values = list(map(int, row[2:]))
                if not require(values and values[0] == epoch,
                               f"epoch {epoch} client {client}: wrong trace epoch"):
                    continue
                events.append((serial, stage, values))
                if stage == "rollback":
                    rollback_depths.append(values[1])
            native[epoch, client] = events
            stalls = [serial for serial, stage, _ in events if stage == "stall"]
            if stalls:
                length = 1
                for before, after in zip(stalls, stalls[1:]):
                    if after == before + 1:
                        length += 1
                    else:
                        stall_lengths.append(length)
                        length = 1
                stall_lengths.append(length)
            trace = root / f"epoch-{epoch}" / f"{client}-wc3-melee-input-trace.txt"
            require(trace.exists() and "journal input fail" not in trace.read_text(),
                    f"epoch {epoch} client {client}: missing trace or journal failure")
            if trace.exists():
                rollback_limits.update(map(int, re.findall(r"common K \d+ confirmed \d+ R (\d+)", trace.read_text())))
            # Final checksums are captured at export, after the result boundary,
            # even when the ordinary 20-second trace ended earlier in the match.
            require((epoch, client) in endpoints and endpoints[epoch, client][2] == 3,
                    f"epoch {epoch} client {client}: final result checksum absent")
        require(endpoints.get((epoch, 0)) is not None and
                endpoints.get((epoch, 0)) == endpoints.get((epoch, 1)),
                f"epoch {epoch}: final checksums differ")
        boundary = next(e for e in journey if e["event"] == "start" and e["epoch"] == epoch)
        end = next(e for e in journey if e["event"] == "end" and e["epoch"] == epoch)
        for slot in (0, 1):
            publications = [boundary["publications"][slot]]
            publications += [e["publications"][slot] for e in journey
                             if e["event"] == "integrity-resume" and e["epoch"] == epoch]
            segments = sorted((p["publication_monotonic_estimate_ns"],
                               int(re.search(r"frame=(\d+)", p["contents"])[1])) for p in publications)
            final_ns = end["publications"][slot]["publication_monotonic_estimate_ns"]
            expected = Counter()
            expected_held = {}
            source_states = {}
            source_edges = []
            previous_down = {}
            for event in producer:
                if event["event"] != f"slot-{slot}" or not event["phase"].startswith(f"match-{epoch}-"):
                    continue
                kind, code, value = event["type"], event["code"], event["value"]
                if kind == 1 and code == 0x13b:
                    continue
                before = event.get("producer_injected_monotonic_ns", event["producer_before_write_monotonic_ns"])
                after = before if "producer_injected_monotonic_ns" in event else event["producer_after_write_monotonic_ns"]
                if before >= final_ns or before < segments[0][0]:
                    continue
                anchor, first = max(segment for segment in segments if segment[0] <= before)
                frame = first + (before - anchor) * 60 // 1_000_000_000
                require(frame == first + (after - anchor) * 60 // 1_000_000_000,
                        f"epoch {epoch} slot {slot}: injection crossed frame boundary at {before}")
                old = 0
                for mask in source_states.values():
                    old |= mask
                source_states[kind, code] = source_mask(kind, code, value)
                held = 0
                for mask in source_states.values():
                    held |= mask
                pressed, released = held & ~old, old & ~held
                expected_held[frame] = held
                edge_keys = [(frame, bit, 1) for bit in bits(pressed)] + [(frame, bit, 0) for bit in bits(released)]
                expected.update(edge_keys)
                measured = "-integrity-" in event["phase"]
                if measured:
                    injected[slot] += 1
                    coverage[slot].add(event["phase"].split(":")[-1])
                    require(bool(edge_keys), f"epoch {epoch} slot {slot}: source transition has no action edge")
                    source_edges.append(edge_keys)
                    if value:
                        previous_down[kind, code] = (frame, before)
                    elif (kind, code) in previous_down:
                        down_frame, down_ns = previous_down.pop((kind, code))
                        if frame == down_frame and 4_000_000 <= before - down_ns <= 12_000_000:
                            same_frame_taps[slot] += 1
            observed_clients = []
            for client in (0, 1):
                events = native.get((epoch, client), [])
                observed = Counter()
                frames = []
                for serial, stage, values in events:
                    if stage != "confirmed" or values[1] != slot:
                        continue
                    _, _, frame, held, pressed, released, _ = values
                    frames.append(frame)
                    observed.update((frame, bit, 1) for bit in bits(pressed))
                    observed.update((frame, bit, 0) for bit in bits(released))
                    if frame in expected_held and held != expected_held[frame]:
                        stuck += 1
                losses += sum((expected - observed).values())
                duplicates += sum((observed - expected).values())
                reordered += sum(b <= a for a, b in zip(frames, frames[1:]))
                observed_clients.append(observed)
                if client != slot:
                    for _, stage, values in events:
                        if stage == "receive" and values[1] == slot:
                            opponent_lateness.extend([max(0, values[6] - 1 - values[2])] *
                                                     (values[4].bit_count() + values[5].bit_count()))
            for keys in source_edges:
                total += 1
                correct += bool(keys) and all(all(observed[key] == expected[key] == 1 for key in keys)
                                             for observed in observed_clients)
            local = native.get((epoch, slot), [])
            captures = {v[2]: serial for serial, stage, v in local if stage == "capture" and v[1] == slot}
            predicted = {v[2]: (serial, v[5]) for serial, stage, v in local if stage == "action" and v[1] == slot}
            for _, stage, values in local:
                if stage != "legal" or values[1] != slot:
                    continue
                _, _, frame, pressed, legal, started = values
                legal_presses += legal.bit_count()
                illegal_presses += (pressed & ~legal).bit_count()
                require(started & legal == legal, f"epoch {epoch} slot {slot} frame {frame}: legal confirmed action failed")
                if not legal:
                    continue
                prediction = predicted.get(frame)
                if frame not in captures or prediction is None or prediction[1] & legal != legal:
                    missing_local += legal.bit_count()
                    continue
                # The callback that FIRST executed prediction is compared to the
                # admission callback. A later rollback replay never creates this row.
                local_delays.extend([prediction[0] - captures[frame]] * legal.bit_count())
    required_bindings = {"move-left", "move-right", "move-down", "jump-stick", "jump-b", "jump-y",
                         "attack", "special", "shield-lt", "shield-rt", "grab", "walk"}
    for slot in (0, 1):
        require(injected[slot] >= 500, f"slot {slot}: fewer than 500 injected edges")
        require(required_bindings <= coverage[slot], f"slot {slot}: missing binding coverage")
        require(same_frame_taps[slot] > 0, f"slot {slot}: no observed same-frame 5 ms tap")
    stalls = [e for e in journey if e["event"] == "integrity-stall"]
    require(sorted(e["kind"] for e in stalls) == ["game", "helper"], "required process stalls absent")
    for event in stalls:
        require(event["verified_stopped_state"] and 240_000_000 <=
                event["continued_monotonic_ns"] - event["stopped_monotonic_ns"] <= 350_000_000,
                f"{event['kind']} stall duration/state unproven")
    require(any(e["event"] == "integrity-pause" for e in journey) and
            any(e["event"] == "integrity-resume" for e in journey), "Start pause/resume absent")
    change = next((e for e in journey if e["event"] == "integrity-slot-change"), None)
    four_fighters = metadata.get("four_fighters", False)
    expected_modes = [(3, 8), (7, 8), (3, 12)] if four_fighters else [(7, 0), (3, 4)]
    require(change is not None and [(c["human_fighters"], c["computers"]) for c in change["changes"]] == expected_modes,
            "rematch slot change absent")
    if four_fighters:
        setup = next((e for e in journey if e["event"] == "four-fighter-setup"), None)
        require(setup is not None and [(c["human_fighters"], c["computers"]) for c in setup["changes"]]
                == [(7, 0), (3, 4), (11, 4), (3, 12)], "two-human two-CPU setup absent")
        for epoch in pair:
            for client in (0, 1):
                trace = root / f"epoch-{epoch}" / f"{client}-wc3-melee-input-trace.txt"
                require(trace.exists() and "connected 3 human-fighters 3 computers 12 fighters 15" in trace.read_text(),
                        f"epoch {epoch} client {client}: native four-fighter roster absent")
    gate_edges = losses == duplicates == reordered == stuck == 0
    gate_frames = total > 0 and correct == total
    gate_local = legal_presses > 0 and missing_local == 0 and bool(local_delays) and min(local_delays) >= 0 and max(local_delays) <= 1
    gate_checksums = len(endpoints) == 4 and all(endpoints[e, 0] == endpoints[e, 1] for e in pair)
    require(len(rollback_limits) == 1, "native rollback limit absent or inconsistent")
    rollback_limit = next(iter(rollback_limits), None)
    if window is not None:
        require(rollback_limit == window, f"native rollback limit {rollback_limit} is not the commanded {window}")
    result = dict(scope=metadata["scope"], build=metadata["settings"]["build"],
                  rollback_limit_frames=rollback_limit,
                  four_fighters=four_fighters,
                  helper_sha256=metadata["helper_sha256"], edges_injected_per_player=injected,
                  lost=losses, duplicated=duplicates, reordered=reordered, stuck=stuck,
                  expected_frame_both_clients=dict(correct=correct, total=total,
                                                   percent=100 * correct / total if total else None),
                  local_start_minus_capture_frames=distribution(local_delays),
                  local_frame_basis="60 Hz service callbacks from map admission to first forward prediction; rollback replay excluded",
                  legal_action_edges=legal_presses, illegal_action_edges=illegal_presses,
                  legal_actions_missing_first_prediction=missing_local,
                  opponent_input_lateness_frames=distribution(opponent_lateness),
                  rollback_depth_frames=distribution(rollback_depths),
                  prediction_stalls=dict(count=len(stall_lengths), longest_callbacks=max(stall_lengths, default=0)),
                  injected_to_screen_ms=None, same_frame_5ms_taps=same_frame_taps,
                  final_checksums={f"epoch-{e}-client-{c}": value for (e, c), value in endpoints.items()},
                  gates=dict(edges=gate_edges, expected_frame=gate_frames,
                             local_start=gate_local, checksums=gate_checksums), evidence_failures=failures)
    result["passed"] = all(result["gates"].values()) and not failures
    def brief(d):
        return f"{d['p50']} / {d['p95']} / {d['max']} (n={d['n']})"
    table = ["| Metric | Result |", "|---|---|",
             f"| Edges injected per player | {injected[0]} / {injected[1]} |",
             f"| Lost / duplicated / reordered / stuck edges | {losses} / {duplicates} / {reordered} / {stuck} |",
             f"| Edges applied at expected frame, both clients | {correct}/{total} ({result['expected_frame_both_clients']['percent']}%) |",
             f"| Local start − capture, frames | {brief(result['local_start_minus_capture_frames'])}; missing first prediction {missing_local} |",
             f"| Opponent input lateness, frames: p50 / p95 / max | {brief(result['opponent_input_lateness_frames'])} |",
             f"| Rollback depth, frames: p50 / p95 / max | {brief(result['rollback_depth_frames'])} |",
             f"| Prediction stalls at {rollback_limit}-frame limit | {len(stall_lengths)}; longest {max(stall_lengths, default=0)} callbacks |",
             "| Injected input → screen, ms | Not captured in this session |",
             f"| Final checksums match | {'Yes' if gate_checksums else 'No'} |"]
    suffix = f"-{tag}" if tag else ""
    (root / f"summary{suffix}.json").write_text(json.dumps(result, indent=2) + "\n")
    (root / f"integrity-table{suffix}.md").write_text("\n".join(table) + "\n")
    print("\n".join(table))
    print(json.dumps(dict(passed=result["passed"], gates=result["gates"], evidence_failures=failures), indent=2))
    return result


def sweep_result(root, metadata):
    """One #26 table per commanded rollback window, from one loaded session."""
    rows = ["| Window | Edges lost/dup/reord/stuck | Expected frame | Local start p50/p95/max | "
            "Opponent lateness p50/p95/max | Rollback depth p50/p95/max | Stalls (longest) | Checksums | Passed |",
            "|---|---|---|---|---|---|---|---|---|"]
    passed = True
    for index, window in enumerate(metadata["sweep"]):
        first = metadata.get("epochs", [1])[0]
        pair = (first + 2 * index, first + 2 * index + 1)
        print(f"## R{window}: epochs {pair}")
        r = integrity_result(root, metadata, pair, f"rb{window}", window)
        passed = passed and r["passed"]
        def brief(d):
            return f"{d['p50']} / {d['p95']} / {d['max']}"
        rows.append(f"| R{window} | {r['lost']}/{r['duplicated']}/{r['reordered']}/{r['stuck']} | "
                    f"{r['expected_frame_both_clients']['percent']}% | {brief(r['local_start_minus_capture_frames'])} | "
                    f"{brief(r['opponent_input_lateness_frames'])} | {brief(r['rollback_depth_frames'])} | "
                    f"{r['prediction_stalls']['count']} ({r['prediction_stalls']['longest_callbacks']}) | "
                    f"{'Yes' if r['gates']['checksums'] else 'No'} | {'Yes' if r['passed'] else 'No'} |")
    (root / "sweep-table.md").write_text("\n".join(rows) + "\n")
    print("\n".join(rows))
    return 0 if passed else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path)
    args = parser.parse_args()
    root = args.capture
    metadata = json.loads((root / "capture.json").read_text())
    if metadata.get("sweep"):
        return sweep_result(root, metadata)
    if metadata.get("input_integrity"):
        return 0 if integrity_result(root, metadata, tuple(metadata.get("epochs", (1, 2))))["passed"] else 1
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
                # A is a valid CHARACTER-menu action before START. Account for
                # that route, then independently require no gameplay admission.
                assert (f"menu_emit epoch={epoch - 1} phase=Some(Character) key=n mono_ns={held_ns}"
                        in logs[slot]), "entry hold was not accounted for in the character menu"
                assert f"suppressed mono_ns={neutral_ns} " in section, "entry release bypassed neutral rearm"
                assert all(not (pressed & 32) for timestamp, (_, pressed, _) in assigned.items()
                           if timestamp < neutral_ns), "held entry produced an attack before neutral"
                match["slot_modes"]["held_entry_suppressed"] = True
            rows = [int(frame) for frame in re.findall(r"published_frame=(\d+)", section)]
            assert rows and rows == list(range(first, rows[-1] + 1)), "capture frame gap or duplicate"
            match["players"].append(dict(slot=slot, anchor_monotonic_ns=anchor,
                                         helper_anchor_difference_ns=helper_anchor - anchor,
                                         published_frames=len(rows), tap_edges=edges))
        endpoints = []
        all_client_actions = []
        for client in range(2):
            trace = (root / f"epoch-{epoch}" / f"{client}-wc3-melee-input-trace.txt").read_text()
            actions = Counter((int(slot), int(frame)) for slot, frame in re.findall(
                r"participant (\d+) frame (\d+) phase \d+ applied attack ", trace))
            human_actions = Counter({key: count for key, count in actions.items() if human_fighters & (1 << key[0])})
            assert human_actions == Counter(expected_actions), f"epoch {epoch} client {client}: actions {actions}"
            assert all((human_fighters | computers) & (1 << slot) for slot, _ in actions), "inactive fighter applied an attack"
            all_client_actions.append(actions)
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
        assert all_client_actions[0] == all_client_actions[1], f"epoch {epoch}: native attack histories differ"
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
    raise SystemExit(main())

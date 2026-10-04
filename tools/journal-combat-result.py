#!/usr/bin/env python3
"""Reconcile --combat-actions using kernel, helper, map and shield evidence."""

import argparse
from collections import Counter
import json
from pathlib import Path
import re


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def lines(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path)
    args = parser.parse_args()
    root = args.capture
    metadata = json.loads((root / "capture.json").read_text())
    require(metadata.get("combat_actions"), "capture was not a combat journey")
    producer = lines(root / "producer.jsonl")
    paired = {}
    logs = {}
    for slot in range(2):
        sent = [e for e in producer if e["event"] == f"slot-{slot}"]
        kernel = [e for e in lines(root / f"kernel-{slot}.jsonl") if e["type"] != 0]
        require(len(sent) == len(kernel), f"slot {slot}: producer/kernel count mismatch")
        for a, b in zip(sent, kernel):
            require(tuple(a[k] for k in ("type", "code", "value")) ==
                    tuple(b[k] for k in ("type", "code", "value")), "kernel event mismatch")
            require(b["kernel_monotonic_ns"] >= a["producer_before_write_monotonic_ns"] - 1000,
                    "kernel timestamp precedes producer")
        paired[slot] = list(zip(sent, kernel))
        logs[slot] = (root / f"helper-{slot}.log").read_text()
        for marker in ("ready", "start", "end", "quiescent"):
            require(re.findall(r"match_" + marker + r" epoch=(\d+)", logs[slot]) == ["1", "2"],
                    f"slot {slot}: persistent two-match {marker} lifecycle absent")

    result = dict(scope=metadata["scope"], helper_sha256=metadata["helper_sha256"],
                  persistent_helper_pids=metadata["helper_pids"], matches=[])
    for epoch in (1, 2):
        prefix = f"match-{epoch}-combat-"
        assigned = {}
        by_phase = {}
        for slot in range(2):
            section = logs[slot].split(f"match_start epoch={epoch} ", 1)[1].split(
                f"match_end epoch={epoch} ", 1)[0]
            require(re.search(r"state=PAUSE ", section) and re.search(r"state=RESUME ", section),
                    f"epoch {epoch} slot {slot}: pause/resume absent")
            rows = [int(f) for f in re.findall(r"published_frame=(\d+)", section)]
            require(rows and rows == list(range(rows[0], rows[-1] + 1)), "helper frame gap/duplicate")
            assigned[slot] = {int(t): tuple(map(int, (f, h, p, r))) for t, f, h, p, r in re.findall(
                r"event mono_ns=(\d+) frame=(\d+) held=(\d+) pressed=(\d+) released=(\d+)", section)}
            by_phase[slot] = {}
            for sent, kernel in paired[slot]:
                phase = sent["phase"]
                if not (phase.startswith(prefix) or phase == f"match-{epoch}-fresh") or sent["code"] == 0x13b:
                    continue
                stamp = kernel["kernel_monotonic_ns"]
                require(stamp in assigned[slot], f"epoch {epoch} slot {slot}: missing helper event {phase}")
                row = assigned[slot][stamp]
                by_phase[slot].setdefault(phase.removeprefix(prefix), []).append((sent, row))
            for name, held, pressed, released in (
                    ("shield-lt", 256, 256, 0), ("shield-both", 768, 512, 0),
                    ("shield-rt-only", 512, 0, 256), ("shield-release", 0, 0, 512)):
                row = by_phase[slot][name][0][1]
                require((row[1] & 768, row[2] & 768, row[3] & 768) == (held, pressed, released),
                        f"epoch {epoch} slot {slot}: wrong trigger union for {name}")

        traces = [(root / f"epoch-{epoch}" / f"{slot}-wc3-melee-input-trace.txt").read_text()
                  for slot in range(2)]
        action_sets = []
        for client, trace in enumerate(traces):
            require("journal input fail" not in trace and re.findall(r"dropped (\d+)", trace) == ["0"],
                    f"epoch {epoch} client {client}: failed/dropped trace")
            records = re.findall(r"participant (\d+) frame (\d+) phase \d+ (applied (?:attack|jump) [^\"\r\n]*|special [^\"\r\n]*|grab action [^\"\r\n]*|recovery down [^\"\r\n]*|damage pose [^\"\r\n]*)", trace)
            records = [(slot, frame, text.strip()) for slot, frame, text in records]
            action_sets.append(Counter(records))
            def applied(slot, phase, kind, delay=0):
                frame = by_phase[slot][phase][0][1][0]
                hits = [(int(f), text) for s, f, text in records if int(s) == slot
                        and frame <= int(f) <= frame + delay and text.startswith(kind)]
                require(len(hits) == 1, f"epoch {epoch} client {client} slot {slot}: {phase} application absent/duplicated")
                return hits[0]
            for slot in range(2):
                applied(slot, f"match-{epoch}-fresh", "applied attack")
                applied(slot, "special", "special ")
            _, tilt = applied(0, "walk-attack", "applied attack")
            require(tilt.endswith("style 6"), "LB + direction + A did not apply forward tilt")
            for phase in ("jump-b", "jump-y", "tap-jump"):
                applied(0, phase, "applied jump", 6)
            _, grab = applied(0, "grab", "applied attack")
            require(grab.endswith("style 5"), "RB did not initiate the native grab attack")
            attacks = [(int(slot), int(frame)) for slot, frame, text in records
                       if text.startswith("applied attack ")]
            expected = [(slot, by_phase[slot][f"match-{epoch}-fresh"][0][1][0]) for slot in range(2)]
            expected += [(0, by_phase[0][phase][0][1][0]) for phase in ("walk-attack", "grab")]
            require(Counter(attacks) == Counter(expected), "extra or missing native attack (including rematch leakage)")
            require(any(int(s) == 0 and text.startswith("damage pose ") and
                        re.search(r"hitstun [1-9]\d*", text) for s, _, text in records),
                    f"epoch {epoch} client {client}: actual damaging hit absent")
            require(any(float(value) > 0 for value in re.findall(r"recovery down .*? damage ([0-9.]+)", trace)),
                    f"epoch {epoch} client {client}: positive damage absent")
        require(action_sets[0] == action_sets[1], f"epoch {epoch}: native combat outcomes differ")

        shields = []
        for slot in range(2):
            pages = list((root / f"epoch-{epoch}").glob(f"{slot}-smashcraft-response-p{slot}-run*-page*.txt"))
            require(pages, f"epoch {epoch} client {slot}: shield observations absent")
            # Only this epoch's latest run belongs to its response recording.
            latest = max(int(re.search(r"-run(\d+)-", p.name)[1]) for p in pages)
            text = "\n".join(p.read_text() for p in pages if f"-run{latest}-" in p.name)
            frames = {int(v[0]): int(v[7]) for row in re.findall(r'Preload\( "A ([^"\r\n]+)', text)
                      if (v := row.split()) and v[0].isdigit()}
            observed = [(frames[int(v[0])], int(v[6])) for row in re.findall(r'Preload\( "B ([^"\r\n]+)', text)
                        if (v := row.split()) and v[0].isdigit() and int(v[0]) in frames]
            proof = {}
            for start, end, expected in (("shield-lt", "shield-both", 1),
                                         ("shield-both", "shield-rt-only", 1),
                                         ("shield-rt-only", "shield-release", 1)):
                first = by_phase[slot][start][0][1][0] + 2
                last = by_phase[slot][end][0][1][0]
                values = [state for frame, state in observed if first <= frame < last]
                require(len(values) >= 2 and all(state == expected for state in values),
                        f"epoch {epoch} slot {slot}: confirmed {start} shield missing/dropped")
                proof[start] = len(values)
            released = by_phase[slot]["shield-release"][0][1][0]
            require(any(state == 0 for frame, state in observed if released + 2 <= frame <= released + 15),
                    "shield did not release")
            shields.append(proof)

        endpoints = []
        final = root / f"epoch-{epoch}-result"
        if not final.exists():
            final = root / f"epoch-{epoch}"
        for slot in range(2):
            trace = (final / f"{slot}-wc3-melee-input-trace.txt").read_text()
            states = re.findall(r"confirmed frame (\d+) state ([\d:]+)", trace)
            require(states and (re.search(r"participant \d+ frame \d+ phase 3 ", trace)
                                or re.search(r"humans \d+ frame \d+ phase 3", trace)),
                    f"epoch {epoch} client {slot}: trace lacks actual result phase")
            require(len(states) >= 2 and states[-1] == states[-2],
                    f"epoch {epoch} client {slot}: result endpoint is not stationary")
            endpoints.append(states[-1])
        require(endpoints[0] == endpoints[1], f"epoch {epoch}: result states differ")
        result["matches"].append(dict(epoch=epoch, native_action_records=sum(action_sets[0].values()),
                                      confirmed_shield_samples=shields, confirmed_result=endpoints[0]))
    result["limitations"] = ["Virtual Linux pads; no physical timing or cross-machine claim.",
                              "RB proves grab initiation; no in-range grab contact claim.",
                              "LB proves the native walking-modifier tilt, not a measured walking speed."]
    (root / "combat-summary.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

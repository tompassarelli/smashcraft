#!/usr/bin/env python3
"""Reconcile --controller-chat: deliberate suppression, neutral rearm and original frames."""

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


def reconcile(root):
    metadata = json.loads((root / "capture.json").read_text())
    require(metadata.get("controller_chat"), "capture was not a native chat journey")
    producer = lines(root / "producer.jsonl")
    paired, logs = {}, {}
    for slot in range(2):
        sent = [e for e in producer if e["event"] == f"slot-{slot}"]
        kernel = [e for e in lines(root / f"kernel-{slot}.jsonl") if e["type"] != 0]
        require(len(sent) == len(kernel), f"slot {slot}: producer/kernel count mismatch")
        for index, (a, b) in enumerate(zip(sent, kernel)):
            require(tuple(a[k] for k in ("type", "code", "value")) ==
                    tuple(b[k] for k in ("type", "code", "value")), "kernel event mismatch")
            require(b["kernel_monotonic_ns"] >= a["producer_before_write_monotonic_ns"] - 1000,
                    "kernel timestamp precedes producer")
            if index + 1 < len(sent):
                require(b["kernel_monotonic_ns"] <= sent[index + 1]["producer_before_write_monotonic_ns"],
                        "kernel timestamp follows next producer event")
        paired[slot] = list(zip(sent, kernel))
        logs[slot] = (root / f"helper-{slot}.log").read_text()
        for marker in ("ready", "start", "end", "quiescent"):
            require(re.findall(r"match_" + marker + r" epoch=(\d+)", logs[slot]) == ["1", "2"],
                    f"slot {slot}: persistent two-match {marker} lifecycle absent")

    result = dict(scope=metadata["scope"], helper_sha256=metadata["helper_sha256"],
                  persistent_helper_pids=metadata["helper_pids"], matches=[])
    for epoch in (1, 2):
        slot = epoch - 1
        prefix = f"match-{epoch}-chat-"
        journey = next(e for e in metadata["events"] if e["event"] == "chat" and e["epoch"] == epoch)
        require(journey["slot"] == slot, "chat fixture did not exercise each client")
        open_receipt = re.search(r" chat=(\d+) chatState=3 chatFrame=1", journey["open_receipt"]["contents"])
        require(open_receipt and int(open_receipt[1]) > 0, "native chat visibility receipt absent")
        require(f" chat={open_receipt[1]} chatState=0 chatFrame=1" in journey["closed_receipt"]["contents"],
                "controller receiver restoration receipt absent")
        require(journey.get("blocked_resume_no_publication"), "resume during chat was not rejected")
        barriers = [int(re.search(r"frame=(\d+)", p["contents"])[1])
                    for p in journey["pause_publications"]]
        resume_frames = [int(re.search(r"frame=(\d+)", p["contents"])[1])
                         for p in journey["resume_publications"]]
        require(len(barriers) == 2 and len(set(barriers + resume_frames)) == 1,
                "chat pause/resume frontiers differ")
        pause_frame = barriers[0]
        observations = {o["label"]: o for o in journey["observations"]}
        opened = [o for label, o in observations.items() if label.startswith("open-")
                  and re.search(journey["open_pattern"], o["text"], re.I)]
        require(opened and journey.get("opened_monotonic_ns"), "native chat opening unproven")
        for label in ("marker", "stimulus"):
            observation = observations[label]
            require(Path(observation["capture"]).is_file(), "native chat capture missing")
            require(journey["marker"] in re.sub(r"\s+", "", observation["text"]).upper(),
                    f"native unsent marker missing at {label}")
        for label in ("closed", "fresh"):
            require(journey["marker"] not in re.sub(r"\s+", "", observations[label]["text"]).upper(),
                    "native unsent marker remained after Escape")
        # Byte offsets bracket independently observed UI, even when transport
        # log messages have no timestamp of their own.
        raw_log = (root / f"helper-{slot}.log").read_bytes()
        chat_log = raw_log[observations["marker"]["helper_log_bytes"]:
                           observations["stimulus"]["helper_log_bytes"]].decode()
        require("editbox_emit " not in chat_log, "controller transport emitted while native chat was open")

        boundary = next(e for e in metadata["events"] if e["event"] == "start" and e["epoch"] == epoch)
        assignments, sections = {}, {}
        expected_actions, eligible_edges, suppressed_edges = [], [], []
        for player in range(2):
            section = logs[player].split(f"match_start epoch={epoch} ", 1)[1].split(
                f"match_end epoch={epoch} ", 1)[0]
            sections[player] = section
            require(re.findall(r"control sequence=\d+ state=PAUSE frame=(\d+)", section) == [str(pause_frame)],
                    "helper did not enter the shared chat pause exactly once")
            resumes = re.findall(r"control sequence=\d+ state=RESUME frame=(\d+) epoch_ns=(\d+) "
                                 r"read_ns=\d+ uncertainty_ns=(\d+)", section)
            require(len(resumes) == 1 and int(resumes[0][0]) == pause_frame,
                    "helper resume frontier differs from chat pause")
            resume_anchor = journey["resume_publications"][player]["publication_monotonic_estimate_ns"]
            require(abs(int(resumes[0][1]) - resume_anchor) <= int(resumes[0][2]),
                    "independent RESUME anchor disagrees")
            publication = boundary["publications"][player]
            first = int(re.search(r"frame=(\d+)", publication["contents"])[1])
            anchor = publication["publication_monotonic_estimate_ns"]
            helper_anchor = int(re.search(r"epoch_ns=(\d+)", section)[1])
            uncertainty = int(re.search(r"uncertainty_ns=(\d+)", section)[1])
            require(abs(helper_anchor - anchor) <= uncertainty, "independent START anchor disagrees")
            assigned = {int(t): tuple(map(int, (f, h, p, r))) for t, f, h, p, r in re.findall(
                r"event mono_ns=(\d+) frame=(\d+) held=(\d+) pressed=(\d+) released=(\d+)", section)}
            assignments[player] = assigned
            rows = [int(f) for f in re.findall(r"published_frame=(\d+)", section)]
            require(rows and rows == list(range(first, rows[-1] + 1)), "helper frame gap/duplicate")
            edges = []
            for sent, kernel in paired[player]:
                if sent["phase"] not in (f"match-{epoch}-fresh", prefix + "fresh"):
                    continue
                stamp = kernel["kernel_monotonic_ns"]
                frame = (pause_frame + (stamp - resume_anchor) * 60 // 1_000_000_000
                         if sent["phase"] == prefix + "fresh"
                         else first + (stamp - anchor) * 60 // 1_000_000_000)
                require(stamp in assigned, "eligible fresh tap missing from helper")
                row = assigned[stamp]
                require(row[0] == frame, "eligible fresh tap moved from original assigned frame")
                require(row[2 if sent["value"] else 3] & 32, "eligible attack transition missing")
                edges.append(dict(phase=sent["phase"], pressed=bool(sent["value"]),
                                  kernel_monotonic_ns=stamp, original_frame=frame))
                if sent["value"]:
                    expected_actions.append((player, frame))
            require(len(edges) == (4 if player == slot else 2), "fresh fixture edge count differs")
            eligible_edges.append(dict(slot=player, edges=edges, published_frames=len(rows)))

        def phase_events(name):
            return [(sent, kernel) for sent, kernel in paired[slot] if sent["phase"] == prefix + name]

        assigned = assignments[slot]
        suppressed = set(map(int, re.findall(r"suppressed mono_ns=(\d+)", sections[slot])))
        for name, count in (("shield-release", 1), ("suppressed", 2), ("held-across-close", 1), ("neutral", 1)):
            events = phase_events(name)
            require(len(events) == count, f"missing {name} stimulus")
            for sent, kernel in events:
                stamp = kernel["kernel_monotonic_ns"]
                row = assigned.get(stamp)
                require(row is None or not any(value & 800 for value in row[1:]),
                        "chat-period or held-through-close input leaked into gameplay")
                # The neutral event may be admitted as a zero state after it
                # re-arms. Deliberate actions must be explicitly suppressed.
                if name != "neutral":
                    require(stamp in suppressed, "chat-period input lacks explicit suppression evidence")
                suppressed_edges.append(dict(phase=name, kernel_monotonic_ns=stamp))
        shield_events = phase_events("shield")
        require(len(shield_events) == 1, "pre-chat shield stimulus absent")
        shield = assigned[shield_events[0][1]["kernel_monotonic_ns"]]
        require(shield[1] & 256 and shield[2] & 256, "pre-chat shield was not assigned")
        releases = [(int(ns), int(frame)) for ns, frame in re.findall(
            r"focus_release mono_ns=(\d+) frame=(\d+)", sections[slot])
                    if journey["enter_monotonic_ns"] <= int(ns) <= observations["marker"]["after_monotonic_ns"]]
        require(len(releases) == 1 and releases[0][1] <= pause_frame,
                "chat capture did not neutralize the hold before the shared pause")
        release_frame = releases[0][1]
        fresh = assigned[phase_events("fresh")[0][1]["kernel_monotonic_ns"]][0]

        pages = list((root / f"epoch-{epoch}").glob(f"{slot}-smashcraft-response-p{slot}-run*-page*.txt"))
        require(pages, "confirmed shield observations absent")
        latest = max(int(re.search(r"-run(\d+)-", p.name)[1]) for p in pages)
        text = "\n".join(p.read_text() for p in pages if f"-run{latest}-" in p.name)
        frames = {int(v[0]): int(v[7]) for row in re.findall(r'Preload\( "A ([^"\r\n]+)', text)
                  if (v := row.split()) and v[0].isdigit()}
        observed = [(frames[int(v[0])], int(v[6])) for row in re.findall(r'Preload\( "B ([^"\r\n]+)', text)
                    if (v := row.split()) and v[0].isdigit() and int(v[0]) in frames]
        held = [state for frame, state in observed if shield[0] + 2 <= frame < release_frame]
        released = [state for frame, state in observed if release_frame + 2 <= frame <= fresh + 5]
        require(len(held) >= 2 and all(state == 1 for state in held), "confirmed pre-chat shield absent")
        require(len(released) >= 2 and all(state == 0 for state in released), "shield stuck or reactivated")

        endpoints = []
        for client in range(2):
            trace = (root / f"epoch-{epoch}" / f"{client}-wc3-melee-input-trace.txt").read_text()
            actual = Counter((int(s), int(f)) for s, f in re.findall(
                r"participant (\d+) frame (\d+) phase \d+ applied attack ", trace))
            require(actual == Counter(expected_actions), "missing, extra, duplicated or moved native attack")
            require("journal input fail" not in trace and re.findall(r"dropped (\d+)", trace) == ["0"],
                    "native trace failed or dropped records")
            final_path = root / f"epoch-{epoch}-result" / f"{client}-wc3-melee-input-trace.txt"
            final = final_path.read_text() if final_path.exists() else trace
            states = re.findall(r"confirmed frame (\d+) state ([\d:]+)", final)
            require(re.search(r"(?:participant|humans) \d+ frame \d+ phase 3", final), "actual result phase absent")
            require(len(states) >= 2 and states[-1] == states[-2], "result endpoint not stationary")
            endpoints.append(states[-1])
        require(endpoints[0] == endpoints[1], "native result states differ")
        result["matches"].append(dict(epoch=epoch, chat_slot=slot, policy=journey["policy"],
                                      eligible_edges=eligible_edges, deliberately_suppressed_edges=suppressed_edges,
                                      pause_frame=pause_frame, shield_release_frame=release_frame,
                                      confirmed_held_samples=len(held),
                                      confirmed_released_samples=len(released), confirmed_result=endpoints[0],
                                      native_actions=[dict(slot=s, frame=f) for s, f in expected_actions],
                                      chat_evidence=journey["observations"]))
    result["limitations"] = ["Same-host virtual Linux pads; no physical or cross-machine timing claim.",
                              "Native chat evidence uses retained compositor captures and OCR; no message is sent.",
                              "Transport absence is checked between verified marker and post-stimulus observations."]
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path)
    args = parser.parse_args()
    result = reconcile(args.capture)
    (args.capture / "chat-summary.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

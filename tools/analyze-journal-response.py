#!/usr/bin/env python3
"""Measure shield-linked appearance changes in retained compositor RGB signals.

The existing native video decoder produces a/b-signals.json with exact matched
compositor timestamps and regional mean blue-minus-red. The region includes
the fighter and shield graphics; either sign can describe its appearance.
This reports that regional appearance signal, not a pure blue-tint measurement.
"""

import argparse
import json
import math
from pathlib import Path
import statistics


def summary(values):
    if not values:
        return None
    ordered = sorted(values)
    return dict(n=len(values), median=statistics.median(values),
                p95=ordered[math.ceil(len(values) * .95) - 1],
                p99=ordered[math.ceil(len(values) * .99) - 1], max=max(values))


def analyze(root):
    events = json.loads((root / "actions.json").read_text())
    if events["failures"]:
        raise ValueError("capture reported failures")
    presses = [event for event in events["actions"] if event["edge"] == "press"]
    releases = {event["trial"]: event for event in events["actions"] if event["edge"] == "release"}
    report = dict(method=("First two consecutive frames toward the held appearance, crossing "
                          "max(20% of held/idle difference, 4x measured idle noise, .015). "
                          "Release uses the opposite direction and pre-release noise. "
                          "The sign comes from the measured idle/held appearance difference. "
                          "This is appearance onset, not "
                          "pure blue-tint onset or actionability after shield release."),
                  limits=events["limits"], clients={})
    for client in "ab":
        signal = json.loads((root / f"{client}-signals.json").read_text())
        times, scores = signal["compositor_ns"], signal["blue_minus_red"]
        assert len(times) == len(scores) and all(b > a for a, b in zip(times, times[1:]))
        assert max(signal["pts_match_error_ns"]) <= 600000
        trials = []

        def samples(start, end):
            return [s for t, s in zip(times, scores) if start <= t <= end]

        def crossing(event, stop, baseline, direction, threshold):
            start, end = event["start_monotonic_ns"], event["end_monotonic_ns"]
            if any((s - baseline) * direction >= threshold for s in samples(start - 100_000_000, start - 1)):
                return dict(status="unresolved: pre-input threshold crossing")
            index = next((i for i in range(1, len(times) - 1)
                          if start <= times[i] < times[i + 1] < stop
                          and (scores[i] - baseline) * direction >= threshold
                          and (scores[i + 1] - baseline) * direction >= threshold), None)
            if index is None:
                return dict(status="censored: no onset in the observation window")
            return dict(status="observed", frame=index,
                        latency_ms=(times[index] - (start + end) / 2) / 1e6,
                        lower_ms=max(0, (times[index - 1] - end) / 1e6),
                        upper_ms=(times[index] - start) / 1e6,
                        preceding_capture_gap_ms=(times[index] - times[index - 1]) / 1e6)

        for press in presses:
            release = releases[press["trial"]]
            t, r = press["start_monotonic_ns"], release["start_monotonic_ns"]
            trial = dict(trial=press["trial"])
            trials.append(trial)
            before = samples(t - 180_000_000, t - 30_000_000)
            held = samples(r - 100_000_000, r - 20_000_000)
            if len(before) < 3 or len(held) < 3:
                trial["press"] = dict(status="censored: insufficient capture coverage")
                continue
            base, target = statistics.median(before), statistics.median(held)
            step = target - base
            noise = max(abs(s - base) for s in before)
            if abs(step) <= max(noise * 8, .05):
                trial["press"] = dict(status="unresolved: no reliable held appearance")
                continue
            direction = 1 if step > 0 else -1
            threshold = max(abs(step) * .2, noise * 4, .015)
            trial.update(baseline=base, held=target, step=step, noise=noise, threshold=threshold)
            trial["press"] = crossing(press, r, base, direction, threshold)
            release_noise = max(abs(s - target) for s in held)
            next_press = min([event["start_monotonic_ns"] for event in presses
                              if event["start_monotonic_ns"] > r] or [times[-1]])
            trial["release"] = crossing(release, next_press, target, -direction,
                                        max(abs(step) * .2, release_noise * 4, .015))
        result = dict(role="local" if client == events["args"]["actor"] else "remote",
                      trials=trials, capture_gap_ms=summary([(b - a) / 1e6 for a, b in zip(times, times[1:])]))
        for edge in ("press", "release"):
            values = [trial[edge]["latency_ms"] for trial in trials
                      if trial.get(edge, {}).get("status") == "observed"]
            result[edge] = dict(observed=len(values), unresolved_or_censored=len(presses) - len(values),
                                latency_ms=summary(values))
        report["clients"][client] = result
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    report = analyze(args.directory)
    (args.directory / "appearance-analysis.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({client: {key: value for key, value in result.items() if key != "trials"}
                      for client, result in report["clients"].items()}, indent=2))

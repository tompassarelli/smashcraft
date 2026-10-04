#!/usr/bin/env python3
"""Relate recorded local shield admission to prediction within native service rows.

The probe retains the last admitted row per callback; earlier rows from the same
packet are not separate samples. These times use only the native game clock.
"""

import argparse
import json
from pathlib import Path
import re


def analyze(directory, slot, run):
    admission, state = {}, {}
    identity = None
    count = None
    for path in directory.glob(f"smashcraft-response-p{slot}-run{run}-page*.txt"):
        text = path.read_text()
        header = re.search(r"RS v=3 build=(\S+) local=(\d+) run=(\d+) page=\d+ rows=(\d+)", text)
        if not header:
            raise ValueError(f"missing service header: {path}")
        current = header.group(1, 2, 3)
        if identity is not None and identity != current:
            raise ValueError("mixed response captures")
        identity, count = current, int(header.group(4))
        for kind, row, payload in re.findall(r'"([AB]) (\d+) ([0-9. -]+)"', text):
            destination = admission if kind == "A" else state
            index = int(row)
            if index in destination:
                raise ValueError(f"duplicate service row: {kind} {index}")
            destination[index] = [float(value) for value in payload.split()]
    if count is None or sorted(admission) != list(range(count)) or sorted(state) != list(range(count)):
        raise ValueError("incomplete service capture")
    results = []
    for row in range(count):
        a, b = admission[row], state[row]
        pressed, released = int(b[1]), int(b[2])
        if a[1] < 0 or not (pressed > 0 or released > 0):
            continue
        edge = "press" if pressed > 0 else "release"
        desired = 1 if edge == "press" else 0
        predicted = next((later for later in range(row, count) if state[later][6] == desired), None)
        result = dict(row=row, edge=edge, target=a[10], F_before=a[7], F_after=a[8],
                      prediction_row=predicted, callbacks=None, after_poll_native_ms=None)
        if predicted is not None:
            result.update(callbacks=predicted - row,
                          after_poll_native_ms=admission[predicted][4] - a[1])
        else:
            result["status"] = "censored: no matching predicted shield before capture ends"
        results.append(result)
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--slot", type=int, choices=range(4), default=1)
    parser.add_argument("--run", type=int, default=1)
    args = parser.parse_args()
    result = analyze(args.directory, args.slot, args.run)
    (args.directory / "admission-to-prediction.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))

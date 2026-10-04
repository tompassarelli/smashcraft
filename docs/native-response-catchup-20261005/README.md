# Journal prediction catch-up — 2026-10-05

The retained journal now executes up to six already-assigned local frames before
presentation, bounded by local row availability, R24 and the acknowledged pause
frontier. Legacy callback capture retains one speculative step per callback.
Original frame assignments, 60 Hz logical steps, capture, batching, transport and
replay semantics are unchanged.

The two-client native comparison removes the measured admission backlog:
13/13 retained edge-bearing rows enter the requested predicted shield state in
the admission callback, versus 1–3 callbacks later in the baseline. The probe
retains only the last admitted row per callback; this is not a complete edge
inventory. Its zero native-clock delta is same-callback evidence, not proof of
zero execution time or physical latency.

| B local appearance | Baseline | Catch-up |
| --- | ---: | ---: |
| Presses observed | 12/12 | 12/12 |
| Press median | 83.088 ms | 67.950 ms |
| Press observed maximum | 88.887 ms | 98.168 ms |
| Releases observed | 12/12 | 12/12 |
| Release median | 81.63 ms | 63.515 ms |
| Release observed maximum | 167.84 ms | 77.442 ms |
| Capture spacing median | 16.342 ms | 16.341 ms |

The median press improvement is about 15.1 ms; the maximum did not improve.
Residual visible delay remains. Twelve trials do not establish a tail bound.
Remote A detected 7/12 presses (168.065 ms median, 192.493 ms maximum) and
2/12 releases (209.431 ms median). All unresolved/censored observations remain
in wc3-melee:docs/native-response-catchup-20261005/appearance-analysis.json;
these are not counted as dropped inputs or successful responses.

Both helpers emitted original frames 1–912 exactly once with no capture failure;
both native endpoints drained at frame 912, checksum `74572:922443`. This agrees
with the baseline endpoint. The trial exercises local shield appearance and
paired confirmation, not physical controller electronics, display scanout,
movement/attack response, human play or general online fairness.

## Candidate and checks

- Diagnostic: `editbox-catchup-20261005`, epoch 1; Archer A, Rifleman B;
  journal/editbox, shadow-d0-r24, pool-predicted, clean response service probe.
- Private map:
  ~/.local/share/smashcraft-build-inputs/playable-integration-20261005/build/editbox-catchup-20261005.w3x
- Map SHA256: `cf05b108d0f18a84fa3e187bb27c41e8033893918b1ca85a581d7d32ffaa2909`.
- Unchanged helper SHA256:
  `ea6e7311e5a787cf08beeeb951cd799f01323ff3c643da9e5464098d8a36f6cb`.
- Source base: `8ad514b1e574609f666a55ba9172e698da4f947b`, plus the catch-up
  source committed with this record. The diagnostic was built before the final
  budget selector restricted legacy callback capture to one step. Its journal
  path uses the same six-step behavior as the committed source. The final
  legacy restriction and D3 capture-target regression passed the focused test;
  this native diagnostic is not evidence for the legacy path.
- Focused playback suite: 8/8 passed, zero errors; native map build: zero errors.
  After the legacy restriction, the focused admitted-pair/budget/pause/missing-row
  and D3 capture-target regression passed 1/1. Logs are retained alongside this
  record. Pause frontier behavior is unit-tested here; this trial does not repeat
  the earlier controller Start native pause trial.

## Reproduction

The capture driver is wc3-melee:tools/journal-response-capture.py from `516d45c`.
At stage selection A used Ctrl+G, then Y to start and focus journal input. The
unchanged virtual-evdev driver emitted 12 B shield holds, with compositor capture
geometry `1400,730 300x240`. Helpers exited before A used Escape, Ctrl+H and
Ctrl+T to export response pages and drained traces. No keyboard key was held
during controller emission. Each client exported 14 pages (2082 service rows).

Video decoder:
~/code/wc3-melee/worktrees/test-loop/build/two-clients/analyze-responsiveness.py,
ROI `0,0,300,240`. Maximum timestamp matching error was below 0.007 ms.
Appearance onset uses the existing regional signal and two-frame threshold;
release appearance is not a measure of actionability after shield release.

Recompute from retained numeric files at the checkout root:

```sh
python3 ~/code/wc3-melee/worktrees/editbox-pause-focus-20261005/tools/analyze-journal-admission.py ~/code/wc3-melee/worktrees/editbox-pause-focus-20261005/docs/native-response-catchup-20261005 --slot 1
python3 ~/code/wc3-melee/worktrees/playable-integration-20261005/tools/analyze-journal-response.py ~/code/wc3-melee/worktrees/editbox-pause-focus-20261005/docs/native-response-catchup-20261005
```

The admission parser also reproduces all 13 baseline observations exactly.
Baseline evidence: wc3-melee:docs/native-response-20261005/b at `516d45c`.
Original videos, Wayland timing logs and unnormalized exports remain local at
~/code/wc3-melee/worktrees/editbox-pause-focus-20261005/build/native-response-b-catchup-20261005.
Published text exports normalize line endings and trailing whitespace only.

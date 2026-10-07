# Dash-dance timing sample, 7 October 2026

Baseline: `c2aa46d3`. `before.jsonl` records 30 Archer timelines: both
facings, 9–13 held full-strength frames, then one opposite sample at
0.79, 0.8 or 1.0. Each row includes the resulting action, action frame,
facing and velocity. Ground action codes: none 0, Dash 1, Run 2,
TurnRun 3, RunBrake 4. The baseline reverses instantly after 9 or 10
held frames, even at 0.79; after 11–13 it enters TurnRun at every
amplitude. Stick magnitude has no effect on that transition.

`after.jsonl` repeats those same timelines with the authored thirteen-frame
window and two-sample 0.8 policy. A 0.79 opposite sample retains the current
dash and facing; a 0.8 or 1.0 sample reverses throughout this interval.
The exact contract is in smashcraft:ts/src/game/sim/dashDance.tests.ts:
512 timelines covering Archer/Rifleman, both facings, held durations 1–16,
immediate versus one weak travel sample, and 0.79/0.8/0.81/full digital
input. Each restores the preceding state and compares the complete fighter.
An additional recorded-input case replays across the weak/strong boundary
through ReplayHistory on every later frame, comparing the complete match.

The numerical reference comes from smashcraft:docs/design/melee/movement.md
(0.8 dash threshold, initial-dash median 13) and UCF's own documentation:

- https://www.20xx.me/ucf.html: first tilt-turn frame may cancel into
  dashback, making the opportunity two samples instead of one.
- https://www.20xx.me/ucf-changelog.html: v0.65 raised the second-sample
  requirement to 0.95; v0.73 refined accidental tilt-turn dashbacks.
- https://www.ssbwiki.com/Dash-dancing: the initial dash bounds the dance;
  a reversal after Run begins has the ordinary turnaround.

Only behavioral descriptions and numerical facts were used. No source
implementation, translated expression or proprietary assets were copied.
The equal 0.8 threshold on both samples is a deliberate Smashcraft departure
for small stick variation, documented in smashcraft:docs/gameplay-design.md.

The real-helper headless run of smashcraft:ts/test/native/pads/dash-dance.pad
reported 8 expectations satisfied, 38 edges, 0 off-frame; its raw output
is ~/.local/state/smashcraft/pads/dash-dance-175-20261007-headless/. The
native LAN run uses that same timeline and its saved moment to compare
confirmed checksums and ground-action/facing changes against headless.

These samples establish their transitions and replay behavior; physical
controller feel and exact UCF hardware emulation are outside #175's scope.

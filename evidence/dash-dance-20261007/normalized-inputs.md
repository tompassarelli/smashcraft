# Binary32 input boundary, 7 October 2026

`after-binary32.jsonl` is the player-input comparison for the 30 timelines
in `before.jsonl`. It rounds the sampled axis to binary32, as the adapter
does. The baseline ignored magnitude entirely, so its transitions do not
depend on this rounding. In this comparison, 0.8 and 1.0 reverse instantly
through thirteen held frames; 0.79 keeps the current dash and facing for
the second-sample decision. The exact sampled value is recorded per row.

The earlier `after.jsonl` injected binary64 controls directly. Its literal
0.8 is below binary32 0.800000011920929, so those samples correctly wait
instead of reversing. The README's statement that its 0.8 rows reverse
was incorrect; use `after-binary32.jsonl` for that claim. These raw-control
diagnostics are retained unchanged. The 512-case contract already uses
`f32(0.8)` and the recorded-row test uses axis 101 (below) versus 102
(above) divided by 127 through the production input adapter.

Validation: 24/24 grounded-movement and dash-dance tests pass in stock
32-bit Lua; 512 sweep cases have zero transition/rollback mismatches,
and the recorded two-sample boundary replays with equal complete state.
The focused emitted-Lua bundle imports only
smashcraft:ts/src/game/sim/groundMovement.tests.ts and
smashcraft:ts/src/game/sim/dashDance.tests.ts. Its stock interpreter is
Lua 5.3.6 built with `-DLUA_32BITS`, using the same source SHA-256 as CI.

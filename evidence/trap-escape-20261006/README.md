# Rifleman trap escape, 6 October 2026

Issue [#84](https://github.com/tompassarelli/smashcraft/issues/84). The delegated
choice retains the single 300-frame freeze and excludes a thawed fighter from
every trap until 20 frames after thaw, including when a hit breaks the ice.
Other attacks still hit; an idle fighter can be frozen again after the interval.

## Observed checks

- The regression initially failed with a waiting trap immediately restoring
  `frozenFrames` to 300 on the thaw frame.
- The frame-executor contract now escapes by jumping on frame 15 after thaw,
  for all three fighters, neutral and all eight held directions: 27 samples,
  zero refreezes. The Rifleman's five-frame squat finishes before the frame-20
  trap contact. A separate idle contract is caught again on frame 20.
- The existing aggregate command, unchanged:
  `bun wisp agency --attacker Rifleman --out FILE`, run from smashcraft:ts/ on
  `d1a3fd760ffb9bf923e929970f35d2c784a77273`, completed in 678 seconds with exit 0.
  It contains the #85 throw-hitstun restriction and #69 accepted windows.
  Of 360 caught starters, all 12 down-special samples (three victims, 0/50/100/150%)
  have no loop; zero trap loops leave three or fewer frames to act. The sweep
  enters its held-DI loop branch only for a tight neutral loop; no trap sample
  enters it. The direction coverage above independently exercises the escape.
- The same aggregate retains five tight neutral up-throw cycles, although
  none holds across every DI direction. Those counterexamples were returned
  to the existing #85 owner; this result does not pass #85's neutral-input gate.
- After cleanly merging published hit-effect main, all six freeze contracts
  and four fighter snapshot/equality contracts pass. Final type-check and the
  unchanged unused-code gate pass on `9fe85e785b52975ac7f00a3204ecc90b554ececc`:
  zero unused exports, unreachable source files or unreferenced tools.

Raw results are smashcraft:evidence/trap-escape-20261006/rifleman.jsonl and
smashcraft:evidence/trap-escape-20261006/rifleman.log. Focused integration and
unused-code logs are retained beside them.

The unchanged gameplay candidate also passed the full Bun suite, 732/732
Lua32 simulation tests, 10 replay tapes/6,830 frames with zero divergent frames
in stock and toward-zero Lua32, numeric parity (2,000 cases/22,000 results in
each Lua32, zero mismatches), CI with timing reported, and the oracle's existing
expected departures/mismatches. The move-specific interaction check reports
the Rifleman graph unchanged and that down special is outside its situations.
The later main merge adds hit presentation metadata; the final declaration
changes only remove unused exports. Their relevant integration checks are
listed above; the completed gameplay aggregate was reused.

These are source and replay measurements, without a native or balance claim.

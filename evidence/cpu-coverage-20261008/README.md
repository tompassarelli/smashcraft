# Original roster activity and computer contracts, 8 October 2026

The existing aggregate report and bot contracts pass at
`31c78c07f32f1dc12b8c3925110ee7d5a1316746`:

- `GAME_TESTS=match/bot bun test test/game.test.ts`: **99 passed, 0 failed**,
  35.27 seconds. The unchanged checks cover gameplay, mana, recovery, kit
  options, delayed observations, five-frame direction commitment, contextual
  history, successful and punishable reads, move value and deterministic replay.
- `bun scripts/cpuCoverage.ts`: **13 selectable fighters, 104 seeded Wren
  Expert matches, 0 inactive fighters**. Every fighter records movement,
  attacks, kit use, defense and recovery; there are 0 refused mana presses.
  Each fighter plays the original eight seeds for 1,800 frames.

The [Bun output](31c78c07-bun.log) and [aggregate rows](31c78c07-coverage.md)
are retained unchanged. Both commands ran inside finite heavy capacity scopes
which released after exit 0. No gameplay source, sample count or assertion was
changed for these measurements.

## Normal computer selection and prepared reads

[Hosted pad run 37662242949](https://github.com/tompassarelli/smashcraft/actions/runs/37662242949)
measured `b7897ba6cee5596b4c553dd308a9d079206fa8c5`. All thirteen existing
`cpu-roster-*.pad` scripts passed: **39/39 original expectations, 52 input
edges, 0 off-frame and 0 written late**. Each selects its fighter as a Wren
Expert computer through the normal menu rule, then observes ground action,
an applied attack and a special during the original 800-frame interval.

The same run's `cpu-reads.pad` passed **2/2 original expectations and 28 edges,
0 off-frame and 0 written late**. It uses seven repeated close shields, then
a grab and surprise jump. This is the prepared-read/surprise check shared by
#182 and #184.

[Retained verification lines](b7897ba6-pads.log) identify each script, frozen
source, result and artifact. The original numerical result files are under
`pad-results/`. Other scripts in the top-level batch are outside these two
checks; the full batch was not entirely green.

These are the authorized headless substitutes for the behavior/parity boxes,
per Tom's standing order in roadmap #16. No native client was started.
The pad source predates the later Dreadlord and Warden move changes; those
fighters' updated kit activity is included in the 31c78c07 aggregate above.
The normal computer-selection path and the scripts are unchanged between
these measurements.

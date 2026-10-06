# Bot balance data after the jab change — 6 October 2026

The same 540-match computer soak as smashcraft:evidence/soak-balance-20261006/
(`--policy cpu --matches 540 --seed 2`, the same matches and seeds), replayed
after the jab change: Archer's and Rifleman's jab 12 → 5 damage, every
fighter's jab recovery 30 → 15 frames (total 36 → 21).

## Run

- Build: smashcraft `f060f22e` (the change) on `e0ff4eaf`, Wisp `699335de`,
  Bun 1.3.13, through the machine-capacity helper (`heavy`).
- `SOAK_OUTCOMES=… bun wisp soak --policy cpu --matches 540 --seed 2`
  (soak-cpu.log, outcomes-cpu.jsonl): 148.3 s with four workers, 767.4 s
  CPU, no findings. The matches ran 163.8 game minutes against 90.9 before:
  computer matches now often run to time.
- `bun scripts/soakOutcomes.ts outcomes-cpu.jsonl` wrote summary.md.

## Before and after

Computer against computer, one deterministic result per setup; each was the
same on both stages and in all ten repeats:

| Setup | Before | After |
| --- | --- | --- |
| Rifleman vs Archer | Rifleman wins: Archer out at 48%, frame 352 | Rifleman wins on time: Archer 642% from 128 hits, Rifleman 75% |
| Archer vs Illidan | Archer wins: Illidan out at 96%, frame 502 | Illidan wins: Archer out at 122%, frame 837 |
| Rifleman vs Illidan | Rifleman wins: Illidan out at 120%, frame 862 | Illidan wins: Rifleman out at 99%, frame 645 |
| Archer mirror | double KO at 120%, frame 898 | time-out, 215% each (43 hits) |
| Rifleman mirror | double KO at 120%, frame 967 | time-out, 215% each (43 hits) |
| Illidan mirror | double KO, 162% / 158% | unchanged |

Computer against fuzz, 120 matches per computer fighter (both slots, both
stages, every opponent):

| Computer | Wins before (95% CI) | Wins after (95% CI) | Its damage per hit | Its hits per match | Fuzzed fighter's stock lost at |
| --- | --- | --- | --- | --- | --- |
| Archer | 113 (88–97%) | 107 (82–94%) | 11.54 → 5.06 | 4.5 → 8.9 | 6.1 → 7.9 s |
| Rifleman | 112 (87–97%) | 115 (91–98%) | 11.25 → 5.04 | 4.1 → 7.5 | 6.4 → 7.2 s |
| Illidan | 113 (88–97%) | 112 (87–97%) | 7.84 → 7.85 | 5.1 → 5.3 | 6.5 → 6.2 s |

## Why the computer matches changed

A probe of the Archer–Rifleman computer match in the pure simulation (not
committed) showed Archer downed at x=-472 from frame 796, hit every 42 frames
by Rifleman's jab, each hit a jab reset (down-damage state) because 5 is
below the 7-damage threshold (smashcraft:docs/physics.md, "Grounded knockdown
and jab resets"), until time ran out at 447% (the probe's match differs in
detail from the soak's, which ended at 642%). A second probe had Rifleman
jab as fast as the game allows at a downed Archer for 600 frames:

| Archer after the first reset | Start 0% | Start 30% | Start 100% |
| --- | --- | --- | --- |
| does nothing | leaves at frame 24 (2 hits) | held: 25 resets, 155% | held: 25 resets, 225% |
| stands every frame | leaves at frame 21 (2 hits) | leaves at frame 21 (2 hits) | leaves at frame 21 (2 hits) |
| rolls | leaves at frame 21 (1 hit) | leaves at frame 21 (1 hit) | leaves at frame 21 (1 hit) |
| get-up attack | 1 hit | 1 hit | 1 hit |

The computer never chooses a get-up option, so it is the "does nothing"
row. Before the change a 12-damage jab launched a downed fighter instead.

## What this shows

- The computer-against-computer results now measure the jab-reset hold on a
  passive computer, not fighter strength. They can't support or reject the
  change.
- Against fuzz, no computer fighter's win rate moved outside its interval;
  Archer's and Rifleman's computers land about twice as many hits for under
  half the damage, and the fuzzed fighter lasts 0.8–1.8 s longer.
- None of it is human play.

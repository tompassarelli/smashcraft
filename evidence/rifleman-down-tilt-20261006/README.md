# Rifleman down tilt 8 → 10: bot soak before and after — 6 October 2026

Issue #63 exercised the character-creation skill on one bounded change:
Rifleman's down tilt deals 10 damage instead of the shared 8. Archer's down
tilt and every timing are unchanged (startup 5, two active frames, 28 total).

Why this change: Rifleman has Falco's slower ground movement and Archer
Fox's faster one, yet the two shared every normal except Archer's down air.
In Melee's frame-data corpus, Falco's down tilt hits 13% and Fox's 10% on the
same frames (startup 7, active 7–9, 29 total): the slower fighter of the pair
hits harder. Rifleman keeps that ratio over the shared 8 (8 × 1.3 ≈ 10).
The hit region, launch direction and knockback growth/base are the shared
ordinary ones; only the damage and what it scales change.

## What the change does at 0%, weight 100 (smashcraft:tools/move-data/moves.jsonl)

| Rifleman down tilt | Before | After |
| --- | ---: | ---: |
| Damage | 8 | 10 |
| Knockback | 43.60 | 46.40 |
| Hitstun | 17 | 18 |
| Hitlag, each side | 5 | 6 |
| Digital shield damage / shieldstun | 5.6 / 5 | 7 / 6 |

## Runs

- Before: smashcraft `c7ec03a8` (origin/main). After: the same with the
  change. Wisp `4aa9418`, Bun 1.3.13, four workers, through the
  machine-capacity helper (`heavy`).
- `SOAK_OUTCOMES=… bun wisp soak --policy cpu --matches 540 --seed 2
  --minutes 20` (soak-cpu-before.log, soak-cpu-after.log): 92.2 s and
  109.0 s, no findings either time.
- `bun scripts/soakOutcomes.ts` wrote summary-before.md and
  summary-after.md. The soak plays a match again to confirm a costly frame
  and that replay wrote its result twice (11 duplicates before, 23 after);
  the summary now counts each match once.
- `bun wisp oracle` after the change (oracle.log): 179 pass, 0 mismatch,
  6 departures, 19 n/a. The oracle checks shared rules and borrowed
  movement, not move damage, so this change can't move it.

## Before and after

Computer against computer, one deterministic result per setup: every setup
is identical except the Rifleman mirror on sky-deck. Before, player 1 won at
frame 792, player 2 out at 94% after 14 hits taken (player 2 landed one down
tilt); after, player 1 won at frame 1130, player 2 out at 91%, 12 hits each.
Rifleman landed no down tilt in any other computer-against-computer setup.

Computer against fuzz, 120 matches with Rifleman as the computer: 118 wins
before, 120 after. Its damage per landed hit 6.89 / 6.84 / 7.04 → 6.90 /
6.99 / 7.16 against Archer / Rifleman / Illidan. Down tilts the computer
Rifleman landed: 38 → 35.

Two of the 300 matches without Rifleman also differ between the runs
(indices 473 and 485, both computer against fuzz). The code they run is
identical, so fuzz-match outcomes vary between runs by about that much;
read the fuzz rows as that noise level, not as an effect.

## What this shows

- The change does what it says in the production data and moves no other
  fighter's result.
- A 2-damage change on one tilt is below what this soak resolves as a
  balance effect. It is a bounded, measured workflow exercise, not a balance
  claim; Tom can veto it.
- None of it is human play, native timing or feel.

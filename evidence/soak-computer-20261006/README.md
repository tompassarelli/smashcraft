# Computer opponent soak, before and after #56 — 6 October 2026

The 540-match computer soak (`bun wisp soak --policy cpu --matches 540
--seed 2`: fuzz/cpu, cpu/cpu and cpu/fuzz, 180 each, every ordered fighter
pair on both stages), once with the computer on `main` and once with the
#56 computer, both recorded with the same outcome recorder.

## Runs

- Before: smashcraft `4eab3f39` (origin/main) with the #56 branch's
  smashcraft:ts/test/soak/game.ts and smashcraft:ts/scripts/soakOutcomes.ts
  copied in, so both runs record the same fields. After: smashcraft
  `83caef18` (branch bot-ai-20261006, the #56 computer merged with
  `4eab3f39`). Wisp `9ce7eef`, Bun 1.3.13, four workers, through the
  machine-capacity helper (`heavy`).
- `SOAK_OUTCOMES=… bun wisp soak --policy cpu --matches 540 --seed 2
  --minutes 20` (soak-cpu-before.log, soak-cpu-after.log; both no
  findings), then `bun scripts/soakOutcomes.ts` (summary-before.md,
  summary-after.md).
- "Left the stage on its own" counts a computer that leaves the main deck
  (airborne past an edge) with no hit taken in the previous 60 frames while
  its opponent is on the deck. A self-destruct is a stock lost more than 3 s
  after the last hit taken. Counts in the per-fighter tables are over every
  match played, the ten identical repeats of each computer-vs-computer setup
  included.

## Results

| Over all 540 matches | Before | After |
| --- | ---: | ---: |
| Computer left the stage on its own | 12 (Archer 10, Rifleman 2) | 0 |
| Computer self-destructs | 1 (Archer) | 0 |
| Time-outs | 80 | 0 |
| Time-outs with a fighter jab-reset 5+ times | 40 | 0 |
| Attacks the computer blocked / dodges it started | 0 / 0 | 268 / 277 |
| Computer wins against fuzz (Archer, Rifleman, Illidan, of 120 each) | 108, 116, 112 | 118, 118, 116 |

Moves the computer landed: before, Archer landed only jab, neutral air and
up special, Rifleman jab and neutral air, Illidan those three and his dash
attack (an up special counts when used: Archer's and Illidan's strike
nothing). After, every jab, tilt (forward, angled up and down, up, down),
smash, aerial and special landed for every fighter, as did grab, pummel, all
four throws and the get-up attack; the fewest were Rifleman's up special (1, the recoil shot) and
Illidan's forward and up throws (1 each). No fighter landed a ledge attack:
the computer takes it from a ledge when its opponent stands within reach, but
in these matches it hung on a ledge only after trades that left the opponent
on the far ledge or out of reach.

Computer against computer, each setup ten times with different seeds, every
repeat identical (winner, frame, damage, hits, stock losses) for all 18
setups. Before, the Archer and Rifleman mirrors and Archer–Rifleman timed out
(Archer 642% from jab resets); after, every setup ends by a KO (frames 358
to 1717).

## What this shows

- The computer no longer leaves the stage while its opponent is on it, and no
  match ends on time from a jab-reset hold.
- It uses its whole jab/tilt/smash/aerial and special moveset where those
  reach, plus grabs, throws and get-up attacks, and defends some attacks.
- None of it is human play or native timing.

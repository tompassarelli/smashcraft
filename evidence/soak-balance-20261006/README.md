# Bot balance data: soak outcomes per fighter pair — 6 October 2026

Issue #12's balance data from bots instead of a human playtest: 2,340 headless
soak matches of the playable build, every ordered fighter pair (Archer,
Rifleman, Illidan) on both stages, with the computer (`cpu`) and the fuzzed
controller (`fuzz`) as players. summary.md is the per-pair table.

## Runs

- Build: smashcraft `1bbab8c4` with the outcome recorder committed as
  `01db0f8c` (its logic unchanged since these runs), Wisp `699335de`, Bun
  1.3.13. Each one-stock, one-minute match is a soak match
  (smashcraft:ts/test/soak/game.ts), recorded with `SOAK_OUTCOMES`.
- `bun wisp soak --policy cpu --matches 540 --seed 2` (soak-cpu.log,
  outcomes-cpu.jsonl): fuzz/cpu, cpu/cpu and cpu/fuzz, 180 each. 100.6 s
  with four workers, 519.5 s CPU, no findings.
- `bun wisp soak --policy fuzz --matches 1800 --seed 3` (soak-fuzz.log,
  outcomes-fuzz.jsonl): fuzz/cpu, fuzz/fuzz, cpu/fuzz, fuzz/absent and
  absent/fuzz, 360 each. 375.7 s with four workers, 1,838.6 s CPU. 184
  findings in 178 matches: 177 `catch-up` in matches with an absent player,
  one `catch-up` in a fuzz/fuzz match (index 1192). Findings don't change a
  result; matches with an absent player are left out of the summary.
- Both through the machine-capacity helper (`heavy`).
- `bun scripts/soakOutcomes.ts outcomes-cpu.jsonl outcomes-fuzz.jsonl`
  wrote summary.md.

## Results

Win rates are of decisive matches with a 95% Wilson interval. A is the first
fighter; in cpu vs fuzz it is the computer.

**Computer against computer is one match per setup.** The 180 cpu/cpu matches
were 18 setups repeated ten times; every repeat of a setup ended on the same
frame with the same damage, hits and winner, and each non-mirror pairing
ended the same on both stages. The summary counts them once. Mirrors end in
a double KO on the same frame (Archer at 120%, frame 898; Rifleman at 120%,
967; Illidan at 162%, 1703 on sky-deck and 158%, 1538 on three-bridges): no
player-slot advantage. Non-mirror results (hits and damage per hit: first
fighter / second):

| Setup | Result | Hits landed | Damage per hit |
| --- | --- | ---: | ---: |
| Rifleman vs Archer | Rifleman wins, Archer out at 48%, frame 352 | 4 / 5 | 12.00 / 12.00 |
| Archer vs Illidan | Archer wins, Illidan out at 96%, frame 502 | 8 / 5 | 12.00 / 8.20 |
| Rifleman vs Illidan | Rifleman wins, Illidan out at 120%, frame 862 | 10 / 10 | 12.00 / 7.00 |

The computer only chases, jumps, recovers and jabs (neutral air when
airborne). Archer's and Rifleman's jab deal 12, Illidan's 5 (his neutral air
7; a jab while dashing becomes his dash attack).

A temporary trace of Archer's state in the Rifleman setup (not committed)
shows how Archer's stock was lost at 48%: grounded at x=531 at frame 252, past
the main deck's edge (x=600) and falling by frame 264, back with his aerial
jump and up special (z=-262 at frame 284, z=-2 at 296), hit by Rifleman's jab
at x=561, z=11 at frame 302 with no jump or special left, and below the
bottom blast zone by frame 352. The computer ran Archer off the deck while
chasing.

**Computer against fuzz (720 matches, 120 per ordered pair).** The computer
wins 92–97% of every pairing. Pooled by the computer's fighter: Archer
341/360 (95%), Rifleman 344/360 (96%), Illidan 338/360 (94%). Pooled by the
fuzzed fighter: each wins 5–6% (Archer 18, Rifleman 18, Illidan 21 of 360).
The fuzzed fighter's stock lasts 5.9–7.1 s and is lost at 37–55%. Damage per
landed hit: computer Archer 11.45–11.72, Rifleman 11.10–11.50, Illidan
7.79–7.80; fuzzed fighters 9.53–10.72.

**Fuzz against fuzz (360 matches: 80 per non-mirror pair, 40 per mirror).**

| Pair | A win rate (95% CI) | Self-destructs A / B | Stock time s |
| --- | --- | --- | ---: |
| Archer vs Rifleman | 29% (20–39) | 43 / 17 | 11.4 |
| Archer vs Illidan | 43% (32–53) | 39 / 27 | 12.4 |
| Rifleman vs Illidan | 49% (38–60) | 28 / 29 | 18.6 |
| Mirrors (P1) | Archer 63% (47–76), Rifleman 50% (35–65), Illidan 50% (35–65) | | |

Archer wins 57 of his 160 non-mirror matches (36%, 29–43%). Across all 240
appearances each, a fuzzed Archer loses his stock more than 3 s after any hit
113 times (47%), Illidan 84 (35%), Rifleman 71 (30%). Damage per landed hit:
Archer 8.88–9.63, Illidan 7.46–8.64, Rifleman 6.51–7.70.

## What this data can and cannot show

- cpu/cpu: three deterministic non-mirror results, each one sample of a jab-
  only computer. The intervals in summary.md treat four setups as samples;
  they are not evidence of matchup strength.
- cpu vs fuzz: no fighter difference is measurable on either side (spread
  2 points, intervals about ±2.5 points). Damage per hit differs (12 vs 5 jab)
  without changing who wins or how fast.
- fuzz vs fuzz: free of computer bias, but it measures how each fighter fares
  under random input. Archer's deficit comes with self-destructs, not with
  damage taken from the opponent.
- None of it is human play, native timing or feel.

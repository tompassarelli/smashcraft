# Mountain King bot soak — 6 October 2026

Headless soak of the playable build with Mountain King selectable (#96):
every ordered pair that includes him, on every stage, with the computer
(`cpu`) and the fuzzed controller (`fuzz`) as players. summary.md is the
per-pair table.

## Run

- Build: smashcraft hero-mountain-king-20261006 at `11d6c688` (main
  `0cdaedb5` plus Thunder Leap `facesStick`), Wisp from smashcraft:ts/wisp.lock,
  Bun 1.3.13, through the machine-capacity helper (`heavy`).
- `SOAK_OUTCOMES=outcomes-cpu.jsonl bun wisp soak --fighter mountain-king --policy cpu --matches 330 --seed 2`
  (soak-cpu.log): 330 matches, 274,408 frames, 276 s with four workers,
  scene checks on, no findings (no desync, typing or scene finding).
- `bun scripts/soakOutcomes.ts outcomes-cpu.jsonl` wrote summary.md.
- The same run before `facesStick` (`0cdaedb5`) gave the same cpu-vs-cpu
  table and 25 instead of 24 stock losses with no hit in the last 3 s.

## Results

- Computer against computer, Mountain King won 26 of 100 matches against
  the other fighters except Uther (Archer 1-19, Rifleman 6-14, Illidan 5-15,
  Blademaster 9-11, Lich 5-15) and 20 of 20 against Uther.
- His hits deal the most damage per hit of any fighter in these matches
  (10.0-12.7 against 6.7-10.1 for his opponents).
- 24 of his stock losses in 240 computer matches came more than 3 s after
  the last hit (counted as self-destructs). A traced match shows the
  mechanism: launched 400-500 units past the ledge, his 0.82 air speed and
  0.7H Thunder Leap drift fall short, or an opponent hits him out of the
  leap after it is spent. This is the roster's stated weakness (slow
  approach, limited air drift), measured.
- The outcome recorder does not attribute hero special hits or hero
  projectiles, so the specials columns read zero for every hero; the
  normals, grabs and throws columns are complete.

Bot results are deterministic computer-versus-computer and fuzz data, not
balance: Tom can veto any tuning.

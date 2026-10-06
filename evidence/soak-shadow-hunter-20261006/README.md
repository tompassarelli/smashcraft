# Shadow Hunter bot soak — 6 October 2026

A headless soak of the playable build with Shadow Hunter selectable (#96).
It covers every ordered pair that includes him, on every stage, with the
computer (`cpu`) and the fuzzed controller (`fuzz`) as players.
summary.md holds the per-pair table.

## Run

- Build: smashcraft hero-shadow-hunter-20261006 at `741233df` (main
  `206de64c` plus Loa Vault `facesStick`), Wisp from smashcraft:ts/wisp.lock,
  Bun 1.3.13, through the machine-capacity helper (`heavy`).
- `SOAK_OUTCOMES=outcomes-cpu.jsonl bun wisp soak --fighter shadow-hunter --policy cpu --matches 330 --seed 2`
  (soak-cpu.log): 330 matches, 296,814 frames, 150 s with four workers.
  Scene checks were on and found nothing (no desync, typing or scene finding).
- `bun scripts/soakOutcomes.ts outcomes-cpu.jsonl` wrote summary.md.
- The same run on main `206de64c`, before `facesStick`, gave the same
  cpu-vs-cpu wins except one more against the Rifleman. It also gave 36
  instead of 33 of his stock losses with no hit in the last 3 s.

## Results

- Computer against computer, Shadow Hunter won 46 of 140 matches. By
  opponent: Archer 0-20, Rifleman 4-16, Illidan 6-14, Blademaster 3-17,
  Mountain King 5-15, Warden 2-8, Uther 6-4, Lich 10-0 and Dreadlord 10-0.
- He lands his glaive normals often (forward tilt and its angles, forward
  smash, neutral air), and his damage per hit is middling (7.1-10.7).
- 33 of his stock losses in 240 computer matches came more than 3 s after
  the last hit (counted as self-destructs). Against Blademaster, Mountain
  King and Warden this was 7-9 per 20 or 10 matches. Loa Vault's 0.6H drift,
  set exactly during its window, is the shortest lateral recovery of the
  kits measured so far. Turning the vault toward the stick removed only 3 of
  these losses, so the cost is the vault's reach, not its direction.
- The outcome recorder does not attribute hero projectiles or placed-object
  shots. The side-special column therefore reads zero for him and does not
  show how often the computer set a ward.

Bot results are deterministic computer-versus-computer and fuzz data, not
balance: Tom can veto any tuning.

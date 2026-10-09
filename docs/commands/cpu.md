# Cpu

- Roster AI coverage: `bun scripts/cpuCoverage.ts` prints movement, attacks,
  kit use, defense and recovery for all selectable fighters over eight
  seeded Wren Expert matches each; `SWEEPS=1 GAME_TESTS=botCoverage bun test test/game.test.ts`
  checks the same report as a sweep (in Bun and Lua32), and the suite plays
  one seeded match a fighter.

- CPU reads and move value: smashcraft:docs/design/cpu-profiles.md describes
  bounded contextual habits, anticipatory commitments and risk-aware move
  choice; smashcraft:ts/src/game/match/botStrategyContracts.tests.ts checks
  adaptation, punishable reads, buffering and seeded decision variety.

- Named-opponent calibration: `bun scripts/cpuCalibration.ts [--revision SHA]
  [--out FILE] [--json FILE]` from ts/ measures all 30 identity/tier rows over
  seeds 0–9, with 100 eligible decisions per measure, distributions and hard
  collection/fairness/replay failures. `gh workflow run cpu-calibration.yml
  -f ref=COMMIT` runs the same report hosted. Procedure and remaining behavior
  gates: smashcraft:docs/design/cpu-profiles.md, "Calibration report".

- Difficulty report: `gh workflow run cpu-tiers.yml -f ref=COMMIT` measures Wren at every tier pair with `cpuTiers` (20 matches per pair, 100 Expert-vs-Rookie matches). The run summary and `cpu-tiers` artifact hold its table.

- Release roster: `bun scripts/releaseRoster.ts FIELD.json` (from ts/) writes
  smashcraft:ts/src/game/sim/heroes/releaseRoster.ts from a gate run's
  `cpuField --json` file: fighters outside the field band are hidden from
  selection (grid, stepping, opening picks) for players and computers, while
  measurement tools and named `-dev` commands keep every fighter. Empty
  unless the balance owner cuts a release build (smashcraft:docs/design/roster.md, "Balance gate").

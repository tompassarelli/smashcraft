# Testing

- Logic: run the tests a change affects locally (`bun wisp dev`), full suites
  on the farm: `bun wisp farm test --wait` runs the full Bun suite (`bun run
  test`) and the 32-bit Lua suite (`LUA=<32-bit lua> bun scripts/lua-tests.ts`)
  for HEAD on GitHub's free runners and prints the counts and each failing
  test (wisp:docs/farm.md). Don't run the full suites on this machine.
  `bun run check` type-checks.

- Sweeps: a test that plays many matches, a whole roster or every stage is a
  sweep: register it with `sweep()` (smashcraft:ts/src/runtime/sweep.ts, or
  smashcraft:ts/test/sweep.ts in Bun-only files) and keep its smallest form,
  such as one seeded match, as an ordinary test. The suite skips sweeps;
  `SWEEPS=1 bun run test` and `SWEEPS=1 bun scripts/lua-tests.ts` run only
  them, and CI's Sweeps (Bun) and six Lua32 (sweeps) jobs run them on every push,
  so a failing sweep turns main red (#243).
  `LUA_PARTITION=K/N` divides `LUA_JOBS` name-hash shards across N jobs;
  CI runs at most six Lua jobs alongside its two Bun jobs.

- Test cost: ts/AGENTS.md sets the per-test ceilings. The Lua32 runner
  (`bun scripts/lua-tests.ts`, enforced by smashcraft:ts/scripts/testCost.ts)
  counts each test's Lua VM instructions and kilobytes allocated, charges
  them to its src module and compares each module with its row in
  smashcraft:ts/test/lua/cost-baseline.tsv. Counts are deterministic for a
  runtime and test order, so every machine judges alike and nothing is
  scaled (#394). A test over 420M instructions (the 6 s ceiling at the
  reference runner's 70M instructions per second) fails, and so does a module
  whose instructions or allocation rise more than 25% (and more than 70M
  instructions or 16 MB) at the same test count; both name the module and say
  "shrink it or move it to the farm" (shrink it, or make it a `sweep()`). A
  new module or a changed test count passes under the ceiling and rewrites
  its row: commit it with the tests. `TEST_COST_UPDATE=1` rewrites every
  measured row, after a cut. The farm's merge job judges every shard's rows,
  and the pre-push gate (`TEST_COST_WRITE=0`) prints changed rows without
  writing them. Natives are counted by the frame-cost gate
  (`bun wisp perf compare`), not here. `bun run test` reports each run's CPU
  and five heaviest tests without gating them, and fails only a test over
  the 4 s Bun ceiling; ts/test/cost-baseline.tsv holds CPU estimates that
  order processes and the pre-push selection. CPU and wall-clock budgets
  are judged only in the exclusive-lease perf measurements (#168). Tests get
  Wisp's two-minute timeout, which only catches hangs; a test that asserts
  speed is a `timingTest`, which the runner runs alone after the suite
  (wisp:docs/testing.md).

- Oracles: every test's title ends with its oracle, where its expected value
  comes from outside the code under test: `[native]` (real-game captures or
  replay tapes from real matches), `[reference]` (an independent
  implementation: Wurst parity, Bun vs 32-bit Lua, retail Melee recordings),
  `[spec #N]` or `[spec docs/…]` (a value Tom or a design doc set, cited),
  `[repro #N]` (reproduces a real defect and fails on the pre-fix code) or
  `[invariant]` (holds however the code computes it: same seed twice, equal
  client checksums, round trips, rollback equals straight play). A headless
  expectation no native capture has confirmed yet is `[provisional]` and
  listed on wisp#69. A test without an oracle restates the code: don't write
  it. `bun run test` and `bun scripts/lua-tests.ts` refuse to run when a
  title lacks a tag (smashcraft:ts/scripts/oracleTags.ts), so titles stay
  literal text (#243).

From ts/, `bun test test/game.test.ts -t NAME` runs focused game tests;
`bun run check` checks host and map types. Use
`LUA=<32-bit lua> GAME_TESTS=PATH bun scripts/lua-tests.ts` for affected emitted-Lua tests and
`bun wisp map build ...` to build a map. See smashcraft:docs/development-loop.md
for the local toolchain and base-map setup.

Pure simulation tests establish logical rules, not Warcraft callback timing,
physical-controller latency, UI focus or online fairness. For those claims,
use the native map and retain exact candidate, input path and measured evidence.
Consume the physics agent's published changes without silently overwriting its
work. Include all mutable gameplay state in deterministic snapshots/replay.

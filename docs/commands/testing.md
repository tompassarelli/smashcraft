# Testing

- Logic: run the tests a change affects locally (`bun wisp dev`), full suites
  on the farm: `bun wisp farm test --wait` runs the full Bun suite (`bun run
  test`) and the 32-bit Lua suite (`LUA=<32-bit lua> bun scripts/lua-tests.ts`)
  for HEAD on GitHub's free runners and prints the counts and each failing
  test (wisp:docs/farm.md). Don't run the full suites on this machine.
  `bun run check` type-checks.

- Where tests live: a module's tests are in one place. Map code (everything
  compiled to Lua, under ts/src and the Lua parts of ts/scripts/wisp) keeps
  camelCase `*.tests.ts` beside its module; the Lua32 suite and
  test/game.test.ts run them. Host tools test in kebab-case
  `ts/test/*.test.ts`, which `bun run test` runs; list a new one in
  smashcraft:ts/tsconfig.json's `include` so `bun run check` type-checks it.

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
  measured row, after a cut. The farm's merge job judges every shard's rows.
  Natives are counted by the frame-cost gate (`bun wisp perf compare`), not
  here. `bun run test` counts the frames stepMatch simulates in each test
  (smashcraft:ts/test/testCost.ts) and fails a test over the 58,000-frame
  Bun ceiling, 4 s at a farm runner's 14,500 frames per CPU second; work that steps no frames is
  bounded only by the hang timeout. It reports each run's CPU and five
  heaviest tests by CPU and by frames without gating CPU;
  ts/test/cost-baseline.tsv holds CPU estimates that order processes. CPU
  and wall-clock budgets are judged only in the exclusive-lease perf
  measurements (#168). Tests get a 60 s timeout, which only catches hangs; a test that asserts
  speed is a `timingTest`, which the runner runs alone after the suite
  (wisp:docs/testing.md).

- Kinds: every test's title ends with exactly one kind tag (#422):
  `[k1 scenario]` (replayed input through the whole system, asserting
  invariants or agreement), `[k2 property]` (a property over a pure core),
  `[k3 measure #N]` or `[k3 measure docs/<path>.md]` (an owner-decided number,
  citing the issue or an existing doc), `[k4 reference <source>]` (an external
  reference: `melee`, `melee-decomp`, `lua32`, `wurst`, `native`, …) or
  `[k5 boundary <name>]` (one integration check per real boundary, each name
  once in the suite). A test that fits no kind is scaffolding: don't write it.
  `bun run check`, `bun run test` and `bun scripts/lua-tests.ts` refuse a
  title that breaks this (smashcraft:ts/scripts/oracleTags.ts), so titles stay
  literal text (#243).

- Literal copies: an expectation reads a tunable constant instead of
  restating its value, so retuning it breaks no unrelated test (#394).
  `bun run literal-copies` lists every `assertEquals` whose expected literal
  equals a numeric constant exported by a module the test imports and named
  like the asserted value; `bun run test` refuses to run while it lists any.

- Seed offsets: `SWEEP_SEED_OFFSET=N SWEEPS=1 bun test test/game.test.ts`
  shifts every computer sweep's match seeds by N (`sweepSeed()` in
  smashcraft:ts/src/runtime/sweep.ts). A computer-behaviour sweep is a
  property whose title states its threshold and the range seen on three
  unrelated offsets, or a measurement with a tolerance band (#394).

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

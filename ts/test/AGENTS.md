# Tests

Doctrine: the `testing` skill. A test is one of five kinds (recorded scenario, property over a pure core, product measurement, external reference, one integration check per real boundary); anything else is scaffolding and is deleted before landing.

Where tests live and run:
- Game rules: `src/**/*.tests.ts` with `test` from `wisp/src/runtime/testing`, no Bun or Node imports. Bun runs them through `test/game.test.ts` (`GAME_MODULES=game/x/y.tests.ts bun test test/game.test.ts`); `scripts/lua-tests.ts` compiles the same modules to Lua and runs them in 32-bit Lua, Warcraft's number model.
- Host tools and assets: `test/*.test.ts` and `scripts/*.tests.ts` with `bun:test`; `bun run test FILE...` runs some, the farm runs all (docs/commands/testing.md).
- Sweeps: `sweep()` (src/runtime/sweep.ts) for many matches, a whole roster or every stage; the suite skips them and CI runs them with `SWEEPS=1`. A seeded bot sweep is a property with a stated margin that holds at 3 unrelated seed offsets, or a measurement with a tolerance band; never a ranking or count one seed shift can flip (#394).

Kinds, the one tag every title ends with (`bun run check` refuses any other ending; ts/scripts/oracleTags.ts, #422):
- `[k1 scenario]`: replayed input through the whole system, asserting invariants or agreement (same seed twice, rollback equals straight play, equal client checksums).
- `[k2 property]`: a property over a pure core: round trips, bounds, every generated input.
- `[k3 measure #N]` / `[k3 measure docs/<path>.md]`: an owner-decided number, citing the issue or the existing doc that sets it. Read the tuned constant from the code rather than copying its literal, so retuning never breaks an unrelated test.
- `[k4 reference <source>]`: an external reference such as `melee`, `melee-decomp` (`scripts/meleeOracle.ts`; departures listed in docs/gameplay-design.md), `lua32`, `wurst` or `native` (real Warcraft captures or tapes). Headless code never establishes Warcraft callback timing, controller latency, UI focus or online fairness; those need the native map.
- `[k5 boundary <name>]`: one integration check per real boundary; each name once in the suite.
- A regression is folded into the property or scenario that should have caught it instead of becoming a standalone test.

Cost: ts/AGENTS.md sets 4 s CPU per Bun test and 6 s per Lua32 test.

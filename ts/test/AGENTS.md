# Tests

Doctrine: the `testing` skill. A test is one of five kinds (recorded scenario, property over a pure core, product measurement, external reference, one integration check per real boundary); anything else is scaffolding and is deleted before landing.

Where tests live and run:
- Game rules: `src/**/*.tests.ts` with `test` from `wisp/src/runtime/testing`, no Bun or Node imports. Bun runs them through `test/game.test.ts` (`GAME_MODULES=game/x/y.tests.ts bun test test/game.test.ts`); `scripts/lua-tests.ts` compiles the same modules to Lua and runs them in 32-bit Lua, Warcraft's number model.
- Host tools and assets: `test/*.test.ts` and `scripts/*.tests.ts` with `bun:test`; `bun run test FILE...` runs some, the farm runs all (docs/commands/testing.md).
- Sweeps: `sweep()` (src/runtime/sweep.ts) for many matches, a whole roster or every stage; the suite skips them and CI runs them with `SWEEPS=1`. A seeded bot sweep is a property with a stated margin that holds at 3 unrelated seed offsets, or a measurement with a tolerance band; never a ranking or count one seed shift can flip (#394).

Oracles, the tag every title ends with:
- `[native]`: real Warcraft captures or tapes from real matches. Headless code never establishes Warcraft callback timing, controller latency, UI focus or online fairness; those need the native map.
- `[reference]`: an independent implementation: Bun against Lua32 parity, Wurst parity, and Melee via `scripts/meleeOracle.ts` against the decompilation; its departures are listed in docs/gameplay-design.md.
- `[spec #N]` / `[spec docs/...]`: a value Tom or a design doc set. Read the tuned constant from the code rather than copying its literal, so retuning never breaks an unrelated test.
- `[invariant]`: holds however the code computes it: same seed twice, rollback equals straight play, round trips, equal client checksums.
- `[provisional]`: headless expectation not yet confirmed natively (wisp#69).
- `[repro #N]`: fold the case into the property or scenario that should have caught it instead of adding a standalone test.

Cost: ts/AGENTS.md sets 4 s CPU per Bun test and 6 s per Lua32 test.

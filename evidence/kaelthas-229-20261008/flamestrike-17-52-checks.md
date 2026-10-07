# Flame Strike timing checks

Measured 7 October 2026 UTC in the `codex-kaelthas-229-flamestrike`
worktree, from base `5493f858` with the gameplay change in this commit.
The discarded prediction patch `b222e886` is absent.

- Placement remains frame 8; projectile activation age is 10 and lifetime is
  45. First contact is frame 17; last possible contact is frame 52: 36 active
  frames. Cast end remains 43, damage 10, mana cost 20, radius 65 and placement
  x180/z45. One contact consumes the flame.
- Bun: `GAME_TESTS=kaelthas bun test test/game.test.ts`, 9 passed, 0 failed.
- Lua32: the same 9 Kael contracts passed, exit 0. A temporary entry imported
  only `kaelthas.tests.ts` and ran all 9 registered tests. Its config extended
  `tsconfig.lua-tests.json`, retaining the Warcraft number plugin. Compilation
  used `bun --bun node_modules/typescript-to-lua/dist/tstl.js -p
  tsconfig.kael-flame-lua.json`; execution used the existing Lua 5.3.6
  `LUA_32BITS` binary in the `codex-perf-20261007` worktree.
- Contracts include no hit before 17, exact hit on 17, delayed fire appearance,
  late entry at 40 and 52, no hit on entry at 53, one hit, shielded damage 0,
  startup cancellation, both facings, original normals, grabs, other specials
  and the original Mewtwo body values. The new timing contracts first failed
  against the old gameplay values; all passed after the timing change and
  grounding the late-entry fixture's offstage waiting target before entry.
- CPU: 8 seeded matches through `fighterCoverage`, 52/8/7/11 uses of neutral,
  side, up and down specials; 134 ordinary attacks; 0 missing actions. The full
  counts and opponent choices are in `cpu-flamestrike-17-52.json`.
- `bun test test/move-list.test.ts`: 1 passed, 0 failed. The generated page
  remains current because Kael is not yet selectable.

Every local test and compilation ran in a `heavy` capacity scope, with the
project's short-test engine settings. All command scopes released. Temporary
entry/config files were removed. This check did not run the native clients,
the full suite or a balance field; the coordinated three-pair comparison owns
the candidate's balance result.

# Tinker final gameplay contracts

Gameplay candidate: `763c41dd`. Roster integration: `7f819579`.

- `GAME_TESTS=tinker bun test test/game.test.ts`: 26 passed, 0 failed.
- The same 26 registered contracts compiled with the repository's Warcraft
  number plugin and ran in 32-bit Lua: 26 passed, 0 failed, 0.206 seconds.
- After merging Thrall's generic damage registration, `bun run check` passed
  and `contactDamageClips(Character.tinker)` returned the authored nine-cell
  `TINKER_DAMAGE_CLIPS` grid.

The Lua entry imported `wisp/src/runtime/testing` and
`src/game/sim/heroes/tinker.tests.ts`, then ran every registered contract.
Its temporary configuration extended `tsconfig.lua-tests.json`, replacing
only the entry, included files, bundle name and output directory. Compile:
`bun --bun node_modules/typescript-to-lua/dist/tstl.js -p tsconfig.tinker-lua.json`.
Runtime: `codex-perf-20261007/ts/build/lua-stock/lua-5.3.6/src/lua`.

The final added contract accepts one light hit during Robo-Goblin armor,
then checks that a second light hit interrupts it. All other move contracts
and the full eight-match CPU trial are described in `README.md`; raw CPU
counts are in `coverage.json`.

The live issue now has four automated boxes; Tom removed the human verdict
box. Selection and the combined 40–60% seeded field remain pending in this
trial. Tinker is still hidden until its assembled private assets are ready.

# Kael’thas candidate checks

Candidate: `a525a537`, with `complete: false` until asset integration.

- TypeScript: pass.
- Bun: 8 Kael’thas combat contracts, 3 projectile presentation contracts,
  9 pain selections and 5 disjoint hit-accent contracts passed.
- Lua32: the same 8 Kael’thas combat contracts passed, exit 0. A temporary
  entry imported `kaelthas.tests.ts` and ran `registeredTests()` with a config
  extending `tsconfig.lua-tests.json`, including its number plugin. Compiled
  with `bun --bun node_modules/typescript-to-lua/dist/tstl.js`; executed with
  the Lua 5.3.6 `LUA_32BITS` binary. The temporary entry and config were removed.
- CPU: 8 seeded coverage matches; specials 44/9/9/8 and no missing actions.
  Raw counts and the candidate opponent list are in `cpu-coverage.json`.
- Art: 81 authored clips, 11 stock sequences preserved, 20 production motion
  states passed. Both-facing sheets remain with the private model inputs.

The Lua log is retained privately at
`~/.local/share/smashcraft-build-inputs/kaelthas-229/authored/focused-lua.log`.
The combined full-roster Lua and seeded balance field are separate queued runs.

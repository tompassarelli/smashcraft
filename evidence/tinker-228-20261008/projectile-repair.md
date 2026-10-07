# Tinker projectile rule repair

The original projectile audit reproduced two failures: no powershield press
reflected Cluster Rockets at spacing 240, and the factory's overlapping
50-frame goblins produced a continuous stream measured at 93 frames.

Lowering only the rocket launch height from 65 to 45 removed the first
failure. Reducing only the goblin lifetime from 50 to 44 ends each flight
before the next factory launch, whose spacing remains 45 frames. Damage,
speed, radius, mana, move timing and all audit rows and thresholds are unchanged.

- `bun test ./scripts/projectileRules.tests.ts -t 'Goblin Tinker|Archer'`:
  both original fighter audits passed.
- `GAME_TESTS=tinker bun test test/game.test.ts`: 26 passed.
- `GAME_TESTS=tinker LUA=.../lua-stock/lua-5.3.6/src/lua bun scripts/lua-tests.ts`:
  26 of 26 passed in 32-bit Lua.
- The original `powershieldReflect.tests.ts` reports all five Tinker rows
  as designed: neutral at 60/240/480 and factory at 240/480. Each row reflects
  on shield frames 1 and 2 and parries on frame 3, all 15 timing cells passing.
  The full file still reported other fighters' separately owned failures on
  this checkout's older main.

This changes the simulation candidate for the required shared balance field.

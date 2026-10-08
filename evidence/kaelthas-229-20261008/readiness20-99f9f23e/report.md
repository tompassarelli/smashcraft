# Kael’thas readiness against all 20 opponents

Source: `99f9f23e07648d618d159f8b4f707d6cd34f62f4`.
Run: https://github.com/tompassarelli/smashcraft/actions/runs/37722632718

**PASS: 3,993 wins / 4,167 losses / 0 ties = 48.93% over 8,160 matches**,
inside the 45–55% readiness band. Wren Expert in both slots, 400 requested
per pair (408 played), 100-seed budget, default stages, orders, stocks and clock.

## Cause

At 5af7b159 Kael won 1,611 of 8,160 (19.74%). A 48-game probe against
Dreadlord and Illidan showed where: his fixed Flame Strike pillar (placed at
x180, live from frame 17) hit about 3 times in 11 casts a match, because
approaches crossed it in the air before it erupted or after it went out; and
the computer started forward smash (frame 19) about 11 times a match, landed
it about twice and was hit out of it about 7 times. Gameplan-only changes
(closer range, run and jump approaches) and a faster, cheaper fixed pillar
did not move the rate.

## Hosted comparisons (all 20 opponents, 408 each)

| Candidate | Wins / 8,160 | Run |
|---|---:|---|
| Fireball bursting into the pillar (Arcfire shape) | 1103 | 37718017468 |
| Travelling flame 10%, forward smash f16 | 3128 | 37718098031 |
| Travelling flame 10%, forward smash f13 | 3555 | 37718071965 |
| Travelling flame 10%, forward smash f12 | 3501 | 37718638080 |
| Travelling flame 10% at 10/frame, radius 48, forward smash f13 | 3808 | 37718706387 |
| Travelling flame 12%, forward smash f13 | 4031 | 37718670984 |

The last row is the landed kit; 99f9f23e adds its contracts, design text and
the forward smash arm pose moved with the new startup.

## Checks on 99f9f23e

- `GAME_TESTS=kaelthas bun test test/game.test.ts`: 9 passed.
- Emitted Lua32 (`GAME_TESTS=heroes/kaelthas bun scripts/lua-tests.ts`, stock
  Lua 5.3.6 `LUA_32BITS`): 9 of 9 passed.
- Bot coverage, eight Wren Expert matches: specials neutral 63, side 11,
  up 9, down 14; nothing missing.

| Opponent | Kael win rate (408) |
|---|---:|
| archer | 62% |
| rifleman | 57% |
| illidan | 31% |
| blademaster | 48% |
| mountain-king | 50% |
| warden | 34% |
| lich | 50% |
| uther | 44% |
| dreadlord | 29% |
| shadow-hunter | 52% |
| pit-lord | 51% |
| beastmaster | 48% |
| lich-king | 42% |
| thrall | 55% |
| jaina-proudmoore | 53% |
| sylvanas-windrunner | 62% |
| cairne-bloodhoof | 35% |
| chen-stormstout | 49% |
| peon | 80% |
| goblin-tinker | 46% |

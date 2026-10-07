# Tinker offensive-growth candidate

Second candidate after `launch-growth-result.json`: apply a single 0.65
multiplier to original offensive launch growth. Preserve the original link,
juggle and chase rows so jab links and the two throw setup roles keep their
launch behavior. Damage, base knockback, angles, timing, body, CPU choices
and the required projectile collision repair are unchanged.

The first candidate moved all three sampled matchups in the desired
direction, but Archer and Cairne remained above 60%. This candidate tests
the same reward reduction across the tilts, aerials and gadgets as well.
It restores the original relative strengths of finishers and edge attacks.

Baseline remains the frozen roster `d8fbd06e`. The same Archer, Lich and
Cairne stage/seed/order rows are the comparison. They are a tuning sample,
not the full 20-opponent balance gate.

Existing focused contracts passed after this change:
`GAME_TESTS=tinker bun test test/game.test.ts` (26 passed) and
`GAME_TESTS=tinker LUA=<Lua32> bun scripts/lua-tests.ts` (26 of 26 passed).

# Tinker finisher launch-growth candidate

Baseline: frozen roster source `d8fbd06ef5df55965d9cba91691dfb159ea8edb5`,
[farm run 37671475350](https://github.com/tompassarelli/smashcraft/actions/runs/37671475350).
The completed 16 of 20 Tinker pairings reported 5,330 wins and 1,198 losses
(81.65%). Even losing every remaining match leaves 65.32%, above the original
60% upper limit. The Archer, Lich and Cairne baseline rows contain 408 matches
each, with Tinker win rates 93.63%, 67.65% and 83.33% respectively.

Candidate: required rocket-height and factory-lifetime repair `08666ea3`,
then one finisher launch-growth change, 118 to 90. Forward smash, up smash
and Robo-Goblin use that row. This tests whether their reward is too high
alongside Tinker's gadget pressure and heavyweight body.

Existing focused contracts passed after the change:

- `GAME_TESTS=tinker bun test test/game.test.ts`: 26 passed.
- `GAME_TESTS=tinker LUA=<Lua32> bun scripts/lua-tests.ts`: 26 of 26 passed.

The interaction command was attempted before editing, but this frozen
tool supports only Archer, Rifleman and Illidan. It rejected
`bun wisp interactions --move goblin-tinker:forward-smash` before simulating.
The farm's same stage/seed/order records provide the outcome comparison.

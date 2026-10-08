# Peon play style — #282

The CPU now closes into tool and grab range. Lumber Toss keeps its player
timing, damage and availability; the gameplan no longer favors it for spacing,
shooting approaches or hitstun follow-ups.

Both focused fields use the same 96 Archer–Peon situations, both orders,
100 seed choices, Wren Expert, three stocks and a four-minute clock.

| Measurement | Before | After |
| --- | ---: | ---: |
| Lumber Toss starts / moves started | 3,437 / 8,881 | 878 / 7,576 |
| Lumber Toss use | 38.700597% | 11.589229% |
| Lumber Toss share of damage | 40.4568% | 9.829356% |
| Peon wins / matches | 59 / 96 | 39 / 96 |
| Peon win rate | 61.458333% | 40.625% |

Before source: `18d61781c4507eb65eb64882cd2ecfc3a853e451`, retained in
`before.json`. After source: `70dcf7403c0bc01876a2778bdba43f28745a8b60`,
[farm 37763618899](https://github.com/tompassarelli/smashcraft/actions/runs/37763618899),
retained in `after.json`.

Removing the remaining Lumber Toss combo preference alone gave 918 / 7,501
starts (12.238368%), 10.644293% of damage and 44 / 96 wins at
`d6c0467886e3e6223fa17d761263e699bff14b3b`
([farm 37763214391](https://github.com/tompassarelli/smashcraft/actions/runs/37763214391)).
Increasing the existing run approach's weight from 8 to 12 closed the final
use gap. Peon's selected move data is unchanged.

Checks: the tool-over-lumber follow-up regression failed before the change;
six affected Bun gameplan contracts passed after it. `bun run check` and the
publication's type and source-shape gates passed. Shared affected Bun/Lua,
the existing Peon four-special sweep and the single final full-roster field
are coordinated by the parent; this focused result meets the first box only.

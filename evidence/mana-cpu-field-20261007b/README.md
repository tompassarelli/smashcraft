# Mana in the level-9 CPU field, 7 Oct 2026, after the Illidan cost fix (#153)

Supersedes mana-cpu-field-20261007, which ran with Illidan's Wing Ascent and Immolation costs swapped (fixed in 465bdd7b).
Command (from ts/): `bun scripts/cpuField.ts --per-pair 2`, on main 58e9acc2 + f90f46d4 (accept checks only).
Totals: 1320 matches, 103948 specials started, 0 presses refused for mana, 1034987 mana spent over 7318 stocks played (141 a stock).

1320 computer matches (3 stocks, 4-minute clock, spawn variants and 1 seed(s) each until each pair has 2 matches, computer levels 9 and 9), 151 s; win rate over decisive matches; a self-destruct is a stock lost with no hit taken since the fighter last stood on a deck or held the ledge; the fall-time column counts stocks lost over 3 s after the last hit.

| Fighter | Matches | Wins | Losses | Ties | Time-outs | Win rate vs field | Stock losses | Self-destructs (share) | Lost over 3 s after a hit (share) | Damage per hit | Mana spent per stock | Specials refused for mana (share of presses) | Top moves (share of moves started) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | --- |
| archer | 220 | 177 | 43 | 0 | 0 | 80% | 388 | 0 (0%) | 28 (7%) | 8.33 | 152 | 0% | side-special 27%, forward-air 21%, neutral-special 12%, up-tilt 7%, down-tilt 4%, up-smash 4% |
| rifleman | 220 | 50 | 170 | 0 | 1 | 23% | 596 | 13 (2%) | 45 (8%) | 6.31 | 210 | 0% | neutral-special 39%, side-special 17%, down-special 8%, down-tilt 6%, up-special 5%, forward-air 5% |
| illidan | 220 | 80 | 140 | 0 | 0 | 36% | 564 | 42 (7%) | 129 (23%) | 6.14 | 58 | 0% | forward-air 35%, forward-smash 11%, neutral-special 11%, down-smash 9%, side-special 8%, forward-tilt 5% |
| blademaster | 220 | 144 | 76 | 0 | 0 | 65% | 444 | 16 (4%) | 135 (30%) | 8.09 | 155 | 0% | side-special 30%, down-tilt 13%, neutral-special 13%, down-special 11%, forward-smash 11%, forward-tilt 6% |
| mountain-king | 220 | 132 | 88 | 0 | 0 | 60% | 458 | 26 (6%) | 106 (23%) | 7.87 | 178 | 0% | neutral-special 41%, down-special 10%, forward-smash 9%, down-tilt 7%, up-special 7%, forward-tilt 6% |
| warden | 220 | 126 | 94 | 0 | 0 | 57% | 499 | 101 (20%) | 152 (30%) | 8.45 | 147 | 0% | side-special 28%, neutral-special 19%, forward-smash 12%, forward-tilt 11%, forward-air 7%, up-special 3% |
| lich | 220 | 73 | 147 | 0 | 1 | 33% | 557 | 5 (1%) | 185 (33%) | 8.56 | 170 | 0% | neutral-special 35%, forward-smash 29%, down-special 10%, side-special 8%, up-special 4%, down-smash 4% |
| uther | 220 | 177 | 43 | 0 | 0 | 80% | 368 | 1 (0%) | 119 (32%) | 8.91 | 153 | 0% | neutral-special 44%, forward-tilt 15%, forward-smash 11%, down-tilt 6%, side-special 6%, up-special 3% |
| dreadlord | 220 | 35 | 185 | 0 | 0 | 16% | 620 | 10 (2%) | 138 (22%) | 6.25 | 161 | 0% | down-special 16%, grab 13%, forward-air 12%, neutral-special 12%, side-special 11%, neutral-air 10% |
| shadow-hunter | 220 | 96 | 124 | 0 | 0 | 44% | 517 | 6 (1%) | 161 (31%) | 6.51 | 119 | 0% | neutral-special 36%, side-special 10%, down-tilt 10%, down-special 7%, forward-tilt 6%, forward-smash 5% |
| pit-lord | 220 | 165 | 55 | 0 | 0 | 75% | 406 | 16 (4%) | 132 (33%) | 13.56 | 106 | 0% | forward-smash 21%, side-special 17%, neutral-special 15%, forward-tilt 13%, forward-tilt-up 6%, up-special 4% |
| beastmaster | 220 | 65 | 155 | 0 | 0 | 30% | 580 | 22 (4%) | 188 (32%) | 8.11 | 92 | 0% | neutral-special 36%, side-special 16%, forward-tilt 8%, down-special 6%, down-tilt 6%, forward-smash 5% |

| Row's win rate vs (matches) | archer | rifleman | illidan | blademaster | mountain-king | warden | lich | uther | dreadlord | shadow-hunter | pit-lord | beastmaster |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| archer | - | 90% (20) | 100% (20) | 65% (20) | 35% (20) | 70% (20) | 85% (20) | 65% (20) | 95% (20) | 95% (20) | 85% (20) | 100% (20) |
| rifleman | 10% (20) | - | 45% (20) | 20% (20) | 15% (20) | 40% (20) | 0% (20) | 0% (20) | 85% (20) | 0% (20) | 10% (20) | 25% (20) |
| illidan | 0% (20) | 55% (20) | - | 50% (20) | 0% (20) | 15% (20) | 85% (20) | 10% (20) | 60% (20) | 40% (20) | 10% (20) | 75% (20) |
| blademaster | 35% (20) | 80% (20) | 50% (20) | - | 80% (20) | 50% (20) | 100% (20) | 40% (20) | 95% (20) | 90% (20) | 10% (20) | 90% (20) |
| mountain-king | 65% (20) | 85% (20) | 100% (20) | 20% (20) | - | 100% (20) | 25% (20) | 0% (20) | 90% (20) | 80% (20) | 15% (20) | 80% (20) |
| warden | 30% (20) | 60% (20) | 85% (20) | 50% (20) | 0% (20) | - | 70% (20) | 40% (20) | 75% (20) | 85% (20) | 45% (20) | 90% (20) |
| lich | 15% (20) | 100% (20) | 15% (20) | 0% (20) | 75% (20) | 30% (20) | - | 25% (20) | 65% (20) | 10% (20) | 20% (20) | 10% (20) |
| uther | 35% (20) | 100% (20) | 90% (20) | 60% (20) | 100% (20) | 60% (20) | 75% (20) | - | 100% (20) | 100% (20) | 65% (20) | 100% (20) |
| dreadlord | 5% (20) | 15% (20) | 40% (20) | 5% (20) | 10% (20) | 25% (20) | 35% (20) | 0% (20) | - | 15% (20) | 0% (20) | 25% (20) |
| shadow-hunter | 5% (20) | 100% (20) | 60% (20) | 10% (20) | 20% (20) | 15% (20) | 90% (20) | 0% (20) | 85% (20) | - | 15% (20) | 80% (20) |
| pit-lord | 15% (20) | 90% (20) | 90% (20) | 90% (20) | 85% (20) | 55% (20) | 80% (20) | 35% (20) | 100% (20) | 85% (20) | - | 100% (20) |
| beastmaster | 0% (20) | 75% (20) | 25% (20) | 10% (20) | 20% (20) | 10% (20) | 90% (20) | 0% (20) | 75% (20) | 20% (20) | 0% (20) | - |

Matchups inside 45%-55%: 4 of 66, at least 20 matches each. Outside: archer-rifleman 90%, archer-illidan 100%, archer-blademaster 65%, archer-mountain-king 35%, archer-warden 70%, archer-lich 85%, archer-uther 65%, archer-dreadlord 95%, archer-shadow-hunter 95%, archer-pit-lord 85%, archer-beastmaster 100%, rifleman-blademaster 20%, rifleman-mountain-king 15%, rifleman-warden 40%, rifleman-lich 0%, rifleman-uther 0%, rifleman-dreadlord 85%, rifleman-shadow-hunter 0%, rifleman-pit-lord 10%, rifleman-beastmaster 25%, illidan-mountain-king 0%, illidan-warden 15%, illidan-lich 85%, illidan-uther 10%, illidan-dreadlord 60%, illidan-shadow-hunter 40%, illidan-pit-lord 10%, illidan-beastmaster 75%, blademaster-mountain-king 80%, blademaster-lich 100%, blademaster-uther 40%, blademaster-dreadlord 95%, blademaster-shadow-hunter 90%, blademaster-pit-lord 10%, blademaster-beastmaster 90%, mountain-king-warden 100%, mountain-king-lich 25%, mountain-king-uther 0%, mountain-king-dreadlord 90%, mountain-king-shadow-hunter 80%, mountain-king-pit-lord 15%, mountain-king-beastmaster 80%, warden-lich 70%, warden-uther 40%, warden-dreadlord 75%, warden-shadow-hunter 85%, warden-beastmaster 90%, lich-uther 25%, lich-dreadlord 65%, lich-shadow-hunter 10%, lich-pit-lord 20%, lich-beastmaster 10%, uther-dreadlord 100%, uther-shadow-hunter 100%, uther-pit-lord 65%, uther-beastmaster 100%, dreadlord-shadow-hunter 15%, dreadlord-pit-lord 0%, dreadlord-beastmaster 25%, shadow-hunter-pit-lord 15%, shadow-hunter-beastmaster 80%, pit-lord-beastmaster 100%.

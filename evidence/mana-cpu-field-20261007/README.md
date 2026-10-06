# Mana in the level-9 CPU field, 7 Oct 2026 (#153)

Command (from ts/): `bun scripts/cpuField.ts --per-pair 2`, on lane mana-20261007 rebased onto main 7b046d2d.
Totals: 88829 specials started, 0 presses refused for mana, 926196 mana spent over 6165 stocks played (150 a stock).

1100 computer matches (3 stocks, 4-minute clock, spawn variants and 1 seed(s) each until each pair has 2 matches, computer levels 9 and 9), 104 s; win rate over decisive matches; a self-destruct is a stock lost with no hit taken since the fighter last stood on a deck or held the ledge; the fall-time column counts stocks lost over 3 s after the last hit.

| Fighter | Matches | Wins | Losses | Ties | Time-outs | Win rate vs field | Stock losses | Self-destructs (share) | Lost over 3 s after a hit (share) | Damage per hit | Mana spent per stock | Specials refused for mana (share of presses) | Top moves (share of moves started) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | --- |
| archer | 200 | 164 | 36 | 0 | 0 | 82% | 352 | 4 (1%) | 26 (7%) | 7.66 | 162 | 0% | side-special 26%, forward-air 21%, neutral-special 13%, up-tilt 6%, down-tilt 4%, up-smash 4% |
| rifleman | 200 | 43 | 157 | 0 | 1 | 22% | 546 | 20 (4%) | 57 (10%) | 6.20 | 212 | 0% | neutral-special 40%, side-special 16%, down-special 8%, down-tilt 7%, up-special 5%, forward-air 5% |
| illidan | 200 | 92 | 108 | 0 | 0 | 46% | 481 | 22 (5%) | 104 (22%) | 7.58 | 65 | 0% | forward-air 29%, forward-smash 24%, neutral-special 10%, forward-tilt 8%, side-special 7%, up-special 3% |
| blademaster | 200 | 91 | 109 | 0 | 2 | 46% | 482 | 14 (3%) | 154 (32%) | 9.03 | 154 | 0% | side-special 28%, down-tilt 18%, neutral-special 12%, forward-smash 11%, down-special 10%, forward-tilt 5% |
| mountain-king | 200 | 125 | 75 | 0 | 0 | 63% | 427 | 20 (5%) | 155 (36%) | 7.64 | 185 | 0% | neutral-special 39%, forward-smash 10%, down-special 10%, down-tilt 8%, forward-tilt 8%, up-special 6% |
| warden | 200 | 123 | 77 | 0 | 0 | 62% | 432 | 52 (12%) | 153 (35%) | 8.85 | 152 | 0% | side-special 29%, neutral-special 19%, forward-smash 13%, forward-tilt 11%, forward-air 7%, down-special 3% |
| lich | 200 | 86 | 114 | 0 | 1 | 43% | 483 | 7 (1%) | 158 (33%) | 8.67 | 172 | 0% | neutral-special 34%, forward-smash 29%, down-special 10%, side-special 8%, up-special 4%, down-smash 3% |
| uther | 200 | 126 | 74 | 0 | 1 | 63% | 419 | 21 (5%) | 115 (27%) | 8.74 | 159 | 0% | neutral-special 36%, forward-tilt 20%, down-tilt 11%, forward-smash 11%, side-special 6%, up-special 3% |
| dreadlord | 200 | 32 | 168 | 0 | 3 | 16% | 564 | 13 (2%) | 114 (20%) | 8.40 | 167 | 0% | grab 20%, down-special 15%, neutral-special 11%, forward-air 11%, side-special 10%, neutral-air 9% |
| shadow-hunter | 200 | 63 | 137 | 0 | 0 | 32% | 514 | 3 (1%) | 118 (23%) | 6.77 | 111 | 0% | neutral-special 35%, side-special 10%, down-tilt 9%, down-special 7%, forward-tilt 6%, forward-smash 5% |
| pit-lord | 200 | 155 | 45 | 0 | 0 | 78% | 361 | 8 (2%) | 90 (25%) | 13.21 | 109 | 0% | forward-smash 22%, side-special 16%, neutral-special 14%, forward-tilt 14%, forward-tilt-up 6%, up-special 4% |

| Row's win rate vs (matches) | archer | rifleman | illidan | blademaster | mountain-king | warden | lich | uther | dreadlord | shadow-hunter | pit-lord |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| archer | - | 95% (20) | 90% (20) | 85% (20) | 50% (20) | 75% (20) | 65% (20) | 85% (20) | 95% (20) | 100% (20) | 80% (20) |
| rifleman | 5% (20) | - | 15% (20) | 40% (20) | 20% (20) | 35% (20) | 0% (20) | 5% (20) | 90% (20) | 0% (20) | 5% (20) |
| illidan | 10% (20) | 85% (20) | - | 90% (20) | 0% (20) | 25% (20) | 75% (20) | 45% (20) | 80% (20) | 45% (20) | 5% (20) |
| blademaster | 15% (20) | 60% (20) | 10% (20) | - | 30% (20) | 45% (20) | 70% (20) | 40% (20) | 70% (20) | 95% (20) | 20% (20) |
| mountain-king | 50% (20) | 80% (20) | 100% (20) | 70% (20) | - | 70% (20) | 25% (20) | 30% (20) | 90% (20) | 95% (20) | 15% (20) |
| warden | 25% (20) | 65% (20) | 75% (20) | 55% (20) | 30% (20) | - | 90% (20) | 55% (20) | 90% (20) | 95% (20) | 35% (20) |
| lich | 35% (20) | 100% (20) | 25% (20) | 30% (20) | 75% (20) | 10% (20) | - | 40% (20) | 70% (20) | 15% (20) | 30% (20) |
| uther | 15% (20) | 95% (20) | 55% (20) | 60% (20) | 70% (20) | 45% (20) | 60% (20) | - | 95% (20) | 100% (20) | 35% (20) |
| dreadlord | 5% (20) | 10% (20) | 20% (20) | 30% (20) | 10% (20) | 10% (20) | 30% (20) | 5% (20) | - | 40% (20) | 0% (20) |
| shadow-hunter | 0% (20) | 100% (20) | 55% (20) | 5% (20) | 5% (20) | 5% (20) | 85% (20) | 0% (20) | 60% (20) | - | 0% (20) |
| pit-lord | 20% (20) | 95% (20) | 95% (20) | 80% (20) | 85% (20) | 65% (20) | 70% (20) | 65% (20) | 100% (20) | 100% (20) | - |

Matchups inside 45%-55%: 5 of 55, at least 20 matches each. Outside: archer-rifleman 95%, archer-illidan 90%, archer-blademaster 85%, archer-warden 75%, archer-lich 65%, archer-uther 85%, archer-dreadlord 95%, archer-shadow-hunter 100%, archer-pit-lord 80%, rifleman-illidan 15%, rifleman-blademaster 40%, rifleman-mountain-king 20%, rifleman-warden 35%, rifleman-lich 0%, rifleman-uther 5%, rifleman-dreadlord 90%, rifleman-shadow-hunter 0%, rifleman-pit-lord 5%, illidan-blademaster 90%, illidan-mountain-king 0%, illidan-warden 25%, illidan-lich 75%, illidan-dreadlord 80%, illidan-pit-lord 5%, blademaster-mountain-king 30%, blademaster-lich 70%, blademaster-uther 40%, blademaster-dreadlord 70%, blademaster-shadow-hunter 95%, blademaster-pit-lord 20%, mountain-king-warden 70%, mountain-king-lich 25%, mountain-king-uther 30%, mountain-king-dreadlord 90%, mountain-king-shadow-hunter 95%, mountain-king-pit-lord 15%, warden-lich 90%, warden-dreadlord 90%, warden-shadow-hunter 95%, warden-pit-lord 35%, lich-uther 40%, lich-dreadlord 70%, lich-shadow-hunter 15%, lich-pit-lord 30%, uther-dreadlord 95%, uther-shadow-hunter 100%, uther-pit-lord 35%, dreadlord-shadow-hunter 40%, dreadlord-pit-lord 0%, shadow-hunter-pit-lord 0%.

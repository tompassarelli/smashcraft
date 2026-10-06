# Level-9 CPU field at 400 a pair after #105 passes 1-2, before whiff punishing, 7 Oct 2026

Main 745069f0 (passes 1-2 and the #98 rule-2 fix; before #157's whiff punishing).
Command (from ts/): `bun scripts/cpuField.ts --per-pair 400 --seeds 100 --pairs <pairs> --json shard.N.json` in four shards, then `--merge`.

26400 computer matches (3 stocks, 4-minute clock, spawn variant 0, seeds 0-19, every soak stage, both orders: 400 matches a pair, computer levels 9 and 9), 1 s; win rate over decisive matches; a self-destruct is a stock lost with no hit taken since the fighter last stood on a deck or held the ledge; the fall-time column counts stocks lost over 3 s after the last hit.

| Fighter | Matches | Wins | Losses | Ties | Time-outs | Win rate vs field | Stock losses | Self-destructs (share) | Lost over 3 s after a hit (share) | Damage per hit | Mana spent per stock | Specials refused for mana (share of presses) | Top moves (share of moves started) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | --- |
| archer | 4400 | 3286 | 1114 | 0 | 0 | 75% | 8707 | 74 (1%) | 854 (10%) | 7.63 | 139 | 0% | side-special 24%, forward-air 19%, neutral-special 12%, dash-attack 6%, up-tilt 6%, down-tilt 4% |
| rifleman | 4400 | 2415 | 1985 | 0 | 4 | 55% | 10103 | 618 (6%) | 1134 (11%) | 8.15 | 191 | 0% | neutral-special 37%, side-special 17%, dash-attack 6%, down-special 6%, forward-air 6%, down-tilt 6% |
| illidan | 4400 | 1817 | 2583 | 0 | 3 | 41% | 10968 | 656 (6%) | 2436 (22%) | 6.60 | 45 | 0% | forward-air 31%, forward-smash 17%, neutral-special 8%, side-special 7%, down-smash 6%, forward-tilt 5% |
| blademaster | 4400 | 2255 | 2145 | 0 | 9 | 51% | 10315 | 451 (4%) | 3458 (34%) | 7.47 | 141 | 0% | side-special 27%, down-tilt 14%, down-special 10%, neutral-special 10%, forward-smash 10%, dash-attack 6% |
| mountain-king | 4400 | 1878 | 2522 | 0 | 3 | 43% | 10833 | 315 (3%) | 3822 (35%) | 8.19 | 164 | 0% | neutral-special 35%, down-tilt 11%, down-special 10%, up-special 8%, forward-tilt 7%, forward-smash 7% |
| warden | 4400 | 2026 | 2374 | 0 | 0 | 46% | 10634 | 1315 (12%) | 3552 (33%) | 8.29 | 147 | 0% | side-special 28%, neutral-special 19%, forward-smash 11%, forward-tilt 9%, forward-air 7%, down-special 3% |
| lich | 4400 | 1842 | 2558 | 0 | 0 | 42% | 10827 | 214 (2%) | 3836 (35%) | 9.22 | 173 | 0% | neutral-special 33%, forward-smash 24%, side-special 10%, down-special 10%, dash-attack 4%, up-special 4% |
| uther | 4400 | 2163 | 2237 | 0 | 2 | 49% | 10450 | 328 (3%) | 3563 (34%) | 8.25 | 136 | 0% | neutral-special 39%, forward-tilt 14%, dash-attack 9%, forward-smash 7%, down-tilt 7%, side-special 6% |
| dreadlord | 4400 | 1825 | 2575 | 0 | 0 | 41% | 10937 | 303 (3%) | 2575 (24%) | 6.99 | 144 | 0% | grab 15%, down-special 14%, neutral-air 12%, forward-air 12%, side-special 10%, neutral-special 9% |
| shadow-hunter | 4400 | 1767 | 2633 | 0 | 7 | 40% | 10967 | 218 (2%) | 3455 (32%) | 6.19 | 107 | 0% | neutral-special 30%, side-special 9%, down-tilt 9%, forward-tilt 7%, down-special 7%, forward-tilt-down 5% |
| pit-lord | 4400 | 2890 | 1510 | 0 | 1 | 66% | 9238 | 401 (4%) | 2791 (30%) | 13.37 | 96 | 0% | forward-smash 20%, side-special 15%, neutral-special 14%, forward-tilt 13%, dash-attack 7%, up-special 5% |
| beastmaster | 4400 | 2236 | 2164 | 0 | 1 | 51% | 10376 | 672 (6%) | 3705 (36%) | 9.95 | 80 | 0% | neutral-special 30%, side-special 17%, down-special 9%, forward-tilt 8%, down-tilt 6%, forward-smash 5% |

| Row's win rate vs (matches) | archer | rifleman | illidan | blademaster | mountain-king | warden | lich | uther | dreadlord | shadow-hunter | pit-lord | beastmaster |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| archer | - | 54% (400) | 88% (400) | 89% (400) | 69% (400) | 84% (400) | 68% (400) | 83% (400) | 70% (400) | 85% (400) | 54% (400) | 78% (400) |
| rifleman | 46% (400) | - | 52% (400) | 67% (400) | 68% (400) | 74% (400) | 44% (400) | 40% (400) | 81% (400) | 25% (400) | 52% (400) | 54% (400) |
| illidan | 12% (400) | 48% (400) | - | 51% (400) | 14% (400) | 51% (400) | 71% (400) | 22% (400) | 53% (400) | 52% (400) | 32% (400) | 51% (400) |
| blademaster | 11% (400) | 33% (400) | 50% (400) | - | 59% (400) | 50% (400) | 80% (400) | 52% (400) | 54% (400) | 81% (400) | 35% (400) | 60% (400) |
| mountain-king | 31% (400) | 32% (400) | 86% (400) | 41% (400) | - | 63% (400) | 36% (400) | 33% (400) | 53% (400) | 47% (400) | 13% (400) | 37% (400) |
| warden | 16% (400) | 26% (400) | 50% (400) | 50% (400) | 37% (400) | - | 74% (400) | 37% (400) | 51% (400) | 74% (400) | 31% (400) | 62% (400) |
| lich | 32% (400) | 56% (400) | 29% (400) | 21% (400) | 64% (400) | 26% (400) | - | 67% (400) | 47% (400) | 28% (400) | 65% (400) | 27% (400) |
| uther | 17% (400) | 60% (400) | 79% (400) | 48% (400) | 67% (400) | 64% (400) | 33% (400) | - | 69% (400) | 66% (400) | 4% (400) | 34% (400) |
| dreadlord | 31% (400) | 19% (400) | 48% (400) | 46% (400) | 47% (400) | 49% (400) | 53% (400) | 31% (400) | - | 64% (400) | 20% (400) | 50% (400) |
| shadow-hunter | 15% (400) | 75% (400) | 48% (400) | 19% (400) | 54% (400) | 27% (400) | 72% (400) | 34% (400) | 37% (400) | - | 24% (400) | 38% (400) |
| pit-lord | 46% (400) | 48% (400) | 69% (400) | 65% (400) | 88% (400) | 69% (400) | 35% (400) | 96% (400) | 80% (400) | 76% (400) | - | 52% (400) |
| beastmaster | 22% (400) | 47% (400) | 50% (400) | 40% (400) | 64% (400) | 39% (400) | 74% (400) | 66% (400) | 50% (400) | 62% (400) | 48% (400) | - |

Matchups inside 45%-55%: 19 of 66, at least 400 matches each. 95% interval overlapping the band: 22 of 66. Median distance from 50%: 15.9 points. Gate (every interval overlaps, median at most 5 points): fails. Intervals missing the band: archer-illidan 88%, archer-blademaster 89%, archer-mountain-king 69%, archer-warden 84%, archer-lich 68%, archer-uther 83%, archer-dreadlord 70%, archer-shadow-hunter 85%, archer-beastmaster 78%, rifleman-blademaster 67%, rifleman-mountain-king 68%, rifleman-warden 74%, rifleman-dreadlord 81%, rifleman-shadow-hunter 25%, illidan-mountain-king 14%, illidan-lich 71%, illidan-uther 22%, illidan-pit-lord 32%, blademaster-lich 80%, blademaster-shadow-hunter 81%, blademaster-pit-lord 35%, blademaster-beastmaster 60%, mountain-king-warden 63%, mountain-king-lich 36%, mountain-king-uther 33%, mountain-king-pit-lord 13%, mountain-king-beastmaster 37%, warden-lich 74%, warden-uther 37%, warden-shadow-hunter 74%, warden-pit-lord 31%, warden-beastmaster 62%, lich-uther 67%, lich-shadow-hunter 28%, lich-pit-lord 65%, lich-beastmaster 27%, uther-dreadlord 69%, uther-shadow-hunter 66%, uther-pit-lord 4%, uther-beastmaster 34%, dreadlord-shadow-hunter 64%, dreadlord-pit-lord 20%, shadow-hunter-pit-lord 24%, shadow-hunter-beastmaster 38%.

# Level-9 CPU field after #105's first identity tuning pass, 7 Oct 2026

Lane balance-105-20261007 on main 6774aaed plus the tuning in this commit (roster.md, Balance record).
Command (from ts/): `bun scripts/cpuField.ts --per-pair 100 --seeds 100 --pairs <22 pairs> --json shard.N.json` in three shards, then `--merge`.

6600 computer matches (3 stocks, 4-minute clock, spawn variant 0, seeds 0-4, every soak stage, both orders: 100 matches a pair, computer levels 9 and 9); win rate over decisive matches; a self-destruct is a stock lost with no hit taken since the fighter last stood on a deck or held the ledge; the fall-time column counts stocks lost over 3 s after the last hit.

| Fighter | Matches | Wins | Losses | Ties | Time-outs | Win rate vs field | Stock losses | Self-destructs (share) | Lost over 3 s after a hit (share) | Damage per hit | Mana spent per stock | Specials refused for mana (share of presses) | Top moves (share of moves started) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | --- |
| archer | 1100 | 933 | 167 | 0 | 0 | 85% | 1948 | 19 (1%) | 181 (9%) | 8.21 | 136 | 0% | side-special 23%, forward-air 19%, neutral-special 12%, dash-attack 6%, up-tilt 6%, down-tilt 5% |
| rifleman | 1100 | 612 | 487 | 1 | 0 | 56% | 2504 | 150 (6%) | 256 (10%) | 8.09 | 191 | 0% | neutral-special 38%, side-special 17%, dash-attack 6%, down-special 6%, forward-air 6%, down-tilt 5% |
| illidan | 1100 | 507 | 593 | 0 | 0 | 46% | 2681 | 138 (5%) | 593 (22%) | 6.58 | 47 | 0% | forward-air 31%, forward-smash 17%, neutral-special 8%, side-special 7%, down-smash 6%, forward-tilt 5% |
| blademaster | 1100 | 573 | 527 | 0 | 0 | 52% | 2576 | 109 (4%) | 1015 (39%) | 7.42 | 141 | 0% | side-special 27%, down-tilt 14%, down-special 10%, neutral-special 10%, forward-smash 10%, dash-attack 7% |
| mountain-king | 1100 | 553 | 547 | 0 | 0 | 50% | 2562 | 85 (3%) | 922 (36%) | 8.25 | 166 | 0% | neutral-special 36%, down-tilt 10%, down-special 10%, up-special 8%, forward-smash 7%, forward-tilt 7% |
| warden | 1100 | 574 | 526 | 0 | 0 | 52% | 2529 | 283 (11%) | 869 (34%) | 8.33 | 150 | 0% | side-special 28%, neutral-special 18%, forward-smash 11%, forward-tilt 10%, forward-air 7%, down-special 3% |
| lich | 1100 | 528 | 572 | 0 | 0 | 48% | 2602 | 46 (2%) | 982 (38%) | 9.39 | 176 | 0% | neutral-special 33%, forward-smash 25%, side-special 10%, down-special 10%, dash-attack 5%, up-special 3% |
| uther | 1100 | 607 | 493 | 0 | 0 | 55% | 2511 | 75 (3%) | 861 (34%) | 8.35 | 137 | 0% | neutral-special 39%, forward-tilt 14%, dash-attack 9%, forward-smash 8%, down-tilt 7%, side-special 6% |
| dreadlord | 1100 | 300 | 800 | 0 | 0 | 27% | 2927 | 66 (2%) | 758 (26%) | 6.34 | 145 | 0% | grab 15%, down-special 15%, forward-air 12%, neutral-air 12%, side-special 10%, neutral-special 9% |
| shadow-hunter | 1100 | 281 | 818 | 1 | 0 | 26% | 2976 | 47 (2%) | 963 (32%) | 6.06 | 106 | 0% | neutral-special 31%, side-special 9%, down-tilt 9%, forward-tilt 7%, down-special 7%, forward-tilt-up 5% |
| pit-lord | 1100 | 784 | 316 | 0 | 0 | 71% | 2121 | 76 (4%) | 615 (29%) | 13.41 | 95 | 0% | forward-smash 20%, side-special 15%, neutral-special 14%, forward-tilt 13%, dash-attack 7%, up-special 5% |
| beastmaster | 1100 | 347 | 753 | 0 | 0 | 32% | 2885 | 168 (6%) | 1001 (35%) | 8.71 | 83 | 0% | neutral-special 31%, side-special 16%, down-special 8%, forward-tilt 8%, down-tilt 6%, forward-smash 4% |

| Row's win rate vs (matches) | archer | rifleman | illidan | blademaster | mountain-king | warden | lich | uther | dreadlord | shadow-hunter | pit-lord | beastmaster |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| archer | - | 74% (100) | 88% (100) | 93% (100) | 65% (100) | 92% (100) | 73% (100) | 90% (100) | 90% (100) | 97% (100) | 74% (100) | 97% (100) |
| rifleman | 26% (100) | - | 48% (100) | 68% (100) | 66% (100) | 70% (100) | 48% (100) | 30% (100) | 90% (100) | 53% (100) | 50% (100) | 64% (100) |
| illidan | 12% (100) | 52% (100) | - | 58% (100) | 20% (100) | 46% (100) | 74% (100) | 23% (100) | 65% (100) | 64% (100) | 23% (100) | 70% (100) |
| blademaster | 7% (100) | 32% (100) | 42% (100) | - | 56% (100) | 49% (100) | 75% (100) | 50% (100) | 72% (100) | 90% (100) | 28% (100) | 72% (100) |
| mountain-king | 35% (100) | 34% (100) | 80% (100) | 44% (100) | - | 60% (100) | 35% (100) | 27% (100) | 74% (100) | 84% (100) | 8% (100) | 72% (100) |
| warden | 8% (100) | 30% (100) | 54% (100) | 51% (100) | 40% (100) | - | 71% (100) | 40% (100) | 88% (100) | 83% (100) | 29% (100) | 80% (100) |
| lich | 27% (100) | 52% (100) | 26% (100) | 25% (100) | 65% (100) | 29% (100) | - | 75% (100) | 49% (100) | 56% (100) | 76% (100) | 48% (100) |
| uther | 10% (100) | 70% (100) | 77% (100) | 50% (100) | 73% (100) | 60% (100) | 25% (100) | - | 76% (100) | 93% (100) | 5% (100) | 68% (100) |
| dreadlord | 10% (100) | 10% (100) | 35% (100) | 28% (100) | 26% (100) | 12% (100) | 51% (100) | 24% (100) | - | 59% (100) | 6% (100) | 39% (100) |
| shadow-hunter | 3% (100) | 47% (100) | 36% (100) | 10% (100) | 16% (100) | 17% (100) | 44% (100) | 7% (100) | 41% (100) | - | 8% (100) | 52% (100) |
| pit-lord | 26% (100) | 50% (100) | 77% (100) | 72% (100) | 92% (100) | 71% (100) | 24% (100) | 95% (100) | 94% (100) | 92% (100) | - | 91% (100) |
| beastmaster | 3% (100) | 36% (100) | 30% (100) | 28% (100) | 28% (100) | 20% (100) | 52% (100) | 32% (100) | 61% (100) | 48% (100) | 9% (100) | - |

Matchups inside 45%-55%: 10 of 66, at least 100 matches each. 95% interval overlapping the band: 19 of 66. Median distance from 50%: 22.0 points. Gate (every interval overlaps, median at most 5 points): fails. Intervals missing the band: archer-rifleman 74%, archer-illidan 88%, archer-blademaster 93%, archer-mountain-king 65%, archer-warden 92%, archer-lich 73%, archer-uther 90%, archer-dreadlord 90%, archer-shadow-hunter 97%, archer-pit-lord 74%, archer-beastmaster 97%, rifleman-blademaster 68%, rifleman-mountain-king 66%, rifleman-warden 70%, rifleman-uther 30%, rifleman-dreadlord 90%, illidan-mountain-king 20%, illidan-lich 74%, illidan-uther 23%, illidan-dreadlord 65%, illidan-pit-lord 23%, illidan-beastmaster 70%, blademaster-lich 75%, blademaster-dreadlord 72%, blademaster-shadow-hunter 90%, blademaster-pit-lord 28%, blademaster-beastmaster 72%, mountain-king-lich 35%, mountain-king-uther 27%, mountain-king-dreadlord 74%, mountain-king-shadow-hunter 84%, mountain-king-pit-lord 8%, mountain-king-beastmaster 72%, warden-lich 71%, warden-dreadlord 88%, warden-shadow-hunter 83%, warden-pit-lord 29%, warden-beastmaster 80%, lich-uther 75%, lich-pit-lord 76%, uther-dreadlord 76%, uther-shadow-hunter 93%, uther-pit-lord 5%, uther-beastmaster 68%, dreadlord-pit-lord 6%, shadow-hunter-pit-lord 8%, pit-lord-beastmaster 91%.

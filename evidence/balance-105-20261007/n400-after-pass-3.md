# Level-9 CPU field at 400 a pair after #105 passes 1-3, with whiff punishing, 7 Oct 2026

Main 78afdb6f (passes 1-3 on #157's whiff punishing as of 0bb991ef).
Command (from ts/): `bun scripts/cpuField.ts --per-pair 400 --seeds 100 --pairs <pairs> --json shard.N.json` in four shards, then `--merge`.

26400 computer matches (3 stocks, 4-minute clock, spawn variant 0, seeds 0-19, every soak stage, both orders: 400 matches a pair, computer levels 9 and 9), 1 s; win rate over decisive matches; a self-destruct is a stock lost with no hit taken since the fighter last stood on a deck or held the ledge; the fall-time column counts stocks lost over 3 s after the last hit.

| Fighter | Matches | Wins | Losses | Ties | Time-outs | Win rate vs field | Stock losses | Self-destructs (share) | Lost over 3 s after a hit (share) | Damage per hit | Mana spent per stock | Specials refused for mana (share of presses) | Top moves (share of moves started) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | --- |
| archer | 4400 | 2963 | 1437 | 0 | 2 | 67% | 9311 | 54 (1%) | 835 (9%) | 7.33 | 129 | 0% | side-special 23%, forward-air 19%, neutral-special 11%, dash-attack 9%, up-tilt 5%, down-tilt 5% |
| rifleman | 4400 | 2619 | 1781 | 0 | 8 | 60% | 9849 | 506 (5%) | 956 (10%) | 8.29 | 182 | 0% | neutral-special 35%, side-special 17%, down-tilt 9%, dash-attack 6%, forward-air 6%, down-special 5% |
| illidan | 4400 | 2490 | 1910 | 0 | 3 | 57% | 10001 | 116 (1%) | 1445 (14%) | 6.43 | 45 | 0% | forward-air 30%, forward-smash 16%, forward-tilt 8%, neutral-special 7%, up-special 7%, side-special 7% |
| blademaster | 4400 | 2583 | 1817 | 0 | 8 | 59% | 9825 | 431 (4%) | 3447 (35%) | 7.40 | 127 | 0% | down-tilt 24%, side-special 24%, forward-smash 9%, neutral-special 9%, down-special 8%, forward-tilt 5% |
| mountain-king | 4400 | 2316 | 2084 | 0 | 10 | 53% | 10230 | 311 (3%) | 3640 (36%) | 8.40 | 154 | 0% | neutral-special 33%, down-tilt 18%, down-special 9%, forward-tilt 8%, up-special 7%, forward-smash 6% |
| warden | 4400 | 2077 | 2323 | 0 | 1 | 47% | 10547 | 1245 (12%) | 3520 (33%) | 8.24 | 130 | 0% | side-special 23%, forward-tilt 20%, neutral-special 16%, forward-smash 10%, forward-air 7%, up-special 3% |
| lich | 4400 | 1890 | 2510 | 0 | 0 | 43% | 10659 | 234 (2%) | 3665 (34%) | 9.39 | 167 | 0% | neutral-special 31%, forward-smash 23%, down-special 11%, side-special 10%, forward-tilt 5%, up-special 4% |
| uther | 4400 | 2172 | 2228 | 0 | 14 | 49% | 10456 | 400 (4%) | 3749 (36%) | 7.93 | 138 | 0% | neutral-special 38%, down-tilt 14%, forward-tilt 13%, forward-smash 7%, dash-attack 6%, side-special 6% |
| dreadlord | 4400 | 1454 | 2946 | 0 | 2 | 33% | 11457 | 287 (3%) | 2709 (24%) | 6.92 | 128 | 0% | grab 19%, down-special 14%, neutral-air 12%, forward-air 12%, neutral-special 8%, side-special 8% |
| shadow-hunter | 4400 | 1440 | 2960 | 0 | 3 | 33% | 11452 | 171 (1%) | 3579 (31%) | 6.16 | 96 | 0% | neutral-special 27%, down-tilt 17%, side-special 8%, forward-tilt 7%, down-special 6%, forward-tilt-down 4% |
| pit-lord | 4400 | 2390 | 2010 | 0 | 0 | 54% | 10067 | 386 (4%) | 3204 (32%) | 13.23 | 84 | 0% | forward-smash 19%, forward-tilt 17%, side-special 13%, neutral-special 13%, dash-attack 6%, up-special 6% |
| beastmaster | 4400 | 2006 | 2394 | 0 | 13 | 46% | 10640 | 574 (5%) | 3683 (35%) | 9.49 | 70 | 0% | neutral-special 27%, down-tilt 15%, side-special 13%, forward-tilt 9%, down-special 8%, forward-smash 4% |

| Row's win rate vs (matches) | archer | rifleman | illidan | blademaster | mountain-king | warden | lich | uther | dreadlord | shadow-hunter | pit-lord | beastmaster |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| archer | - | 44% (400) | 71% (400) | 81% (400) | 55% (400) | 80% (400) | 72% (400) | 64% (400) | 69% (400) | 82% (400) | 50% (400) | 75% (400) |
| rifleman | 56% (400) | - | 49% (400) | 63% (400) | 69% (400) | 68% (400) | 65% (400) | 45% (400) | 82% (400) | 37% (400) | 70% (400) | 53% (400) |
| illidan | 30% (400) | 52% (400) | - | 67% (400) | 22% (400) | 66% (400) | 85% (400) | 35% (400) | 75% (400) | 75% (400) | 52% (400) | 66% (400) |
| blademaster | 20% (400) | 37% (400) | 33% (400) | - | 68% (400) | 50% (400) | 81% (400) | 65% (400) | 67% (400) | 90% (400) | 63% (400) | 73% (400) |
| mountain-king | 46% (400) | 31% (400) | 78% (400) | 33% (400) | - | 71% (400) | 45% (400) | 44% (400) | 77% (400) | 61% (400) | 24% (400) | 71% (400) |
| warden | 20% (400) | 32% (400) | 35% (400) | 50% (400) | 30% (400) | - | 72% (400) | 44% (400) | 63% (400) | 81% (400) | 42% (400) | 53% (400) |
| lich | 28% (400) | 36% (400) | 15% (400) | 19% (400) | 55% (400) | 28% (400) | - | 66% (400) | 60% (400) | 34% (400) | 93% (400) | 39% (400) |
| uther | 36% (400) | 55% (400) | 66% (400) | 35% (400) | 56% (400) | 56% (400) | 34% (400) | - | 74% (400) | 69% (400) | 20% (400) | 42% (400) |
| dreadlord | 31% (400) | 18% (400) | 25% (400) | 33% (400) | 23% (400) | 37% (400) | 40% (400) | 26% (400) | - | 68% (400) | 24% (400) | 40% (400) |
| shadow-hunter | 18% (400) | 64% (400) | 25% (400) | 10% (400) | 40% (400) | 20% (400) | 66% (400) | 31% (400) | 32% (400) | - | 18% (400) | 37% (400) |
| pit-lord | 51% (400) | 31% (400) | 49% (400) | 37% (400) | 76% (400) | 58% (400) | 7% (400) | 81% (400) | 76% (400) | 82% (400) | - | 51% (400) |
| beastmaster | 25% (400) | 47% (400) | 34% (400) | 27% (400) | 29% (400) | 48% (400) | 62% (400) | 58% (400) | 61% (400) | 64% (400) | 49% (400) | - |

Matchups inside 45%-55%: 10 of 66, at least 400 matches each. 95% interval overlapping the band: 15 of 66. Median distance from 50%: 17.1 points. Gate (every interval overlaps, median at most 5 points): fails. Intervals missing the band: archer-illidan 71%, archer-blademaster 81%, archer-warden 80%, archer-lich 72%, archer-uther 64%, archer-dreadlord 69%, archer-shadow-hunter 82%, archer-beastmaster 75%, rifleman-blademaster 63%, rifleman-mountain-king 69%, rifleman-warden 68%, rifleman-lich 65%, rifleman-dreadlord 82%, rifleman-shadow-hunter 37%, rifleman-pit-lord 70%, illidan-blademaster 67%, illidan-mountain-king 22%, illidan-warden 66%, illidan-lich 85%, illidan-uther 35%, illidan-dreadlord 75%, illidan-shadow-hunter 75%, illidan-beastmaster 66%, blademaster-mountain-king 68%, blademaster-lich 81%, blademaster-uther 65%, blademaster-dreadlord 67%, blademaster-shadow-hunter 90%, blademaster-pit-lord 63%, blademaster-beastmaster 73%, mountain-king-warden 71%, mountain-king-dreadlord 77%, mountain-king-shadow-hunter 61%, mountain-king-pit-lord 24%, mountain-king-beastmaster 71%, warden-lich 72%, warden-dreadlord 63%, warden-shadow-hunter 81%, lich-uther 66%, lich-dreadlord 60%, lich-shadow-hunter 34%, lich-pit-lord 93%, lich-beastmaster 39%, uther-dreadlord 74%, uther-shadow-hunter 69%, uther-pit-lord 20%, dreadlord-shadow-hunter 68%, dreadlord-pit-lord 24%, dreadlord-beastmaster 40%, shadow-hunter-pit-lord 18%, shadow-hunter-beastmaster 37%.

## Same build at computer level 7, 100 a pair

6600 computer matches (3 stocks, 4-minute clock, spawn variant 0, seeds 0-4: 100 a pair, computer levels 9 and 9); win rate over decisive matches; a self-destruct is a stock lost with no hit taken since the fighter last stood on a deck or held the ledge; the fall-time column counts stocks lost over 3 s after the last hit.

| Fighter | Matches | Wins | Losses | Ties | Time-outs | Win rate vs field | Stock losses | Self-destructs (share) | Lost over 3 s after a hit (share) | Damage per hit | Mana spent per stock | Specials refused for mana (share of presses) | Top moves (share of moves started) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | --- |
| archer | 1100 | 681 | 419 | 0 | 0 | 62% | 2440 | 15 (1%) | 156 (6%) | 7.33 | 119 | 0% | side-special 22%, forward-air 17%, neutral-special 11%, up-tilt 6%, down-tilt 6%, dash-attack 5% |
| rifleman | 1100 | 633 | 467 | 0 | 0 | 58% | 2502 | 93 (4%) | 195 (8%) | 8.06 | 184 | 0% | neutral-special 29%, side-special 17%, down-tilt 8%, down-special 6%, forward-air 5%, up-special 5% |
| illidan | 1100 | 480 | 620 | 0 | 0 | 44% | 2708 | 65 (2%) | 524 (19%) | 6.47 | 43 | 0% | forward-air 27%, forward-smash 15%, neutral-special 8%, forward-tilt 7%, down-smash 7%, up-special 6% |
| blademaster | 1100 | 676 | 424 | 0 | 1 | 61% | 2410 | 112 (5%) | 810 (34%) | 7.65 | 124 | 0% | side-special 27%, down-tilt 19%, neutral-special 10%, forward-smash 9%, down-special 6%, forward-tilt 6% |
| mountain-king | 1100 | 547 | 553 | 0 | 0 | 50% | 2619 | 75 (3%) | 867 (33%) | 8.25 | 154 | 0% | neutral-special 33%, down-tilt 14%, down-special 10%, forward-tilt 8%, up-special 7%, forward-smash 6% |
| warden | 1100 | 498 | 602 | 0 | 0 | 45% | 2659 | 242 (9%) | 845 (32%) | 8.28 | 131 | 0% | side-special 23%, neutral-special 16%, forward-tilt 14%, forward-smash 10%, forward-air 6%, down-special 3% |
| lich | 1100 | 445 | 655 | 0 | 0 | 40% | 2722 | 63 (2%) | 966 (35%) | 9.17 | 164 | 0% | neutral-special 29%, forward-smash 23%, side-special 10%, down-special 9%, forward-tilt 4%, up-special 4% |
| uther | 1100 | 594 | 506 | 0 | 0 | 54% | 2556 | 103 (4%) | 946 (37%) | 8.00 | 137 | 0% | neutral-special 38%, forward-tilt 12%, down-tilt 11%, forward-smash 7%, side-special 6%, dash-attack 4% |
| dreadlord | 1100 | 455 | 645 | 0 | 1 | 41% | 2743 | 54 (2%) | 647 (24%) | 7.07 | 133 | 0% | grab 17%, down-special 14%, neutral-air 11%, forward-air 11%, neutral-special 8%, side-special 7% |
| shadow-hunter | 1100 | 430 | 670 | 0 | 0 | 39% | 2753 | 46 (2%) | 857 (31%) | 6.37 | 98 | 0% | neutral-special 28%, down-tilt 14%, side-special 9%, forward-tilt 6%, down-special 6%, forward-smash 4% |
| pit-lord | 1100 | 652 | 448 | 0 | 0 | 59% | 2430 | 73 (3%) | 728 (30%) | 13.06 | 88 | 0% | forward-smash 19%, forward-tilt 15%, side-special 14%, neutral-special 12%, up-special 6%, forward-tilt-up 5% |
| beastmaster | 1100 | 509 | 591 | 0 | 0 | 46% | 2670 | 113 (4%) | 922 (35%) | 9.43 | 58 | 0% | neutral-special 30%, down-tilt 11%, side-special 10%, forward-tilt 9%, down-special 8%, forward-smash 5% |

| Row's win rate vs (matches) | archer | rifleman | illidan | blademaster | mountain-king | warden | lich | uther | dreadlord | shadow-hunter | pit-lord | beastmaster |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| archer | - | 32% (100) | 80% (100) | 64% (100) | 44% (100) | 81% (100) | 64% (100) | 63% (100) | 61% (100) | 66% (100) | 52% (100) | 74% (100) |
| rifleman | 68% (100) | - | 46% (100) | 59% (100) | 65% (100) | 72% (100) | 59% (100) | 49% (100) | 81% (100) | 27% (100) | 52% (100) | 55% (100) |
| illidan | 20% (100) | 54% (100) | - | 41% (100) | 11% (100) | 65% (100) | 69% (100) | 23% (100) | 53% (100) | 63% (100) | 35% (100) | 46% (100) |
| blademaster | 36% (100) | 41% (100) | 59% (100) | - | 54% (100) | 61% (100) | 88% (100) | 52% (100) | 61% (100) | 93% (100) | 57% (100) | 74% (100) |
| mountain-king | 56% (100) | 35% (100) | 89% (100) | 46% (100) | - | 73% (100) | 28% (100) | 31% (100) | 65% (100) | 57% (100) | 13% (100) | 54% (100) |
| warden | 19% (100) | 28% (100) | 35% (100) | 39% (100) | 27% (100) | - | 74% (100) | 25% (100) | 54% (100) | 89% (100) | 49% (100) | 59% (100) |
| lich | 36% (100) | 41% (100) | 31% (100) | 12% (100) | 72% (100) | 26% (100) | - | 52% (100) | 50% (100) | 18% (100) | 87% (100) | 20% (100) |
| uther | 37% (100) | 51% (100) | 77% (100) | 48% (100) | 69% (100) | 75% (100) | 48% (100) | - | 63% (100) | 55% (100) | 19% (100) | 52% (100) |
| dreadlord | 39% (100) | 19% (100) | 47% (100) | 39% (100) | 35% (100) | 46% (100) | 50% (100) | 37% (100) | - | 74% (100) | 16% (100) | 53% (100) |
| shadow-hunter | 34% (100) | 73% (100) | 37% (100) | 7% (100) | 43% (100) | 11% (100) | 82% (100) | 45% (100) | 26% (100) | - | 29% (100) | 43% (100) |
| pit-lord | 48% (100) | 48% (100) | 65% (100) | 43% (100) | 87% (100) | 51% (100) | 13% (100) | 81% (100) | 84% (100) | 71% (100) | - | 61% (100) |
| beastmaster | 26% (100) | 45% (100) | 54% (100) | 26% (100) | 46% (100) | 41% (100) | 80% (100) | 48% (100) | 47% (100) | 57% (100) | 39% (100) | - |

Matchups inside 45%-55%: 17 of 66, at least 100 matches each. 95% interval overlapping the band: 34 of 66. Median distance from 50%: 14.0 points. Gate (every interval overlaps, median at most 5 points): fails. Intervals missing the band: archer-rifleman 32%, archer-illidan 80%, archer-warden 81%, archer-shadow-hunter 66%, archer-beastmaster 74%, rifleman-mountain-king 65%, rifleman-warden 72%, rifleman-dreadlord 81%, rifleman-shadow-hunter 27%, illidan-mountain-king 11%, illidan-warden 65%, illidan-lich 69%, illidan-uther 23%, illidan-pit-lord 35%, blademaster-lich 88%, blademaster-shadow-hunter 93%, blademaster-beastmaster 74%, mountain-king-warden 73%, mountain-king-lich 28%, mountain-king-uther 31%, mountain-king-dreadlord 65%, mountain-king-pit-lord 13%, warden-lich 74%, warden-uther 25%, warden-shadow-hunter 89%, lich-shadow-hunter 18%, lich-pit-lord 87%, lich-beastmaster 20%, uther-pit-lord 19%, dreadlord-shadow-hunter 74%, dreadlord-pit-lord 16%, shadow-hunter-pit-lord 29%.

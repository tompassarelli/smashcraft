# Level-9 CPU field baseline for #105's tuning pass, 7 Oct 2026

Main d5994278 (all kit redesigns, mana, passives, drills, hero tilts; Archer/Rifleman tilts not yet landed).
Command (from ts/): `bun scripts/cpuField.ts --per-pair 100 --seeds 100 --pairs <22 pairs> --json shard.N.json` in three shards, then `--merge` of the three.

6600 computer matches (3 stocks, 4-minute clock, spawn variant 0, seeds 0-4, every soak stage, both orders: 100 matches a pair, computer levels 9 and 9); win rate over decisive matches; a self-destruct is a stock lost with no hit taken since the fighter last stood on a deck or held the ledge; the fall-time column counts stocks lost over 3 s after the last hit.

| Fighter | Matches | Wins | Losses | Ties | Time-outs | Win rate vs field | Stock losses | Self-destructs (share) | Lost over 3 s after a hit (share) | Damage per hit | Mana spent per stock | Specials refused for mana (share of presses) | Top moves (share of moves started) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | --- |
| archer | 1100 | 865 | 235 | 0 | 0 | 79% | 1998 | 20 (1%) | 166 (8%) | 8.30 | 151 | 0% | side-special 27%, forward-air 20%, neutral-special 13%, up-tilt 7%, down-tilt 5%, up-smash 4% |
| rifleman | 1100 | 188 | 912 | 0 | 2 | 17% | 3058 | 93 (3%) | 238 (8%) | 6.26 | 207 | 0% | neutral-special 39%, side-special 17%, down-special 8%, down-tilt 6%, up-special 5%, forward-air 5% |
| illidan | 1100 | 464 | 636 | 0 | 1 | 42% | 2715 | 148 (5%) | 604 (22%) | 6.11 | 59 | 0% | forward-air 34%, forward-smash 13%, neutral-special 11%, down-smash 8%, side-special 7%, forward-tilt 5% |
| blademaster | 1100 | 731 | 369 | 0 | 1 | 66% | 2214 | 89 (4%) | 712 (32%) | 8.09 | 154 | 0% | side-special 28%, down-tilt 16%, neutral-special 12%, down-special 12%, forward-smash 11%, forward-tilt 6% |
| mountain-king | 1100 | 716 | 384 | 0 | 1 | 65% | 2250 | 75 (3%) | 705 (31%) | 8.02 | 174 | 0% | neutral-special 39%, down-special 10%, forward-smash 9%, down-tilt 8%, forward-tilt 7%, up-special 7% |
| warden | 1100 | 617 | 483 | 0 | 0 | 56% | 2426 | 325 (13%) | 740 (31%) | 8.37 | 149 | 0% | side-special 29%, neutral-special 20%, forward-smash 12%, forward-tilt 10%, forward-air 7%, up-special 3% |
| lich | 1100 | 364 | 736 | 0 | 1 | 33% | 2796 | 62 (2%) | 953 (34%) | 8.56 | 171 | 0% | neutral-special 33%, forward-smash 28%, down-special 11%, side-special 9%, up-special 4%, down-smash 3% |
| uther | 1100 | 862 | 238 | 0 | 0 | 78% | 1841 | 55 (3%) | 639 (35%) | 8.98 | 156 | 0% | neutral-special 43%, forward-tilt 16%, forward-smash 11%, down-tilt 7%, side-special 6%, up-special 3% |
| dreadlord | 1100 | 224 | 876 | 0 | 0 | 20% | 3026 | 52 (2%) | 679 (22%) | 6.27 | 158 | 0% | down-special 16%, grab 13%, forward-air 12%, neutral-special 12%, side-special 11%, neutral-air 10% |
| shadow-hunter | 1100 | 426 | 674 | 0 | 1 | 39% | 2693 | 42 (2%) | 739 (27%) | 6.43 | 117 | 0% | neutral-special 36%, side-special 10%, down-tilt 9%, down-special 7%, forward-tilt 7%, forward-smash 5% |
| pit-lord | 1100 | 885 | 215 | 0 | 1 | 80% | 1902 | 90 (5%) | 538 (28%) | 13.58 | 103 | 0% | forward-smash 21%, side-special 16%, forward-tilt 15%, neutral-special 15%, forward-tilt-up 6%, up-special 4% |
| beastmaster | 1100 | 258 | 842 | 0 | 0 | 23% | 2982 | 155 (5%) | 1033 (35%) | 8.20 | 87 | 0% | neutral-special 36%, side-special 16%, forward-tilt 8%, down-special 7%, forward-smash 6%, down-tilt 5% |

| Row's win rate vs (matches) | archer | rifleman | illidan | blademaster | mountain-king | warden | lich | uther | dreadlord | shadow-hunter | pit-lord | beastmaster |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| archer | - | 96% (100) | 94% (100) | 76% (100) | 36% (100) | 83% (100) | 86% (100) | 66% (100) | 97% (100) | 94% (100) | 46% (100) | 91% (100) |
| rifleman | 4% (100) | - | 19% (100) | 11% (100) | 13% (100) | 30% (100) | 2% (100) | 2% (100) | 65% (100) | 3% (100) | 3% (100) | 36% (100) |
| illidan | 6% (100) | 81% (100) | - | 43% (100) | 2% (100) | 42% (100) | 71% (100) | 5% (100) | 77% (100) | 49% (100) | 8% (100) | 80% (100) |
| blademaster | 24% (100) | 89% (100) | 57% (100) | - | 60% (100) | 51% (100) | 92% (100) | 44% (100) | 93% (100) | 93% (100) | 34% (100) | 94% (100) |
| mountain-king | 64% (100) | 87% (100) | 98% (100) | 40% (100) | - | 71% (100) | 59% (100) | 17% (100) | 95% (100) | 85% (100) | 9% (100) | 91% (100) |
| warden | 17% (100) | 70% (100) | 58% (100) | 49% (100) | 29% (100) | - | 79% (100) | 25% (100) | 79% (100) | 93% (100) | 29% (100) | 89% (100) |
| lich | 14% (100) | 98% (100) | 29% (100) | 8% (100) | 41% (100) | 21% (100) | - | 10% (100) | 48% (100) | 21% (100) | 44% (100) | 30% (100) |
| uther | 34% (100) | 98% (100) | 95% (100) | 56% (100) | 83% (100) | 75% (100) | 90% (100) | - | 100% (100) | 99% (100) | 32% (100) | 100% (100) |
| dreadlord | 3% (100) | 35% (100) | 23% (100) | 7% (100) | 5% (100) | 21% (100) | 52% (100) | 0% (100) | - | 26% (100) | 1% (100) | 51% (100) |
| shadow-hunter | 6% (100) | 97% (100) | 51% (100) | 7% (100) | 15% (100) | 7% (100) | 79% (100) | 1% (100) | 74% (100) | - | 5% (100) | 84% (100) |
| pit-lord | 54% (100) | 97% (100) | 92% (100) | 66% (100) | 91% (100) | 71% (100) | 56% (100) | 68% (100) | 99% (100) | 95% (100) | - | 96% (100) |
| beastmaster | 9% (100) | 64% (100) | 20% (100) | 6% (100) | 9% (100) | 11% (100) | 70% (100) | 0% (100) | 49% (100) | 16% (100) | 4% (100) | - |

Matchups inside 45%-55%: 5 of 66, at least 100 matches each. 95% interval overlapping the band: 13 of 66. Median distance from 50%: 33.5 points. Gate (every interval overlaps, median at most 5 points): fails. Intervals missing the band: archer-rifleman 96%, archer-illidan 94%, archer-blademaster 76%, archer-warden 83%, archer-lich 86%, archer-uther 66%, archer-dreadlord 97%, archer-shadow-hunter 94%, archer-beastmaster 91%, rifleman-illidan 19%, rifleman-blademaster 11%, rifleman-mountain-king 13%, rifleman-warden 30%, rifleman-lich 2%, rifleman-uther 2%, rifleman-dreadlord 65%, rifleman-shadow-hunter 3%, rifleman-pit-lord 3%, illidan-mountain-king 2%, illidan-lich 71%, illidan-uther 5%, illidan-dreadlord 77%, illidan-pit-lord 8%, illidan-beastmaster 80%, blademaster-lich 92%, blademaster-dreadlord 93%, blademaster-shadow-hunter 93%, blademaster-pit-lord 34%, blademaster-beastmaster 94%, mountain-king-warden 71%, mountain-king-uther 17%, mountain-king-dreadlord 95%, mountain-king-shadow-hunter 85%, mountain-king-pit-lord 9%, mountain-king-beastmaster 91%, warden-lich 79%, warden-uther 25%, warden-dreadlord 79%, warden-shadow-hunter 93%, warden-pit-lord 29%, warden-beastmaster 89%, lich-uther 10%, lich-shadow-hunter 21%, lich-beastmaster 30%, uther-dreadlord 100%, uther-shadow-hunter 99%, uther-pit-lord 32%, uther-beastmaster 100%, dreadlord-shadow-hunter 26%, dreadlord-pit-lord 1%, shadow-hunter-pit-lord 5%, shadow-hunter-beastmaster 84%, pit-lord-beastmaster 96%.

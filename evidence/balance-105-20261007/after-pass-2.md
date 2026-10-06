# Level-9 CPU field after #105's identity tuning pass 2, 7 Oct 2026

Lane balance-105-20261007 on main f5e93490 plus pass 2 (roster.md, Balance record).
Command (from ts/): `bun scripts/cpuField.ts --per-pair 100 --seeds 100 --pairs <22 pairs> --json shard.N.json` in three shards, then `--merge`.

6600 computer matches (3 stocks, 4-minute clock, spawn variant 0, seeds 0-4, every soak stage, both orders: 100 matches a pair, computer levels 9 and 9); win rate over decisive matches; a self-destruct is a stock lost with no hit taken since the fighter last stood on a deck or held the ledge; the fall-time column counts stocks lost over 3 s after the last hit.

| Fighter | Matches | Wins | Losses | Ties | Time-outs | Win rate vs field | Stock losses | Self-destructs (share) | Lost over 3 s after a hit (share) | Damage per hit | Mana spent per stock | Specials refused for mana (share of presses) | Top moves (share of moves started) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | --- |
| archer | 1100 | 891 | 209 | 0 | 0 | 81% | 2031 | 12 (1%) | 186 (9%) | 8.20 | 132 | 0% | side-special 22%, forward-air 19%, neutral-special 12%, dash-attack 6%, up-tilt 6%, down-tilt 5% |
| rifleman | 1100 | 569 | 531 | 0 | 0 | 52% | 2557 | 148 (6%) | 259 (10%) | 8.12 | 188 | 0% | neutral-special 37%, side-special 17%, dash-attack 7%, down-special 6%, forward-air 6%, down-tilt 5% |
| illidan | 1100 | 457 | 643 | 0 | 0 | 42% | 2748 | 164 (6%) | 591 (22%) | 6.62 | 45 | 0% | forward-air 31%, forward-smash 17%, neutral-special 8%, side-special 7%, down-smash 6%, forward-tilt 5% |
| blademaster | 1100 | 538 | 562 | 0 | 2 | 49% | 2629 | 101 (4%) | 988 (38%) | 7.43 | 138 | 0% | side-special 26%, down-tilt 15%, down-special 10%, neutral-special 10%, forward-smash 9%, dash-attack 6% |
| mountain-king | 1100 | 473 | 627 | 0 | 0 | 43% | 2705 | 79 (3%) | 939 (35%) | 8.24 | 164 | 0% | neutral-special 35%, down-special 11%, down-tilt 10%, up-special 8%, forward-smash 7%, forward-tilt 7% |
| warden | 1100 | 525 | 575 | 0 | 0 | 48% | 2611 | 286 (11%) | 886 (34%) | 8.29 | 148 | 0% | side-special 28%, neutral-special 18%, forward-smash 11%, forward-tilt 10%, forward-air 7%, down-special 3% |
| lich | 1100 | 469 | 631 | 0 | 0 | 43% | 2693 | 45 (2%) | 963 (36%) | 9.36 | 172 | 0% | neutral-special 33%, forward-smash 25%, side-special 10%, down-special 10%, dash-attack 4%, up-special 4% |
| uther | 1100 | 562 | 538 | 0 | 0 | 51% | 2587 | 85 (3%) | 874 (34%) | 8.35 | 134 | 0% | neutral-special 39%, forward-tilt 14%, dash-attack 8%, forward-smash 7%, down-tilt 7%, side-special 6% |
| dreadlord | 1100 | 433 | 667 | 0 | 0 | 39% | 2762 | 95 (3%) | 604 (22%) | 6.95 | 143 | 0% | grab 16%, down-special 14%, neutral-air 12%, forward-air 12%, side-special 10%, neutral-special 9% |
| shadow-hunter | 1100 | 439 | 661 | 0 | 2 | 40% | 2729 | 54 (2%) | 838 (31%) | 6.25 | 104 | 0% | neutral-special 31%, side-special 9%, down-tilt 9%, forward-tilt 8%, down-special 6%, forward-tilt-down 5% |
| pit-lord | 1100 | 711 | 389 | 0 | 0 | 65% | 2330 | 84 (4%) | 720 (31%) | 13.23 | 96 | 0% | forward-smash 19%, side-special 15%, neutral-special 14%, forward-tilt 13%, dash-attack 7%, up-special 5% |
| beastmaster | 1100 | 533 | 567 | 0 | 0 | 48% | 2629 | 145 (6%) | 930 (35%) | 9.90 | 81 | 0% | neutral-special 30%, side-special 17%, down-special 9%, forward-tilt 8%, down-tilt 6%, forward-smash 4% |

| Row's win rate vs (matches) | archer | rifleman | illidan | blademaster | mountain-king | warden | lich | uther | dreadlord | shadow-hunter | pit-lord | beastmaster |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| archer | - | 74% (100) | 88% (100) | 93% (100) | 65% (100) | 92% (100) | 73% (100) | 90% (100) | 81% (100) | 90% (100) | 67% (100) | 78% (100) |
| rifleman | 26% (100) | - | 48% (100) | 68% (100) | 66% (100) | 70% (100) | 48% (100) | 30% (100) | 82% (100) | 22% (100) | 61% (100) | 48% (100) |
| illidan | 12% (100) | 52% (100) | - | 58% (100) | 20% (100) | 46% (100) | 74% (100) | 23% (100) | 46% (100) | 46% (100) | 28% (100) | 52% (100) |
| blademaster | 7% (100) | 32% (100) | 42% (100) | - | 56% (100) | 49% (100) | 75% (100) | 50% (100) | 45% (100) | 86% (100) | 43% (100) | 53% (100) |
| mountain-king | 35% (100) | 34% (100) | 80% (100) | 44% (100) | - | 60% (100) | 35% (100) | 27% (100) | 61% (100) | 43% (100) | 10% (100) | 44% (100) |
| warden | 8% (100) | 30% (100) | 54% (100) | 51% (100) | 40% (100) | - | 71% (100) | 40% (100) | 61% (100) | 73% (100) | 29% (100) | 68% (100) |
| lich | 27% (100) | 52% (100) | 26% (100) | 25% (100) | 65% (100) | 29% (100) | - | 75% (100) | 51% (100) | 33% (100) | 66% (100) | 20% (100) |
| uther | 10% (100) | 70% (100) | 77% (100) | 50% (100) | 73% (100) | 60% (100) | 25% (100) | - | 66% (100) | 75% (100) | 0% (100) | 56% (100) |
| dreadlord | 19% (100) | 18% (100) | 54% (100) | 55% (100) | 39% (100) | 39% (100) | 49% (100) | 34% (100) | - | 64% (100) | 12% (100) | 50% (100) |
| shadow-hunter | 10% (100) | 78% (100) | 54% (100) | 14% (100) | 57% (100) | 27% (100) | 67% (100) | 25% (100) | 36% (100) | - | 31% (100) | 40% (100) |
| pit-lord | 33% (100) | 39% (100) | 72% (100) | 57% (100) | 90% (100) | 71% (100) | 34% (100) | 100% (100) | 88% (100) | 69% (100) | - | 58% (100) |
| beastmaster | 22% (100) | 52% (100) | 48% (100) | 47% (100) | 56% (100) | 32% (100) | 80% (100) | 44% (100) | 50% (100) | 60% (100) | 42% (100) | - |

Matchups inside 45%-55%: 13 of 66, at least 100 matches each. 95% interval overlapping the band: 27 of 66. Median distance from 50%: 17.0 points. Gate (every interval overlaps, median at most 5 points): fails. Intervals missing the band: archer-rifleman 74%, archer-illidan 88%, archer-blademaster 93%, archer-mountain-king 65%, archer-warden 92%, archer-lich 73%, archer-uther 90%, archer-dreadlord 81%, archer-shadow-hunter 90%, archer-pit-lord 67%, archer-beastmaster 78%, rifleman-blademaster 68%, rifleman-mountain-king 66%, rifleman-warden 70%, rifleman-uther 30%, rifleman-dreadlord 82%, rifleman-shadow-hunter 22%, illidan-mountain-king 20%, illidan-lich 74%, illidan-uther 23%, illidan-pit-lord 28%, blademaster-lich 75%, blademaster-shadow-hunter 86%, mountain-king-lich 35%, mountain-king-uther 27%, mountain-king-pit-lord 10%, warden-lich 71%, warden-shadow-hunter 73%, warden-pit-lord 29%, warden-beastmaster 68%, lich-uther 75%, lich-shadow-hunter 33%, lich-pit-lord 66%, lich-beastmaster 20%, uther-dreadlord 66%, uther-shadow-hunter 75%, uther-pit-lord 0%, dreadlord-pit-lord 12%, shadow-hunter-pit-lord 31%.

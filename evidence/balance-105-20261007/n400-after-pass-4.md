# Level-9 CPU field at 400 a pair after #105 pass 4, 7 Oct 2026

Lane balance-105-20261007 on main 4776861a plus pass 4 before the Hex fix (roster.md, Balance record). The Hex fix's Shadow Hunter row follows the table.
Command (from ts/): `bun scripts/cpuField.ts --per-pair 400 --seeds 100 --pairs <pairs> --json shard.N.json` in four shards, then `--merge`.

26400 computer matches (3 stocks, 4-minute clock, spawn variant 0, seeds 0-19, every soak stage, both orders: 400 matches a pair, computer levels 9 and 9); win rate over decisive matches; a self-destruct is a stock lost with no hit taken since the fighter last stood on a deck or held the ledge; the fall-time column counts stocks lost over 3 s after the last hit.

| Fighter | Matches | Wins | Losses | Ties | Time-outs | Win rate vs field | Stock losses | Self-destructs (share) | Lost over 3 s after a hit (share) | Damage per hit | Mana spent per stock | Specials refused for mana (share of presses) | Top moves (share of moves started) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | --- |
| archer | 4400 | 2447 | 1953 | 0 | 0 | 56% | 10141 | 68 (1%) | 848 (8%) | 7.08 | 125 | 0% | side-special 23%, forward-air 18%, neutral-special 11%, dash-attack 9%, up-tilt 5%, down-tilt 5% |
| rifleman | 4400 | 2520 | 1880 | 0 | 8 | 57% | 9994 | 529 (5%) | 1010 (10%) | 8.29 | 180 | 0% | neutral-special 35%, side-special 17%, down-tilt 9%, dash-attack 6%, forward-air 6%, down-special 5% |
| illidan | 4400 | 2349 | 2051 | 0 | 3 | 53% | 10244 | 116 (1%) | 1454 (14%) | 6.44 | 43 | 0% | forward-air 30%, forward-smash 16%, forward-tilt 8%, neutral-special 7%, up-special 7%, side-special 6% |
| blademaster | 4400 | 2583 | 1817 | 0 | 4 | 59% | 9857 | 425 (4%) | 3507 (36%) | 7.42 | 126 | 0% | side-special 24%, down-tilt 23%, forward-smash 9%, neutral-special 9%, down-special 8%, forward-tilt 5% |
| mountain-king | 4400 | 2244 | 2156 | 0 | 8 | 51% | 10389 | 352 (3%) | 3744 (36%) | 8.40 | 152 | 0% | neutral-special 33%, down-tilt 18%, down-special 9%, forward-tilt 8%, up-special 7%, forward-smash 6% |
| warden | 4400 | 1994 | 2406 | 0 | 1 | 45% | 10697 | 1348 (13%) | 3518 (33%) | 8.23 | 130 | 0% | side-special 23%, forward-tilt 20%, neutral-special 16%, forward-smash 10%, forward-air 7%, up-special 3% |
| lich | 4400 | 1832 | 2568 | 0 | 1 | 42% | 10765 | 220 (2%) | 3781 (35%) | 9.40 | 165 | 0% | neutral-special 31%, forward-smash 23%, down-special 11%, side-special 10%, forward-tilt 5%, up-special 4% |
| uther | 4400 | 2071 | 2329 | 0 | 13 | 47% | 10639 | 423 (4%) | 3818 (36%) | 7.92 | 137 | 0% | neutral-special 38%, down-tilt 14%, forward-tilt 13%, forward-smash 7%, dash-attack 6%, side-special 6% |
| dreadlord | 4400 | 2167 | 2233 | 0 | 0 | 49% | 10505 | 316 (3%) | 2424 (23%) | 7.05 | 131 | 0% | grab 18%, down-special 13%, neutral-air 13%, forward-air 12%, side-special 8%, neutral-special 8% |
| shadow-hunter | 4400 | 1919 | 2481 | 0 | 1 | 44% | 10784 | 181 (2%) | 3375 (31%) | 6.73 | 96 | 0% | neutral-special 28%, down-tilt 17%, side-special 8%, forward-tilt 7%, down-special 6%, forward-smash 4% |
| pit-lord | 4400 | 2314 | 2086 | 0 | 0 | 53% | 10220 | 403 (4%) | 3209 (31%) | 13.21 | 85 | 0% | forward-smash 19%, forward-tilt 17%, side-special 13%, neutral-special 13%, dash-attack 6%, up-special 6% |
| beastmaster | 4400 | 1960 | 2440 | 0 | 13 | 45% | 10748 | 617 (6%) | 3675 (34%) | 9.51 | 70 | 0% | neutral-special 28%, down-tilt 14%, side-special 13%, forward-tilt 9%, down-special 8%, forward-smash 4% |

| Row's win rate vs (matches) | archer | rifleman | illidan | blademaster | mountain-king | warden | lich | uther | dreadlord | shadow-hunter | pit-lord | beastmaster |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| archer | - | 37% (400) | 56% (400) | 69% (400) | 46% (400) | 74% (400) | 61% (400) | 59% (400) | 41% (400) | 66% (400) | 43% (400) | 60% (400) |
| rifleman | 63% (400) | - | 44% (400) | 63% (400) | 69% (400) | 68% (400) | 65% (400) | 45% (400) | 65% (400) | 27% (400) | 70% (400) | 53% (400) |
| illidan | 44% (400) | 56% (400) | - | 66% (400) | 22% (400) | 64% (400) | 82% (400) | 33% (400) | 48% (400) | 59% (400) | 49% (400) | 65% (400) |
| blademaster | 31% (400) | 37% (400) | 34% (400) | - | 68% (400) | 50% (400) | 81% (400) | 65% (400) | 62% (400) | 82% (400) | 63% (400) | 73% (400) |
| mountain-king | 54% (400) | 31% (400) | 78% (400) | 33% (400) | - | 71% (400) | 45% (400) | 44% (400) | 62% (400) | 50% (400) | 24% (400) | 71% (400) |
| warden | 26% (400) | 32% (400) | 36% (400) | 50% (400) | 30% (400) | - | 72% (400) | 44% (400) | 49% (400) | 66% (400) | 42% (400) | 53% (400) |
| lich | 39% (400) | 36% (400) | 19% (400) | 19% (400) | 55% (400) | 28% (400) | - | 66% (400) | 37% (400) | 28% (400) | 93% (400) | 39% (400) |
| uther | 41% (400) | 55% (400) | 67% (400) | 35% (400) | 56% (400) | 56% (400) | 34% (400) | - | 59% (400) | 53% (400) | 20% (400) | 42% (400) |
| dreadlord | 59% (400) | 36% (400) | 52% (400) | 38% (400) | 38% (400) | 51% (400) | 63% (400) | 41% (400) | - | 68% (400) | 43% (400) | 54% (400) |
| shadow-hunter | 34% (400) | 74% (400) | 41% (400) | 18% (400) | 51% (400) | 34% (400) | 72% (400) | 47% (400) | 32% (400) | - | 28% (400) | 51% (400) |
| pit-lord | 57% (400) | 31% (400) | 51% (400) | 37% (400) | 76% (400) | 58% (400) | 7% (400) | 81% (400) | 57% (400) | 72% (400) | - | 51% (400) |
| beastmaster | 40% (400) | 47% (400) | 35% (400) | 27% (400) | 29% (400) | 48% (400) | 62% (400) | 58% (400) | 47% (400) | 50% (400) | 49% (400) | - |

Matchups inside 45%-55%: 14 of 66, at least 400 matches each. 95% interval overlapping the band: 26 of 66. Median distance from 50%: 12.9 points. Gate (every interval overlaps, median at most 5 points): fails. Intervals missing the band: archer-rifleman 37%, archer-blademaster 69%, archer-warden 74%, archer-lich 61%, archer-shadow-hunter 66%, archer-beastmaster 60%, rifleman-blademaster 63%, rifleman-mountain-king 69%, rifleman-warden 68%, rifleman-lich 65%, rifleman-dreadlord 65%, rifleman-shadow-hunter 27%, rifleman-pit-lord 70%, illidan-blademaster 66%, illidan-mountain-king 22%, illidan-warden 64%, illidan-lich 82%, illidan-uther 33%, illidan-beastmaster 65%, blademaster-mountain-king 68%, blademaster-lich 81%, blademaster-uther 65%, blademaster-dreadlord 62%, blademaster-shadow-hunter 82%, blademaster-pit-lord 63%, blademaster-beastmaster 73%, mountain-king-warden 71%, mountain-king-dreadlord 62%, mountain-king-pit-lord 24%, mountain-king-beastmaster 71%, warden-lich 72%, warden-shadow-hunter 66%, lich-uther 66%, lich-dreadlord 37%, lich-shadow-hunter 28%, lich-pit-lord 93%, lich-beastmaster 39%, uther-pit-lord 20%, dreadlord-shadow-hunter 68%, shadow-hunter-pit-lord 28%.

## Shadow Hunter's row with the Hex fix (400 a pair)

| Opponent | archer | rifleman | illidan | blademaster | mountain-king | warden | lich | uther | dreadlord | pit-lord | beastmaster | field |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| shadow-hunter | 40% | 73% | 42% | 20% | 52% | 30% | 74% | 45% | 41% | 26% | 51% | 45% |

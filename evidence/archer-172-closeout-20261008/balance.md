# Archer #172 completed balance gate

The original 13 selectable fighters all pass 40–60% at source
`3c47d8d444da22fa516c8a2f78eb684181e93759`, hosted run
[37669368177](https://github.com/tompassarelli/smashcraft/actions/runs/37669368177).
The unchanged field uses Wren expert against Wren expert, 400 matches for each
of 78 pairs, 100 seeds, three stocks and the four-minute clock: 31,200 matches,
two tied matches and zero time-outs. Rates use decisive matches as the existing
gate specifies. The run finished in 8 minutes 44 seconds.

The source combines Rifleman CPU recovery aiming `42e1be57`, Beastmaster
authored damage ×0.90 `a7fdfa77`, and the floor-defense down-smash correction
`80f165bb`. Beastmaster retains the accepted recovery band, timing, geometry
and knockback growth. His existing 13 contracts and the 12 shared grab
contracts pass in Bun and emitted Lua32, including Uther’s accepted 0.85
pummel contact damage. Archer’s measured neutral-arrow rework is unchanged;
its accepted runtime evidence is recorded in [runtime.md](runtime.md).

| Fighter | Wins | Decisive matches | Field win rate |
| --- | ---: | ---: | ---: |
| archer | 1993 | 4800 | 41.5208% |
| rifleman | 2150 | 4800 | 44.7917% |
| illidan | 2854 | 4800 | 59.4583% |
| blademaster | 2291 | 4799 | 47.7391% |
| mountain-king | 2623 | 4800 | 54.6458% |
| warden | 2258 | 4799 | 47.0515% |
| lich | 2475 | 4799 | 51.5732% |
| uther | 2218 | 4800 | 46.2083% |
| dreadlord | 2700 | 4800 | 56.2500% |
| shadow-hunter | 2553 | 4799 | 53.1986% |
| pit-lord | 2173 | 4800 | 45.2708% |
| beastmaster | 2381 | 4800 | 49.6042% |
| lich-king | 2529 | 4800 | 52.6875% |

The original farm outputs are retained unchanged in [field.md](field.md) and
[field.json](field.json).

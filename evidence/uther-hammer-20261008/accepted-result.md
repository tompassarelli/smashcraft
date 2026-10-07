# Uther hammer rework: accepted balance result

Source: `1e71bbbb60be5f7c97a29692750463b1f9455dcb`.
Damage adjustment: `b24c6c3a`.
Command: `bun wisp farm balance --ref 1e71bbbb60be5f7c97a29692750463b1f9455dcb --wait`.
Run: [37663596530](https://github.com/tompassarelli/smashcraft/actions/runs/37663596530).

The original thirteen-fighter field ran 31,200 matches: 400 per pair,
100 seeds with spawn variants, Wren Expert, three stocks, four-minute clock.
It took 7 minutes 25 seconds from run start to verdict. Uther won
**2289/4800 = 47.6875%**, passing his 40–60% gate. The unedited report is
`field-r4.md`.

| Measured Uther source | Wins / matches | Rate |
| --- | ---: | ---: |
| Initial hammer kit, `91e8d8c3` | 4304 / 4800 | 89.6667% |
| Holy Radiance recovery 69, `8901bfcd` | 3880 / 4800 | 80.8333% |
| Holy Radiance mana 50, `e4fa8139` | 3571 / 4800 | 74.3958% |
| Approved damage ×0.85, `1e71bbbb` | 2289 / 4800 | 47.6875% |

The final source also includes the shared Dreadlord, Pit Lord, Warden and
presentation changes merged from main. This is the current combined field,
with the same original roster and seeded fixture. Its separate misses are
Dreadlord 2998/4800 = 62.4583% and Pit Lord 1796/4800 = 37.4167%; their owners
received the report. Beastmaster passes at 2831/4800 = 58.9792%.

Uther's 57 focused Bun checks and 24 emitted-Lua32 contracts pass. After the
latest shared bot code was merged, the unchanged eight-match Uther coverage
again recorded all four special types. The headless pad passes six gameplay
expectations, two effect-model expectations, and 26 exact input edges with
zero late or off-frame edges. Its distant wave deals 5.1 damage; the later
Hammer of Justice raises the total to 16.15. The hammer's ten-frame pause and
127-volume heavy impact contract stay unchanged.

Only the readable-impact box remains. The previous white-overlay repair
failed the lead's visual check: white shapes extend beyond the bodies.
`flash211_r2` owns the replacement and the exact frame-183 image. No Uther
art or pose changes were made for the damage multiplier. The commander
removed the human playtest hold and accepted Uther's 47.6875% result.

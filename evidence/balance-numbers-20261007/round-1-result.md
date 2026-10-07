# First fighter-number round — 7 October 2026

Candidate `e43d1a1341ffb4964313f05340ef378ff3ba3c4c`, from accepted main `1350aac5ac4e1f5398e8299a1fc6dc0435ae0001`. Tom authorized numeric fighter tuning during the existing repair window: only damage, knockback growth, startup and recovery, at most 15% per number per round; only the five outside-band fighters. Passing fighters' numbers and the original gate remain unchanged. A round lands only when more fighters enter the band.

This round changed damage and knockback growth only. Its [195 exact before/after values](round-1-changes.json) use factors 0.85 for Rifleman, Blademaster and Dreadlord, and 1.15 for Mountain King and Beastmaster. Values round toward the original number in binary32 to respect the cap. Rifleman's shared aerial/smash numbers stayed untouched because other fighters use them. No computer-policy code changed.

[Hosted run 37648648839](https://github.com/tompassarelli/smashcraft/actions/runs/37648648839) completed the unchanged 31,200-match field: 400 per pair, 100 seeds, Wren Expert, three stocks and four minutes. The original 40–60% gate failed. Only 7/13 fighters passed, down from 8/13; this worse candidate was **not landed**. Raw [field Markdown](round-1-field.md) and [JSON](round-1-field.json) retain the downloaded values.

| Fighter | Before | Round 1 | In original band |
|---|---:|---:|---|
| Archer | 41.5208% | 47.3542% | yes |
| Rifleman | 67.2917% | 29.1042% | no |
| Illidan | 45.9167% | 51.3333% | yes |
| Blademaster | 62.7917% | 21.1042% | no |
| Mountain King | 24.8125% | 60.0625% | no |
| Warden | 44.6667% | 49.9375% | yes |
| Lich | 48.6458% | 54.2917% | yes |
| Uther | 53.5208% | 59.1042% | yes |
| Dreadlord | 73.9583% | 35.4167% | no |
| Shadow Hunter | 48.3125% | 52.4375% | yes |
| Pit Lord | 54.1875% | 60.6667% | no |
| Beastmaster | 34.0625% | 73.0417% | no |
| Lich King | 50.3125% | 56.1458% | yes |

Mountain King's displayed integer rate rounds to 60%, but 2883/4800 is 60.0625%, outside the unchanged gate. Pit Lord's numbers were untouched; the changed opponents moved its field rate outside the band.

Both candidate pre-push checks passed: TypeScript and source shapes. The local development watcher reported no type errors in the edited files and then reached its finite deadline; its scope released. GitHub briefly returned an unexpected EOF while reading the terminal run. The original artifact eventually downloaded, and its explicit artifact endpoint also succeeded; no alternative login or transport was used.

Tom authorized one response-interpolated second round, candidate `82995f013f5bba4bef7653bfa888f447d44e0747`, hosted [run 37651390705](https://github.com/tompassarelli/smashcraft/actions/runs/37651390705). It starts from accepted main `682ae4a9`; the failed first candidate is not an ancestor. [Its exact values](round-2-changes.json) use Rifleman 0.93, Blademaster 0.955, Mountain King 1.105, Dreadlord 0.905 and Beastmaster 1.06 times the original damage/growth numbers. All 195 edits are within 15% of both accepted main and round 1. The second round was still running when this record was written. Hard stop: 16:32 UTC; no further tuning round afterward.

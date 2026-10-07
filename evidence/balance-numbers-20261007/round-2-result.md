# Second fighter-number round — 7 October 2026

The original full-field balance gate **passes for all 13 fighters** at frozen candidate `82995f013f5bba4bef7653bfa888f447d44e0747`: every rate is within 40–60%, with 31,200 matches, 400 per pair, 100 seeds, Wren Expert, three stocks and a four-minute clock. There were zero ties and zero time-outs.

[Hosted run 37651390705](https://github.com/tompassarelli/smashcraft/actions/runs/37651390705), merge job `112900547290`, completed successfully at **16:33:16 UTC**. At the hard stop, **16:32 UTC**, the result was still pending and tuning stopped. This record collects the already-running field afterward; no third round or new field was started. Artifact `11497741011` supplies the raw [Markdown](round-2-field.md) and [JSON](round-2-field.json), copied byte-for-byte from the download.

| Fighter | Wins / matches | Field rate | Original band |
|---|---:|---:|---|
| Archer | 2099 / 4800 | 43.7292% | pass |
| Rifleman | 2284 / 4800 | 47.5833% | pass |
| Illidan | 2343 / 4800 | 48.8125% | pass |
| Blademaster | 2278 / 4800 | 47.4583% | pass |
| Mountain King | 2377 / 4800 | 49.5208% | pass |
| Warden | 2225 / 4800 | 46.3542% | pass |
| Lich | 2377 / 4800 | 49.5208% | pass |
| Uther | 2679 / 4800 | 55.8125% | pass |
| Dreadlord | 2450 / 4800 | 51.0417% | pass |
| Shadow Hunter | 2444 / 4800 | 50.9167% | pass |
| Pit Lord | 2729 / 4800 | 56.8542% | pass |
| Beastmaster | 2355 / 4800 | 49.0625% | pass |
| Lich King | 2560 / 4800 | 53.3333% | pass |

Tom authorized numbers-only tuning for the five fighters outside the previous band, with at most 15% per number per round and no changed numbers for passing fighters. Round 1 overshot and reduced the passing count from 8/13 to 7/13, so its source was rejected. This second candidate starts from accepted main `682ae4a9`; the rejected candidate is not an ancestor.

The [195 exact changes](round-2-changes.json) touch damage and knockback growth only. Against accepted values, Rifleman uses 0.93, Blademaster 0.955, Mountain King 1.105, Dreadlord 0.905 and Beastmaster 1.06. Binary32 values round toward their originals. Every number is within 15% of both accepted values and round 1. Startup, recovery and passing fighters' numbers stayed unchanged. Rifleman's shared aerial and smash numbers also stayed unchanged. The candidate's TypeScript and source-shape pre-push checks passed.

This result applies to `82995f01`. Later down-move changes under #208, roll changes or bot changes require their own measurement and cannot inherit this frozen result. At the time this evidence was written, the candidate was retained on `codex-balance-numbers-r2-20261007`, off main; only report collection continued after the hard stop.

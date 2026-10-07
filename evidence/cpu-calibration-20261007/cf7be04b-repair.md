# Visible projectile windups, 7 October 2026

Source `86fc1437fb6ec99085adb06abd16f32c1fe649a9`, integrated at `cf7be04b772318ffcf8c775fe8a16b9637d2976a`. Tom authorized this continuation at 15:02 UTC with a hard stop at 16:32 UTC. The original 40–60% fighter field still fails after this repair. Fighter stats, authored profile rows, the 12-frame reaction floor, five-frame direction commitment and all acceptance thresholds are unchanged.

The first shared repeated error in the selected Mountain King and Dreadlord losses was advancing into a projectile after its windup was already available in delayed vision. Defense previously waited for the projectile itself to enter that delayed view. It now forecasts the authored launch and flight from the observed windup, using the same fallible defense choices. An airborne cast that will land and cancel before launch predicts no shot.

## Full-match diagnosis

Both matches use Wren Expert, three stocks, four minutes and sky-deck. The baseline is `ef9894dc4d223aaf43d66693db747fbd242471be`. Candidate traces were captured with the repair in the working tree before committing; their original git HEAD field therefore still names the baseline. The retained [trace excerpts](cf7be04b-traces.json) identify the source explicitly and contain the actual states and scalar inputs around the first changed decision.

| Match | First changed input | Baseline | Repaired |
|---|---|---|---|
| Mountain King / Dreadlord, seed 0 | Frame 1128: shield instead of dash attack against observed Carrion Swarm frame 2 | Mountain King loses at frame 3583; next hit taken at 1133 | Mountain King wins at 3877; next hit taken at 1236 |
| Dreadlord / Rifleman, seed 1 | Frame 346: spot dodge instead of advancing against observed blaster frame 2 | Dreadlord loses at 6555; next hit taken at 351 | Dreadlord wins at 3486; next hit taken at 390 |

The local trace used the real `produceComputerInput`, `captureFrame` and `executeMatchFrame` path. Its scratch logger retained mutable attack-command objects, so their members are excluded from the published excerpts; attack-request presence and the actual following move state are preserved. These two wins diagnose the repair; the unchanged full field determines balance acceptance.

## Original checks

- Focused Bun defense fixtures: 6/6 PASS, including the two cases that failed before this repair and the canceled airborne-cast case.
- Emitted Lua32 on the landed source: 26/26 PASS across defense forecasts, profile contracts, reaction contracts and strategy contracts. Includes 150 profile/seed restored replays with zero differing states, 150 surprise traces with zero early reactions, and the original direction/recovery contracts with zero early reversals. The finite moderate scope released after exit 0.
- [Whole-roster kit check](cf7be04b-kit.md): 13 fighters, 104 seeded matches, zero inactive fighters, no missing kit/defense/recovery measures, zero refused mana presses.
- `bun run check` and the required pre-push source-shape checks PASS. The development watcher's quick-match journey passed; its unrelated field-repeatability test exceeded its five-second timeout during shared load. The required focused checks above passed.
- [Calibration run 37643833548](https://github.com/tompassarelli/smashcraft/actions/runs/37643833548): PASS all 30 rows, six growth paths and 30 counterplays, seeds 0–9 and at least 100 eligible decisions per measure/row. Raw [Markdown](cf7be04b-report.md) and [JSON](cf7be04b-report.json) are unchanged downloads.
- [Difficulty run 37643829965](https://github.com/tompassarelli/smashcraft/actions/runs/37643829965): PASS, Expert beats Rookie 100/100; pooled rates rise 11%, 34%, 46%, 75%, 84%. [Raw report](cf7be04b-difficulty.md).

## Full field result

[Run 37643829098](https://github.com/tompassarelli/smashcraft/actions/runs/37643829098) at exact integrated `cf7be04b` finished at 15:41 UTC: all 20 shards completed, then the original merge gate failed. There were 31,200 matches, 400 per pair, 100 seeds per pair and zero ties or time-outs. Raw [Markdown](cf7be04b-field.md) and [JSON](cf7be04b-field.json) are unchanged downloads.

| Fighter | Prior 5ec2f096 | cf7be04b | Original 40–60% gate |
|---|---:|---:|---|
| Archer | 38% | 42% | PASS |
| Rifleman | 66% | 67% | FAIL |
| Blademaster | 66% | 63% | FAIL |
| Mountain King | 27% | 25% | FAIL |
| Dreadlord | 73% | 74% | FAIL |
| Beastmaster | 37% | 34% | FAIL |

The remaining seven fighters pass: Illidan 46%, Warden 45%, Lich 49%, Uther 54%, Shadow Hunter 48%, Pit Lord 54%, Lich King 50%. Misses fell from six to five, but Mountain King and Beastmaster worsened. This repair does not close #184 or #186. No unchanged field rerun or additional policy repair was started after the result.

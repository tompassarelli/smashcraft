# Retained catch-up findings — 6 October 2026

The two Frozen Throne repros were replayed against Smashcraft
`89abaf3cd49632219ac2d8b287a6838a0825554d`, Wisp
`339c713ed592acfe31ce93e384720234e36d32fb`, with Bun 1.3.13. No gameplay,
snapshot, detector, or acceptance change was needed. #48 remains 1/3: these
headless observations do not satisfy either native box.

| Retained match | Current recovery | Remaining catch-up finding |
| --- | --- | --- |
| 46: absent Archer / fuzzed Rifleman | At the original backlog finding, callback 1221, predicted input lag is 0 and confirmed lag is 20 frames; the original 104-frame backlog finding does not recur. | Callback 1260 reports historical wall-clock growth while prediction lag is 0 and confirmed lag is 16. |
| 87: computer Illidan / fuzzed Archer | After the 1,734 ms hitch at callback 98, both clients reach prediction lag 0 and their pre-hitch confirmed bound of 20 frames at callback 136: 709.22 ms later. | Callback 240 reports wall-clock growth after the match has ended; the final playing observation was callback 190. |

Match 46 stops its input source over callbacks 741–1040 and includes a
1,330 ms game hitch. The combined outage is about 6.35 seconds, exceeding
#48's up-to-two-second stall condition. When input resumes at callback 1041,
prediction trails it by 376 frames; prediction catches up at 1202 and
confirmation returns to its prior 22-frame bound at 1203, 3,069.18 ms after
1041. This is a measured recovery from a longer outage, not a one-second
recovery claim for that outage.

The retained files replay their original `inputs.slow` costs even after the
implementation changes. Wisp's replay clock adds at least 1/60 second per
callback, plus those saved costs and hitches. Its wall-clock growth check
compares that clock with callback count rather than the confirmed or predicted
simulation cursor, and continues after the result. Match 87 also includes a
128 ms hitch at callback 203, after the result. Consequently the remaining
wall-clock findings do not establish input that stays late or a match that
keeps slowing. No finding or threshold was removed to obtain this conclusion.

Both standard `wisp soak --repro` commands still exit 1: match 46 has that
wall-clock finding and four hit-spark scene findings; match 87 has that
wall-clock finding. Their current client-native-call checksums are equal
within each match (`-1536588905` and `-2049994866`, respectively), and differ
from the older record. No desync or runtime error finding occurred. This is
not a passing full soak or a native recovery measurement.

The useful next action for #48 is its existing native cost and three-stall
acceptance check. These retained findings require no new gameplay patch.

## Reproduction and observations

From smashcraft:ts/, use the unchanged published input files:

```sh
bun wisp soak --repro ~/code/smashcraft/main/evidence/frozen-throne-20261006/match-46.json
bun wisp soak --repro ~/code/smashcraft/main/evidence/frozen-throne-20261006/match-87.json
```

Each was run in a moderate capacity scope with a 90-second limit. A subsequent
read-only cursor trace used the same `playSoakMatch` and input files;
smashcraft:evidence/catchup-retained-20261006/trace.ts is the exact executed
probe, originally at smashcraft:ts/build/catchup-trace.ts. It reads each
client's real confirmed and speculative cursors without changing the driver.
The JSON files retain the interval summaries, findings, checksums, and
observations around the outage, recovery, and original finding callbacks.
Their `wallMs` is sampled before the current callback's recorded cost is
added. Interval extrema use every playing observation in that interval;
selected individual observations are included alongside them.

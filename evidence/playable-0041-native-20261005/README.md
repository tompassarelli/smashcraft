# Installed 0.0.41 acceptance — 5 October 2026

The actual 0.0.41 map and its frozen matching helper passed the existing
two-client controller combat/rematch check. This is the playable checkpoint;
files, startup and controls are in wc3-melee:docs/playable-0041.md.

Source `d12a2bf`, build `playable-0041`. Exact map/helper hashes and configuration
are in wc3-melee:evidence/playable-0041-native-20261005/candidate.json.
The only implementation changes from the preceding tested candidate were its
version/build identity and controller stage-help text. Full compilation passed.

The existing wc3-melee:tools/journal-match-capture.py driver used
`--controller-menus --combat-actions` and the frozen 0.0.41 helper. Its result was
accepted by wc3-melee:tools/journal-combat-result.py. Both clients agreed on all
52 recorded combat events in each match: attacks, specials, jump applications,
damage/recovery and grab initiation. Both controllers passed overlapping-trigger
shield behavior; Start paused and resumed the match. Both helpers stayed alive
through results, selection and rematch; no result-screen tap became an extra
combat attack. Traces reported zero drops and no journal input failures.

Stationary final results:

| Match | Confirmed frame | Checksum on both clients |
| --- | --- | --- |
| 1 | 914 | 933725:107908 |
| 2 | 918 | 10392:907822 |

Confirmed shield samples for LT / both triggers / RT alone were 15/18/22 on A
and 18/18/23 on B in match 1; 15/18/25 on each client in match 2. Shield released
after both triggers were released. These counts establish observed shield
retention, not latency percentiles.

The stimulus and evidence boundaries match
wc3-melee:evidence/controller-combat-native-20261005/README.md. Virtual Linux pads
were used, including three separate jump sources, a damaging exchange and
controlled stock losses. RB establishes grab initiation, not in-range capture
and throw; LB establishes walking-modifier tilt, not measured speed or rightward
displacement. This is not physical response, cross-machine timing/fairness or
ten genuinely played human matches. Those requirements retain their issue owners.

Raw kernel/producer/helper records, native combat/result traces and shield
observations are under wc3-melee:evidence/playable-0041-native-20261005/passed/.
Machine result: wc3-melee:evidence/playable-0041-native-20261005/passed/combat-summary.json.

The warm loader first stopped at the correctly selected 0.0.41 map because OCR
read “Rifieman” instead of “Rifleman.” Its checkpoint now uses the selected map
title. Continuing from that screen loaded both existing authenticated clients;
no game restart was used. Both loader logs are retained beside this record.
After the pass, the two owned helper processes were cleanly stopped/reaped and
both authenticated games remained at results. No further verification is needed
for this unchanged bounded checkpoint.

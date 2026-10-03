# Native synchronized contact rollback: positive numerical result

Both distinct-account Battle.net clients ran exact Smashcraft0.0.10, SHA256
bf71b2ba4923cce99dcb73236ba9dc49ba35a4b24eed768164e9f655a508c4c6.
Probe source80c738e uses production-integration simulation62b1a88, not later
physics commits. It deliberately advances speculative combat throughF8, then
accepts the externally authored shield history through actual native sync.

| Observation | Client A | Client B |
| --- | --- | --- |
| Transient speculative damage atF8 | 12 | 12 |
| Earliest correction frame | F5 | F5 |
| Corrected damage / shieldstun | 0 / 7 | 0 / 7 |
| Corrected/canonical/confirmed F8 checksum | 383160:327045, all three | 383160:327045, all three |
| In-memory corrected-vs-canonical/confirmed difference | empty / empty | empty / empty |
| Actual F9-shield counterfactual damage | 12 | 12 |
| Original remote tags preserved / invalid records | 8 / 0 | 8 / 0 |

All eight original wire records and accepted frames independently match the
external corpus in source documentation. P1 sent8 records; P0 sent none.
The diagnostic label F9_original_remote_row_matches=1 checks the retained F5
row at the late-delivery phase; its label is misleading, not a claim of F9
original assignment. Source inspection confirms CONTACT_FRAME=5.

Important export limitation: native Preload truncates the long full-state
strings. Those lines are not complete external snapshots. The full firstDifference
comparisons and checksums were computed in memory before export and agree.
Do not claim that complete serialized snapshots were exported or externally
reconstructed. Exact numerical exports are in
wc3-melee:docs/native-contact-rollback-evidence/client-{a,b}.txt.

Measured conclusion: actual Warcraft synchronized delivery of preserved original
F5 defense history repairs the scripted contact-changing speculative result on
both native clients. Assigning shield toF9 changes the final exchange instead.
This extends the headless result to native numerical execution. It does not
measure naturally late packets, independent live clocks, physical/controller
capture, fighter pixels/audio recovery, real-player fairness, or low latency.
Competitive verdict remains HOLD; none of the required human fights is counted.

Reproduce with retained slots0/1 and exact candidate: host -start, observe F8
completion, enter the208-character corpus from
wc3-melee:docs/native-contact-rollback-20261004.md in P1's focused editbox;
collect both CustomMapData/smashcraft-contact-rollback-20261004-pN.txt exports.
The code buffers all original tagged rows before deriving adjacent-frame edges,
then accepts F8..F1 and reconciles; arrival order does not choose button edges.

# Controller reconnect accepted — 5 October 2026

The 0.0.41 map now has an updated Linux helper that recovers the selected
controller without restarting the helper or match. Two native clients passed
the removal/reconnect journey, with player 1 disconnected in the first match
and player 2 in the rematch. Each helper remained alive throughout both matches.
Files and startup: wc3-melee:docs/playable-0041.md.

## Observed behavior

The fixture removed a pad while shielding, placed a different-identity pad of
the same model at its old event path, and recreated the selected identity at a
new path. The replacement initially held Attack and Shield. The helper ignored
the other pad and required neutral before accepting a fresh 5 ms Attack tap.
The fixture briefly stopped the helper while setting the replacement's initial
held state, so reopening could not race the initial press.

| Result | Match 1 | Match 2 |
| --- | --- | --- |
| Disconnected player | 1 | 2 |
| Old → recovered event node | event2 → event4 | event3 → event5 |
| Assigned neutral release frame | 93 | 93 |
| Fresh tap expected / assigned / applied frame | 181 / 181 / 181 | 181 / 181 / 181 |
| Confirmed shield-on samples before removal | 29 | 28 |
| Confirmed shield-off samples through recovery and fresh tap | 93 | 92 |
| Final confirmed frame on both clients | 547 | 547 |
| Final checksum on both clients | 55348:900019 | 284195:94714 |

All six eligible taps applied once on each native client: **12 applications**,
zero extra attacks, zero dropped trace rows and no unexplained frame retargets.
Kernel events and independently sampled START-file timestamps establish the
expected frame under each player's local grid. Publication rows remained
contiguous (566 per player in match 1; 564 in match 2). Those drain counts are
not the final combat frame. Both endpoints were stationary in the result phase.
The same helpers handled controller selection, results and rematch.

## Owning repair and retained failure

Helper source `41d785c` added ordered removal/reconnect boundaries, neutral
release, held-state rearming and exact device identity matching. Its first
native attempt recovered the correct device and applied the fresh tap at frame
204 on both clients, but later overflowed the bounded output queue. It was not
accepted as a usable reconnect result.

Measurement found each discovery scan took **275–310 ms**. Opening unrelated
evdev devices was cheap; closing their handles took 9–37 ms each, blocking the
helper's input/delivery loop. Source `007b5b8` reads kernel sysfs identity first,
opens only a unique matching candidate and rechecks identity after opening.
Measured scans then took **0.86–1.66 ms**. Queue capacities, frame origins and
transport/retry rules were not changed. All 33 focused checks, including the
explicit native scan measurement, and the helper build passed.

The failed trace also contains burst retry stalls. This pass does not establish
a general burst-recovery bound or repair every transport limitation. The failure
and scan measurements remain under
wc3-melee:docs/controller-reconnect-native-20261005/failed/.

## Reproduction and scope

Exact map/helper identities are in
wc3-melee:docs/controller-reconnect-native-20261005/candidate.json.
Use the unchanged installed 0.0.41 map at fresh initial character selection and
the matching repaired helper. Run wc3-melee:tools/journal-match-capture.py with
`--controller-menus --controller-reconnect`, the current two-client session
configuration and a new output directory. Run
wc3-melee:tools/journal-match-result.py on that capture. It reconciles producer,
kernel, helper, native actions, shield observations and final state. The retained
result is wc3-melee:docs/controller-reconnect-native-20261005/passed/summary.json.

Identity requires matching Linux input ID, name, physical path and unique name,
with at least one nonempty physical/unique discriminator. Missing or ambiguous
identity does not select another pad. Changing USB ports can change physical
identity and is not accepted by this matching rule. Neutral frames continue
during absence; controls held on return must be released before fresh input.

This is virtual Linux pad evidence on one machine. Physical unplug/replug,
different-port recovery, removal during pause/menu transitions, map reload,
chat interference, Windows/macOS and physical latency remain unverified. It
does not close all of #18/#26 or establish cross-machine clock alignment (#25).
Both helpers were stopped and reaped after acceptance; authenticated games were
retained at the second result screen. No repeat is required for this unchanged
bounded claim.

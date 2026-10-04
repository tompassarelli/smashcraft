# Original-frame journal pause checkpoint

The journal now coordinates a shared pause frame instead of independently
stopping each helper or assigning retained input to its later receipt frame.
This is experimental original-frame capture work. It does not change the
previously responsive digital controller-to-keyboard result in 0.0.40.

On pause, helpers seal already assigned input and report their next frames.
The map synchronizes the highest frontier, asks every helper to reach that
barrier, and commits the pause only after all human helpers acknowledge it.
Resume starts new monotonic capture segments at that same shared frame, with
neutral controls; the paused interval contributes no simulation frames.

Checks observed: `./test.sh Journal 90` passed 6/6, zero errors and nine existing
warnings. The corrected companion's journal tests passed 6/6 and its binary
rebuilt. The regression covers every incomplete prefix of a native control
receipt, acceptance after completion, and rejection of a completed invalid
version. The 0.0.41 native map compiled with zero errors and 28 warnings and
loaded on both retained clients with human/fighter mask 3.

Native candidate: private artifact
~/.local/share/smashcraft-build-inputs/production-netcode-20261004/build/Smashcraft 0.0.41.w3x,
SHA256 2edc05ad8c5db222915efd8fb3995b20d22f97175b4c68d99ed47c189fda6d90,
build pause-0041, journal source, shadow-d0-r24, pool-predicted.
Map source is a9c626c with map-version 0.0.41; the companion repair followed
the first native attempt and does not alter the already built map.

The native attempt reported prepared helper frontiers 1422 and 1431. Both map
control receipts selected PAUSE_COMMIT frame 1431, so ordinary unequal frontiers
did reach a shared decision. Both helpers then stopped with "control command
lacks v"; the completed receipts subsequently contained valid v=1 payloads.
The reader treated file creation as completed publication. It now waits for
the generated function's closing line before parsing. The incomplete read's
exact byte prefix was not captured; the retained failure, completed commands,
and executable prefix regression preserve the implicated boundary.

Native final pause acknowledgment and resume were not reached. The corrected
helper has not completed a second native trial. The diagnostic also retained
the previously known journal progress delay; no new latency comparison or
digital-controller regression is inferred. A five-millisecond synthetic tap
was submitted in this trial, but its native intended-frame application was
not established.

Owned failure logs and completed control receipts are retained privately under
~/.local/share/smashcraft-build-inputs/production-netcode-20261004/archive/pause41-partial-control
and wc3-melee:build/journal-pause41-partial-control. Helpers were reaped and the
virtual controller was destroyed. Exact 0.0.40 bytes were restored to both
clients' Maps/00-Smashcraft folders. At the last observation the loaded 0.0.41
session still showed Pausing on A and the End Game submenu on B; ordinary quit
inputs and the developer exit had not established a completed map leave.
Read-only foreground eligibility on A was true. No game/launcher was restarted.

The usable delivery remains 0.0.40. Native journal pause/resume, live original
frame retention, physical response and broader platform/player coverage remain
open. See wc3-melee:docs/smashcraft-delivery-state-20261004.md.

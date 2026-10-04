# Live immutable event transport through a native client hitch

Smashcraft 0.0.15, BUILD 20261003T205320798376516, SHA256
1b2bb310eb0d7caec53136b845a7ef85211e3e38c68f368c7a13cee277d2caae.
Private artifact:
~/.local/share/smashcraft-build-inputs/live-immutable-ingress-20261004/build-20261003T205320798376516/Smashcraft 0.0.15.w3x.
Two retained distinct-account Warcraft III 3.0.0.24268 Linux/GE-Proton clients
joined online custom game sc-live-0015. No client restart or sign-in.

## Independent expected input

The host publisher waits for both build/slot-specific native ready receipts,
then declares one Linux monotonic epoch E. It produces five synthetic
press/release pairs, sampled at host publication time rather than generated
inside Warcraft. Expected frame = 1 + floor((capture_ns-E)*60/1000000000), D=0;
intervals are half-open. Serialized elapsed microseconds truncate nanoseconds;
frame tags use the original nanoseconds. Capture and publication brackets use
the same host clock. They are never subtracted from Warcraft game-clock rows.
This is a synthetic OS/filesystem producer, not SDL or physical Xbox capture,
and not an aligned production clock shared across separate player machines.

A was SIGSTOPped after the second pair. The injector observed its stopped
process state before continuing. Events 5 and 6 were each published while that
state remained stopped. The observed-stop-to-resume-request interval is
251.304 ms (15.078 nominal 60 Hz frames); the actual resumption
instant is not independently measured. Resume occurs in a finally block.
Both events have exact expected frame tags: event 5 at frame 17 (press), event 6
at frame 22 (release). This differs from the earlier lost-pair polling test:
the producer retained original event identity and timing outside the stopped game.

## Native observations

The map polls FileIO at nominal 60 Hz, retaining its cursor on missing files and
draining at most 16 sequence files per callback. Both clients completed at
300 callbacks with ten exact local records and ten exact synchronized records
from each sender. Each observer's twenty receipts match the external corpus in
sender order, including every event ID, elapsed field, original frame and action.
Thus 20/20 local reads and 40/40 observer receipts match; there are ten unique
synthetic source events replayed by two senders, not forty independent samples.
Invalid-record, send-failure and receive-error counters are zero on both clients.

A consumed events 5/6 together at callback 38, Warcraft timer 633.545 ms,
preserving frames 17 and 22. B consumed them at callbacks 54/59, Warcraft timer
900.146/983.398 ms, with those same tags. These callback/time differences are not
cross-client input-latency measurements. Native timer epochs are not aligned.
No frame is derived from the recovery callback or receipt time.

Native read-begin/read-end timestamps are identical at printed precision for
these reads. That is insufficient resolution to bound disk/service cost. The
short corpus does not prove sustained throughput, cache growth behavior, smooth
60 Hz rendering or a worst-case service bound. The first built candidate was
superseded only to add an errors total; it was not loaded for this trial.

## Decision

Proceed to connecting this ingress to the production rollback input ledger and
live helper publication. The original input pair demonstrably survives a game
service hitch through this focus-free native transport. The map only transports
records: no combat frame application or visible rollback correction is claimed.
Competitive HOLD remains pending real capture-clock repair, common-frame and
pause contract, combat integration, visible/audio recovery and physical response.
Real human fights, 3/4-player trials and ten matches remain unfulfilled.

## Reproduce and review

Build wc3-melee:tools/netcode-probe/build-live-immutable-ingress.sh with the
private base map and the pinned toolchain. Install its exact artifact on both
clients and use its printed build ID. Start the host injector in
wc3-melee:docs/native-live-ingress-20261004/producer.py with that ID after adapting
the exact owned process/prefix paths; it waits for native ready files before
publishing. Never target an unverified PID. Load the probe online on two accounts.
Require both complete exports with 300+ callbacks, counts 10/10/10 and zero errors.
Compare each local wire and each sender's observer wires against producer.json;
counters alone are insufficient. Raw evidence and host brackets are under
wc3-melee:docs/native-live-ingress-20261004.

Ending state: both original clients in completed 0.0.15 probe, and each
Maps/00-Smashcraft contains only 0.0.15. Earlier 0.0.14 is privately archived.

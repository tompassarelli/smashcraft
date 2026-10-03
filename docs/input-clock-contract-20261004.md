# Input clock contract: next executable gate

Current production-integration scheduling assigns a poll to next speculative
frame plus fixed delay. It does not derive that frame from event time. Preserved
text records therefore need a separate frame rule; their survival alone does
not close competitive input integrity.

## Facts established by source inspection

Pinned Rust SDL3 0.20.0 exposes u64 timestamps on gamepad button down/up and
axis events. Its bundled SDL3 headers document event timestamps as nanoseconds
populated using SDL_GetTicksNS; that clock is time since SDL initialization.
It is not a shared clock across helper processes or machines. Current companion
logs these events, then samples final pad state; it does not retain each event
for map ingress. Logging Instant elapsed time at dequeue is not an independent
physical event timestamp. Earlier OS/device latency remains outside that record.

## Bounded next experiment

First use an independently authored corpus of id, elapsed-time, intended-frame,
and action records. Define epoch E before capture and frame boundaries by
`frame = 1 + floor((t - E) * 60 / 1_000_000_000) + D` for t>=E,
with fixed D. An exact boundary belongs to the next half-open sampling interval.
This is an experiment rule, not an already selected production clock contract.
Use integer arithmetic in the external oracle and small elapsed values on the
map boundary; do not squeeze absolute nanoseconds into Warcraft integers.

The native probe must preserve record ID/frame/action from local text polling
through synchronization under a verified service stall. It must not replace
intended frame with local service cursor or callback arrival time. Include
records on either side of a boundary, multiple edges, duplicate delivery, and
out-of-order records. Compare against the independent corpus.

A pass establishes tagged-record ingress only. It does not prove the corpus's
clock is aligned with another machine or with production simulation. The next
contact test must replay the original F5 defense after delivery at F9 without
retargeting it. Live clock alignment must bound offset/drift uncertainty,
identify permitted boundary ambiguity, and define common pause/resume semantics.
Until those gates pass, keep competitive HOLD and avoid an end-to-end bound.

## Executable capture-time boundary rule

wc3-melee:tools/netcode-probe/InputFrameOracle.wurst implements the experiment's
60 Hz half-open rule using externally supplied elapsed seconds plus nanoseconds
and fixed delay. It preserves nanosecond precision without overflowing Warcraft's
signed integers; negative elapsed values and an overflowing final frame fail.
It does not use a map service cursor or receipt time.

At 16,666,666 ns the expected frame is 1; at 16,666,667 ns it is 2. Truncating
the latter timestamp to whole microseconds before assignment would incorrectly
place it in frame 1. Split elapsed time at the foreign clock boundary rather
than passing absolute SDL nanoseconds into Warcraft integer fields. This rule
still requires a predeclared epoch, bounded clock alignment and a chosen pause
policy before it can be a production contract.

Run wc3-melee:tools/netcode-probe/test-frame-tagged-records.sh for the focused
tag-retention and capture-frame boundary tests. These tests establish arithmetic
and retention logic; they do not prove live helper-to-map assignment.

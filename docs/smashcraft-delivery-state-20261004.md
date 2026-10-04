# Smashcraft delivery state — 4 October 2026

## Verdict and operator intent

Responsive online play is not yet delivered. No measured transport shortcut has
beaten direct sync. Frame accuracy is the primary requirement: retain captured
presses/releases, assign them consistently to intended simulation frames, and
apply them on those frames when late delivery requires rollback. Ordinary network
jitter must not silently shift or discard an action. Capture, frame assignment,
receipt, simulation and visible response are separate boundaries.

The operator clarified that 33 ms median / 50 ms p95 / 83 ms p99 are useful visible
response targets, not rigid substitutes for viable gameplay. Judge the usable
checkpoint by responsive fights, consistent input timing, retained short taps,
bounded corrections and recovery from ordinary pauses/stalls. Report observed
limits. Do not claim all hardware events survive arbitrary stalls. Full device,
platform, player-count and match coverage remains requested, but unfinished
extended coverage must be distinguished from the first usable checkpoint.

## Measured evidence

| Boundary | Observed | Limit / next action |
| --- | --- | --- |
| Corrected native32 direct sync | 30 Hz means A/B 80/75 ms; 60 Hz 114/108 ms. Every 120/120 value correct in each comparison arm. | Transport echoes only; no physical response or full playable claim. |
| Native32 GameCache + selections | 30 Hz 80/75 ms; 60 Hz 721/743 ms. | No demonstrated advantage over direct sync at the higher rate. |
| Native32 selection digits | 30 Hz 102/99 ms; 60 Hz 4759/4880 ms. | Functional alternative, unsuitable in the measured higher-rate comparison. |
| Native34 file source discriminator | Generated and identical scripts under fresh paths: 100–111 ms means. Changing scripts, including comment-only changes: 2.8–3.4 seconds. All 300/300 correct per arm. | Source-text variation suffices for delay; engine internal cause remains unknown. |
| Native38 vocabulary | All 24 begin/end receipts and 120 pages retained. All arms sent 300/client; every arm recorded zero own echoes and zero peer packets. Local source comparisons reported zero read errors. | Generated controls failed too, invalidating latency/integrity ranking. Do not integrate the writer from this evidence. |
| Capture retention | 250.308 ms stopped-helper trial retained ten edges and emitted 24 rows in twelve pairs. | Production decoder/rollback not exercised by that trial; pause/resume frame mapping remains unfinished. |
| Arithmetic | Upstream explicit-operand Binary32 repair e3714f629113ee682353c3244065fee3e7d9ae16 passed 15/15 focused tests. | Consumer migration/native proof pending; world-scale loss is separate. |
| Common VFX | Six capture/throw, charge/ready, ledge cues integrated; Impact tests 21/21. | Native appearance, timing, pause and replay still required. |

Native38 source fc26d79, map SHA256
f2d678bad9c0f7268a870fc47135950cf4ab759a723253e0c1c979b9feeab411.
A startup local request preceded synchronized entry by 181.327 seconds;
reset then completed in about 41 ms by publication timestamps. Receipt
publication spans A/B: generated30 5.901/5.863 seconds, changing30
20.754/20.532, vocabulary30 195.308/194.542, generated60 6.245/6.229,
changing60 20.075/20.786, vocabulary60 119.742/123.495. These spans include
sending and drain callbacks, and are not per-read cost or latency. Native timer
spans diverge materially from host publication spans. No cadence guarantee
follows. The initial collector timed out before startup with zero receipts;
late collection retained the completed export. Its directory-glob polling used
about one CPU core; collection was changed to exact-path polling. This host
interference remains a confound, not an explanation for the game failure.

Evidence: wc3-melee:docs/native-journal-packet-comparison-20261004/transports0032/,
wc3-melee:docs/native-journal-packet-comparison-20261004/fileio0034/,
wc3-melee:docs/native-journal-packet-comparison-20261004/vocabulary0038/,
wc3-melee:docs/native-physics-precision-20261004/native0035.txt and
wc3-melee:docs/native-physics-precision-20261004/native0037.txt.

## Current execution and estimate

Root owns input testing/native clients; the arithmetic worker accepted consumer
migration in a separate owned lane. Both peer listeners remain stopped by
operator instruction. Native38's existing transport control is being invoked
after the vocabulary experiment to distinguish the SC_GP receiver from broader
sync failure. Its results are diagnostic after a contaminated workload, not a
fresh matched performance comparison. The source-verified chord is Ctrl+N;
an initial Ctrl+T attempt was not registered and invoked no test.

Next decisive input-path checkpoint estimate: 30–60 minutes from the executive
report, an uncalibrated estimate based on recent build/native iteration times,
not a completion commitment. Original deadline 08:38:38 Taipei was missed and
is never reset. Full completion has no credible date yet. A repeated failed
boundary must change the next diagnostic or route, not produce another blind
rerun or a claim of being almost done.

## Delivery path

Resolve the earliest failing input boundary, then exercise actual captured
input through the production decoder into two-client fights and rematch. Check
short taps, original frames, a bounded service stall, rollback, and pause/resume
mapping. Measure visible response and corrections on the working path. Keep
arithmetic/native fidelity and authored VFX integration productive alongside
input work. Hosting admission and remaining device/platform/player coverage
stay explicit. Issues 3/4/21 are closed for their delivered scope; no further
issue closure is justified by the latest results. Draft PR:
https://github.com/tompassarelli/smashcraft/pull/23.

## Subsequent checkpoint

A displayed Battle.net disconnect after the warm-exit attempt; B reported win
by forfeit. The disconnect onset/cause is unknown and is not assigned as the
cause of the earlier missing echoes. Both launcher auth transports have their
source addresses present; actual game admission still requires recovery. The
separate-prefix native38 control produced no receipts before leaving.

Generated-only native39 diagnostic built with zero errors. It suppresses normal
journal polling while start is pending, reports accepted/rejected start send,
and counts rawSC_GP events before parsing. SHA256
ab3cf8e74ee5b74ab701d7bef0bae99c9fabdbc671ffc8e20368d1ded70cc6fe.
Native observation pending. Includes commonVFX but predates binary32 migration.

Consumer arithmetic source87d2c79 plusb5cd0638cb33bc179802f15d70b5a2596da44c23
passed22focused checks: scalar16,DI3,actual-launch-magnitude1,hit-launch1,
knockback-cap1. Native acceptance and scale representation repair remain open.

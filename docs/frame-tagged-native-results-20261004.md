# Native preservation of independently assigned frame tags

Two distinct-account online clients loaded Smashcraft0.0.9, build
20261003T181114345729716, SHA256
fa6b830d9fc6880d008aa8ffe771046c04d38312d7737b7e67ea2efddb9165ec.
Probe source commit34ab4d1 is retained in
~/code/wc3-melee/worktrees/frame-tagged-history-probe-20261004.

Before implementation, wc3-melee:docs/frame-tagged-history-corpus.json froze
nine id/elapsed_us/frame/action records. The independent rule is
1+floor(elapsed_us*60/1000000), D0. Each record is26 ASCII bytes;234 total.
This synthetic epoch does not claim alignment with production simulation.

Both processes were verified stopped before and after injection, then resumed
in finally. Measured stopped-observation to resume-request intervals were
251.194ms for A and250.395ms for B. Both original processes remained live.
Each local map polled9 exact records; each observer received18 exact records,
9 per sender. Local and per-sender receive wire sequences exactly matched the
frozen corpus, including all IDs, elapsed values, intended frames and actions.
Both exports reported zero invalid, duplicate, conflict, out-of-order, rewrite
and overflow counters. No packet/physical/visible-latency claim follows.

This establishes that the supported editbox→local poll→BlzSendSyncData path
can preserve externally assigned original frame identities through these
controlled stalls. It does not derive correct frames from live controller
capture, align separate-machine clocks, apply input to production rollback,
or establish sustained throughput/focus usability. Competitive verdict HOLD.
Next gate is the original F5 defense delivered later into native combat replay,
plus the independent live clock and pause/resume contract.

Private stimulus:
~/code/wc3-melee/worktrees/competitive-integrity-20261003/build/native-command-20261004/frame-tagged-stimulus.json.
Native exports in each prefix's Warcraft III/CustomMapData:
smashcraft-frame-tagged-1-p0.txt and smashcraft-frame-tagged-1-p1.txt.
Reproduction: exact probe, two participants, frozen234-byte corpus, verify STOP,
type corpus, verify STOP, CONT in finally; allow sync receipts, click Save/stop;
compare L and R wire rows per sender against independent corpus.

## Same-client native service-to-sync interval

Within each observer's own Warcraft timer, local polling preceded its own
synchronized receipt by346.923 game-ms for A and372.070 game-ms for B
(20.82 and22.32 nominal60Hz frames). All nine rows in each client's batch shared
one send observation and one receipt time: these are two batch observations,
not18 independent latency samples. This is not host wall time, physical input
latency, visible response, or a transport-only measurement. Sequential process
stops and native lockstep/service behavior were not independently isolated.
No Wi-Fi, server, or engine root cause is established. Preservation success
does not establish acceptably fast delivery; native prediction/correction must
be measured separately. Stage calculations retained privately at
~/code/wc3-melee/worktrees/competitive-integrity-20261003/build/native-command-20261004/frame-tagged-native-stage-gaps.json.

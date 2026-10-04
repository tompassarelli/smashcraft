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

The corrected trial loaded a fresh match on both retained clients and started
two rebuilt helpers at a common CLOCK_MONOTONIC epoch. Both helpers retained
the attack press and release at original frame 19, about 5.1 ms apart, and
published through frame 2130 without the earlier partial-control parse error.
The driver timed out after 35 seconds waiting for the first PREPARE receipts;
neither helper had observed a control command during that interval. A later
100 ms Y press produced complete PAUSE requests on both clients, naming frame
65, after the driver had reaped its helpers. Both screens then showed Pausing.
This is an incomplete native pause trial, not a passing pause/resume check.
The observed boundary is delayed journal progress and control admission; its
owning cause remains unresolved. The trial never reached its controlled helper
stall or resume, and helper retention alone does not prove native application
at frame 19. No digital-controller regression is inferred.

Owned failure logs and completed control receipts are retained privately under
~/.local/share/smashcraft-build-inputs/production-netcode-20261004/archive/pause41-partial-control
and wc3-melee:build/journal-pause41-partial-control. Helpers were reaped and the
virtual controller was destroyed. The first failed session subsequently left
through the native score/browser screens without restarting either client;
its fixtures were retired only after that map leave was verified. Corrected
trial logs and producer timestamps are under wc3-melee:build/journal-pause41-native.
The corrected trial's two helpers were also reaped and its virtual controller
destroyed. Both retained clients reached Game Menu and then End Game Options,
but Quit Mission did not establish a score/browser transition after held keys
and pointer clicks. Both exact game windows remained focused and the pointer
reached the observed Quit Mission position. Both unusable game processes were subsequently terminated by exact PID and
recovered through Play in their retained authenticated Battle.net launchers.
Both returned online without another sign-in. A fresh 0.0.40 two-client match
then accepted movement, and both clients completed ordinary Quit Mission to
score screens. Later F5 requests occurred after that transition, with no
receipt, and did not establish the exit. Do not attribute the earlier leave
failure to the journal without a discriminating measurement. Bounded evidence is
under wc3-melee:docs/journal-pause0041-evidence-20261004/.

## 0.0.42 checkpoint

Source 1f185f8 integrates the immutable one-character vocabulary reader for I4
packets and ACK1 replies. The helper publishes symbols first and a length marker
last. It also repairs nonzero-delay addressing: the reader names the original
frame, matching the writer. Focused journal checks passed Rust 7/7 and Wurst
5/5; these establish protocol logic, not native performance.

The private candidate is
~/.local/share/smashcraft-build-inputs/production-netcode-20261004/build/Smashcraft 0.0.42.w3x,
SHA256 a0bfcbe264ff624c069779b0afd605b0bb62c33f73ccf561a8b063a497a6b723.
Both retained clients joined the same Battle.net match; the spare slots were
closed and both entered the fight. Helper epoch 514602024183525 assigned both
5 ms attack edges to frame 19. The first PREPARE acknowledgment was unavailable
within 35 seconds. The developer footer was observed at attack frame 0 during the trial and later
at attack frame 9 with Pausing after helper shutdown. These are animation
frames, not simulation frames (wc3-melee:wurst/Melee.wurst). Complete pause
requests on both clients name next input frame 65, showing their journal
cursors had admitted input through frame 64. Attack serial 1 was also observed;
that does not establish the attack's exact original simulation frame. No fresh
journal-0042 trace start or completed trace was observed. The fixture never
reached native pause commitment, resume, or its controlled helper stall.

This encoding has not established usable native journal input. Helper retention
does not prove native application at the intended frame. The helpers were reaped
and the virtual controller destroyed. Bounded evidence is retained at
wc3-melee:docs/journal0042-evidence-20261004/; full private logs remain at
wc3-melee:build/journal-journal42-native. The playable keyboard/digital-mapper
baseline remains 0.0.40. No new transport survey is needed to make that choice.

The usable delivery remains 0.0.40. Native journal pause/resume, live original
frame retention, physical response and broader platform/player coverage remain
open. See wc3-melee:docs/smashcraft-delivery-state-20261004.md.

## 0.0.43: bounded short-input result

Source 384b95a checks the admission horizon before disk access and retains a
deferred valid packet until submission or a new epoch. Journal checks passed
7/7. The diagnostic trace now starts automatically on the first ready packet;
the footer distinguishes attack animation, confirmed simulation and prediction.

Candidate journal-0043 SHA256:
52ebde1a0cd1a56574200f93693683199a46dbacf6e56749b3c0f9d07948406a.
Two clients joined one Battle.net match, human mask 3. Both helpers assigned
the normal 5 ms attack edges to frame 19 and a second tap during helper A's
250.075206 ms service stop to frame 97. Both published through frame 300 and
exited successfully. This is helper retention evidence, not native application.

Both native traces completed 300 callbacks in five native seconds. Each sent
32 paired packets containing 64 rows in the first 60 callbacks, but recorded
zero received packets and zero confirmed steps. Confirmed simulation remained
at frame 0; prediction reached frame 25 and blocked at its 24-frame limit.
Frame 97 was never admitted. No confirmed attack was recorded; zero rejected
rows, speculative failures or dropped trace entries does not turn this into a
pass. The first failing gameplay boundary is synchronized receipt/confirmation,
not an absent 60 Hz callback loop.

The subsequent existing generated-packet check produced no local-request
receipt after Ctrl+P. It never established its own startup, so its missing
later receipts cannot diagnose transport. The clients were subsequently
observed at result/quit screens. No further benchmark was admitted from this
unstarted attempt. Both clients left through ordinary score/browser screens
without restart, and exact playable 0.0.40 bytes were restored. Journal43 is
archived privately; no helper or virtual controller remains active.

Bounded native traces, producer/kernel timestamps and capture metadata:
wc3-melee:docs/journal0043-evidence-20261004/. Full helper logs remain at
wc3-melee:build/journal-tap43-native/.

## 0.0.44–0.0.45: channel startup and failed warming

Both candidates received both startup markers on the production SC_GP channel
before any journal reads, at callback 25/native 0.423 seconds. This establishes
registration and callback delivery at startup; it does not diagnose garbage
collection or rule out later integration costs.

In 0.0.44, both observers applied both players’ ordinary 5 ms attack at original
frame 19, callback 162/native 2.700 seconds. Confirmation stopped at frame 20
(prediction 45), with 21 production receipts and two startup receipts per trace.
The second tap was retained at frame 97 during a 249.865263 ms helper stop but
was not applied within the trace. Helpers published through frame 300 and exited
0/0. This proves the first tap’s original-frame application, not usable sustained
latency or recovery. Artifact SHA256:
aa7ea32e304307d95f30fd1f72ec5c2c3806bde3090c0d36466ce45a548bb74f.
Evidence: wc3-melee:docs/journal0044-evidence-20261004/.

0.0.45 warmed 65 canonical symbol scripts before input servicing. Both clients
applied the frame-19 attack at callback 173/native 2.883 seconds. Confirmation
stopped at frame 24 (prediction 49); 25 production receipts plus two startup
receipts were recorded. The frame-97 tap, retained during a 249.951663 ms helper
stop, was not applied. Helpers again published 300 frames and exited 0/0. Neither
trial reported rejected input, speculative failures or dropped trace rows.
Artifact SHA256:
1dc89e76782eca9fb153832aa6d3b5d2c52d4144a8a78ad8b71d10c643373ac3.
Evidence: wc3-melee:docs/journal0045-evidence-20261004/.

Warming did not repair performance and its source/CLI was retired. The
next owning repair encodes data through immutable file presence, so every
present file executes exactly the same script bytes. Native34 motivates that
choice; only its matched native trial can decide this integration’s performance.
The responsive keyboard/digital mapper remains the delivered 0.0.40 path.

## 0.0.46: constant script also failed

The publisher encoded six-bit I4 symbols (seven-bit ACK symbols) through
immutable file presence and committed a ready marker last. Every present file
contained the same three-line script returning `1`. Focused Rust journal checks
passed7/7, the helper rebuilt, and the native map compiled. The experiment’s
source patch and exact map remain privately archived; the failed representation
was removed from the live tree after this native result.

Both clients received both SC_GP startup markers before journal reads. Helpers
retained5ms attack edges at originalframes19 and97, the latter during a
249.892723ms helper stop; both published through300 and exited0/0. Each native
trace recorded300callbacks/native4.999s, but only the two startup callbacks and
zero production receipts. Both confirmations stayedframe0 and predictions25.
Neither attack was applied. No rejected rows, speculative failures or dropped
trace rows were reported. This is a failed native integration, despite passing
protocol checks. It does not prove a cause or invalidate all identical-script
techniques; it rejects this representation at the tested workload.

Artifact SHA256:
605ef5bf552b9e04393076e13ddde5b63bd75c9f183f8a65aad6df48b7bba3ee.
Evidence: wc3-melee:docs/journal0046-evidence-20261004/.
Private source counterexample:
~/.local/share/smashcraft-build-inputs/production-netcode-20261004/archive/journal46-source/constant-presence.patch.

Helpers and virtual controller were reaped. The unusable46 games were terminated
by verified exact PID;40 was restored in both mapfolders. Return to the usable
keyboard/digital-controller result; no further transport survey is admitted by
this failed attempt. Full original-frame journal delivery remains incomplete.

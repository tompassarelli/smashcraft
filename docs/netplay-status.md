# Netplay claims, progress and issue reconciliation

Updated 5 October 2026, Taipei time. The historical review covers 2–4 October;
the later checkpoints below include new native evidence from 5 October. GitHub
holds current issue state; linked records retain the exact measurement scope.

**Playable Linux controller checkpoint: 0.0.41. Combined input acceptance is #26.**
The map and its matching helper passed controller-only menus, a damaging combat
sequence, shield overlap, pause, results and rematch in both native clients.
Frame capture, retention and local prediction have bounded passing evidence;
the new combined 500-edge-per-player run has not yet been completed.
Exact older 0.0.40 is preserved with its known polling-loss limitation.
Startup/artifacts: wc3-melee:docs/playable-0041.md.

The two-client engineering checkpoint is complete. The first human session
awaits Tom and another player: three matches with rematches and intended controls,
reporting missed/extra actions, inconsistent timing or stuck controls. The agent
prepares the session and repairs findings; more virtual-input runs cannot supply
that human observation. #17 owns four-fighter and human play, #18 Linux startup
and jump-source aggregation, and #34 native Windows/macOS access. The current
GitHub **Done when** and **Not required** lists govern completion; #25 and #27
are folded into #26. Physical timing and cross-machine clock alignment are
outside that combined run. Keep the preserved 0.0.41 map/helper pair stable;
internal diagnostics do not supersede it.

## What shipped overnight, 5 October

**At the overnight review, ten canonical issues remained open.** The later
issue cleanup folded #25/#27 into #26 and separated Windows/macOS as #34. The
rows below are delivered engineering increments, not additional issue closures.
Times are recorded commit times in Taipei. Passing scopes stay banked.

| Delivered | Concrete result | Evidence |
| --- | --- | --- |
| Short-input retention | Three 5 ms taps, including ~250 ms helper/game stops, applied at original frames 19/97/157 on both clients; all 300 input frames/player arrived. | wc3-melee:docs/editbox-ingress-native-20261005/README.md |
| Controller pause, 02:18 | Start pauses at a shared frontier; 600 frames/player and matching drained state after resume. | wc3-melee:docs/controller-start-native-20261005/README.md |
| Local prediction repair, 02:46 | Removed the measured extra 1–3-callback wait; 13/13 retained edge rows predicted in their admission callback. Software shield press median 83.09 → 67.95 ms; maximum did not improve. | wc3-melee:docs/native-response-catchup-20261005/README.md |
| Focus/receipt repair, through 05:05 | 500 ms focus-away trial retained original-frame taps, released shield and leaked no keys to the other window. Selective gap repair removed the observed multi-second retry amplification. | wc3-melee:docs/native-text-receipts-20261005/README.md |
| Resume-frame repair, 05:26 | Reading RESUME 361 ms late no longer shifts the fresh tap: original frame 98 on both clients; 600 frames/player and matching state. | wc3-melee:docs/resume-clock-native-20261005/README.md |
| Persistent controller menus, 06:30 | Fighter/stage selection, recall/back, start, results and rematch work without restarting helpers. | wc3-melee:docs/controller-menus-native-20261005/README.md |
| Playable 0.0.41, 06:59 | Installed two-client combat/rematch pass: all 52 recorded combat events per match agree, shield overlap works, final states match; no extra rematch attack or trace/input failure. | wc3-melee:docs/playable-0041-native-20261005/README.md |
| Reconnect, 07:28 | Correct pad recovered at a new event node; shield released, stale held buttons suppressed, fresh tap applied at frame 181; all 12 expected native attacks and both results agree. Scan stalls repaired from 275–310 ms to 0.86–1.66 ms. | wc3-melee:docs/controller-reconnect-native-20261005/README.md |

The controller evidence uses virtual Linux pads and two clients on one machine.
The response sample measures software stimulus to compositor appearance, not
physical button-to-pixel latency. Local START/RESUME anchors still differ;
physical hardware, common cross-machine clocks and Windows/macOS are unfinished.
The current backlog also includes the scoped physics/VFX/balance work, alternate
hosting after #26, a four-fighter run and three human matches under #17. The older
ten-match and additional human-account campaign is no longer an acceptance gate.
A playable Linux checkpoint is delivered while the project remains incomplete.

**Production move export delivered, 08:12 (`5b19ad7`):** 42 normal moves and
nine charged variants now produce 1,797 queryable rows from the owning combat
functions. Timing, contact geometry, damage, shield/hitlag values and sampled
movement/landing transitions are available without duplicating tuning authority.
The focused production check passed and the generated snapshot matched. This
completes the production export portion of #12. See wc3-melee:docs/move-data.md.

**Contextual move comparisons delivered (`055e320`):** 54 contact contexts,
2,236 option trials and six category comparisons now demonstrate reachable
punishment, a timing-and-reach follow-up interval, and detection of a deliberate
category violation. Both focused tests passed and the regenerated snapshot
matched. Four more #12 criteria are complete; reference joins, dominated-trade-off
analysis and measured tuning remain. Exact scope: wc3-melee:docs/move-comparisons.md.

**Factual reference joins delivered (`160b34d`):** 1,320 family comparisons,
six explicit missing records and 54 bounded trade-off pairs now connect the
production export to the factual Melee corpus. Two focused tests passed. The
three observed one-tick readiness differences do not establish a warranted
roster adjustment; tuning and playable before/after acceptance remain open.
See wc3-melee:docs/move-reference-join.md.

**Native chat handoff accepted (`e068b9a`):** both clients passed shared pause,
shield release, unsent native chat, suppressed controls, blocked resume while
chatting, receiver restoration and neutral rearm across match/rematch. Fresh
attacks applied exactly once at original frames 306/326; all 12 expected native
attack applications and both final states matched. The unchanged reconciler
passed after repairing two observer gaps (shield exhaustion during OCR and a
trace ending during pause). This diagnostic does not replace playable 0.0.41.
Exact candidate and evidence: wc3-melee:docs/controller-chat-native-20261005/README.md.

**Connected player-slot lifecycle accepted:** player 2 changed from human to
CPU, EMPTY and back to human across three matches with persistent helpers.
Both clients agreed on all attack histories and final states; all eight expected
human attack applications retained their original frames. Held menu input stayed
out of gameplay until neutral rearm. The receiver now services every connected
sender even when its fighter is CPU or EMPTY. This completes #26's bounded
virtual-Linux-pad slot criterion. Exact candidate, retained fixture failure and
passing corpus: wc3-melee:docs/controller-slots-native-20261005/README.md.

**Physics precision repairs integrated:** capsule/shield calculations now pass
operands to the pinned binary32 helpers before arithmetic; all 508 focused
classifications pass. Position accumulation and gravity-driven vertical velocity
now retain original units across world projection, with snapshot/checksum state
preserved; 71/71 focused physics tests pass, including recorded ten-frame fall
and mid-fall restoration. Native physics re-execution and precision lost at
other scaled-input boundaries remain #9 work. These repairs are not included in
the slot diagnostic or preserved playable 0.0.41. Evidence and scope:
wc3-melee:docs/native-physics-precision.md.

## Input paths and retention limits (#26)

These paths have different observation boundaries. A passing event-capture
check does not establish fighter application. The current player release is
0.0.41; the later chat diagnostic is identified separately above.

| Path | Observation and accepted scope | Remaining limit |
| --- | --- | --- |
| Linux evdev journal → native receiver → shared simulation | Kernel monotonic event timestamps, helper rows and native action traces; bounded 5 ms taps, ~250 ms helper/game stops, 500 ms focus loss, pause/resume, overlapping shields and combat/rematch pass in the linked corpora. The named slot diagnostic also passes CPU/EMPTY/restored-human changes with persistent senders. | Virtual devices, same host; no physical minimum pulse or universal interruption bound established. Departures and broader player counts remain separate requirements. |
| Linux journal reconnect | Original identity, neutral release/rearm and fresh frame-181 tap observed on both slots. | Same virtual pad at a new event node; physical/different-port recovery and automatic map reload unverified. |
| Linux journal native chat | Diagnostic e068b9a: unsent chat, shared pause, suppression, neutral rearm and fresh frame-306/326 actions observed across rematch. | No submitted message or physical/platform claim; this diagnostic does not replace 0.0.41. |
| SDL companion capture/digital keyboard mapping | Event-capture and mapping/focus checks exist; the warm Linux capture retained recorded edges. | Cold SDL capture timestamps compressed the first batch. Mapping and event retention do not prove original-frame native consumption. |
| In-map keyboard polling | Samples held keys and accumulates detected press/release bits until capture. | A pulse wholly between polls is undetectable; repeated transitions coalesce. Historical native polling-loss counterexample remains. |
| Windows/macOS companion | Common mapping source exists. | Foreground adapters reject emission; native builds, input retention and physical play are unverified. |

The journal's configured capacities are **source facts**, not measured maximum
safe interruption times: pending output is bounded by 120 records **and** 2,048
bytes including delimiters; the text receive window is 16 records, and the
native editbox capacity is 4,096 characters. At the ordinary two-frame record
rate, 120 records correspond to about four seconds, but record size and control
traffic can reach a bound earlier. Unpublished-control capture has a separate
65,536-event cap. The input ledger retains 256 frame slots and accepts at most
64 frames ahead of consumption; the current journal profile permits 24 frames
of rollback. None of these capacities promises recovery after an arbitrary
stall or kernel queue loss.

The helper reports and stops on output-capacity exhaustion, kernel
`SYN_DROPPED`, or an event older than its already-published cursor; it does not
overwrite pending output or silently move that event to a later frame. The
receiver rejects conflicting/out-of-window text records. Source checks cover
parts of this response; the requested independently injected native
loss/overflow acceptance remains open.

There is also a remaining representation limit: journal rows retain pressed
and released **bit sets** plus final analog state per original frame. A single
down/up pulse survives in one row, but repeated presses of the same action
within that frame have no multiplicity field, and an analog excursion/return
is not a complete sub-frame history. Production source is
wc3-melee:companion/src/bin/journal.rs (`apply_event`/`encode_row`) and
wc3-melee:wurst/KeyboardInputCapture.wurst. Rapid-repeat/axis-boundary acceptance
must resolve this limitation rather than interpreting a retained kernel log
as proof that every transition reached the fighter.

## The specific answers and their owners

**Resume service-delay defect delivered:** helper B read RESUME 361 ms after its
publication-derived boundary, but the fresh 5 ms tap captured during that stop
applied at original frame 98 on both clients. All 600 frames/player arrived,
paused/held actions stayed suppressed, and both final states matched. Local
publication anchors still differed by 3.134 ms; this is not cross-machine clock
alignment. Exact contract, uncertainty and raw evidence:
wc3-melee:docs/resume-clock-native-20261005/README.md.

| Question / claim | Verdict | Canonical issue |
| --- | --- | --- |
| Does sampled, eligible shield input enter local prediction without waiting for sync? | Demonstrated: 12/12 presses in the capture callback on 0.0.40. Logical state, not physical pixels or all moves. | [#28, completed](https://github.com/tompassarelli/smashcraft/issues/28) |
| Can late original-frame input repair the combat outcome? | Demonstrated for the native F5 shield corpus: damage 12 becomes 0, shieldstun 7, canonical and confirmed states agree. | [#29, completed](https://github.com/tompassarelli/smashcraft/issues/29) |
| Have selection/GameCache beaten direct sync? | No in the corrected bounded 60 Hz comparison; direct sync is the selected baseline. | [#30, completed comparison](https://github.com/tompassarelli/smashcraft/issues/30) |
| Can short inputs disappear or merge? | The 0.0.41 controller path has bounded tap/stall, focus, reconnect and rematch passes. The older 0.0.40 polling path can miss/coalesce inputs. The newer chat diagnostic also passes; physical reconnect and broader hardware acceptance remain open. | [#26, partial](https://github.com/tompassarelli/smashcraft/issues/26) |
| Is every acquired input assigned to its intended frame despite delayed service? | The path released in 0.0.41 preserves tested tap/stall frames and keeps a post-resume tap at frame 98 despite a 361 ms delayed resume read. Local publication anchors still differ; cross-machine alignment remains open. | [#26, active](https://github.com/tompassarelli/smashcraft/issues/26) |
| What physical response and 3–5-frame variation should a player expect? | Candidate B software shield response: 12/12 presses, median 67.95 ms, max 98.17 ms. The measured admission backlog is fixed: 13/13 retained edge rows predict in the same callback. Physical response remains unmeasured. | [#26, active](https://github.com/tompassarelli/smashcraft/issues/26) |
| Can two clients fight and rematch? | Installed 0.0.41 passes controller-only menus, damaging combat, shield overlap, pause and rematch with persistent helpers. Full human-play and feedback acceptance remain open. | [#17, partial](https://github.com/tompassarelli/smashcraft/issues/17) |

Issues #28–#30 were created during this review to record already completed,
bounded results. They are not three engineering tasks completed today. #21 closed
the earlier timeboxed HOLD decision; it did not close an input guarantee.
#31–#33 were duplicate tracking created concurrently with #25–#27, consolidated
into those canonical issues, and closed as not planned rather than completed.

## What 0.0.40 actually does with an input

The exact playable source is fa681100fc429735720325bf479f5bcd6944f25d, with
keyboard input, shadow-d0-r24 and pool-predicted presentation. The map hash and
native evidence are in wc3-melee:docs/smashcraft-delivery-state-20261004.md.

1. The digital controller mapper emits keys; Warcraft samples current held keys
   once per nominal 16.67 ms game callback. The sampling interval is configured,
   not an observed wall-clock upper bound. Between regularly spaced samples,
   input phase alone can add up to one sampling interval after the key is visible
   to Warcraft; OS/controller/display delays are separate.
2. A newly sampled input is assigned to the next speculative simulation frame
   with **zero intentional delay frames**. When prediction can advance, that row
   is simulated in the same callback and persistent presentation is updated.
   Twelve separated shield presses demonstrated this after-capture behavior.
3. Once assigned, the row keeps that frame through synchronization and replay.
   A packet arriving four frames late is not deliberately executed four frames
   late instead. The late-defense experiment proves a concrete correct repair.
4. A complete tap between samples can be absent entirely. The older 0.0.13
   native stop trial lost one of five shield pairs; that press lasted 100 ms
   inside a roughly 285 ms stop. 0.0.40 retains the same polling mechanism and
   its initial very short injected taps also did not all register. This is a
   known capture limitation, not merely a missing universal proof.
5. Prediction stops when the next frame exceeds known input by the configured
   24-frame window. This is a logical lead limit, not a 400 ms response guarantee.
   If callbacks keep running, observed edges stay latched until another row can
   be committed, but repeated edges of one action can merge. If callbacks stop,
   a held key is seen later and a complete intervening tap can be lost. No bounded
   wall-clock delay follows from the frame limit.
6. Actions have gameplay restrictions. Normal attack requests have a six-frame
   buffer and can wait for eligibility or expire; later requests can replace
   earlier ones. Jump/special/shield do not inherit an all-actions queue from
   that buffer. Recovery, hitstun, move startup and pause are separate from
   transport delay. A corrected earlier remote hit can legitimately change a
   previously predicted action's outcome; immutable input does not guarantee
   that every predicted animation survives correction.

Source seams: wc3-melee:wurst/Melee.wurst (shadowPollLocal,
shadowCaptureLocalInput, shadowInputTick, gameTick),
wc3-melee:wurst/KeyboardInputCapture.wurst,
wc3-melee:wurst/ShadowInputSchedule.wurst,
wc3-melee:wurst/ShadowInputPlayback.wurst, wc3-melee:wurst/CommandBuffer.wurst
and wc3-melee:wurst/MatchStep.wurst. The reviewed scheduler, sampler, command
buffer and match step have no differences from the exact playable source.

## Engineering progress during the requested window

Dates below use recorded commits in Taipei time. A recorded finding is not
automatically a new production feature; prediction/replay already existed before
this review window. No unsupported claim of a new network algorithm is made.

| Date / checkpoint | Concrete advance | What it still does not establish |
| --- | --- | --- |
| 3 Oct, 20:48, 9befea9 | Rust SDL3 controller core with bindings, shared-source aggregation and guarded key output; Linux device discovery and focused checks. Later focus adapter 1535200. | Physical game response, analog map delivery, macOS/Windows native readiness. |
| 3 Oct, 22:15, d46f6f8 | Seven focused input-integrity cases recorded: original tags survive four-frame-late/reordered delivery and restore canonical state; models expose missed/coalesced edges and progress-relative frame assignment. | Native capture/clock behavior or display response. |
| 4 Oct, 02:40, 9d0abbc | Both native clients repair the controlled F5 shield exchange through actual sync; full in-memory state comparisons agree. | Live event frame assignment, visible/audio correction or naturally occurring jitter. |
| 4 Oct, 03:22–05:15, de0c62f / 38a8ec1 / f0ca60f | Measured helper event retention and a separate cold SDL timestamp defect; reproduced native polling loss; preserved original tagged file records through a stopped-client contact correction. | End-to-end reliable playable capture. These isolated where reliability fails; they did not fix the playable polling loss. |
| 4 Oct morning, 8d47b00 / 2a12d78 | Integrated original-frame journal input and isolated seconds-long backlog to populated-file integration. Matched generated production packets stayed around 97–100 ms mean own echo; file input was about four seconds. | A usable journal replacement or physical response. |
| 4 Oct, 11:56–12:37, 134da6e / 4640a03 | Activated the compiler's signed-minimum-integer serialization repair and completed the corrected transport comparison: all tested values correct; direct sync best of these 60 Hz arms. | Universal optimal transport or sustained-load bounds. |
| 4 Oct, 14:45, ecf0d3b | Exact 0.0.40 completes two-client movement, attacks, specials, jumps, damaging exchanges, pause/resume, stock loss, results and rematch. Eighteen recorded confirmed checkpoints match. | Every-frame equality, two human competitors, hardware latency or all fidelity requirements. |
| 4 Oct, 15:12, 167b5d7 | All 12 separated shield presses enter prediction in their capture callback. Software virtual-controller mapping produces movement and three attacks in the native game. | Complete short-tap capture, arbitrary stall retention, physical button-to-pixel time. |
| 4 Oct afternoon/evening, through ba00161 | Multiple journal variants and the serial keyboard/file-ACK bridge were rejected. Startup/checksum and interrupt cleanup defects were repaired; exact 0.0.40 restored. | These attempts did not deliver a better input path. The consistency gap stayed open. |

The 60 Hz direct-sync means were 114/108 ms on A/B, versus 721/743 ms for
GameCache plus selection and 4,759/4,880 ms for selection digits. Those are
short-arm **transport echoes**, not local response. Earlier software shield-tint
measurements on another candidate had press median 36.90 ms, p95 47.99 ms,
p99 54.92 ms (32 samples, approximately 16.4 ms capture spacing). They are not
physical-controller or current-build bounds. Do not combine these endpoints into
a fictitious end-to-end performance guarantee.

Evidence: wc3-melee:docs/competitive-integrity/experiment-result.md,
wc3-melee:docs/native-contact-rollback-result-20261004.md,
wc3-melee:docs/native-file-contact-rollback-result-20261004.md,
wc3-melee:docs/native-polling-hitch-20261004.md,
wc3-melee:docs/warcraft-api-netcode-findings.md,
wc3-melee:docs/native-playable-0040-evidence-20261004/ and
wc3-melee:docs/keyboard-mailbox-20261004/README.md.

## Reconciliation and consolidation of every GitHub issue

No previously open umbrella issue met all its acceptance criteria. Completed
subclaims are now visible. Eleven fragmented issues were consolidated on the
owner's request; their requirements remain in the destination bodies and their
original descriptions remain accessible. Those closures are not completion.

| Issue | Disposition and actual remaining work |
| --- | --- |
| #1 Soldat research | Consolidated into #16's deferred research; unfinished. |
| #2 Physics/balance/VFX roadmap | Consolidated into the single roadmap #16, with work owned by #9/#12/#14. |
| #3 Reference intake | Already completed; factual corpus, parameter sources and limitations retained. |
| #4 Independent physics comparisons | Already completed; fixtures and perturbation detection exist. |
| #5 Movement | Consolidated into #9; full reference trajectories and native movement acceptance remain. |
| #6 Damage/knockback/DI | Consolidated into #9; scalar/DI work advanced, full contact/launch/native precision remain. |
| #7 Shield behavior | Consolidated into #9; full displacement, actionable-frame and native contact cases remain. |
| #8 Surface recovery | Consolidated into #9; tech input corrected, damage-state/contact/native recovery gaps remain. |
| #9 Physics acceptance | Open; component passes do not close known world-scale precision and native fidelity gaps. |
| #10 Queryable move data | Consolidated into #12; production export and reference joins remain. |
| #11 Category balance rules | Consolidated into #12; contextual comparisons and violation check remain. |
| #12 Move data/balance/tuning | Open; owns former #10/#11/#15 plus timing-and-reach analysis. |
| #13 Effect event correctness | Consolidated into #14; full verified trigger/reference/lifecycle scope remains. |
| #14 Visible effects | Partial; common grab/charge/ledge cues and star/screen KO implemented. Two-client KO observation and pause/resume pass recorded in wc3-melee:docs/ko-native-20261005/README.md; broader appearance/replay acceptance remains. |
| #15 Measured roster tuning | Consolidated into #12; no completed before/after tuning plus playable evaluation. |
| #16 Online roadmap | Open; original-frame input, human play, platforms, hosting and broader-player work remain. |
| #17 Two-client integration | Partial: 0.0.41 controller combat/rematch and bounded agreement delivered; human play, response distribution and full feedback recovery remain. |
| #18 Controller/companion | Partial: requested Linux control mappings and menu/combat/rematch path pass with virtual pads; analog range, physical and Windows/macOS acceptance remain. |
| #19 Hosting/fairness | Open; alternative native-host admission and matched comparison not delivered. |
| #20 2–4 players / ten matches | Consolidated into #17; the full requested match corpus remains required. |
| #21 Timeboxed integrity decision | Already completed as a HOLD decision, not a positive readiness result. |
| #25 Intended frames | Open; canonical owner for frame assignment, clock and pause semantics. |
| #26 Input retention | Partial; bounded tap/stall, pause/focus, shield overlap, reconnect, combat/rematch and diagnostic chat passes are banked. Player-slot changes, rapid-repeat/axis boundaries, native loss/overflow, physical reconnect and broader hardware acceptance remain open; path/capacity limits are enumerated above. |
| #27 Response/variation | Partial; candidate software shield response measured and admission-to-prediction delay repaired with native evidence. Broader action/physical scope remains. |
| #28 After-capture shield prediction | Completed bounded evidence, registered during this review. |
| #29 Native tagged defense rollback | Completed bounded evidence, registered during this review. |
| #30 Transport comparison | Completed bounded evidence, registered during this review. |
| #31 | Duplicate of #26, closed not planned; not a delivered fix. |
| #32 | Duplicate of #25, closed not planned; not a delivered fix. |
| #33 | Duplicate of #27, closed not planned; not a delivered measurement. |

#22–#24 are pull requests, not missing issues. After consolidation: 30 historical
issue records, **10 open work items**, six completed records, and fourteen
duplicate/consolidation closures. The latter are not delivered engineering.
Open items carry theme labels and now/next/later priorities; #16 is the one
roadmap. The retention, Start pause and prediction catch-up checkpoints are banked;
bounded focus and resume-service gaps are now repaired. Old comments remain evidence; the issue
body owns current status.

## Source integration and branch cleanup

At the start of this review GitHub had main and
production-netcode-integration-20261004. Main contained the earlier integration
and a rollback of unintended research publication, followed by the issue-lookup
instruction in 3366e5b. Later gameplay work and diagnostics were in draft PR #24;
PR #22 and #23 were already merged. This split was source integration history,
not two current player releases.

Main's instruction was incorporated into the integration lane. On 5 October the
owner authorized completing the PR/branch cleanup and removing the blanket
no-publication-to-main restriction. PR #24 is merged and its temporary remote
integration branch is retired. Main is the canonical source. Current PR state is visible at
https://github.com/tompassarelli/smashcraft/pull/24.

The PR integration did not complete #25–#27 or create a player release.
The subsequent controller checkpoint is now playable 0.0.41; exact 0.0.40 remains
preserved. Retained local worker checkouts are
not additional remote releases. Use issue-scoped work lanes for future changes
and finish each bounded checkpoint rather than retaining a permanent alternate
delivery branch or making all research claims prerequisites for merging it.

## The next rungs

1. **#26/#18: extend the now-playable controller path at its remaining seams.**
   Tap/stall, bounded focus/pause and controller combat/rematch are banked. The
   0.0.41 usable checkpoint and bounded reconnect repair are delivered. Chat,
   physical reconnect/play, map reload and other
   platforms remain; do not repeat the successful corpus merely for confidence.
2. **#25: preserve the chosen frame contract.** Define active-match clock and
   pause behavior, then compare independent expected/assigned/applied frames.
   Do not turn a continuous-clock experiment into a silent product decision.
3. **#27: extend the measured timing envelope to gameplay.** The shield baseline
   and owning prediction repair are complete. Broader eligible actions and
   physical hardware remain; keep intended buffering separate from extra delay.
   Do not invent a universal ceiling or rigidly gate delivery on advisory
   33/50/83 ms values.

The already completed claims stay closed unless a relevant change or concrete
regression reopens them. Playtesting the 0.0.41 Linux checkpoint is useful now. It is not
a substitute for these specific technical claims, and broad platform/physics
roadmaps must not prevent reporting progress on them.

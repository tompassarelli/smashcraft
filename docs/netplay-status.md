# Netplay claims, progress and issue reconciliation

Updated 5 October 2026, Taipei time. The historical review covers 2–4 October;
the later checkpoints below include new native evidence from 5 October. GitHub
holds current issue state; linked records retain the exact measurement scope.

**Playable Linux controller checkpoint: 0.0.41. Full input guarantees remain open.**
The map and its matching helper passed controller-only menus, a damaging combat
sequence, shield overlap, pause, results and rematch in both native clients.
Frame capture, retention and local prediction have bounded passing evidence;
physical response, cross-machine clock/fairness and broader acceptance remain.
Exact older 0.0.40 is preserved with its known polling-loss limitation.
Startup/artifacts: wc3-melee:docs/playable-0041.md.

**5 October implementation advance:** the repaired editbox controller candidate
delivered all 300 original frames per player in a two-client native trial.
Three 5 ms Attack taps, including taps during ~250 ms helper/game interruptions,
applied at frames 19, 97 and 157 on both clients. Final frame 300 and checksum
agreed. Helper emission medians fell from ~220 ms to ~1.4 ms. This is a bounded
retention pass for #26, not physical response latency or complete acceptance of
#25–#27. The broader lifecycle and real hardware still need work. Exact source,
failed attempt, fixture repair and raw evidence:
wc3-melee:docs/editbox-ingress-native-20261005/README.md.

**Controller pause checkpoint:** Start now travels in the controller's ordered
input stream. Both clients paused at the same boundary and resumed through all
600 input frames, ending at matching checksum `432553:258417`. This replaces
the failed F8 route, which dropped incoming text while held. Concurrent keyboard
interference remains open; the later bounded window-focus result is below. Resumed helper clocks differed
by 7.1 ms, so this is not a cross-machine alignment guarantee. Evidence and exact
scope: wc3-melee:docs/controller-start-native-20261005/README.md.

**Response repair landed:** journal prediction now consumes up to six available
original frames before rendering. All 13 retained edge admissions reached shield
prediction in the same callback, eliminating the baseline's 1–3-callback wait.
B local shield presses improved from 83.09 to 67.95 ms median; releases improved
from 81.63 to 63.52 ms. All 12 presses and releases were observed and both native
clients confirmed frame 912 with matching state. Press maximum increased from
88.89 to 98.17 ms, so this establishes a median improvement, not a tail bound.
These are software-stimulus-to-compositor measurements. Physical button-to-pixel
remains unmeasured. Exact scope and baseline comparison:
wc3-melee:docs/native-response-catchup-20261005/README.md.

**Focus recovery delivered:** the 500 ms focus-switch corpus now retains and
applies both 5 ms attacks exactly once at original frames 7 and 109 on both
clients. All 300 frames per player arrive, shield releases, final states match,
and no keys reach the other window. Selective repair removes the multi-second
retry amplification: A's native sync-echo median/max is now 180/397 ms versus
1698/4894 ms with whole-suffix retries; B is 147/297 ms. These are transport echoes,
not physical or visible local response. The bounded focus defect is closed;
chat/menu, reconnect/rematch, hardware and broader response remain open. Exact
scope and raw evidence: wc3-melee:docs/native-text-receipts-20261005/README.md.

**Automatic start/results/rematch delivered:** the candidate now follows local
match START publications without an externally supplied capture timestamp. The
same two helpers completed two one-stock match lifecycles. All four 5 ms Attack
taps applied at original frame 19 on both clients; a results-only tap did not leak.
Both match endpoints agreed (118/858608:772108, then 117/339439:72128), with zero
trace drops or input failures. Native testing caught and repaired a stale menu
confirmation after text focus changed. This is Linux virtual-pad evidence with
keyboard menu confirmation, not physical response or a shared cross-machine clock.
Exact source, failures and reproduction:
wc3-melee:docs/match-lifecycle-native-20261005/README.md.

**Controller-only menus delivered:** the same persistent helpers now handle
fighter selection, recall, stage navigation/back, match start, results and
rematch. Two native three-stock lifecycle trials passed using virtual pads for
all game menu actions. Four 5 ms gameplay taps applied once at frame 19 on both
clients; both matches ended at confirmed 385/checksum `354842:379026`, with no
trace drops or result-screen input leakage. This advances #18/#17/#26; it is not
full human combat, physical timing or cross-machine clock alignment. Exact
candidate and raw reconciliation:
wc3-melee:docs/controller-menus-native-20261005/README.md.

**0.0.41 installed combat checkpoint delivered:** two three-stock match sequences
passed with the release map and frozen matching helper. Both clients agreed on
all 52 recorded combat events in each match, including attacks, specials, three
jump sources, damage and grab initiation. Shield survived LT release while RT
remained held; controller Start paused and resumed. Final states agreed at
914/`933725:107908` and 918/`10392:907822`, with no extra rematch attack, input
failure or trace drop. These are virtual-controller fights, not ten human matches
or physical timing. Exact release corpus:
wc3-melee:docs/playable-0041-native-20261005/README.md.

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
| Can short inputs disappear or merge? | The 0.0.41 controller path has bounded tap/stall, focus and rematch passes. The older 0.0.40 polling path can miss/coalesce inputs. Chat, reconnect and hardware acceptance remain open. | [#26, partial](https://github.com/tompassarelli/smashcraft/issues/26) |
| Is every acquired input assigned to its intended frame despite delayed service? | The candidate preserves tested tap/stall frames and now keeps a post-resume tap at frame 98 despite a 361 ms delayed resume read. Local publication anchors still differ; cross-machine alignment remains open. 0.0.40 still assigns by local progress. | [#25, partial](https://github.com/tompassarelli/smashcraft/issues/25) |
| What physical response and 3–5-frame variation should a player expect? | Candidate B software shield response: 12/12 presses, median 67.95 ms, max 98.17 ms. The measured admission backlog is fixed: 13/13 retained edge rows predict in the same callback. Physical response remains unmeasured. | [#27, partial](https://github.com/tompassarelli/smashcraft/issues/27) |
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
| #26 Input retention | Partial; candidate's tap/stall, Start pause/resume and bounded focus recovery corpora pass. Keyboard interference and broader lifecycle remain open; playable 0.0.40's polling limitation remains. |
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
   0.0.41 usable checkpoint is delivered. Chat/reconnect, physical play and other
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

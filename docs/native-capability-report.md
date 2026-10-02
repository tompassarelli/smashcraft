# Native capability report

Updated 1 October 2026. Status is evidence-specific; no competitive backend
has passed native acceptance. Research/acceptance record:
wc3-melee:docs/netcode-proposal.md.

## Baseline and versions

- Source baseline: local tag `netcode-baseline-20260930`, commit
  `e9aeefce750da751d4aaf1754df6a868fba5cae8`, also published on GitHub main.
- Wurst target: Lua; declared WC3 patch v3.0.
- Compiler: `c31f228c4a43dad1bca4d4acc003b1d12a823331`;
  jar SHA256 `9169418755f722bbbfd36f4e4f2e34241e72a0e006510040b3569eb76e4cb6ad`.
- Stdlib: `4dfc8a0474bd0b9628ff79d935310c7fc92bce4a` (different from the
  research's inspected SyncSimple revision; local source decides behavior).
- Installed game: `3.0.0.24268`, read from the installation's .build.info.
  The actual client UI/native behavior still supplies runtime evidence.
- Steam/Battle.net GE-Proton environment is the retained Linux execution path.
- Saved preferences: gamespeed=2, mostRecentlySeenGraphicsMode=2. These raw
  preference values do not establish the active match speed or graphics mode.
  The probe displays GetGameSpeed; native UI graphics mode remains to inspect.
- Gameplay map saved before the probe, restored byte-for-byte afterward, and
  reloaded to character select without restarting the Warcraft process.
  Screenshot: wc3-melee:build/netcode-probe/gameplay-restored.png.
- Aerial animation WIP is excluded from the historical baseline. Exporter
  interpolation was repaired in mdl-exporter4 commit 376f0c2a153d1332ae535ad4cada75cd3340ca6a.
  Both new packages pass preservation against unchanged source scenes exported
  with that repair; this does not preserve the former buggy between-key poses.
  See wc3-melee:docs/fighter-animation-work.md for the distinction and native validation limits.

## Audit: existing ownership boundaries

| State/path | Current owner | Replay consequence |
| --- | --- | --- |
| Fighter physics, damage, stocks, shield, hitlag/stun, tech/ledge/grab, jumps | wc3-melee:wurst/Simulation.wurst | Numerical state exists; every mutable scalar and fixed projectile array needs snapshot coverage. |
| Simultaneous hit selection, then application | wc3-melee:wurst/Simulation.wurst | Retain explicit pair semantics; do not resolve by packet order. |
| Per-victim hit registry | FighterState.lastHitAttacker/serial/window | Attacker is currently a Wurst object reference. Snapshot/restore needs stable identity, not a reference into a different history copy. |
| Inputs and buffered attacks | wc3-melee:wurst/PlayerInputState.wurst, DirectionalInput.wurst, CommandBuffer.wurst; queues/edges in Melee.wurst | Include previous-held, edges, pulse history, buffer frame/style/facing/charge and consumption state. |
| Match stage/selection/rules/timer/results | wc3-melee:wurst/MatchRules.wurst and MatchStep.wurst | Separate confirmed results from speculative presentation; snapshot rule state and clocks. |
| Bot decisions and cooldown | wc3-melee:wurst/Melee.wurst gameTick | Must become replay input or numerical state; currently adapter-owned. |
| Native fighter bodies | Fighter extends FighterState in wc3-melee:wurst/Melee.wurst | CreateUnit, paused/invulnerable/pathing-disabled; SetUnitX/Y/FlyHeight/facing still mutate native unit state. Not safe to assume these are local-prediction visuals. |
| Animations/shields/projectiles/UI/camera | wc3-melee:wurst/Melee.wurst and UI packages | Presentation follows serials/state; dynamic effects and body handles must stay out of snapshots and replay. Exact pose recovery untested. |
| Timers | Melee.gameTick at 0.016666667 game seconds | No measured wall-time cadence guarantee. Trace timer reads are diagnostic, not physics delta. |
| Randomness | No engine RNG calls found in current Simulation/MatchStep/CommandBuffer source | Future random gameplay needs owned snapshot RNG. This is source evidence, not a native determinism proof. |
| Save/load bindings | wc3-melee:wurst/BindingSettings.wurst | Current stdlib callback synchronizes loaded data before restoring bindings. Keep configuration out of per-frame combat transport. |

The core uses real arithmetic plus math/conversion natives (Cos, Sin,
SquareRoot, R2I); no native unit orders/damage/position reads or writes occur in
the inspected numerical step. Exact runtime replay remains unproven. Native
body/presentation state currently shares a subclass with numerical state; a
snapshot must not accidentally include handles or presentation-only values.
Trap/bear/transformation logic is still requested gameplay scope, not existing
snapshot coverage. Current combat supports two fighters, not four.

## Gate status

| Gate | Observed | Status |
| --- | --- | --- |
| Header declarations | Pinned common.j declares keyboard/meta/mouse polling, local-client-active, named effect animation/blend and effect time | PASS for declaration presence only |
| A: early local polling | Both probes run; N/I/A holds/releases visible, and some poll transitions precede synchronized callbacks | SINGLE-CLIENT ONLY; network locality/physical timing unknown |
| B: native traffic/pacing | Both 180-byte packet variants receive contiguous rows; receipt bursts observed | SHORT SINGLE-CLIENT SAMPLE; multiplayer capacity unknown |
| C: complete snapshots/replay | Preallocated history, exact comparison, 100,000-frame unchanged-input oracle and bounded corrected-input oracle pass | PARTIAL; transport-fault replay, serialization/hash and native equivalence pending |
| D: local presentation/pose recovery | Single authored timeline restores known marker poses; clip-switch candidates failed | PARTIAL; fighter pose fidelity/local multiplayer safety unproven |
| E: controlled fixed/hybrid comparison | Isolated numerical D=3/5 R=0 gameplay runs; regular waits in both | PARTIAL; hybrid and multiplayer pending |

Initial probe compile exposed `%` (real modulo) where integer ring indices
require `mod`, then local variable shadowing; both were corrected in source.
An ad-hoc compiler-only invocation returned a NullPointerException and is not
a supported validation result. Use the project's build workflow; do not
interpret that driver failure as native API failure.

## Next decisions

Test two actual clients with external input/video timing and controlled
network conditions before selecting any online policy. Build the complete
replayable core independently; no reason to block pure simulation work on a
second client. Keep the native synchronized-key gameplay baseline meanwhile.

No latency, fairness, throughput, phase-seek or shipping-profile measurement has
been inferred from declaration names, compiler success or the headless suite.

## Two-client gameplay baseline, 1 October

Two simultaneous Warcraft III 3.0.0.24268 clients on one Linux host, using
separate Proton profiles, private GPU desktops and distinct authenticated
accounts, joined the private Smashcraft lobby with both human slots occupied.
The normal illidan-physics-complete map ran Archer versus Rifleman. Independent
private XTEST inputs from each client reached both clients; separate captures
showed the same fighters and damage. P1 and P2 each applied a jump and an attack
in the retained trace windows. The five-second input traces agree byte-for-byte,
identify two humans and report zero dropped entries. Paths:
wc3-melee:build/two-clients/a-first-human-trace.txt and b-first-human-trace.txt,
plus a-second-human-trace.txt and b-second-human-trace.txt.

The match reached results. P2's rematch confirmation waited for P1; P1's
confirmation returned both players to selection with choices retained. A
subsequent Illidan mirror match ran both jumps and P2's aerial attack, with
matching no-drop traces, and reached results. Evidence:
wc3-melee:build/two-clients/a-illidan-mirror-trace.txt and b-illidan-mirror-trace.txt.

This proves a working same-host Battle.net gameplay path and a two-match
baseline/rematch journey. It does not prove full-state checksum agreement,
ten consecutive matches, physical input latency, controlled network impairment,
early polling, production transport, prediction or rollback. Existing native
transport and pose gates remain open.

## Two-client input transport pressure, 1 October

The existing input probes ran with both real human slots in the same Battle.net
session. Both use 180-byte packets and a requested 60-callback/second native
timer. Variant 1 sends one row per callback per competitor; variant 2 sends
two consecutive rows every second callback. These are traffic diagnostics,
not the production gameplay backend or physical response measurements.

| Trace | Dump service S | Completed R=0 frame | Latest observed P1/P2 row age in callbacks | Failed sends | Trace drops |
| --- | --- | --- | --- | --- | --- |
| P2, batch 1 | 1592 | 815 | 765 / 764 | 0 | 0 |
| P1, batch 2 | 1341 | 1225 | 105 / 107 | 0 | 0 |
| P2, batch 2 | 1418 | 1276 | 127 / 133 | 0 | 0 |

The first accepted rows arrived at S=19/43 in batch 1 and S=20/43 in
batch 2. Their later increasing ages show delivery backlog in both variants.
Batch 2 materially reduced it without eliminating it in these samples.
Successful BlzSendSyncData returns did not imply timely delivery. P1's later
batch-1 dump overflowed its trace (1298 drops); only its retained prefix is
evidence, and it is not claimed as a complete run. Each dump was requested by
held private-XTEST F8; short taps can occur between polling callbacks.

Evidence: wc3-melee:build/two-clients/b-native-batch1.txt,
a-native-batch1-overflow.txt, a-native-batch2-early.txt and
b-native-batch2-early.txt. These counters are callback ages, not milliseconds.
The current gameplay baseline uses synchronized key events and does not send
these continuous packets; the backlog must not be presented as a measured
baseline button-to-screen delay. Production I2 packets are smaller (65/106
bytes), so their usable envelope still requires its own two-client run.

No average, p95/p99 or maximum physical input-to-pixel delay has been measured.
The earlier six-callback single-client receipt cadence is nominally 100 ms at
60 callbacks/second; it is not a two-client latency bound or a uniform sampling
distribution. Under sustained traffic, phase within a delivery batch is only
one source of delay: backlog adds further variable waiting. Do not promise a
100-ms ceiling, absence of lost physical taps, or equal wall-clock response
from agreement of logical frames.

### Input source determines what rollback can improve

The playable map's 60-Hz gameTick reads firstKeyState/secondKeyState, populated
by BlzTriggerRegisterPlayerKeyEvent handlers. Those callbacks have already been
synchronized; sampling that state more often or predicting after callback
receipt cannot recover the input's earlier delivery delay.

InputProbe.sample and ScheduledInputProbe.poll instead call BlzIsKeyPressed
directly. They do not obtain their held masks from synchronized callbacks.
The recorded polling-before-callback transitions establish a distinct early
local path in the tested client. They do not establish its full focus/chat,
short-tap or physical timing contract. Rollback must capture that local path
before transport, keep own pending rows outside accepted common input, and
predict only remote holds without generating fresh edges. The confirmed
simulation and common advancement gate must still use synchronized acceptance.

### What input delay can currently be promised

The playable baseline has no measured wall-clock response bound. Its delay is
physical input to synchronized callback, then callback to simulation, then
simulation to visible presentation. Delivery-batch phase, backlog, timer stalls,
and display timing can each vary; this is timing-dependent rather than game RNG.
Equal confirmed states do not imply equal presentation times.

At an actually steady 60-Hz cadence, polling alone contributes between zero and
one 16.67-ms interval for a hold that survives until the next poll. An 8.33-ms
mean would require uniformly distributed input phase; neither that distribution
nor steady physical polling cadence has been measured here. A tap entirely
between samples can be absent. The synchronized baseline pays its callback
transport delay before its gameTick can observe the input.

Scheduled D=3 and D=5 represent nominal 50-ms and 83.33-ms logical offsets at
60 simulation frames per second. They do not bound physical latency when the
common gate waits. The six-frame rollback window bounds speculative distance
from common knowledge; nominal 100 ms describes its frame budget, not an
input-delivery ceiling. Local capture may remove the wait for self-delivery
from speculative response, but fixed input scheduling, polling phase, gate
stalls and rendering remain. Visible prediction is not enabled or native-proved.

A real average/frame-delay comparison remains pending for baseline, fixed
schedule and hybrid rollback. Report average/p95/p99/max only after physical
button-to-pixel measurements under ordinary and controlled delay/jitter;
callback counters and timer timestamps cannot substitute for that experiment.

## Ten consecutive baseline matches — 2026-10-01

Two real, separately authenticated clients completed ten consecutive ordinary
matches through results and rematch without restarting the map. The roster
sequence was Archer/Rifleman twice, Illidan/Rifleman once, Illidan mirrors
three times, Archer mirrors twice, and Rifleman mirrors twice. Both stages
were used. The first match used three stocks; subsequent matches used one.
After jump/attack input, the second player deliberately walked offstage to
exercise KO/results promptly. These are bounded match-loop tests, not prolonged
combat/load or exhaustive collision coverage.

All ten results trace windows report two humans, phase 3, zero trace drops,
and byte-identical per-client traces including six numerical checksum samples.
Nine retained combat windows also match. Both players' jump/attack callbacks
appear in combat windows 3..10. Match 2's attempted combat copy was stale and
is explicitly named INVALID-stale; it is excluded. The result checks for that
match are fresh. Agreement is proved only at sampled confirmed states; no
physical tap-loss, every-frame equality or wall-clock responsiveness guarantee
is inferred.

Evidence: wc3-melee:build/two-clients/{a,b}-run10-match01-result.txt through
{a,b}-run10-match10-result.txt and corresponding valid combat traces. These
baseline sessions use the two-client-checksum map previously identified below.
Production scheduled inputs, native shadow rollback, visible pose correction,
controlled connection impairment and physical latency measurements remain open.

## Live numerical checksum comparison

The normal two-client-checksum map compiled and deployed with identical bytes
in both profiles (SHA-256
597a7ec5d837ee48b86d1a1c6dc676f035b39ffac7145096b87bf4818392fe1a).
ReplaySnapshot canonical serialization includes current fighter fields and
arrays, stable participant references, match rules, command buffers and the
simulation cursor. Real values use binary sign/exponent/significand encoding.
The digest is a pure two-lane bounded integer hash, independent of Warcraft's
StringHash native. Ten focused replay-state tests pass, including a known
hash vector and distinct small-real/reference-slot values.

The playable Archer/Rifleman match produced identical digest pairs on both
clients at frames 24,83,143,203,263,323 and a later window at
4719,4778,4838,4898,4958,5018. Both windows report two humans and zero trace
drops. Native traces: wc3-melee:build/two-clients/a-checksum-combat-trace.txt and
b-checksum-combat-trace.txt, plus a-checksum-combat-later.txt and
b-checksum-combat-later.txt. These prove agreement at the twelve sampled
confirmed frames, not every frame or a collision-free cryptographic guarantee.
The digest runs only during developer traces, once per 60 trace callbacks;
this diagnostic overhead is excluded from future response-time windows.

Results/rematch checksum coverage and ten consecutive matches were subsequently
observed in the run above. Controlled network conditions, production scheduled
transport and shadow/visible rollback remain open. B's bounded private desktop subsequently reached its ordinary one-hour
expiry; the terminal capacity release receipt was consumed. That is session
lifecycle evidence, not an unexplained gameplay disconnect.

## Observed single-client input run

Both variants compiled with zero errors/warnings and executed on the retained
client. Input was injected through ydotool/uinput on Linux, not a physical
button instrument or a gamepad mapper. One human slot was active; the other
slot did not contribute input. The displayed game-speed handle was 2. This was
the existing single-client test session, not a Battle.net/LAN comparison.

Diagnostic files, captured with F8 before trace capacity was exhausted (only
line endings and trailing blank lines normalized for Git):

- wc3-melee:tools/netcode-probe/evidence/20260930-batch1.txt
- wc3-melee:tools/netcode-probe/evidence/20260930-batch2.txt

| Observation | One row/packet | Two rows/packet |
| --- | --- | --- |
| Dump service counter | 242 | 237 |
| Send calls at dump / rejected | 242 / 0 | 118 / 0 |
| Packets recorded / covered rows | 239 / 239 | 116 / 232 |
| First receipt service counter | 11 | 11 |
| Gaps between subsequent receipt bursts | 6 callbacks | 6 callbacks |
| Maximum first-row age after initial burst | 5 callbacks | 6 callbacks |
| Dropped trace entries at dump | 0 | 0 |

Later screenshots show progress across the 256-row ledger wrap, with zero
displayed invalid/conflicting/reordered packets: batch 1 at S=311, contiguous
row 305; batch 2 at S=307, contiguous row 304. Screenshot paths:
wc3-melee:build/netcode-probe/after-input.png and
wc3-melee:build/netcode-probe/batch2-after-input.png.

In batch 2, polling observed N at S=159 and the key callback arrived at S=161;
polling observed I/A released at S=212 and callbacks arrived at S=215. Other
transitions were detected in the same callback interval or by the event first.
This establishes functioning, distinct paths in this run, not physical latency
or a general promise that polling is always earlier. Both recorded receipt
streams were bursty even with one client. A 60 Hz timer request must therefore
not be described as a measured per-frame delivery guarantee.

The empty R=0 counter stayed 11 callbacks behind the service counter. Its
one-step-per-service rule retains startup waiting; that difference is not an
estimate of transport age or the production fighting-frame delay.

Still untested: two-client locality, induced network delay/loss, physical
button-to-pixel time, sustained production traffic, chat/focus/modifier edge
cases, controller injection, observer behavior and outer-engine stalls.

## Replay foundation implemented

wc3-melee:wurst/ReplayState.wurst provides detached, reusable capture/restore
storage for the existing two-fighter numerical state, projectile arrays,
match rules, command buffers and frame/CPU cooldown state. Attacker references
map into the restored pair. Physical keys and uncommitted edges are sampling
state outside snapshots. Capture/restore allocate no objects or native handles.
This is not yet a canonical serialized snapshot format.

wc3-melee:wurst/MatchStep.wurst now records each complete frame in
MatchFrameInput. Execution copies the immutable inputs into scratch storage,
feeds recorded attack requests into canonical command buffers, and advances
only the expected next frame. wc3-melee:wurst/Melee.wurst captures and executes
that row once per existing game tick; callbacks stage requests. Match start
resets the reusable record. There is no added network delay or prediction.

wc3-melee:wurst/ReplayHistory.wurst preallocates a 64-slot ring of snapshots
immediately before each assigned frame and privately copied input rows. Epochs,
ring reuse and complete replay ranges are checked before restore; unavailable
history fails without mutating the current state. Save/restore/replay allocate
neither Wurst objects nor native handles. Construct history in common context.
wc3-melee:wurst/ReplayState.wurst compares every canonical field directly and
reports the first mismatch, including exact real comparisons and attacker slot
identity. All 79 FighterState fields and fixed projectile arrays are covered.

The ordinary suite passes 221/221, zero errors/warnings, including short tapes,
ring wrap, immutable retained input, stale epochs and signed-counter bounds.
Log: wc3-melee:build/replay-history-integrated.log. A separately selected
100,000-frame tape also passes, comparing independent worlds every frame after
six-frame and full 64-frame replay every 64 frames. It exercises shield stun,
hitlag, projectiles, hit registries, damage, KO and respawn. Log:
wc3-melee:build/replay-history-100k.log. Reproduce with:

```bash
bash ~/code/wc3-melee/worktrees/test-loop/test.sh ReplaySoak 180
```

The first long run exhausted its 99-stock fixture after successful comparisons
and failed the final MATCH assertion. The long fixture now starts with 100001
stocks; short tests retain 99. No assertion or gameplay tuning changed. The
original failure remains at wc3-melee:build/replay-history-100k-exhausted-stocks.log.

The 100,000-frame scenario proves replay of unchanged recorded inputs in the
headless runtime. Its result does not establish corrected-input or transport-fault
coverage, canonical serialization/hash or native arithmetic agreement. CPU
decisions remain recorded inputs; speculative CPU regeneration is not implemented.

Corrected used-input replay is now separately implemented in
wc3-melee:wurst/ReplayHistory.wurst. Existing beginEpoch selects R=0;
beginEpochWithCorrections selects an immutable per-epoch window of 0–6 frames.
The 64 retained snapshots do not expand that window. Both speculative and
subsequent authoritative saves stop at the window boundary while an earlier
prediction remains unresolved. save retains an authoritative row;
saveSpeculative retains a replaceable used copy. Neither changes its producer.

ReplayCorrections owns up to six detached complete-frame replacements, bound to
one epoch. Identical duplicate additions succeed; conflicting ones fail. correct
preflights the entire batch and replay interval against the saved present before
editing history or live state. It rejects stale epochs, missing/overwritten/future
rows, conflicting authoritative input and a live cursor away from the present.
A mismatch restores immediately before the earliest differing row, replays to
the saved present, and refreshes every affected before-frame snapshot. Supplied
rows become authoritative; matching predictions confirm without restoring or
stepping. The return is the earliest replayed frame, zero for unchanged input,
or -1 for rejection. Scratch and batch storage are preallocated; correction
creates no Wurst objects or native handles. Initialize them in common context.

The focused ReplayHistoryTests suite passes 8/8 in 32 seconds, with zero errors
and one existing unused-import warning in wc3-melee:wurst/RecoveryTests.wurst.
Log: wc3-melee:build/corrected-replay-tests.log. Reproduce with:

```bash
bash ~/code/wc3-melee/worktrees/prediction-replay/test.sh ReplayHistoryTests
```

The new oracle executes 68 frames in independent actual, partially corrected and
predicted worlds. Missing attack input at frame 63 and movement input at frame 65
produce real state differences across ring wrap. Reordered replacement batches
correct frame 63 and then frame 65; the second rollback uses snapshots refreshed
by the first. Every affected retained snapshot and the final replay match the
actual-input history exactly, including projectile damage. Additional cases cover
whole-batch rejection without mutation, authoritative conflicts, identical-input
no-op, epoch-bound rematch rejection, bounded batch copying, and R=0/1/2 admission.
Existing 1,024- and 4,096-frame unchanged-input tapes also pass in that suite.

This is a bounded pure-core correction scenario, not a new 100,000-frame fault
soak. No native or network validation was performed. Authoritative input sourcing,
per-player row assembly, prediction policy, scheduling, presentation and native
integration remain outside this correction API; history is not connected to
speculative gameplay.

## Bounded input protocol and accepted ledger

wc3-melee:wurst/NetworkInput.wurst retains the 15 action IDs from bindings as
held/pressed/released masks, signed axes -127..127 and trigger values 0..255.
Both press and release can survive a tap in one capture interval. Prediction
copies held/axis/trigger values but clears edges.

wc3-melee:wurst/KeyboardInputCapture.wurst now accumulates fresh action-mask
transitions into bounded press/release masks, preserving a short tap between
commits. Repeated held samples do not create new presses. Opposite keyboard
directions cancel; C-stick actions do not affect movement axes. Its existing
fixed-scheduler capture path clears edges only after a successful new commit,
so application waits cannot rewrite an assigned row or discard the next tap.
Focus neutral produces release edges; explicit resume reset discards
uncommitted actions and baselines current held keys without inventing presses.
An epoch can reset from neutral. Six focused tests pass, including a
repeated-capture wait against the real scheduler and a held-key resume:
wc3-melee:build/wurst-tests/keyboard-capture-resume-r2.log.
Sampling takes an already normalized held-action mask. The pure adapter from
network rows to gameplay InputSnapshot and AttackBuffer requests is now in
wc3-melee:wurst/InputAdapter.wurst. Binding/key polling, inactive-client neutral input and scheduled gameplay now
run in the isolated diagnostic below. Chat/menu ownership remains unresolved;
the installed gameplay baseline is unchanged.

wc3-melee:wurst/InputProtocol.wurst currently encodes complete normalized input
records in exact 65-byte or 106-byte ASCII packets (one/two consecutive frames),
version I2. Each row carries held/pressed/released actions, quantized axes and
triggers, first sampled Special direction, latest sampled shield-dodge vector,
latest qualifying SDI pulse, the latest up/down ledge edge, and bounded signed
throw-direction press sums. Reserved flags, count, epoch, frame range, action
masks, axis bounds, and canonical direction/count fields are checked. Player
identity is absent from the payload. The isolated scheduled receiver derives
the slot from GetTriggerPlayer, registers fromServer=false and uses SC_I.
The production gameplay map still uses its synchronized-event input path.

The sampler retains the first uncommitted Special direction, the latest
shield-trigger direction, and the latest SDI pulse until a row is captured;
predicted rows clear these press-only values. If polling observes opposing
up/down ledge presses in one sample, they resolve to neutral because their
sub-sample order is unknowable. Polling cannot recover physical ordering between
two calls to sample(). Repeated throw-direction taps are accumulated up to
±127 per axis before row assignment. The existing callback baseline is
unchanged.

The integrated input-focused suite passes 69/69, with zero errors and the
existing unused-import warning in wc3-melee:wurst/RecoveryTests.wurst.
Evidence: wc3-melee:build/normalized-input-integrated.log. Coverage includes
press-vector retention, wire rejection/roundtrip, immutable ledger/scheduler
behavior, action mapping and clearing reused frame-local output so neutral
rows cannot retain a prior attack. The adapter allocates no objects per row.
This remains pure-source evidence: the published map still uses native
synchronized callbacks, and no new native or two-client gate has passed.

wc3-melee:wurst/InputLedger.wurst preallocates 256 frames for two competitors.
It validates a whole batch before accepting any rows; equal duplicates succeed,
conflicts fail. The known frontier advances only over both players' contiguous
accepted input. Core frames start at 1, so initial neutral rows are 1..D, the
one-based equivalent of the proposal's 0..D-1. The caller marks confirmed
consumption in order; inputs beyond 64 future frames are rejected. Explicit
discard requires consumed rows and must follow release of replay dependencies.
Local pending input must never enter this accepted/common ledger directly.

Focused Input tests passed 33/33 and the ordinary suite passed 236/236 before
the subsequent gameplay-timing changes. Coverage includes codec bounds,
short-tap edges, conservative prediction, reversed/batched delivery, gaps,
duplicate conflicts, ring reuse and epoch/counter limits. This is headless
protocol evidence, not a 100,000-frame fault-injected gameplay oracle, native
throughput measurement or fixed/hybrid scheduler. Those remain outstanding.

## Observed single-client model pose run

wc3-melee:tools/netcode-probe/PoseProbe.wurst creates four native model effects
and its UI handles in common initialization. The stock Rifleman model is used;
no predicted native units or new handles are created during the sequence.
Build completed with zero errors/warnings. The phase sequence exercises named
Attack/Walk selection, zero blend time, frozen playback, seeks forward/backward,
and clip switching. Screenshots: wc3-melee:build/netcode-probe/pose-0.png through
pose-6.png; cropped comparison wc3-melee:build/netcode-probe/pose-models.png.

Observed: the naturally playing reference freezes at callback 18. On the
already selected Attack clip, setting time to 0.3 reproduces a visibly similar
recoil pose; 0 returns toward the initial pose; 0.5 advances it; returning to
0.3 visibly restores the earlier recoil pose. The 300/500 values do not show
the corresponding desired poses. This supports seconds for these tested seek
values. It is visual evidence, not an exact bone-transform/animation-clock
comparison. Named Walk and Attack select visibly different clips.

Failed candidate: switching Walk back to Attack and immediately setting time
to 0.3 did not reproduce the reference recoil pose. A second build also tries
the same seek on the next native service callback for the third effect; it
still did not reproduce that pose. Evidence:
wc3-melee:build/netcode-probe/pose-deferred.png (S=1297, phase 6).
The cause is not established; selection timing, animation variants and native
time semantics need separation before choosing a presentation strategy.
Do not call this an exact phase-restoration API or enable predicted fighters
on the strength of the successful within-clip seeks.

This does not test authored fighter models, two-client local mutation safety,
native handle agreement, effect-emitter/audio reconciliation, or repeated
rollback during live combat. Embedded gun-smoke particles visibly continue to
vary while the reference body is frozen, so body pose alone is not a complete
effect snapshot. Gate D remains open. The next useful probe must discriminate
clip-selection/seek ordering against known authored clip intervals, rather
than assume that another fixed delay solves it.

## Controlled pose fixture follow-up

The authored marker in wc3-melee:tools/netcode-probe/pose-fixture.ts separates
clip-relative seconds from the model timeline. Attack spans 2000–3000ms and
moves a marker vertically from 0 to 200; Walk spans 4000–5000ms and moves it
horizontally. The ruler and geometry are original probe assets, with no random
animation variants or emitters. Build variant: pose-controlled. Compilation
passed with zero errors/warnings.

| Phase | Operation | Visible marker result |
| --- | --- | --- |
| 0 | Select Attack, freeze | z=0; naturally frozen reference near z=60 |
| 1 | SetTime(.3) | z=60, matching reference |
| 2 | SetTime(2.3) | z=200, nonlooping endpoint |
| 3 | SetTime(0) | z=0 |
| 4 | Select Walk and SetTime(.3) together | x=0; desired seek failed |
| 5 | SetTime(4.3), later | x≈60; looping time wraps |
| 6 | Select Attack and SetTime(2.3) together | z=0; desired seek failed |
| 7 | SetTime(.3), later | z=60 |
| 8 | SetTime(.5) | z=100 |
| 9 | SetTime(.3), backward | z=60 |

This supports seconds relative to the selected clip and successful forward/
backward seeks within that clip. It reproduces the same-callback clip-switch
failure without Rifleman variants. It does not establish the cause or a safe
clip-switch recovery interval; the earlier Rifleman next-callback candidate
also failed. Gate D remains open. A single authored pose timeline or explicitly
preselected model pools are possible next experiments, not accepted backends.

Evidence: wc3-melee:build/netcode-probe/controlled-0.png through controlled-9.png,
controlled-overview.png and controlled-markers.png. These are single-client
visual observations, not bone-transform or two-client safety measurements.
The original installed gameplay map was restored byte-for-byte and the running
client returned to character select; gameplay-restored-after-controlled.png
in the same evidence directory records that return. Warcraft was not closed.

## Multiplayer test setup outstanding

A GPU-accelerated VM can supply the second actual client; a second physical PC
is not required for synchronization and protocol tests. Tom currently has no
second account/client available. Concurrent play needs a separately licensed
account and verified guest execution. Capture in the guest so remote-desktop
streaming delay is not mislabeled as game latency.

Read-only host inspection found AMD-V, accessible /dev/kvm, 24 logical CPUs,
approximately 96 GiB RAM and 1.7 TiB free disk. The Radeon 890M is the sole
exposed GPU; do not detach it from the running desktop. A local Linux guest
with shared virtual graphics and Proton is the first feasibility candidate,
not a verified Warcraft configuration. QEMU/libvirt tools were not on PATH.
Windows guest graphics and any cloud GPU alternative need separate checks.
No VM, paid resource or second account has been provisioned. A same-host VM
shares host CPU/GPU contention and does not establish independent-machine
performance or physical button-to-visible latency. Controlled external timing,
role/network swaps and two-client native gates remain outstanding.

Local host graphics feasibility: QEMU 10.2.4 and virglrenderer 1.3.0 were
obtained through a temporary Nix shell, without changing system configuration.
The host kernel is 6.18.51. QEMU advertises blob memory and Venus support; a
diskless, paused KVM instance initialized with EGL on /dev/dri/renderD128,
virtio-vga-gl, blob=true, venus=true and 512 MiB hostmem. QMP reported prelaunch
and accepted a clean quit, with no graphics initialization error. Evidence:
wc3-melee:build/multiplayer-setup/qemu-gpu-capabilities.log and
wc3-melee:build/multiplayer-setup/qemu-gpu-init.log.
This checks host device initialization only: no guest OS, guest Vulkan workload,
Proton or Warcraft has run. The next decision-changing check is guest Vulkan
rendering, then Warcraft startup. Shared GPU support is documented at
https://www.qemu.org/docs/master/system/devices/virtio/virtio-gpu.html and
https://docs.mesa3d.org/drivers/venus.html; a CPU-only VM is not the recommended
gameplay-measurement configuration.

## Integrated frame-boundary validation

The headless suite passes 216/216 with zero compiler errors/warnings, including
the frame-record reset regression. Log:
wc3-melee:build/wurst-tests/replay-frame-integrated.log.
The full gameplay build passes and verifies packaged assets/Lua. It reports
four existing warnings: three UI array initialization warnings and the unused
DirectionalInput import in Melee. Log: wc3-melee:build/replay-aerials-build.log.

Build replay-aerials reached both selection screens and combat in the existing
client. Its five-second trace records attack requests consumed at their exact
assigned frames. CPU hits confounded the first jump attempt; that trace is not
a jump failure or a successful jump test. The existing knockdown fixture
(disables CPU pursuit/attacks) supplies the isolated follow-up without changing
combat tuning. Native replay and cross-client determinism are still untested.

In isolated build replay-aerial-isolated, both fighters perform a ground jump,
double jump and neutral aerial. Archer's attack is sampled and applied at
frame 271, Rifleman's at frame 265 (style 12). No dropped trace rows; both
five-second traces complete. Retained evidence:
wc3-melee:tools/netcode-probe/evidence/20260930-archer-frame-input.txt and
wc3-melee:tools/netcode-probe/evidence/20260930-rifleman-frame-input.txt.
Screenshots in wc3-melee:build/netcode-probe/archer-aerial-isolated.png and
rifleman-aerial-isolated.png show neutral aerial at action frames 8 and 11,
with weapons retained. They do not establish active-frame alignment, every
aerial clip, physical latency or multiplayer correctness. The normal
replay-aerials map was restored afterward; client remains at character select.

## Single-timeline pose representation

wc3-melee:tools/netcode-probe/TimelinePoseProbe.wurst keeps one nonlooping
Stand clip selected and seeks into two motion segments, at 2..3 and 4..5
seconds. Build variant pose-timeline passes with zero errors/warnings.

The first run reused the earlier PoseFixture.mdx import name: every phase
remained at the initial pose. The fixture generator now includes SHA-256 in
model filenames and emits its Wurst import constant. With that new identity,
the same motion data produces the expected observations below. This A/B result
supports cached model data as the explanation for the failed first run;
it does not establish Warcraft's complete cache invalidation contract.

| Phase | Seek sequence | Observed candidate marker |
| --- | --- | --- |
| 1 | 2.3s | z=60, matching reference |
| 2 | 4.3s | x≈60, z=0 |
| 3 | 2.5s | z=100 |
| 4 | 4.5s | x≈100, z=0 |
| 5 | 2.3s | z=60 restored |
| 6 | 2.3s every service callback | z=60 held |
| 7 | 2.8s, 4.9s, 2.3s in one callback | final z=60 |
| 8 | 2.3s | z=60 retained |

Evidence: wc3-melee:build/netcode-probe/timeline-0.png through timeline-8.png
(failed same-name run), and timeline-hashed-0.png through timeline-hashed-8.png
(successful new-identity run). Phase numbers are printed in each capture.
The simple authored fixture has no particles or animation variants. This
supports the proposal's asset-authored pose-timeline candidate without native
clip switching. It does not verify fighter skeletons/materials, per-frame
pose fidelity, local-only mutations across two clients, handle safety, audio
or event reconciliation. Gate D remains open; this is a candidate mechanism,
not a deployed predictive renderer. Normal gameplay assets remain unchanged.

## Transport-independent fixed-delay scheduler

wc3-melee:wurst/FixedInputSchedule.wurst implements R=0 over the accepted input
ledger. Each increasing epoch chooses D=2, 3 or 5, starts F=1, and seeds neutral
accepted rows 1..D. Preallocated pending-own storage captures F+D once; repeated
service opportunities while waiting preserve that assigned row. Pending data
cannot advance K. Only explicit synchronized-receive methods accept packets;
those methods return ledger errors unchanged and require a future adapter to
supply common delivery and authoritative sender identity.

The gate is F<=K. Reading preflights both accepted rows into distinct caller
scratch; ordered explicit completion advances F and confirmed consumption once.
Receipt alone never executes. The scheduler retains the last 64 completed rows,
reuses bounded rings, rejects stale epochs and reports exhausted capture targets
without signed wrap. Capture, receipt, read and completion allocate no objects.
Physical-edge sampling and native service timing remain absent; the gameplay
bridge is a separate pure module described below.

`wc3-melee:wurst/FixedInputPlayback.wurst` now provides the pure R=0 gameplay
bridge: it reads the two accepted rows for exactly F, adapts them through the
normalized `InputAdapter`, captures one detached `MatchFrameInput`, executes
that recorded row, then marks the frame complete. Playback scratch is
preallocated. `FixedInputPlaybackTests.wurst` adds a direct-versus-scheduled
gameplay oracle for D=2/3/5: 128 frames per profile, comparing every canonical
replay field after every executed frame, including initial neutral rows and
reordered two-frame deliveries. Calling playback with a missing input prefix
returns false and leaves the compared gameplay state unchanged. The combined
fixed-input tests pass 9/9, with zero errors and the existing unused-import
warning in wc3-melee:wurst/RecoveryTests.wurst. Evidence:
wc3-melee:build/fixed-input-playback-final.log. Native input, transport and
pacing remain outside this bridge; this is not the required long fault soak.

Focused scheduler tests passed 8/8 with zero errors/warnings. The bounded oracle
compares every executed normalized row for 600 frames under ordered single-row
and delayed/reversed/duplicated two-row batch delivery, including ring reuse.
Other tests cover neutral delays, immutable captures during waits, pending-only
stalls, atomic reads, packet errors, ordered completion, retention, epoch resets
and signed capture-target bounds. Log:
wc3-melee:build/fixed-input-schedule-focused.log.

The concurrent gameplay aggregate passed 253/255, including all eight scheduler
tests. Two SimulationTests assertions failed: L-cancel aerial recovery expected
9 but got 0, and aerial launch direction expected a positive value but got 0.
Those failures were returned to the gameplay owner; they are not claimed fixed
by scheduler delivery. Log: wc3-melee:build/fixed-input-schedule-integrated.log.
This is headless scheduler evidence, not a native/two-client gate, gameplay
fault oracle, 100,000-frame run or netcode performance measurement.

The integrated gameplay follow-up resolved those two failures: the L-cancel
fixture now lands during the dive's active phase, and the dive retains the
existing vertical contact span. The complete suite passed 259/259 with zero
errors/warnings in wc3-melee:build/dive-dodge-integrated.log. This closes the
aggregate regression; the native and two-client limitations above remain.


## Scheduled numerical gameplay: native D=3 versus D=5

On 1 October, both isolated maps compiled with zero errors/warnings and passed
packaged Lua validation. Each ran on the installed client using keyboard
polling, I2 packets over SC_I, synchronized acceptance and FixedInputPlayback
with R=0. One human supplied input; the absent opponent received neutral rows
only in the synchronized receive callback. No fighter models were rendered.
This is diagnostic integration, not the released gameplay backend.

| Observation | D=3 | D=5 |
| --- | --- | --- |
| Final service counter S | 1362 | 1445 |
| Final completed combat frame C | 904 | 1314 |
| Wait callbacks | 458 | 131 |
| Longest wait run, including startup | 8 | 12 |
| Steady combat frames per 60 service callbacks | 40 | 55 |
| Failed sends / local errors / common errors | 0 / 0 / 0 | 0 / 0 / 0 |
| Dropped trace records | 0 | 0 |

Steady counts come from successive periodic rows after startup. They are not
wall-clock FPS, physical latency or two-client performance. D=5 reduces waiting
but does not eliminate it. Neither profile demonstrates uninterrupted
one-combat-frame-per-service advancement in this sample.

Both traces show sampled edges sent, accepted and consumed at their assigned
frame. D=5 samples/sends right at S=1151 for frame 1050, receives at S=1151,
and consumes at S=1156. D=3 sends right at S=1069 for frame 712, receives at
S=1073 and consumes at S=1074. These establish routing, not physical response
timing. The D=3 scripted jump arrived during attack recovery; that recording
does not establish successful jump/aerial behavior.

Tracked traces, with line endings normalized:

- wc3-melee:tools/netcode-probe/evidence/20261001-scheduled-d3.txt
- wc3-melee:tools/netcode-probe/evidence/20261001-scheduled-d5.txt

Local recordings: wc3-melee:build/scheduled-input-d3-native.mp4 and
wc3-melee:build/scheduled-input-d5-native.mp4. Build outputs:
wc3-melee:build/netcode-probe/batch-scheduled.GYfYew and
wc3-melee:build/netcode-probe/batch-scheduled-5.ozB3fC.

Next investigation: trace every send/receive and pre-step F/K over a short
bounded window, then correlate waits with receipt bursts. The earlier traffic
probe observed six-callback receipt spacing; whether it fully explains these
waits remains a hypothesis. Preserve D and immutable assigned frames while
investigating. Do not silently raise delay or add catch-up. Gate A locality,
two-client operation, physical timing, chat handling, local presentation safety
and hybrid comparison remain unproven.


### Full callback trace explains recurring fixed-delay waits

The follow-up D=5/R=0 build adds complete send, receipt and pre-step gate records
for callbacks 1..180 only. It compiled without errors/warnings, passed packaged
Lua validation, and ran on the same single-client fixture. Evidence:
wc3-melee:tools/netcode-probe/evidence/20261001-scheduled-d5-pacing.txt.
Build log: wc3-melee:build/scheduled-pacing-build.log.

All 29 receipt bursts in the detailed window occur at S=11,17,...,179: each gap
is six service callbacks. Initial waits are S=6..11. Subsequent waits occur at
S=23,35,...,179, exactly once per twelve callbacks. Every wait has F=K+1.
For example, frame 17 is captured/sent at S=18; at S=23 the gate sees F=17,K=16
and waits. The receive events for frames 17..22 run later at S=23. The next
service callback, S=24, executes frame 17. No input was available to the gate
when it made that wait decision. The first 180 callbacks finish 160 combat
frames with 20 waits; the final S=291 dump has no send/protocol errors or trace
drops. Startup differs from the earlier run; steady 55-per-60 pacing agrees.

This locates the recurring wait at the interaction between native receipt
batching and the once-per-service fixed-input gate. It does not identify an
internal engine implementation, nor prove a wall-clock or multiplayer bound.
Moving execution into receive callbacks would change the scheduling policy;
it is not a demonstrated fix and must not bypass immutable captures or advance
extra ticks. The next comparison remains the bounded speculative policy in
shadow simulation, with the identical capture schedule and common advancement
gate. Production visuals stay on the existing baseline until native safety and
two-client gates pass. No delay or physics changes were made for this diagnosis.

## Two-client production-size fixed-delay probe D=3

The existing 65-byte, single-row scheduled probe ran on two real human slots.
A's dump: S3934, C2201, F2202, K2202; 1733 wait callbacks, maximum consecutive
wait 38. B's dump: S3979, C2225, F2226, K2226; 1754 waits, maximum38. Both report
zero failed sends, local/common errors, trace drops and absent-slot neutral rows.
Independent holds/jumps/attacks produced accepted and consumed input changes.
Fighter diagnostic strings match at 72 shared recorded service callbacks; these
strings are partial state diagnostics, not full snapshot hashes.

Combat advances on about 56% of service callbacks overall, settling to roughly
31–33 frames per 60 callbacks in the later retained rows. Successful synchronized
acceptance therefore does not establish a smooth 60-frame service profile at D3.
This is native callback/frame progress, not measured wall-clock FPS or physical
input-to-pixel latency. The effect of transport phase, the diagnostic display,
and other execution overhead is not isolated by this observation.

Evidence: wc3-melee:build/two-clients/a-fixed-d3.txt and b-fixed-d3.txt;
map SHA256 dea82913853c83f3fcf3da668b8d1e4407ade66b12b8d5cf8a0935b9d4006f3b.

## Two-client production-size fixed-delay probe D=5

The 65-byte D5 probe also accepted both players' independently injected holds,
jumps and attacks, with no failed sends, local/common errors, trace drops or
passive rows. A's dump: S5175, C3439, F3440, K3440; 1736 waits, maximum consecutive
wait 33. B's dump: S5220, C3470, F3471, K3470; 1750 waits, maximum 33. Fighter
strings match at 95 shared recorded service callbacks. Overall combat progress
is about 66% of service callbacks, better than D3 but still repeatedly waiting.
These partial fighter diagnostics and callback ratios are not full hashes,
physical latency distributions or measured rendered FPS.

Evidence: wc3-melee:build/two-clients/a-fixed-d5.txt and b-fixed-d5.txt;
map SHA256 8f69e1b6691f0c4173d4d9d39298c036345ae9b11520112794afb09cf32d2cac.

The assembled source suite now passes 412/412 with zero errors and two existing
import warnings. The normal map also builds with the added NetworkInput/InputAdapter
dependencies required by raw-input replay. Its build ID is shadow-foundations,
SHA256 7495b89abb4c1759f20a15cad2f28c771de88f4e95fb1b62e862e4d8001f8a59;
it still uses synchronized baseline gameplay callbacks. Native shadow variants
are separate numerical probes and do not enable visible prediction.

## Native shadow correction and diagnostic overhead (1 October)

The D3/R6 probe completed real corrections with A holding movement and B holding
jump at map entry. Both traces contain `replay earliest=4 depth=6`. Their 13
shared confirmed-frame portable checksums agree. On each client, speculative
checksums for frames 10–13 after correction agree with the separately advanced
confirmed world at the same frames. No packet rejects, false sends, or trace
drops were reported in these retained windows. This proves the bounded numerical
correction path for these inputs; it does not enable predicted visuals or prove
ordinary match pacing.

Evidence: wc3-melee:build/two-clients/a-shadow-fast-portable.txt and
wc3-melee:build/two-clients/b-shadow-fast-portable.txt. Map SHA256
72c34565fc2cb4db29f927ae6ba7ed02d2e5d3722d3016061c92fe0ce98c67d1.

The initial missing F8 dump was not proof of a permanently stopped callback.
First-callback stage files and sustained F8 subsequently demonstrated completion.
The portable full-state checksum is far too intrusive for this native probe:
after replacing per-byte alphabet scans with the pinned StringUtils lookup,
host file timestamps still span 445.931 ms on A and 482.766 ms on B between
`spec-checksum` and `spec-checksum-complete`. These intervals include canonical
serialization, hashing, and checkpoint file overhead. They are not physical
button-to-pixel measurements, and the probe's transport waits cannot establish
an ordinary gameplay transport limit while carrying this cost.

The printable ASCII refactor preserves portable checksum vectors; its focused
suite passed 12/12. The subsequent two-domain Warcraft StringHash experiment
passed 13/13 interpreter tests but failed native complete-state sensitivity:
confirmed frames 1, 2, and 3 all returned `wc3-v1:496060934:350115669`, although
the serialized runtime frame counter changed. Its 13.667 ms A / 9.000 ms B
checkpoint intervals cannot make this inadequate digest usable as equality
evidence. Suffix insensitivity was observed; truncation and its exact cause
remain unestablished. The native digest is being removed in favor of streaming
the portable digest during the existing canonical field traversal.

Counterexample: wc3-melee:build/two-clients/native-hash-incomplete-d3.w3x,
SHA256 12a87034e4e0664e8c9af1da2557695f8f42f7ef9375b230b9ca922c65cffac5.
Failure traces: wc3-melee:build/two-clients/a-shadow-NATIVE-HASH-INCOMPLETE.txt
and wc3-melee:build/two-clients/b-shadow-NATIVE-HASH-INCOMPLETE.txt. Matching
hashes from that experiment do not prove complete-state agreement.

### Streamed portable checksum

The portable encoder now feeds short canonical field fragments into the same
bounded polynomial lanes, with one preallocated writer and one authoritative
field traversal. The independent byte-string oracle and all prior vectors remain.
The focused replay-state suite passes 13/13. Native D3/R6 map SHA256
26bedf3d86d6067c9b6713b10bd8f641962750684ee97b3cdc8ae8c897e661ca matched all
305 shared confirmed frames; both peers corrected frame 4 at depth 6, and each
peer's corrected speculative frames 10–13 matched its confirmed world. Frames
1–3 now have distinct hashes, closing the native digest counterexample at this
owned encoder seam. Retained windows report no rejects, failed sends, or drops.

Evidence: wc3-melee:build/two-clients/{a,b}-shadow-stream.txt and
wc3-melee:build/two-clients/shadow-stream-analysis.json. First checksum checkpoint
intervals are 42 ms A / 38 ms B, including checkpoint output. This is still too
intrusive for per-frame pacing claims. A separate paced diagnostic samples full
checksums every 60 simulation frames and retains separate service 60/180/300
milestone files so host timestamps can bound callback/frame progress. Such
sampling does not prove equality of unsampled frames or physical input latency.

### D3/R6 pacing with sampled checksums

With checksum stride 60, service milestones 60–300 span 4.0071 host-clock
seconds on each client. Confirmed simulation advanced 240 frames in that
interval (59.894 frames/second); waits stayed at 32 after the startup window.
Both players independently held movement/jump. All four sampled confirmed
frames 60/120/180/240 agree; retained milestone traces report zero rejects,
failed sends, and drops. This is a short ordinary-connection numerical run,
with periodic serialization and dump overhead still present. It does not
measure physical response, CPU-tail cost, controlled network impairment, or
unsampled-state equality.

Each of those four confirmed samples executed four service callbacks after
its own assigned input was captured on both clients. At the measured cadence
that is approximately 66.8 ms capture-to-confirmed numerical progress. Physical
input-to-pixel also includes sampling phase, device/OS delivery, rendering, and
outer-engine stalls; these are unmeasured and this observation is no ceiling.

Evidence: wc3-melee:build/two-clients/{a,b}-shadow-paced-d3-s{60,180,300}.txt
and wc3-melee:build/two-clients/shadow-paced-d3-analysis.json. Map SHA256
7bc32c83c53d32aedbf06507f4abc4c2aa2be4948b53b3f515d774fd874ca37f.

### D5/R6 pacing with sampled checksums

The same stride-60 diagnostic with D5/R6 advanced 240 confirmed frames over
4.0100 seconds on A and 4.0021 seconds on B (59.850 / 59.969 frames/second).
Waits stayed at 30 after service 60. All four shared confirmed samples agree;
retained milestone traces report zero rejects, failed sends, and drops. Each
sample reached confirmed simulation six callbacks after assigned local capture,
versus four in D3: roughly 100 ms versus 67 ms at the measured cadence, before
unmeasured physical sampling and display stages. These are four samples per
side, not a distribution, latency ceiling, profile recommendation, or controlled
network impairment result.

Evidence: wc3-melee:build/two-clients/{a,b}-shadow-paced-d5-s{60,180,300}.txt
and wc3-melee:build/two-clients/shadow-paced-d5-analysis.json. Map SHA256
92882ce240132e7657e909ffe2c12031e84b4abad550798e54670b955a27c54d.

### Local capture/window diagnosis (2 October)

The fresh `gameplay-shadow-d3-delivery-diagnostic` map entered a private lobby
with two human slots, then Archer/Illidan combat on the retained authenticated
clients. Installed map bytes matched on both profiles:
SHA256 d680a167125610e21c59eb812abcfca87792e32c39505c05e25d969fbb16ba82.
Every retained window reports phase MATCH, trace drops zero, rejected packets
zero, and matching same-frame confirmed-state samples. Local diagnostic counters
are not equality evidence; matching samples do not cover unsampled frames.

| Window | Confirmed frames / trace seconds | Local polls | Successful sends | Same-target skips | Window blocks |
| --- | --- | --- | --- | --- | --- |
| Idle | 206 / 4.995 (41.24/s) | 299 | 206 | 93 | 93 |
| Both crouch keys held | 183 / 4.993 (36.65/s) | 299 | 178 | 121 | 120 |
| Neutral after crouch | 215 / 4.992 (43.07/s) | 299 | 213 | 86 | 85 |
| Guest unbound X held | 166 / 4.990 (33.27/s) | 299 | 167 | 132 | 133 |
| Neutral after X | 199 / 4.988 (39.90/s) | 299 | 199 | 100 | 100 |

Evidence: wc3-melee:build/two-clients/{a,b}-delivery-{idle,crouch-held,after-held,unbound-held}.txt
and wc3-melee:build/two-clients/delivery-analysis.json. Host file timestamps
for the crouch trace span 4.998997s on A and 4.997997s on B, consistent with
the native trace clock. After-X host spans are 5.033998s A / 5.038998s B,
retained in wc3-melee:build/two-clients/delivery-after-unbound-timing.json.
These are simulation-progress measurements, not rendered
frame rates or physical button-to-display latency.

The polls continue while speculative F repeatedly exhausts its R=6 credit.
Capture targets repeat and no additional packet is assigned to those polls;
successful sends fall with speculative progress. This rules out continuous
60-row sending followed solely by a growing accepted-row backlog for these
windows. It does not establish the cause of receipt delay or prove a transport
bandwidth limit. The unbound-key window is slower than the preceding neutral
window and records repeated synchronized callbacks; transport contention and
trace/callback overhead remain competing explanations.

Next discriminating artifact: trace-only local send-to-own-receipt ages in
service callbacks and native timer seconds, with bounded histograms. Keep the
packet semantics and R unchanged until timing identifies the next correction.

### Playable scheduled D3 acceptance and variable pacing

The playable shadow-D3 map (SHA256
7be0c6bf802a7db8f3fcc8b3b7526761231f79d2901223192f9a14308e11f3e6)
completed an Archer/Rifleman match, both-player rematch, an Illidan mirror,
and another both-player rematch on two real clients. Independent movement,
jump, attacks, and specials reached confirmed gameplay. Retained paired
traces were byte-identical, their complete-state samples agreed, and trace
drops were zero. This is two scheduled-input matches; the earlier ten-match
acceptance used the baseline callback path.

The Archer/Rifleman control window advanced 200 confirmed frames in 4.996
trace-clock seconds; its later edge/idle window advanced 190 in 4.998 seconds.
The first Illidan mirror window advanced 301 in 4.997 seconds. Consequently,
native gameplay pacing is variable even though peers agree. These windows
do not establish physical input-to-display latency or unsampled-frame equality.

Evidence: wc3-melee:build/two-clients/{a,b}-gameplay-d3-{controls,edge,results,
rematch,mirror,mirror-rematch}.txt.

A separate diagnostic map (SHA256
55ddbaaadb845e1a165b00b2e786ecd5cd65213e2cb8d22fc3dd6164f9f35ded)
retained the following Archer/Rifleman windows:

| Window | Confirmed frames | Trace-clock seconds | Frames/second |
| --- | ---: | ---: | ---: |
| Initial neutral | 299 | 4.985 | 59.98 |
| Directional holds for three seconds | 191 | 4.990 | 38.28 |
| Later neutral | 209 | 4.997 | 41.83 |
| Unbound X held for three seconds | 193 | 4.986 | 38.71 |

All four paired traces were byte-identical with agreeing complete-state
samples, zero rejected packets, zero speculative-step failures, and zero trace
drops. Service callbacks remained approximately 60 Hz. Accepted rows fell
from approximately 60 per participant per second initially to 26–47 per
60 callbacks in the later windows. This locates missing progress at input
availability or earlier capture/send gating; it does not yet distinguish
late native delivery from fewer submitted rows.

Unbound X creates synchronized keyboard callbacks without a bound combat
action. Its window was similar to the preceding neutral window, so this
experiment does not establish keyboard callback/autorepeat traffic as the
cause. The initial-neutral versus later-held comparison also changes match
age; it is not a controlled proof of a key-induced slowdown.

The retained diagnostic's `waits` field is invalid as a stall count: it was
incremented after confirmed rows were drained. The source condition was
corrected to count callbacks with zero confirmed steps, but that correction
was not present in this map. Frame deltas and accepted-packet counts remain
usable. Do not reinterpret the old `waits` values as measured stalls.

Evidence: wc3-melee:build/two-clients/{a,b}-gameplay-d3-paced-{idle,held,
after-held,unbound}.txt. The unbound window's completed files were fresh at
2026-10-01 23:25:03.977711 UTC on both profiles; start files were written at
23:24:58.991737 UTC (A) and 23:24:58.988737 UTC (B). Those timestamps bound
that trace's wall-clock duration, not physical key-to-screen latency.

The playable D3 path polls local `BlzIsKeyPressed` state before explicitly
sending assigned rows. It does not sample the held state maintained by the
synchronized keyboard callbacks. Those callbacks still handle menus, pause,
and developer controls, and remain registered for all keys. Numerical shadow
prediction is private; visible units, animations, and effects still follow
confirmed state. Visible correction, button-to-screen latency distributions,
and controlled network delay/jitter comparisons remain unfinished.

A subsequent trace-only delivery diagnostic now records local polls, captured
rows, successful sends, repeated-target skips, rollback-window blocks, and
per-player key callbacks. It includes the corrected zero-confirmed-step count.
The pinned build passed with zero errors and seven existing warnings; map
SHA256 d680a167125610e21c59eb812abcfca87792e32c39505c05e25d969fbb16ba82
is installed identically in both profiles. Native acceptance of this diagnostic
and its send-versus-receive comparison are pending. Local counter rows need
not be byte-identical; compare confirmed frame/state samples separately.
Artifact: wc3-melee:build/two-clients/Smashcraft-gameplay-shadow-d3-delivery-diagnostic.w3x.

### Playable send-to-own-receipt timing (2 October)

Both retained signed-in clients entered `gameplay-shadow-d3-echo-diagnostic`
with fresh paired ready markers, then Archer (B/player 0) versus Illidan
(A/player 1) combat. Both installed maps have SHA256
bd73c5183a7ada3c35e63e9606d35f15ef6ddb3d44df8a24e91e45c3b72111b0.

| Window | Confirmed frames/native second | A echo mean/max ms | B echo mean/max ms |
| --- | ---: | ---: | ---: |
| Idle | 41.69 | 142.3 / 267.6 | 154.0 / 335.3 |
| Crouch keys held | 34.42 | 201.8 / 373.8 | 124.5 / 283.1 |
| Neutral after crouch | 40.87 | 128.5 / 274.0 | 145.1 / 298.7 |
| Guest unbound X held | 34.05 | 201.2 / 320.4 | 109.6 / 288.6 |
| Neutral after X | 39.93 | 146.6 / 291.8 | 145.8 / 321.5 |

Each window spans approximately five native timer seconds and 299 local
polls. Host trace-file spans are 4.97–5.01 seconds. All six same-frame
confirmed-state samples agree per window; rejected packets and trace drops
are zero. Means are sample-weighted from rounded per-window statistics.
Pre-trace sends and still-pending end-of-trace sends are censored.

Echo age begins after a successful engine send returns and ends at entry to
that client's own synchronized receive callback. It includes engine queuing,
transport/scheduling and callback dispatch; it is not isolated RTT, physical
button-to-screen latency or rendered FPS. Native timer brackets reported zero
for receipt-file/checksum work; their intra-callback resolution is unproven,
so they do not establish zero execution cost.

The guest's mean echo age rises in both held-key windows and recovers after
release. This association does not isolate callback contention, diagnostic
cost or changing network conditions. The trace does establish substantial,
variable send-to-receipt delay while the six-frame speculative gate blocks
capture progress. The next comparison uses the existing two-row protocol to
reduce packet rate, preserving D=3, R=6 and keyboard registration. Batching's
capture-to-send wait must be reported separately from delivery age.

Evidence: wc3-melee:build/two-clients/{a,b}-echo-{idle,crouch-held,after-held,unbound-held,after-unbound}.txt,
wc3-melee:build/two-clients/echo-analysis.json and matching per-window timing
files. Numerical prediction remains private; visible prediction, actual
screen-response distributions and final-profile acceptance remain open.

### Two-row batching, matched singleton control, and memory (2 October)

The opt-in `shadow-d3-batch2` profile combines two consecutive immutable
captures in one existing protocol packet. A partial pair flushes when the
capture target repeats, combat pauses, or combat ends; epoch reset clears an
obsolete pair. D=3, R=6, keyboard registration, and confirmed presentation are
unchanged. The focused batching check passed 3/3; the pinned map build passed
with zero errors and seven existing warnings. The original default map and
generated BuildInfo were restored byte-identically.

The initial comparison also changed packet encoding from twice to once per
send. A current-source singleton control therefore uses the same encoding
helper as batching. Both maps were installed with independently matching
profile hashes and entered native Archer (B/player 0) versus Illidan
(A/player 1) combat with fresh paired build markers. The clients remained
signed in and were retained through ordinary leave/rejoin.

| Build | SHA256 |
| --- | --- |
| `gameplay-shadow-d3-batch2-echo` | `9dbdeb397bf544a86cee754b549279f67751c85ba50771608b1a57647a07dae4` |
| `gameplay-shadow-d3-single-control` | `a95f91814c869cbed653d445b8cf1169d80bfd7626863e5f3c0cd0be04ada558` |

| Window | Confirmed frames/native second | A echo mean/max ms | B echo mean/max ms |
| --- | ---: | ---: | ---: |
| Batch2 initial neutral | 51.29 | 113.9 / 191.3 | 114.5 / 191.3 |
| Batch2 later neutral | 50.49 | 125.3 / 198.9 | 122.0 / 197.9 |
| Batch2 rematch neutral | 53.44 | 96.1 / 191.5 | 96.1 / 191.5 |
| Batch2 guest crouch held | 49.48 | 124.0 / 287.2 | 107.6 / 235.5 |
| Batch2 neutral after crouch | 53.45 | 107.6 / 190.6 | 108.0 / 190.6 |
| Batch2 guest unbound X held | 52.64 | 114.7 / 215.9 | 105.6 / 170.0 |
| Batch2 neutral after memory sample | 51.05 | 104.7 / 170.0 | 112.7 / 281.4 |
| Singleton control initial neutral | 60.07 | 68.8 / 122.9 | 69.4 / 122.9 |
| Singleton control later neutral | 40.62 | 147.8 / 291.3 | 141.3 / 274.5 |
| Singleton control after memory sample | 43.63 | 137.3 / 273.6 | 142.5 / 272.8 |
| Singleton control guest crouch held | 36.48 | 183.7 / 314.0 | 124.3 / 269.0 |
| Singleton control neutral after crouch | 41.31 | 145.6 / 295.5 | 144.7 / 286.6 |
| Singleton control guest unbound X held | 32.62 | 200.9 / 323.1 | 115.2 / 284.9 |
| Singleton control neutral after X | 37.85 | 177.2 / 362.9 | 174.0 / 362.9 |

The singleton control's initial and later trace starts are about 57 seconds
apart. Encoding once does not prevent its age-related slowdown. Later batch2
windows show higher progress than singleton windows, but sequential matches
do not control changing engine/network conditions and do not isolate packet
rate as the sole cause. Batching adds about 16.6–16.7 ms to the first row in a
pair and 8.3 ms averaged across rows. Capture-to-send waiting is separate from
the send-return-to-own-receipt echo ages in the table; these are not physical
input-to-screen results or rendered FPS. Neither profile establishes sustained
60 simulation frames/sec.

Each included five-second window has 299 local polls, six matching sampled
confirmed states, zero rejected packets, and zero trace drops. Host trace-file
spans remain separately recorded. The attempted
`batch2-echo-crouch-held` window started in results, advanced zero frames, and
dropped 37 entries; it is excluded. The collector now rejects non-combat
starts or nonadvancing windows and preserves their raw evidence. It does not
prove phase constancy between samples or full unsampled state agreement.

Two separate 45-second whole-process RSS samples were bracketed by advancing
combat traces, with no build concurrent:

| Build/client | First MiB | Minimum MiB | Maximum MiB | Last MiB |
| --- | ---: | ---: | ---: | ---: |
| Batch2 A | 1377.46 | 1377.46 | 1424.04 | 1377.47 |
| Batch2 B | 2248.17 | 2247.91 | 2282.55 | 2247.94 |
| Singleton A | 1383.07 | 1383.06 | 1383.40 | 1383.06 |
| Singleton B | 2262.50 | 2262.49 | 2262.79 | 2262.49 |

Temporary RSS rises return to baseline; these samples show no accumulating
whole-process memory despite slowed simulation. They do not measure Lua heap,
GC pauses, retained native handles, or long-term leaks. A prior unbracketed RSS
sample may have run after results and is not combat evidence. Lua GC remains
an unmeasured hypothesis; these observations do not justify changing the
configured Lua target to Jass.

The hardware-polled profile still registers synchronized down/up events for
all keys and ignores most combat callbacks only after dispatch. Guest held
keys produced 115–119 down callbacks per window, including unbound X.
Removing redundant combat event registrations while preserving menu/pause
controls is the next measured comparison; event contention is not yet an
established cause.

Evidence: wc3-melee:build/two-clients/batch-control-analysis.json,
wc3-melee:build/two-clients/{a,b}-batch2-*.txt,
wc3-melee:build/two-clients/{a,b}-single-control-*.txt,
their matching timing JSON files, and
wc3-melee:build/two-clients/memory-{batch2-rematch-combat,single-control-combat}.json.
Live visible prediction, physical response distributions, network impairment,
and final-configuration ten-match acceptance remain open.

### Combat keyboard-event lifecycle and pause recovery (2 October)

The hardware-polled profile now destroys broad keyboard-event registrations
during combat and restores them for results and menus. Persistent Y/F5 events
and the separate developer chords preserve controls through those transitions.
The parent retained both players' F5 registrations during integration. The
pinned build passed; default map and generated BuildInfo were restored exactly.
Both profiles ran `gameplay-shadow-d3-key-events-controls`, SHA256
6b805343448b2ef50f09a4b95e066d29a1620290ab68a7c1cdc0a07de79bf8ed.
This comparison retains singleton packets, D=3, R=6, and confirmed presentation.

| Window | Simulation frames/native second | A echo mean/max ms | B echo mean/max ms |
| --- | ---: | ---: | ---: |
| Initial neutral | 54.80 | 94.08 / 222.72 | 93.91 / 222.72 |
| Later neutral | 40.02 | 145.41 / 343.14 | 151.62 / 274.41 |
| Guest crouch held | 36.90 | 188.36 / 325.01 | 137.77 / 314.64 |
| Neutral after crouch | 41.71 | 143.20 / 296.08 | 148.80 / 296.08 |
| Guest unbound X held | 36.04 | 182.25 / 297.79 | 128.24 / 293.82 |
| Resumed, with both players jumping/attacking | 60.27 | 72.89 / 124.02 | 71.88 / 124.02 |
| Fresh rematch | 59.82 | 70.13 / 122.31 | 72.97 / 122.31 |

Combat windows have zero dispatched key-down callbacks, 299 local polls,
six matching confirmed-state samples, and zero rejects/drops. Removing these
callbacks does not cure the slowdown or establish that Warcraft stops sending
internal keyboard traffic. Both participants' jumps and aerial attacks applied
after resume without synchronized combat-key callbacks. This supports the
hardware-polling path; early locality under actual network impairment is still
unverified.

Host Y paused combat. A trace during the pause showed 299 polls, no sends,
no simulation advancement, and matching unchanged sampled state. The collector
correctly rejected that intentionally nonadvancing window as a pacing sample.
Guest Y resumed. The subsequent five-second window advanced 301 frames, with
lower receipt ages and no speculative-window blocks. This recovery happened
in the same match and client processes. It supports a load-sensitive or
drainable delivery mechanism, but does not identify a native queue, a rate
limit, GC behavior, or a general latency bound.

Guest movement then exhausted stocks and reached results (native HUD phase 3).
Both Y confirmations, character-choice input on both clients, and host stage
confirmation entered a fresh rematch. Its trace reset to frame 12 and advanced
299 frames. The complete final-profile ten-match acceptance is still pending.

Evidence: wc3-melee:build/two-clients/key-events-analysis.json,
wc3-melee:build/two-clients/{a,b}-key-events-*.txt, matching timing files and
wc3-melee:build/two-clients/gameplay-shadow-d3-key-events-controls-build.log.

Current protocol inspection also establishes that an I2 singleton is 65 ASCII
bytes and a two-row packet is 106 bytes, including a 24-byte decimal header.
At an unstalled 60 rows/sec per player that is 7,800 payload bytes/sec across
two players for singletons, or 6,360 for pairs, before engine framing. The
current BlzSendSyncData documentation describes an approximate 255-byte string
limit but supplies no sustained-throughput or dispatch-latency guarantee.
Compact independent records can therefore distinguish payload cost from
packet-rate cost without changing frame assignment or intentional delay.

### Compact independent input records (2 October)

The live protocol is now I3: a 15-byte header and complete independent rows
with canonical omission of zero-valued groups. Singleton packets are 16 bytes
for neutral input, 19 for held-mask-only input, and at most 36; two-row packets
are 17–57 bytes. All valid NetworkInput values, including press-time vectors,
SDI and accumulated throw contributions, round-trip without dependence on
earlier packets. All live protocol consumers were migrated together.

The focused input filter passed 81/81 tests. A stale old-format malformed-second-row
ledger fixture was then migrated; the focused ledger filter passed 8/8. The
pinned map build passed with seven existing warnings; original default map and
BuildInfo were restored byte-identically. Both retained clients independently
hashed to 338b26aa6238650c0a7c8affefa42c67aca7ee92b95e343781347b965cce69fb and
entered gameplay-shadow-d3-compact. Singleton cadence, D=3/R=6, keyboard-event
lifecycle, and confirmed presentation stayed unchanged.

| Window | Simulation frames/native second | A echo mean/max ms | B echo mean/max ms |
| --- | ---: | ---: | ---: |
| I2 control fresh rematch | 60.12 | 87.88 / 148.93 | 88.14 / 148.93 |
| I2 control aged | 40.81 | 153.70 / 341.00 | 153.77 / 341.00 |
| I3 initial neutral | 60.17 | 76.33 / 121.95 | 77.69 / 121.95 |
| I3 aged neutral | 56.38 | 115.80 / 197.94 | 116.07 / 197.94 |
| I3 guest crouch held | 55.04 | 117.43 / 185.61 | 120.46 / 174.32 |
| I3 guest unbound X held | 54.49 | 118.90 / 239.62 | 124.08 / 239.62 |
| I3 later, both jumping/attacking | 45.63 | 151.86 / 287.84 | 150.96 / 287.84 |

Control aged trace started 57.260s after its initial trace; I3 aged started
57.483s after its initial trace. Subsequent I3 windows began at 110.735s,
149.559s and 179.168s. All seven windows have 299 polls, six matching sampled
confirmed states, zero rejects/drops, and zero combat-key callbacks. Both
players' jumps and aerial attacks applied in the final trace. Keys were
explicitly released; builds did not overlap measurement windows.

Compact inputs improved this sequential matched-age comparison but did not
eliminate aging or establish sustained 60 simulation frames/sec. The codec
also changes encoding/decoding work and allocation, so improvement cannot be
attributed exclusively to native byte volume. Later input windows differ in
age as well as activity; they do not isolate an effect of held keys. Echo
remains successful send-return to own synchronized callback, with pending
samples censored, not button-to-screen latency or isolated RTT.

Evidence: wc3-melee:build/two-clients/compact-analysis.json, paired
compact-control-* and compact-* traces/timing, compact-input-tests-2.log,
compact-input-ledger-tests.log, and compact-input-build-run.log. Next comparison
uses the existing two-row batching mode with I3; its transmission waiting must
remain separate from echo delivery time.

The I3 two-row comparison is now measured. Pinned build
gameplay-shadow-d3-compact-batch2 passed, restored the default map/BuildInfo,
and both installed maps hashed to
1fae63df4e6306c13aae7fa8a13c36c5804d08abe0c9ebbd39cfbf4a53d88fa8.
The same clients entered a fresh Archer/Illidan match through leave/rejoin.

| I3 two-row window | Age from initial trace, seconds | Simulation frames/native second | A echo mean/max ms | B echo mean/max ms |
| --- | ---: | ---: | ---: | ---: |
| Initial neutral | 0 | 60.08 | 78.43 / 123.78 | 79.28 / 148.74 |
| Aged neutral | 57.480 | 53.72 | 105.53 / 168.27 | 109.92 / 167.66 |
| Guest crouch held | 110.983 | 46.91 | 131.84 / 226.20 | 126.30 / 234.25 |
| Guest unbound X held | 149.867 | 47.66 | 137.22 / 310.73 | 136.57 / 269.47 |
| Both jumping/attacking | 179.360 | 50.42 | 119.87 / 234.92 | 123.76 / 284.91 |

These windows were scheduled at the corresponding singleton ages (differences
below 0.31s), with the same guest key holds and jump/attack pulses. They are
sequential runs, not simultaneous controls for engine/network conditions.
Each has 299 polls, six matching confirmed samples, zero rejects/drops, and
zero combat-key callbacks. Both players' jumps and aerial attacks applied on
both clients. Builds did not overlap measurement; all injected keys were released.

Capture-to-send waiting averages 8.30–8.33ms per row, maximum 16.72ms; it is
additional to the echo measurements above. The initial window sent 149 packets
for 298 rows. The aged window sent 134 for 268 rows and recorded 31 prediction
window blocks; the matching singleton-age window recorded 21. Smaller messages
and this halved message cadence therefore do not establish sustained 60Hz or
resolve delivery aging. No final default is selected from these samples.

All twelve windows and separate capture-to-send summaries are retained in
wc3-melee:build/two-clients/compact-analysis.json. Raw pairs use
compact-batch2-* labels. The next useful causal comparison isolates fixed-rate
native traffic from the fighting simulation and its advancement gate. The
existing wc3-melee:tools/netcode-probe/InputProbe.wurst already sends on an
independent service counter, but needs bounded aged-window timing and selectable
payload/rate controls before it can decide this question. Aging there would
direct work toward native delivery capacity/policy; aging confined to gameplay
would direct work toward the integrated simulation/presentation path.

### Isolated fixed-rate native delivery (2 October)

The standalone delivery probe now runs without fighting simulation, snapshots,
rollback, fighter presentation, or an accepted-input advancement gate. Both
retained clients completed run `20261002T033313678332238`, installed SHA256
`4d3d6c6c45e2c5251f35b4abeee9a579fffc3b27a72a790936e74d0e198d0f78`.
Each phase attempts fixed traffic for 10800 native service callbacks, then
drains for 600; export occurs at drain callback 540. Phases are sequential in one match.
No build overlapped the measurements. Clients were retained through ordinary
leave/rejoin and all observations stayed in text/on disk.

The first native attempt exposed measurement defects: Preload cut longer
records at 259 ASCII bytes, and a 1,000,000-second timer gave 62.5 ms quantization.
That incomplete attempt is not the comparison below. The probe now emits six
short records per cohort and uses a 3600-second timer for its 575-second run.
The pinned compiler and existing Lua/packaging checks passed with zero errors
and warnings. Native output now has fractional-millisecond values; the longest
observed record is 235 bytes. All 36 cohorts/phase contain the six required
records with consistent send, receipt and histogram accounting.

The following values are own successful-send-return to synchronized-receive
callback entry, in native milliseconds, A/B. They are not input-to-screen or
isolated RTT. Each column is a 30-second send cohort window:

| Payload and rate per player | First 30s mean | Middle 30s mean | Last 30s mean | Unmatched own sends at phase export |
| --- | ---: | ---: | ---: | ---: |
|16 bytes,60/sec|105.30 /103.24|119.15 /118.12|117.30 /114.78|0 /0|
|65 bytes,60/sec|1566.67 /1558.68|12802.20 /12792.99|22868.81 /22855.36|900 /900|
|16 bytes,30/sec|5582.53 /5570.97|127.46 /126.13|118.33 /115.48|0 /0|

The 16-byte/60 phase sent 10800 messages per player, received all of them,
and maintained 60.01 sends/native second. Whole-phase echo means were 116.96 ms
and 114.60 ms; maxima 346.43/321.53 ms, or 20/19 service callbacks. Its late
distribution was similar to its middle distribution; this phase does not show
continuously growing backlog.

The 65-byte/60 phase also attempted and successfully returned 10800 sends per
player, but only 9900 own receipts had arrived by the export after nine nominal
drain seconds. Means in its last 30-second cohort include only 900 of 1800 sends;
the remaining 900 are explicitly censored, not missing from the accounting.
The largest observed ages by that export were 24074.47/24049.56 ms. All 900
remaining own messages subsequently arrived during phase 3. This establishes
substantial native delivery backlog under this offered traffic without the
fighting implementation. A successful BlzSendSyncData return did not establish
timely delivery or a sustainable offered rate.

Phase 3 inherited that backlog, so its first 30 seconds and whole-phase averages
are not clean low-rate controls. After recovery, its middle and last windows
settled near the 16-byte/60 phase's delivery ages. Last-window maxima were
236.06/269.31 ms. Halving small-message cadence did not establish a lower
steady delivery floor in this sequential comparison.

Both final files account for 27000 own successful sends and 27000 unique receipts
from each participant on each client. Final pending counts are zero. All phases
report zero failed send returns, duplicates, reorder/gap events, malformed
messages, missing stamps, overwritten stamps and unexpected senders. Phase 2's
final after-export count is 1800 received events/client (900 from each sender).
Native interval lengths between phase starts/final completion were approximately
189.95–189.97 s; corresponding host file-time spans were 190.16–191.33 s. Host
marker intervals support near-real-time service; they are not per-event wall
timestamps and include boundary/export overhead.

The results separate an overload signature at the older 65-byte singleton load
from substantial baseline delay/jitter at small payloads. They do not determine
Warcraft's exact byte allowance, framing overhead, rate policy, or GC behavior,
nor prove that all compact-gameplay slowdown belongs to one native mechanism.
The phase order and inherited phase 2 backlog remain comparison limitations.

The next gameplay comparison should hold compact singleton traffic and D=3
steady while explicitly testing the speculative horizon/pacing interaction.
The baseline remains R=6 and confirmed presentation. A larger experimental
horizon must be measured for sustained pace and replay/correction cost before
being selected; it cannot fix sustained transport overload. No gameplay
configuration or physics was changed for this probe.

Evidence: wc3-melee:build/two-clients/delivery-20261002T033313678332238/
contains raw paired files, analysis.json, summary.txt, host-start.json and
final-check.json. The incomplete first run and measurement counterexample are
under wc3-melee:build/two-clients/delivery-20261002T031125230934468/;
its executable/source remain in
wc3-melee:build/netcode-probe/batch-delivery.JQtYAL/.
Probe source/grammar: wc3-melee:tools/netcode-probe/DeliveryProbe.wurst and
wc3-melee:tools/netcode-probe/README.md. Native visible prediction, physical
response distributions and final-profile match acceptance remain open.

## Compact input: explicit R6/R12 gameplay comparison — 2 October

The scheduler now fixes R at epoch creation, and the correction store accepts
up to12 rows. Existing profiles retain R6; `shadow-d3-r12` is opt-in. Both
comparison maps use the same source, expanded preallocated correction storage,
compact singleton encoding, D3, input assignment, physics, confirmed rendering,
and once-per60-callback diagnostics. Focused ShadowInput8/8, ReplayHistory8/8
and InputBatch3/3 checks passed, including full12-row correction and rebuilt-
snapshot equality. Both pinned builds passed; the default map and BuildInfo
were restored byte-identically. No native measurements overlapped builds/tests.

An older compact R6 control first measured53.25 frames/native second, then46.07
at93.657 seconds after its first window. Its299 polls contained respectively
269/228 speculative steps and30/71 window blocks; there were no speculative
step failures. Every missing speculative opportunity in those windows was
accounted for by the F/K window gate. Input polling continued near60Hz.

The matched builds subsequently produced:

| Five-second window | R6 frames/native second | R12 frames/native second | R6/R12 window blocks | R6/R12 maximum own echo, ms |
| --- | ---: | ---: | ---: | ---: |
| Initial | 57.58 | 59.79 | 12 / 0 | 224.91 /149.84 |
| Age60s, neutral | 59.06 | 59.57 | 6 / 0 | 170.72 /187.01 |
| Age120s, neutral | 59.05 | 60.05 | 7 / 0 | 168.94 /160.34 |
| Age180s, both jump/attack | 58.51 | 58.61 | 9 / 4 | 174.32 /295.47 |
| Age294.6s, both holding crouch | 58.78 | 60.18 | 7 / 0 | 170.47 /187.99 |

Timed neutral/action windows began within0.25 seconds of their requested age.
For the held-input condition, both profiles began E holds at age264.285s,
then captured after30 seconds of sustained nonneutral input and released both
keys after export. Local injection times are OS timings, not physical keyboard
measurements. Both players' jumps and aerial attacks applied in the action
windows. R6 performed8 corrections/client replaying45 frames, maximum depth6;
R12 performed8 replaying53 frames, maximum depth9. These are replay counts,
not measured CPU durations.

All10 paired windows started in combat, advanced, contained299 local polls
and six identical same-frame confirmed-state samples, and reported zero packet
rejects, speculative-step failures and trace drops. Host export spans were
4.971–5.000 seconds. Values slightly above/below60 reflect finite-window
confirmed-cursor progress and delivery phase; these are not rendered FPS.

The larger horizon removed gate blocks in four sampled windows and remained
near60 while held-input echo means reached114.71/115.65ms. The action window
with a295.47ms echo maximum still blocked four times. R12 therefore improves
observed tolerance but does not close sustained-pacing or arbitrary-tail claims.
The matched R6 run also aged more smoothly than the earlier control, so age
alone does not predict the slowdown. Sequential matches had naturally different
delivery distributions; this is not a controlled estimate of a universal speedup.

The finite correction gate is a demonstrated immediate slowdown mechanism.
Its dependence on delivered K remains; widening R does not reduce native
delivery delay or enable visible prediction. The remaining timing-policy work
must preserve immutable assigned inputs and authored combat durations. Visible
fighter-pose restoration is the next independent capability artifact; actual
button-to-screen distributions and final-profile acceptance remain open.

Maps: wc3-melee:build/two-clients/Smashcraft-gameplay-shadow-d3-compact-r6.w3x
(SHA25610852b4709b1487ff5679a56cb081722678f02dce804fba5f46e9472fa2f58ef),
and wc3-melee:build/two-clients/Smashcraft-gameplay-shadow-d3-compact-r12.w3x
(SHA256aaadf020aeeb9cc3aad8db157a36c5977b2af2eccad6a914ed73797ee7304ad9).
Evidence: wc3-melee:build/two-clients/window-comparison-analysis.json,
paired `window-r6-matched-*`/`window-r12-matched-*` traces and timing/hold
records under wc3-melee:build/two-clients/, plus
wc3-melee:build/two-clients/window-r6-control-analysis.json and
wc3-melee:build/two-clients/pacing-{tests,build}-capacity.log.

## Actual-fighter pose comparison — 2 October

The retained two-client session completed the full27-phase fighter timeline
probe for Archer, Rifleman and Illidan. Each selected authored Spot Dodge,
Jump and Up Tilt clip was sampled at+250ms, including backward/forward restores,
repeated seeking, three seeks in one callback, and intentionally different local
pose/position/height/facing. This is an isolated presentation capability test;
production gameplay still presents confirmed state.

The initial side-by-side run20261002044542366 completed27 paired receipts with
matching service/checksum, sentinel position/health and expected local effect
coordinates. All54 final capture headers had the intended phase and age>=60.
Different camera positions and changing daylight limit direct pixel comparison.
Restored candidate silhouette overlap ranged Archer0.965–0.996,
Rifleman0.859–0.993, Illidan0.970–0.999 in the cropped above-ground region.
Those ranges alone do not establish exact source-pose fidelity.

The next probe added fixed-noon lighting and host C selection of the source
reference alone or the timeline alone at identical local coordinates. Both
profiles independently verified map SHA256
`e59862ef01abe4d5d7a00e9cd3a7757035a3957955e05b7a9a91b3ea27a13cd3`.
Run20261002050213391 completed54 paired view receipts and54 source-versus-
timeline image comparisons (27phases times two clients). All108 final header
phase/view/age checks and all paired common sentinel/checksum checks passed.
Per-client differing requested positions were observed in split phases8,17,26.

The RGB comparison covers x400..2250,y250..1100, including the models and terrain
below the horizon but excluding UI and cursor. Archer's18 comparisons differed
by at most6 intensity levels/channel, with no pixels exceeding8. Rifleman's
worst comparison had146 pixels exceeding8 and36 exceeding16, max30. Illidan's
worst had1778 pixels exceeding8 and1262 exceeding16, max168. The larger Illidan
residuals occur in some Spot Dodge/Jump captures and remain unresolved at this
checkpoint. Do not treat low whole-image average error as proof those residuals
are harmless or claim full native visual equivalence yet.

A capture limitation was identified directly: the first VNC image for phase18,
view1,A still displayed phase17,view2 in its OCR. The subsequent image had the
correct header. First/final differences therefore are not valid estimates of
native animation noise unless freshness of both is independently verified.
The comparisons above use subsequent images with validated headers. A private
compositor capture also retained B's text-rendering artifacts; that observation
does not identify their cause or invalidate common state receipts.

The pinned compiler implements GetHandleId through __wurst_objectToIndex,
assigning an index on first query. Equal printed handle fields are program-local
object-identity observations, not proof of matching native allocation order.
This limitation is now stated in the probe source and instructions. No native
allocation or general GetLocalPlayer safety guarantee is inferred from them.

The next discriminating variant disables embedded event objects and particle/
ribbon emitters in both references and candidates while preserving geometry,
skeletal/material tracks and the original gameplay assets. Native timeline
seeks and embedded event/effect lifecycle must be evaluated separately before
this can drive rollback presentation. The body-only build passed pinned compiler,
MDX round-trip, imported-byte and Lua/package checks with zero errors/warnings.
Its native result is not yet established here.

Evidence: wc3-melee:build/two-clients/fighter-timeline-20261002044542366/ and
wc3-melee:build/two-clients/fighter-coincident-20261002050213391/ contain paired
receipts, disk images, OCR, collection times and analysis.json. V2 workspace:
wc3-melee:build/netcode-probe/batch-fighter-timeline.FcOiud/. Build log:
wc3-melee:build/two-clients/fighter-pose-coincident-build.log. Both signed-in
clients and private desktops remain open; all native evidence stays on disk.

### Body-only restoration discriminator — 2 October

Run `20261002051948573` used independently installed map SHA256
`63d0e8820c8ad01dc26d962115f48aaa922724ff5d94b878bae2128097708405`.
Both source references and timeline candidates omitted EventObjects,
ParticleEmitters, ParticleEmitters2 and RibbonEmitters. Geometry and skeletal/
material tracks remained intact; original gameplay assets were untouched.
The export rejects any retained node whose parent is a removed effect node.

All 28 paired view receipts passed their common checksum/sentinel and requested
local position checks. All 56 final screenshot headers identified the requested
phase and view at age >=60; none were unreadable. Source-versus-timeline RGB
comparisons were exactly identical throughout the same x400..2250,y250..1100
region in all 28 comparisons: Archer 6, Rifleman 6, Illidan 16; maximum channel
difference 0. Selected phases were 0,1,2,9,10,11,18,19,20,21,23,24,25,26.
They cover the three selected clips per fighter and additional Illidan restores,
repeated seeking, multiple seeks per callback and differing local states.

This establishes body-pose fidelity for those sampled +250ms poses on both
tested clients. The full-asset residual disappeared when native events and
emitters were removed together; the experiment does not distinguish which
removed feature caused it. It does not establish complete animation coverage,
embedded effect/audio restoration, physical response latency, or production
predictive gameplay. The next implementation boundary is complete body-timeline
export and replayable presentation phase, with separate effect/event policy.

Evidence: wc3-melee:build/two-clients/fighter-coincident-20261002051948573/
contains the paired receipts, disk images, verified OCR, collection.json and
analysis.json. Build workspace:
wc3-melee:build/netcode-probe/batch-fighter-timeline.anl2pL/; build log:
wc3-melee:build/two-clients/fighter-body-isolation-build.log.
Collector 21312 and analyzer 63603 completed successfully and were reaped.

## Early local input under a real connection interruption — 2 October

The retained clients completed isolated probe run `20261002T053842256272143`,
map SHA256 `dbdea09e402a7ab8a1327ddc48f9f9dc29be3d312526b3a857044a06df511035`.
Both profiles independently verified the installed bytes. The pinned build and
Lua/package checks passed with zero errors/warnings. The first build selected
an already compiled gameplay map instead of the terrain base and stopped at
the terrain-script check; the successful build used the documented terrain base.

The probe polls A and D every native 1/60-second callback. A has synchronized
native key callbacks; D has none. A compact sync message is sent only on a
local mask change. Event files record local polling, key callbacks and sync
receipt separately. A heartbeat is exported every six callbacks. Host injection
start/end times and export mtimes share the host clock; native elapsed time is
recorded separately. No build or asset check overlapped this measurement.

A temporary egress classifier dropped only the two established game-service
TCP flows owned by client B (host/player0), to 34.142.252.64:12243. The idle
flow matched no packets; the active flow dropped24 packets/11012 bytes. The
interval between fully installed filters and completed removal was2064.65ms.
All filters were removed and the original noqueue configuration verified.
Both clients remained signed in and resumed normally. The first driver
preflight retained the previous lobby's port and aborted before any input or
network mutation; the actual test used the newly observed endpoint.

Relative to the interruption marker:

| Observation on client B | Host time, ms |
| --- | ---: |
| A keydown injected (command interval) |150.08–180.66|
| Local poll exported A down |193.42|
| A keyup injected (command interval) |360.79–393.53|
| D keydown injected (no registered callback) |893.62–924.37|
| D keyup injected |1104.44–1135.13|
| Network filters fully removed |2064.65|
| Local poll exported A up |2304.17|
| Synchronized A-down callback exported |2712.24|
| Own sync echo for A-down poll exported |2713.17|

The A-down poll preceded its native synchronized callback by2518.82ms and its
own sync echo by2519.75ms while the actual flow was impaired. This directly
establishes early local polling in this tested case; it is not state populated
only by the synchronized key callback.

The same experiment exposes a distinct limitation. B's largest observed
heartbeat-export gap was2024.00ms; A's was125.00ms. B's A-down to A-up poll
exports were2110.75ms apart in host time but only six service callbacks/100ms
apart in native time. The intervening D tap produced no local poll transition
or sync record. Baseline and recovery D taps did. Missing timer/poll service
can therefore lose a tap that begins and ends during the interruption, even
though polling is genuinely local while serviced. Native time alone obscures
that pause. This identifies observed service interruption, not Warcraft's exact
internal scheduling cause or a universal duration threshold.

Both clients ultimately received the same ten edge-message payloads and six
native A key events. Final heartbeat service counts matched at2730; masks,
failed sends and dropped diagnostic records were all zero. No physical-device
or input-to-screen measurement is claimed. This is one two-second outbound
interruption, not a delay/jitter/loss sweep. Heartbeat exports perturb this
isolated diagnostic; overwritten heartbeat versions during catch-up are not
independent per-callback observations.

Implication: use early polling for responsive prediction while Warcraft services
the map. Application rollback cannot guarantee continuous sampling when that
service pauses. Preserving short taps through this engine-level interruption
and defining connection-stall behavior remain open; visible rollback is still
not implemented in gameplay.

Source: wc3-melee:tools/netcode-probe/EarlyInputProbe.wurst. Driver:
wc3-melee:build/two-clients/measure-early-input.py. Raw events, host action times,
classifier counters, cleanup evidence and analysis.json:
wc3-melee:build/two-clients/early-input-20261002T053842256272143-12243/.

### Complete body-timeline edge comparison — 2 October

Run `20261002054520202`, map SHA256
`0ab4ce516e9eb773ea29db5ac0d5e2a29e573afa0e4eb1c5ca85e6fe4e0a49d2`,
exercised missing tracks and partial clip boundaries in stock animations.
All18 paired receipts passed common-state and requested-coordinate checks;
all36 final image headers were readable and identified the requested view.
Collector88786 and analyzer93090 completed and were reaped.

The candidate's clamp-to-first/last-key policy does not yet reproduce native
source poses. Rifleman Spell at+62.5ms differed in up to14554 pixels with
channel difference>8; Illidan Morph Alternate at+437.5ms differed in up to8980.
Rifleman Attack at+125ms had up to347 such pixels. Those clips contain partial
track starts, including the Rifleman root transform and Illidan helper transforms.
That association motivates an interpolation discriminator; it does not yet
identify native boundary semantics. Archer Stand/Attack-1/Stand Ready had at
most4 pixels above8; Illidan Stand at+41.5ms had none, and at+937ms had up to59.
These smaller residuals have not been attributed to rounding or rendering noise.

The earlier authored Spot Dodge/Jump/Up Tilt samples remain valid, but cannot
justify generalizing the exporter to every source clip. Complete native body
fidelity and production predictive presentation remain open.

Evidence: wc3-melee:build/two-clients/fighter-coincident-20261002054520202/analysis.json.
Clip selection and exercised track cases:
wc3-melee:build/netcode-probe/batch-fighter-timeline.ZhDs1C/fighter-timeline-evidence.json.

### Partial-key marker evidence withdrawn — 2 October

**The earlier marker interpolation conclusions are invalid.** A missing positive
control allowed comparisons of an unchanged scene to pass. In gapped translation
run20261002070326708, offset translation20261002074320075 and rotation
20261002075801888, native phase0 versus phase1 images differ only in the UI
(top y49..117); the complete body comparison region is pixel-identical despite
the requested different poses. The static marker candidates likewise did not
establish visible motion. Image equality here cannot identify a native rule.

All partial-key runs below are withdrawn as animation evidence, including the
endpoint and single-key follow-ups which used the same unproven fixture. Their
receipts establish code/control progress only:

| Run | Requested case | Retained evidence |
| --- | --- | --- |
|20261002070326708|gapped translation|wc3-melee:build/two-clients/partial-key-20261002070326708/|
|20261002072930879|endpoint translation|wc3-melee:build/two-clients/partial-key-20261002072930879/|
|20261002072941961|single-key translation|wc3-melee:build/two-clients/partial-key-20261002072941961/|
|20261002074320075|offset translation|wc3-melee:build/two-clients/partial-key-20261002074320075/|
|20261002075801888|gapped rotation|wc3-melee:build/two-clients/partial-key-20261002075801888/|

All collectors/builds completed and their capacity scopes released. Strict OCR
failures remain in their original analysis files; those files are raw historical
outputs, not accepted native conclusions. No gameplay predictive renderer was
enabled. Circular exporter boundaries and their two arithmetic tests remain an
**unproven candidate**, not a native counterexample fix. The next build adds
actual effect-origin receipts to distinguish incorrect native placement from
asset/visibility failure. Before another interpolation comparison, static
candidate poses must visibly differ and marker geometry must be present.

### Circular-edge candidate on the original fighters — 2 October

Run `20261002071856554`, map
`c73d872ed91915f28b90432e0d39f9968e28044ba78b59600840b8c1c631366a`,
repeated the same nine clip/time selections after the circular linear-edge
change. All18 paired receipts and36 screenshot headers passed; the new map
also passed pinned compilation, imported-byte and Lua checks. Full export
preserved223 sequences/102747 track-clip pairs. Collector59251 and analyzer83920
completed/reaped; their compute scopes both released.

**The candidate still fails complete body fidelity.** Rifleman Spell+62.5ms
retains up to10663 pixels with channel delta>8 (prior clamp candidate14554),
and Illidan Morph Alternate retains up to8652 (prior8980). Archer's maximum
remains4. A changed image difference count does not establish an acceptable
pose or explain the remaining mismatch. The marker experiments below do not establish a native edge rule.
No gameplay renderer was enabled by this result.

Evidence: wc3-melee:build/two-clients/fighter-coincident-20261002071856554/analysis.json.
Workspace: wc3-melee:build/netcode-probe/batch-fighter-timeline.UjZO4a/.


### Replayed fighter presentation state — 2 October

The separate pure pose extraction is implemented in wc3-melee:wurst/FighterPose.wurst.
Match execution advances animation selection, phase, rate and restart serial,
including existing jump/landing/Illidan history. Replay snapshots copy this
state and remap prior grab-owner references; firstPoseDifference compares it
without changing the gameplay checksum schema. Melee consumes confirmed pose
selection/rate without mutating replay history. Visible prediction remains off.

Five focused tests passed for replay equality, freeze/restart, jump/landing,
detached grab history and smash-release behavior. Supported nondeployed full
map build replay-pose-check passed0errors and7existing warnings. Log:
wc3-melee:build/two-clients/replay-pose-map-build.log. Native visual equivalence
is still untested. Child/root/replay_pose settled; agent lease
35251aef-beed-428e-9505-7afe1f25cf29 and run scope
ff9a6742-5713-4a40-bbea-e105787bb82e RELEASED.


### Visible marker placement and first valid edge comparison — 2 October

Diagnostic20261002081039994 measured both effect origins atz0 after the old
setup/presentation path, despite requesting1000. The corrected presentation
uses BlzSetSpecialEffectPosition(x,y,1000), replacing the X-only setter.
Run20261002081443711 records1000 after each setup operation (height, scale,
animation, freeze, alpha) and in final shown origins. This implicates the X-only
placement call in the height loss, not a missing texture or invisible model.
The earlier evidence remains withdrawn; corrected placement requires fresh tests.

Corrected mapSHA256
`a034127174b0e50304ddb3183ccdd5ec4d58b24589213088a9932b33aca8c337`,
workspace wc3-melee:build/netcode-probe/batch-partial-key.bx8ekV/,
passed pinned build0errors/warnings and package checks. All24 captures now
contain visible bright-green marker geometry (1345–1576 pixels). Static
candidate phases0 and1 visibly differ. The collector now rejects missing
markers, wrong effect origins and unchanged static poses before accepting
image equality.

Twelve paired receipts passed; nine B screenshot headers fail strict age-label
OCR and remain recorded. All six A comparisons and Bphase4 have both headers
verified. On A, native middle z100 and late z130 match circular predictions
pixel-identically for both looping flags. Early native poses differ from the
circular z70 prediction by2823 pixels with channel delta>8 for both flags.
Additional Aphase0 captures with verified headers also reject clamp40,
default0 and outside-key-20 (2804/2782/2766 pixels respectively). Thus the
before-first-key rule is unresolved and the circular exporter candidate is
rejected for that boundary. No default/quaternion/end-key conclusions follow.

Native early green bounding box is(834,103,924,135) within the crop beginning
at(400,350), versus the z100 control at(835,306,924,337). This can guide a new
static-position hypothesis but is not yet a measured model-space value.
Next experiment should distinguish before-first-key extrapolation using an
asymmetric key interval and static predictions; do not rerun invisible probes
or patch exporter semantics without native evidence.

Collector6599 completed/reaped in93.050s; scope
`af84c066-cfa2-4108-b920-248b7261e6af` RELEASED. Extra comparison driver31772
completed/reaped. Both clients remain open in scmarkerz, phase0/view2.
Evidence: wc3-melee:build/two-clients/partial-key-20261002081443711/analysis.json,
collection.json and early-alternatives.json. Images remain on disk.

### Asymmetric translation edges — 2 October

Run `20261002082542002` moved the last in-clip key from 2750 to 2700ms,
leaving the first at 2250ms in the 2000–3000ms clip. The 450ms key span
and 550ms circular gap distinguish two extrapolation hypotheses.
At +125ms, the static z187.272727 candidate is pixel-identical to the native
marker in verified A captures for both looping flags. Extrapolation using
the in-clip span predicts z193.333333 and differs by 2002 pixels above
channel delta 8; the ordinary circular bridge predicts z67.272727 and
differs by 2822. Interior +500ms and late +875ms samples still match.

The supported early-edge candidate is
`lastValue + ((sampleTime - firstTime) / (firstTime + duration - lastTime))
* (firstValue - lastValue)`. Before the first key, the fraction is negative.
This implies a discontinuity at that key, whose exact source instant has
not been sampled. This establishes a translation sample, not quaternion,
default, step, scale, or whole-fighter fidelity.

All 12 paired receipts and origins passed. Nine B screenshot age headers
remain OCR failures. All six original A comparisons and the extra A early
policy captures have verified headers. Evidence:
wc3-melee:build/two-clients/partial-key-20261002082542002/analysis.json and
wc3-melee:build/two-clients/partial-key-20261002082542002/early-alternatives.json.
Map SHA256 `c9e1583d9339e78077ea3e881c3a2b1c077ff43e696a62336fe38ff8f79ce3e4`;
workspace wc3-melee:build/netcode-probe/batch-partial-key.08QteZ/.

The next fixture tests whether duplicate-time keys can encode the jump on
one seekable track. Do not substitute a short interpolation ramp without
native evidence. Prediction remains disabled pending actual fighter results.

### Duplicate-time translation discontinuity — 2 October

Run `20261002083256678` tested the proposed single-track representation:
keys at 2000:z214.5454545, 2250:z160, 2250:z40, 2700:z160,
3000:z94.5454545. Native output matches static geometry exactly at +125ms,
+250ms and +500ms for both looping flags. The exact duplicate timestamp
selects the right-hand value z40 in these samples. This validates encoding
the proposed discontinuity without an approximation ramp; it does not prove
the original partial track's exact-first-key behavior or quaternion fidelity.

All 12 paired receipts and origins passed, with visible markers and changing
static poses. All 12 raw body comparisons have zero pixel difference. Seven
original screenshot-header OCR failures remain in the raw analysis: A early
looping views 1 and 3, and five B views. A separate early looping capture
pair has verified headers and zero body difference. Thus A provides verified
before/at/after comparisons for both flags; B provides all three verified
nonlooping comparisons. No unreadable header was accepted as proof.

Map SHA256 `d35d9c814668dbdff9f2b3e9bfb615b3cb9095aae0e9f12f6e34af7b6a08a438`;
workspace wc3-melee:build/netcode-probe/batch-partial-key.XXZUAa/.
Evidence: wc3-melee:build/two-clients/partial-key-20261002083256678/analysis.json
and wc3-melee:build/two-clients/partial-key-20261002083256678/early-recheck.json.
Collector 66142 completed in 90.695s; scope
`88020f20-51a8-43b0-be2c-a2178ac04a49` released. Extra driver 47948 and
analysis 56738 completed/reaped. The next step is the opt-in exporter change
and the existing full-fighter comparison; gameplay prediction remains off.

### Extrapolating edges on fighter bodies — 2 October

The opt-in exporter now retains source keys and inserts extrapolated starts
plus ordered left-limit duplicates for varying linear tracks. It keeps
circular ends and the existing constant/default policies. Ten focused Bun
checks passed (64 assertions), including codec order and quaternion hemisphere
construction. The latter is an arithmetic check, not native quaternion proof.
Child /root/timeline_edges delivered; parent released its agent reservation.

Full-fighter run `20261002085427797` preserved 223 source sequences and 102747
track-clip pairs, adding 23 discontinuities each for Rifleman and Illidan and
none for Archer. The pinned build passed with zero errors/warnings; body,
codec, packaged-asset and Lua checks passed. Map SHA256
`34ed4bc8e2c3da795a3beda11bf5a50564c33dd88a990e76d4b2ca50680717ca`
was verified in both profiles. Workspace:
wc3-melee:build/netcode-probe/batch-fighter-timeline.GNe4by/.

All 18 paired receipts, shared-state checks and 36 screenshot headers passed.
At the same sampled clip times as the prior circular candidate:

| Pose | Prior pixels above channel delta 8, A / B | Corrected A / B |
| --- | --- | --- |
| Rifleman Spell +62.5ms | 10080 / 10663 | 63 / 120 |
| Rifleman Attack +125ms | 280 / 292 | 0 / 0 |
| Illidan Morph Alternate +437.5ms | 7290 / 8652 | 0 / 0 |

Rifleman Attack's maximum channel difference is 1. Illidan Morph Alternate is
pixel-identical on A and has maximum channel difference 3 on B. Unchanged
controls retain their previous differences: Archer at most 4 pixels above 8,
Rifleman Stand at most 9, Illidan late Stand at most 59. These reproducible
residuals are not yet attributed to rounding or accepted as harmless. Spell
still has 120 differing pixels at worst, including large intensity changes.
Prediction remains disabled while the next asymmetric rotation marker tests
the interpolation rule independently.

Evidence: wc3-melee:build/two-clients/fighter-coincident-20261002085427797/analysis.json.
Build log: wc3-melee:build/two-clients/fighter-edge-extrapolation-build.log.
Build 57999, collector 81339 (123.902s), and analyzer 30972 completed/reaped;
their scopes ee9cae00-fefe-4369-90e7-6437e5d4a5c2,
12273810-dd85-454c-8c4a-4bc1e6155cd9 and
8fb755f8-8099-4c8e-8931-14d05f849b0d all released.

### Asymmetric rotation marker and remaining raster differences — 2 October

Run `20261002090112200` applies the same asymmetric 2000–3000ms layout to
rotation about Y. The native marker matches static geometry at +125ms
(187.272727 degrees), +500ms (106.666667), and +875ms (121.818182) for both
looping flags. All 12 raw comparisons are pixel-identical; all six A comparisons
have verified headers. B independently verifies phases 1, 2 and 5. Six B
header OCR failures remain recorded. All paired receipts, origins, visible
geometry and changing-pose controls pass. This supports the tested spherical
rotation samples, not every source quaternion or exact clip endpoint.

Map SHA256 `de7ced43b355e600a61938d25869fc5b4f91497bc8c586a58faa151b60e3e7c4`;
workspace wc3-melee:build/netcode-probe/batch-partial-key.BS1L1v/.
Evidence: wc3-melee:build/two-clients/partial-key-20261002090112200/analysis.json.
Build 98136 and collector 27687 (94.536s) completed/reaped; scopes
04af4ae5-2756-4937-b85b-84a0219f7493 and
c3af3d80-6361-4d5a-89ba-ee5264ea36fe released. The collector now accepts an
optional prediction-view argument; this test compared native view 1 to view 5.

The remaining fighter differences do not all admit a neighboring-pixel color
match within radius 1 and channel tolerance 8. For Rifleman Spell on B, 53
source pixels and 71 candidate pixels remain unmatched under that criterion.
It is therefore unsupported to call all residuals a simple one-pixel shift.
This is a raster-similarity check, not a unique geometric correspondence or
a diagnosis. Evidence:
wc3-melee:build/two-clients/fighter-coincident-20261002085427797/spatial-residuals.json.
Analysis 14620 completed/reaped; scope 59cf4755-03ab-4924-a9d7-11468760b670 released.

Source arithmetic exposes a smaller candidate discrepancy: Rifleman Spell's
quaternion norms are approximately 0.999994–1.000005. Direct candidate slerp
at +62.5ms and interpolation through the exported start differ by up to
3.9339066e-6 per component. The calculation is retained in
wc3-melee:build/two-clients/fighter-coincident-20261002085427797/quaternion-composition.json.
It does not establish that this causes the native pixel differences. Another
unresolved variable is seeking large, nonbinary clip origins on one timeline
versus small clip-relative times on native references (Spell starts at
117958ms); the earlier irregular-origin marker evidence was withdrawn.
Do not normalize source quaternions, approximate jumps, or dismiss residuals
without a discriminating native result. No new input-latency measurement or
production predictive renderer follows from these animation probes.

### Clip-relative clock discriminator and original-clip alternative — 2 October

Run20261002091608627 rebased the flattened candidate's selected clip keys to
zero without changing their values or duplicate ordering. Both profiles ran
map SHA256153f89fb2acae34703db8820fc25f49de8e1cc8537274ce96744b1f7a2273f72.
All six paired receipts and twelve capture headers passed. Source/candidate
pixels exceeding channel delta8 were Archer3/0, Rifleman Spell63/120, and
Illidan late Stand1/0 (clients A/B). Exact fidelity therefore still fails.

Archer and Rifleman A source and candidate images are individually identical
to the previous absolute-clock run. Rifleman's remaining discrepancy is not
removed by rebasing alone. Illidan's residual decreased, but its reference
image also changed between runs when the same selected clip/time occupied a
different reference slot/path. That comparison does not isolate the clock as
Illidan's cause. Full per-image comparisons and metadata are retained in
wc3-melee:build/two-clients/fighter-coincident-20261002091608627/analysis.json
and wc3-melee:build/two-clients/fighter-coincident-20261002091608627/across-run-clock-comparison.json.
Later frozen candidate captures at phase18/view2 remained pixel-identical to
the collected images on both clients; the result is in the same directory's
static-rest-comparison.json. These stable captures support an exact raster
oracle within the frozen fixture; they do not prove every rendering condition.

The initial collector68211 expired before the map was started. Its directory
was preserved with suffix-before-start-timeout. Replacement collector30239
completed and released scope3ba42c89-af13-42c2-aae2-ceccd880af86; analysis42543
released scopeccc1efd5-7ddd-4589-afe6-0df2d5ba24af.

The checked Warcraft native interface in wc3-melee:_build/common.j exposes
whole-effect transforms and animation selection/time, but no general bone
matrix or vertex-buffer setter. SetUnitLookAt is a constrained targeting API,
not arbitrary skeletal evaluation. The next candidate uses preselected
original clips in persistent effects, choosing the visible effect and seeking
relative time without selecting an animation during restoration. This removes
flattened-timeline interpolation from the rendering path. Native restoration,
immediate presentation, resident cost, and local mutation safety remain gates.

Source assets total223 sequences. Blindly duplicating each complete asset
would total1,659,562,748 bytes; animation key data accounts for7,054,516 of
Archer's7,103,271 bytes,7,183,368 of Rifleman's7,237,188, and7,541,012 of
Illidan's7,722,979. Selecting only original in-clip keys is a subsequent size
candidate, conditional on preserving native pose behavior; do not infer that
trimming is already verified. The initial pool probe retains unchanged keys.
Visible prediction remains disabled and exact animation fidelity remains
required by the owner.

### Original-clip pool: geometry fidelity and scene-state counterexample

Run20261002093613117 uses nine persistent candidate effects and nine frozen
references. Each pair loads identical selected-source asset bytes; no timeline
flattening or key recalculation occurs. Source intervals, flags, geometry,
skeletal/material keys and model blend metadata are preserved. Map SHA256
fb700e7a702d62cd44a43d5ea0975a90159803c38fba508a4c2fcf0860ec9922 ran on both clients.
The compiler reported zero errors/warnings; codec, original-body equality,
packaged script and all imported-model checks passed.

The21-phase run completed42 paired receipts and84 verified capture headers.
All14 Archer and14 Rifleman source/candidate comparisons were pixel-identical,
including Rifleman Spell, which retained63/120 pixels above delta8 under the
flattened candidate. Thirteen of14 Illidan comparisons were identical. The
host Morph Alternate sample differed at3084 pixels with maximum channel delta3.
Exact source fidelity therefore failed; this residual is not accepted.

Returning to the initial candidate image is exact for Archer and Rifleman,
but Illidan's early Stand changes after other pool instances have moved. Both
reference and candidate change together: they still match each other at the
later phases. Twelve wrong-pose controls change12636–62094 pixels on B and
11539–48748 on A, so equal comparisons are not empty-scene evidence. Source
and restoration results are kept separately in
wc3-melee:build/two-clients/fighter-coincident-20261002093613117/analysis.json.
Collector68188 released4a252050-2002-4a6b-b380-402c5b471604; analyzer49444
released5c6222f2-5ad9-427e-a1e1-64598eb6ea35.

Inspection found one static point light in Illidan: Omni01,ObjectId155,
Parent=null,attenuation0..40,local pivot(0.609531,-1.292670,107.408997).
Archer and Rifleman contain no lights. The body exporter removes emitters,
ribbons and events but retains lights. The pool therefore duplicates an
unaccounted-for scene component. Hidden-instance illumination is a hypothesis
for the changing scene, not yet a native diagnosis. The discriminating flag
FIGHTER_POSE_ISOLATE_LIGHTS moves all hidden models out of the scene without
changing any source asset, key or clip. It applies to every fighter, not an
Illidan branch. If confirmed, the production remedy belongs to shared model
component visibility/lifecycle. No character-specific numeric correction is
admitted.

The selected-pose prototype also allocates distinct candidates for repeated
selections of the same source clip. Production must key the pool by unique
source clip and exercise actual backward time seeks on that same instance;
switching between two frozen instances does not prove that separate claim.

### Hidden-model isolation and compact-clip rejection — 2 October

Isolation run20261002095449862 moved every hidden candidate/reference to
relative x4096,z-4096. All14 source/candidate comparisons were pixel-identical;
all14 paired receipts and28 headers passed. Restoration still failed on both
clients:526 pixels/max22 on A,5093 pixels/max40 on B. The frozen reference
changed by exactly the same pixels as the candidate. This isolates some
hidden-instance interference but does not uniquely diagnose model lighting or
prove history-independent restoration. Evidence:
wc3-melee:build/two-clients/fighter-coincident-20261002095449862/analysis.json
and the same directory's frozen-reference-changes.json.

The compact exporter retains only original in-clip keys, preserving values,
timestamps, duplicate order, interpolation, tangents, sequence flags and
geometry. Its initial policy retains empty animation tracks as zero-key chunks.
Structural checks and MDX round trips pass for223 clips totaling38,128,088
bytes, versus1,659,562,748 bytes of full-source duplication. Those checks do
not establish native semantics.

Native run20261002101022264 tests eight unique source-clip candidates against
nine full-key references. Illidan early/late Stand reuse candidate index6;
the pool now actually seeks backward on one instance. Both clients ran map
SHA2567c765af7003729c5d9442588aa48cc9cb48b9d1866f3affd70c2e7e6f9e40f3c.
All42 paired receipts and84 capture headers passed, but all42 image comparisons
failed, with maximum channel difference255. Worst pixels above delta8 were
Archer26065,Rifleman25195,Illidan42041. The compact zero-key representation is
rejected. Restoration of an incorrect or degenerate candidate does not prove
usable rewind fidelity. Evidence:
wc3-melee:build/two-clients/fighter-coincident-20261002101022264/analysis.json.
Collector52272 completed in263.957s and released
d629d693-9bbf-4713-9fcf-c13c75dc65fa; analyzer16108 released
0b927594-c00a-4821-9125-5f4a260048ca.

Archer Stand alone gains175 empty channels, including skeletal scale and
geoset alpha. The next discriminator omits empty channel properties while
leaving every retained key and the native reference unchanged. Zero-key native
semantics are a hypothesis until that result; this is a shared import rule,
not a character-specific adjustment. Prediction remains disabled.

### Empty-channel omission restores compact pose fidelity — 2 October

Run20261002102859948 omits animation chunks emptied by trimming. Required
geoset static alpha retains the exact serialized source backing; skeletal
channels become absent. Retained keys, intervals, flags and geometry are
unchanged. Six focused checks include byte-level observation of the GEOA
backing field. Pinned compilation reported zero errors/warnings; packaging
and MDX round trips passed. Map SHA256
db96964c20b62ecb7e94a776b6268b9d6026e550b68f8b9070fa9135025398c3 ran on both clients.

All26 source/candidate comparisons are pixel-identical, with26 paired receipts
and52 headers valid. Archer and Rifleman each pass eight comparisons, including
return to their initial pose. Illidan passes ten comparisons, including an
early→late→early seek on the same Stand effect and multiple seeks in one callback.
These are selected native samples, not proof of all223 clips or first-render
timing. The compact candidate imports total956,887 bytes for eight clips.

Illidan scene restoration still fails: the early pose after other presentations
differs989 pixels/max40 on A and5084 pixels/max48 on B. Its frozen full-key
reference changes identically. This separates compact pose fidelity from the
remaining scene-history problem. The next diagnostic zeros both direct and
ambient model-light intensity on both comparators while preserving light nodes,
hierarchy and body keys. That diagnostic changes illumination deliberately and
cannot itself establish fidelity to the original lighting.

Evidence: wc3-melee:build/two-clients/fighter-coincident-20261002102859948/analysis.json.
Collector89959 completed168.369s, releasedcf0c741d-c377-4450-964d-de790a1d89e2;
analyzer37479 released1b18159a-e398-45ba-960b-f3c258969488. Child ownership is
settled; all child scopes released in
wc3-melee:build/two-clients/compact-empty-channel-release.json.

### Model illumination is the scene-history discriminator — 2 October

Run20261002103744679 sets every model light's direct and ambient intensities
to zero in both source and candidate. Nodes, hierarchy, pose keys, camera and
hidden-instance isolation remain unchanged. Map SHA256
c252968de861a4f5841af4e51df9b01bc5f71f198f438668957fef256d7dd94d was installed
on both clients. All12 source/candidate comparisons,12 paired receipts and24
headers pass. All four Illidan candidate restorations are pixel-identical;
the frozen references are also unchanged. Wrong-pose controls remain visibly
different. Evidence:
wc3-melee:build/two-clients/fighter-coincident-20261002103744679/analysis.json.

This intervention identifies model illumination as the source of the observed
scene-history residual in this fixture. It does not distinguish internal light
registration, culling, accumulation or transform caching. It deliberately
removes original illumination and is therefore not a production fidelity fix.
The next smaller visibility experiment retains all original lights and adds
zero scale for inactive pooled effects, restoring their original scale when
active. A failure will reject that hiding mechanism and support separating
model-light ownership from clip-instance ownership.

Collector77708 completed85.958s and released34509e38-85d3-41c4-b088-60165d46ba41;
analyzer61960 released9e748de8-98a0-459b-aaa9-83041bfbaf08. Both clients remain
signed in. No production renderer or prediction setting changed.

### Zero-scale hiding does not restore original illumination — 2 October

Run `20261002104533933` retains original model lights, parks inactive models
outside the scene and sets their scale to zero. Active instances recover their
original scale. Both clients ran map SHA256
`8cf2eab69fade7518a150253eabb9082553695bd40b4c09df0ce76dbd2fc4d9c`.
All 12 source/candidate comparisons are exact, with 12 paired receipts and 24
capture headers valid. Illidan restoration still fails: 292 changed pixels
(maximum channel difference 7) on A and 6,695 (maximum 81) on B, for both the
ordinary return and multiple-seek return. Exact restoration remains required;
the smaller A residual is not accepted.

Evidence: wc3-melee:build/two-clients/fighter-coincident-20261002104533933/analysis.json.
Collector 31957 completed in 85.388 seconds and released
`a1d1a268-28d6-4450-8054-20675e5a7f88`; analyzer 26250 released
`bacc5ffa-1b53-401b-8c68-0db5bc4a2cdc`.

This rejects zero-scale hiding as the scene-light lifecycle fix. The next
candidate separates model-light ownership from clip-instance ownership, retaining
the original light values and transforms once per fighter. It must be compared
against an original single-model illumination baseline. Matching two references
whose illumination was altered together would not establish preservation.
Animated or parented lights need explicit supported semantics; a character-name
exception or silent light removal is not a general solution.

### Corrected compact export covers all 223 source clips — 2 October

The shared original-clip exporter now defaults to omission of emptied channels.
Eight focused tests and full-roster source/structural/MDX checks pass. The corrected
223 clips total 37,827,880 bytes, a 97.7206% reduction from 1,659,562,748 bytes of
full-source duplication. Output is wc3-melee:build/original-clips-omission/;
the older zero-key export in wc3-melee:build/original-clips/ remains rejected.

Evidence: wc3-melee:build/original-clips-omission/original-clips-evidence.json,
SHA256 `0588392bd47f7641295b48e9108b5ffe1e01b547baf4d6e53abe023ec66bec42`.
The 26 exact native comparisons above cover selected clips and times, not every
exported sequence. First-render timing, full-pool residency/cost, and original
illumination restoration remain unproven. Visible prediction remains disabled.

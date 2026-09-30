# Native capability report

Updated 1 October 2026. Status is evidence-specific; no competitive backend
has passed native acceptance. Research/acceptance record:
wc3-melee:SMASHCRAFT_NETCODE_PROPOSAL.md.

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
  See wc3-melee:ANIMATIONS.md for the distinction and native validation limits.

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

# Native capability report

Updated 30 September 2026. Status is evidence-specific; no competitive backend
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
- Aerial animation WIP is excluded from this baseline. Existing source actions
  survive, but exporter interpolation changes remain unresolved. Counterexample:
  wc3-melee:tools/animations/check-aerials.ts. Upstream seam:
  mdl-exporter4:export_mdl/classes/animation_curve_utils/get_wc3_animation_curve.py.
  Parent retains repair responsibility; no aerial preservation/native claim.

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
| C: complete snapshots/replay | Reusable numerical capture/restore plus focused movement/contact tests; full suite 214/214 | PARTIAL; adapter state/ring/hash/fault oracle pending |
| D: local presentation/pose recovery | Model-only effects freeze and seek within Attack; clip-change restoration did not reproduce reference pose | PARTIAL; exact recovery/local multiplayer safety unproven |
| E: controlled fixed/hybrid comparison | No scheduled/rollback backend in gameplay yet | NOT IMPLEMENTED |

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
storage for the existing two-fighter numerical state, projectile arrays, both
normalized input snapshots, match rules, command buffers and physical-key/
action-edge/directional-pulse state. Attacker references map into the restored
fighter pair, so they do not point into another history's fighters. Storage is
allocated at construction; capture/restore contain no allocations or native
calls. This is not yet a canonical serialized snapshot format.

Three focused tests cover restore after mutation, a 48-frame movement/clock
replay, and restoration into different fighter objects without repeating a
hit from the same attack window. The integrated headless suite passed 214/214,
zero errors/warnings; wc3-melee:build/wurst-tests/replay-integrated.log.
This is not the requested 100,000-frame fault-injection oracle and makes no
cross-client floating-point determinism claim.

Before connecting the live adapter, move or explicitly capture its additional
queued edges (normal attack, jump, air dodge/vector, directional/getup/tech/
L-cancel/mash/ledge inputs), simulationFrame, attack facing, and bot decision/
cooldown state. Keep device sampling outside replay and distinguish immutable
input records from canonical consumed-input history. Then add the bounded
preallocated history ring, complete state comparison/hash, input-tape oracle
and transport fault injection. Gameplay still uses its existing adapter.

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

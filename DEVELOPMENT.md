# Development plan

The main feedback loop is Wurst tests outside Warcraft III. Compile and reload
the map for an engine-visible change or a completed gameplay slice, not for
every physics edit. Wurst is the authoritative gameplay source; generated Lua
or JASS is output. This is the owner's chosen platform fighter using Warcraft
assets, initially Archer/Fox and Rifleman/Falco.

## Split

| Part | Owns | Checks |
| --- | --- | --- |
| Simulation | Fighter and match state, input snapshots, movement, platforms, blast zones, damage, hitstun, shields, stocks | Wurstunit, without Warcraft |
| Controls and clock | Key-down/up events, held state and press edges, player assignment, fixed simulation steps | Small adapter checks plus an in-game input check |
| Presentation | Warcraft units/models, animations, camera, frames, sounds, selection screens | In-game visual and interaction check |
| Build/test driver | Compiler, packaging, running focused tests, map replacement and restart, readiness observation | One observed build → reload → ready journey |

Simulation must not create Warcraft units, frames, timers, triggers, effects,
or files. It receives ordinary typed state and inputs and advances exactly one
simulation step. Presentation reads the resulting state and events; its frame
rate, camera, animation, or local-player status must not decide combat.
Warcraft timers schedule steps but do not supply variable wall-clock deltas
to fighter physics. The bot supplies the same input shape as a human player.

Tests call the same simulation functions that the map calls. Do not maintain a
parallel test model or reproduce the implementation in the expected results.
Avoid game-native mocks for pure physics: remove those dependencies from the
simulation boundary instead. Start with a few Wurst packages, not a new engine
framework or generic entity system.

## Normal edit loop

1. Change the relevant simulation rule and run its focused Wurst test.
2. Use compiler/editor diagnostics for type and API mistakes.
3. For a complete mechanic, build the map and use the running client to check
   controls and presentation. The same test inputs should be reproducible.
4. Record an actual changed-build readiness result and one useful visual
   observation. Leave the client running for the next change.

Good initial tests: one press gives one jump; holding the key does not consume
the second jump; landing restores jumps; crossing a platform from below does
not land; crossing a blast boundary loses exactly one stock; shield energy and
hitstun prevent the appropriate actions. Assert explicit expected trajectories
and state changes, then add cases only when a mechanic or observed bug needs
them.

For wavedashing, tests will specify the input sequence, jump-squat frames,
air-dodge direction, landing transition, and retained horizontal velocity.
The simulation advances at 60 logical frames per second. Distinguish sourced
parameters from provisional move tuning. Study the factual frame rules in
~/code/resources/melee and record independently implemented mechanics in wc3-melee:PHYSICS.md before claiming fidelity; logical frame timing and
Warcraft's actual input delivery cadence are separate questions.

## What tests cannot settle

Headless tests do not prove the engine's keyboard timing, visual alignment,
animation playback, timer cadence, networking, or absence of multiplayer
desynchronization. Use a short in-game check for those boundaries. A two-client
test is required before making fairness/netcode claims; no rollback guarantee
follows merely from deterministic simulation tests.

## Directional influence integration

Held Left/Right and Up/Down reach the simulation in the same frame snapshot.
The victim's last hitlag frame samples those axes once to adjust launch angle;
later steering does not repeatedly rotate the launch. The developer line's
`DI=count:degrees` reports nonzero applications for the native input check.
The control bindings remain player-configurable. Numerical and digital-input
differences are recorded in wc3-melee:PHYSICS.md.

Launch velocity is separate from ordinary movement. Collision and the bot's
descent check use their sum; gravity caps only ordinary falling velocity.
The launch vector loses magnitude along its current direction, rather than
subtracting the same amount from both axes. DI rotates that vector, leaving
ordinary movement alone. Detailed reset, landing, and action choices are in
wc3-melee:PHYSICS.md.

Directional taps during hitlag now feed SDI position shifts. Component-entry
rules distinguish a fresh tap or newly added diagonal axis from holding a key
or releasing one axis. The final hitlag tick uses left-stick direction for DI,
then applies ASDI with held C-stick bindings taking priority for displacement.
The adapter derives these axes from the player's bindings, not fixed key codes.
The developer counters `S` and `A` report actual SDI and ASDI displacements.
ASDI reuses ordinary landing/recovery code; a downward SDI floor crossing blocks
that vertical shift while downward SDI in open air remains possible. Reference
parameters and deliberate differences are in wc3-melee:PHYSICS.md.

SDI/ASDI passes 123/123 headless tests with no warnings; output is retained at
~/code/wc3-melee/worktrees/test-loop/build/wurst-tests/sdi-asdi-full.log.
Native build 003040 reloaded in 22.992 seconds with the process retained.
Holding Up across hits recorded four ASDI shifts and no repeated SDI.
A 230 ms press / 190 ms release sequence recorded SDI followed by ASDI.
The earlier 70 ms / 60 ms sequence recorded neither. The callback trace below
subsequently identified batched press/release delivery as a cause of lost taps.
C-stick priority and landing
boundaries have headless coverage; native C-stick priority is not yet observed.
Evidence:
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/asdi-held-client.mp4,
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/sdi-tap-client.mp4,
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/sdi-tap-timeline.png,
and ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/hitlag-shift-reload.log.

## Native input batching

F7 records 300 presentation ticks of key callbacks and directional snapshots to
the prefix's Warcraft III CustomMapData files `wc3-melee-input-start.txt` and
`wc3-melee-input-trace.txt`. The trace includes tick index and an independent
Warcraft timer's elapsed time. F7 is reserved from gameplay rebinding. Tracing
is dormant until requested and does not alter gameplay state.

Build 003649 measured 240 ticks across 4.000 native timer seconds. The full
trace's start/end file times were 4.978 seconds apart for its 300 ticks, including
the partial first interval. Linux injection requested eight short taps and
four longer taps. All 24 direction key callbacks arrived, but the first five
short down/up pairs had identical native timestamps and tick indices (0.300,
0.500, 0.700, 0.900, 1.100 seconds). The held-only sampler saw none of them.
Later releases and re-presses also arrived in a single batch, hiding neutral
intervals. Delivery was quantized in roughly 100 ms increments in this native
single-player setup; that measurement is not a multiplayer latency guarantee.

The input boundary now retains the newest fresh directional component-entry
pulse until the next tick, independently of held state. SDI consumes that pulse
only in its valid hitlag window. Every tick clears it, including menu and
ineligible ticks; this does not introduce delayed action buffering or reconstruct
unknown physical hold durations. Warcraft callback delivery latency remains.

Before-change evidence:
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/input-trace-before.txt
and ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/input-timing-before.log.

After the fix, build 004400 reloaded in 23.337 seconds and the same native
sequence produced twelve separate pulse samples for twelve direction presses.
This included neutral transitions hidden inside callback batches: release and
re-press at 1.500 seconds became a pulse at tick 91 / 1.501 seconds while the
victim had six hitlag ticks left. No extra tick of buffering was introduced.
The full headless suite passes 129/129, including a down/up batch generating
one SDI pulse with neutral held state and zero ASDI, expiry before a later hit,
direction reversal, and component-entry rules. This does not recover physical
timestamps or remove the engine's measured callback batching.
After-change trace:
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/input-trace-after.txt.

Repeat the controlled input probe from character selection with the current
N=Attack and Space=Up bindings (the reload command leaves that menu ready):

```bash
/home/tom/code/wc3-melee/worktrees/test-loop/loop.sh reload
/home/tom/code/wc3-melee/worktrees/test-loop/tools/probe-input-timing.sh
```

The script emits wall-clock injection times, enters the default match, invokes
F7, and sends eight short taps followed by four longer taps. It stops if focus
changes and releases its scoped input daemon. Read the completed trace at
`~/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData/wc3-melee-input-trace.txt`.

The integrated suite passed 112/112 tests with no compiler warnings. The final
input-timing check additionally changes Down to Up on the last frozen tick and
confirms the Up result; the focused DI suite passed 3/3 after that assertion.
Native build 000339 reloaded in 23.801 seconds with the Warcraft process retained.
Holding Up in a normal Sky Deck match produced four recorded DI applications
(approximately -9 degrees against the bot's diagonal launches) before stock
loss reset the diagnostic. This proves the held-input adapter reaches DI in the
client; it does not establish analog parity or multiplayer timing.
Evidence: ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/di-client.mp4,
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/di-timeline.png,
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/di-reload.log,
and ~/code/wc3-melee/worktrees/test-loop/build/wurst-tests/di-integrated.log.

The launch-velocity split passes 116/116 headless tests without warnings,
including vector decay after hitstun, downward launches beyond terminal speed,
DI isolating launch from movement, fast-fall eligibility, and floor-tech cleanup.
Native build 001654 reloaded in 23.611 seconds with the client retained. The
normal Sky Deck recording shows repeated bot hits, DI, airborne travel, landing,
and stock loss after leaving the platform. This checks the ordinary engine
path; the numerical trajectory assertions remain headless evidence.
Recording and diagnostic strip:
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/knockback-client.mp4
and ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/knockback-timeline.png.
Reload output: ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/knockback-reload.log.

## Sequence and current checkpoint

1. Finish the initial Wurst port and observe it running in the existing client.
2. Extract the movement/platform/blast-zone step from native calls, add focused
   Wurst tests, and make a headless test command the routine development gate.
3. Add the playable character mechanics through that split: jumps, shields,
   air dodge and wavedash, then attacks/knockback and their presentation.
4. Use character and stage selection to enter the same simulation.

The initial extraction shares handle-free fighter state and simulation
functions with the Warcraft adapter. Frame-based mechanics and the UI integration
are in progress; see the checkpoint below for what has actually been checked.

Lua output plus persistent-client map restart is the established integration
route. JHCR can improve in-game iteration with JASS output, but is an optional
accelerator; its setup must not block headless simulation work. Choose between
backends from working builds, tests, and measured in-game behavior. Toolchain
selection and automation are the assistant's responsibility, not an operator
menu. See wc3-melee:WURST.md and wc3-melee:LOOP.md for source findings and prior
timings.

## Headless checkpoint

The initial extraction now shares Simulation.FighterState and advance/attack
functions between wc3-melee:wurst/Melee.wurst and
wc3-melee:wurst/SimulationTests.wurst. The worker observed seven Wurstunit tests
passing in approximately four seconds through
~/code/wc3-melee/worktrees/test-loop/test.sh. VS Code's default test task calls
that command. Frame-based refinements and sourced parameter adoption are in
progress; this checkpoint does not prove those later changes.

## Frame-based checkpoint and next work

Nine Wurstunit tests passed after frame counters and the documented movement,
shield and knockback parameters were introduced. The Warcraft adapter uses a
1/60-second timer. Build 185558 loaded in 14.135 seconds without restarting the
client. The new ClosureFrames selector accepted a Falco mouse click and then
keyboard confirmation, entering stage selection and a match. Evidence:
~/code/wc3-melee/worktrees/test-loop/build/engine-check-185558 and
~/code/wc3-melee/worktrees/test-loop/build/loop/20260929-185557-reload.

Latest integrated checkpoint: 30/30 headless tests passed (18 simulation,
four command-buffer, three key-binding, three match-rule and two match-step).
Build 191513 became ready in 14.015 seconds with the same Warcraft process.
The map uses the tested match step: advance both fighters, consume eligible
queued commands, resolve attacks against pre-hit state, then resolve stocks.
Shield minimum hold/release lag, air-dodge helplessness, platform crossing,
short/full hops, attack trades and simultaneous final stocks are covered.
L grab is implemented with provisional 100-unit reach, 20-frame hold and
10-frame release hitstun; those are prototype tuning rather than sourced data.

Next required work:

- Extend the current single-human settings/match adapter when adding a second
  human player, then validate synchronized input timing with two clients.
- Use focused client checks for shield/air-dodge appearance, animations and
  control feel after those tests. Multiplayer timing remains unverified.

The Wurst skill is active in the shared catalog.

## Goal extension: authored combat animations

The owner explicitly added Blender installation and animation authoring to the
active goal. Required initial clips: jab; forward tilt; up-angled forward tilt;
down-angled forward tilt; jump; double jump; forward roll; backward roll; and
get-up attack. Use Warcraft assets as requested. Establish a Blender ↔ Warcraft
model/animation import/export path and verify skeleton compatibility before
claiming the clips can ship. Author and preserve editable animation sources,
exported map assets, and timing metadata. Simulation owns displacement, damage,
invulnerability and recovery; clips must align with those tested frame windows.
Validate exported clips on the actual in-game fighter. Additional moves may
follow; the named clips remain required even after the current simulation
checkpoint is complete.

Control correction from owner: L is grab. A/8 shield on ground and trigger air
dodge on a fresh airborne press. Grab must enter the same queued frame-boundary
combat path and have bounded capture/release behavior; no hidden jab fallback.

Input timing policy: collect presses until the next logical frame, consume
commands once, and resolve both fighters' attacks from pre-hit state. Default
attack grace is zero extra frames (no universal recovery buffer); AttackBuffer
supports an explicit configured window and tests its expiry. Same-frame action
priority is deterministic rather than callback-order dependent. This does not
prove network synchronization or equal physical input latency. Three match-rule
tests and four command-buffer tests passed independently during integration.

## Goal extension: player input settings and persistence

Owner requests standard QWERTY and Tom's custom keymap presets, per-action
rebinding, and persistence of player hotkey settings. L=grab is part of Tom's
preset; A/8 are ground shield/airborne dodge. Build an in-game settings screen,
retain/reset presets, validate conflicting bindings deliberately, and verify a
save → map reload → restored bindings journey. Inspect Wurst's existing local
FileIO/preload support before implementing persistence. Local settings are
per-player preferences; translating them into actions must preserve the shared
simulation input/synchronization boundary. Do not mutate shared match state
based on unsynchronized local file reads. This is required goal scope, not an
optional follow-up.

Preset mapping clarification: custom key 8 represents GameCube R/right trigger
(shield/air dodge), while standard QWERTY defaults that action to 7. Shift the
other mapped number-row keys left for QWERTY as well: custom 9 jump → QWERTY 8.
These are action bindings, not instructions to synthesize a keyboard R press.
Keep player rebinding available after choosing either preset.

KeyBindings supplies two tested presets, two slots per action, conflict and
reserved-key rejection, and versioned fixed-length encoding/restoration. Three
headless tests cover owner mappings, rebinding, and atomic malformed-save
rejection. SettingsUI and BindingSettings now connect this to the game through
the standard-library SaveLoadData wrapper. The compiler exports generated
abilities, and the packager includes and verifies those bytes. Only the synced
load callback updates the active bindings. The current adapter is Player(0)
versus a bot; this is not a completed two-human multiplayer implementation.

Observed persistence check: select Custom, add K as a second grab key, Save,
restart through the normal F6 loop, open Controls with F1. Build 194234 restored
the exact encoded table and showed both L and K; the whole reload took 23.667
seconds with the same client process. The test binding was then removed by
restoring and saving Custom. Evidence lives at
~/code/wc3-melee/worktrees/test-loop/build/controls-probe/restored.png and
~/code/wc3-melee/worktrees/test-loop/build/controls-probe/restored-ready.txt.
The save file is
~/.local/share/Steam/steamapps/compatdata/3516115571/pfx/drive_c/users/steamuser/Documents/Warcraft III/CustomMapData/MeleePrototypeBindings.pld.
Confirm actual key-event/network behavior with two clients before claiming
multiplayer synchronization or latency properties.

Settings read on map startup and write on Save. A same-map disk reread is not
supported: Warcraft returned the prior cached preload contents after the file
had changed. The UI exposes preset selection, rebinding and Save; restoration
is automatic next time the map starts. See wc3-melee:WURST.md for the observed
engine boundary. Blender is installed and its animated import/export API issues
are repaired. Archer and Rifleman now have editable textured scenes; authored
clips and complete in-game animation fidelity remain unfinished. Commands and the model
version limitation are recorded in wc3-melee:ANIMATIONS.md.

## Air-dodge checkpoint

33/33 headless tests pass after adding frames 4–29 of air-dodge intangibility
for both characters. Damage during startup interrupts dodge movement; landing
ends dodge protection without clearing independent respawn protection. The
same protection query drives hit detection and fighter opacity.
Build 195029 loaded in 23.505 seconds with the client retained. A client input
probe captured the faded airborne fighter and normal opacity afterward at
~/code/wc3-melee/worktrees/test-loop/build/dodge-probe/dodge.png and
~/code/wc3-melee/worktrees/test-loop/build/dodge-probe/recovery.png.

Jump calibration now passes 36/36 headless tests: complete full/short/double
jump trajectories match the documented apexes for both characters, repeated
presses cannot restart squat or spend the air jump, and releasing during squat
locks in short hop. The original Fox full-jump test measured 165.92 world units
against the 187.68 target; calibrated launch velocity fixes the discrepancy.
Build 195812 reported ready in 23.432 seconds with the same Warcraft process.
The client probe entered character → stage → match using the attack binding,
then held Jump and captured the airborne fighter at z=166. A subsequent frame
showed it back at platform height under bot attack. Evidence:
~/code/wc3-melee/worktrees/test-loop/build/jump-probe/airborne.png and
~/code/wc3-melee/worktrees/test-loop/build/jump-probe/landed.png.
This checks input and rendered movement, not exact in-client apex or Melee feel.

Action recovery now passes 42/42 headless tests. Jump, dodge, shield startup
and ground steering respect attack cooldown; air drift remains available
without reversing facing during recovery. Cooldown decrements before action
eligibility on non-hitlag frames, giving all those actions the same recovery
boundary. Regression tests first reproduced the three illegal action cancels.
Build 200313 reported ready in 22.890 seconds with the same Warcraft process.
Jump out of active shield is now implemented and covered for both characters.
The 43-test suite includes held-trigger jump startup and the complete
shield-jump → diagonal air dodge → sliding landing/recovery sequence.
The new jump-out-of-shield test failed against the prior rejection, then passed
after implementing the transition. Shieldstun still blocks it.
Build 200554 loaded in 22.630 seconds with the same client. The native-input
probe held Custom trigger 8, then pressed Jump without releasing the trigger;
the captured fighter was airborne at z=149. Evidence:
~/code/wc3-melee/worktrees/test-loop/build/shield-jump-probe/airborne.png.
Exact wavedash distance and input feel remain unmeasured in the client.

Attack phases now use an accepted-start serial, style, frame counter and
one-contact flag. MatchStep starts queued moves, then resolves active contacts
from both fighters' pre-hit eligibility. Damage can cancel startup. The
adapter starts animations from the serial, freezes playback during hitlag and
routes bot facing through the queued command. Timing values in
wc3-melee:PHYSICS.md are prototype tuning; authored clips, hitbox shapes,
projectiles and character-specific move data remain unfinished.
The 52-test suite passes with zero warnings. Tests now advance attacks through
the shared MatchStep, including startup interruption, later contact during an
active window, single contact across hitlag, recovery completion/reuse and
order-independent trades. The shield-energy oracle is independent arithmetic:
60 - 5 * 0.28 - 12 * 0.7 for the five startup/contact ticks of a neutral hit.

Owner control clarification: standing N is jab, U blaster; hold ; to walk and
use N plus direction for tilts. N plus direction without the walk modifier,
or direct C-stick bindings, requests smashes. Normal attack intent is resolved
from held direction/modifier state at the frame boundary, including a fresh
direction press while N is held. C-stick wins a simultaneous normal tilt.
These chords have no extra recovery buffer or charged-smash implementation yet.
The walk action is rebindable. Existing K1 saved settings are read into K2 with
their prior keys retained; ; is added unless already bound to another action.
New saves contain all 15 actions. Ground blaster captures 24-frame duration,
air blaster 15; both values remain prototype tuning rather than sourced parity.
Integrated build 203053 loaded in 22.866 seconds with the same client process.
The Controls screen restored Custom L/8/9 and displayed the new ; action at
~/code/wc3-melee/worktrees/test-loop/build/tilt-probe/controls.png.
The held-key probe captured input action 5, selected move 6, accepted serial 1
and attack frame 2 at
~/code/wc3-melee/worktrees/test-loop/build/tilt-probe/contact.png.
This proves the native keyboard chord starts the side tilt, not that it hit:
the earlier live probes were interrupted or did not reach contact. Headless
tests cover tilt damage. Charged smashes and distinct aerial normals remain
unfinished. Short synthetic key pulses are insufficient evidence of received
input; use explicit held presses and inspect the developer input/move counters.

Next simulation gap: remaining shield escape options and move-specific tuning. Air-dodge
motion parameters remain provisional; passing protection tests does not prove
motion fidelity. Continue the animation pipeline and two-client work already
listed above; the overall goal remains unfinished.

## Moving blaster checkpoint

56/56 headless tests pass with zero warnings/errors after replacing the instant
blaster range check with traveling shots. Focused cases cover travel delay,
contact, missed-shot lifetime, Fox versus Falco hit response and intangibility;
simultaneous-attack checks remain green. The adapter renders a short red/blue
beam from each active projectile's simulation position and clears visuals when
the match ends or fighters are replaced. Projectile speed, shape, damage and
stun remain prototype tuning recorded in wc3-melee:PHYSICS.md.

Build 210040 loaded in 22.448 seconds with the same Warcraft process. The
native-key probe entered character → stage → match, fired U, displayed a red
shot, and the subsequent frame showed Falco at 3%. Evidence:
~/code/wc3-melee/worktrees/test-loop/build/projectile-probe/flight.png and
~/code/wc3-melee/worktrees/test-loop/build/projectile-probe/after-flight.png.
The screenshot catches emission, not a measured in-client trajectory; headless
tests establish travel delay. The beam art remains provisional. The map build
still reports the two known SettingsUI array-initialization warnings.

## Authored jab and camera lock

The first Archer jab is exported from Blender and integrated through Wurst
object definitions and map packaging. The native client recording shows N
starting it; it needs stronger visible motion before treating its art as
finished. See wc3-melee:ANIMATIONS.md for asset generation, tool repairs and
remaining clip work.

The owner requires a fixed arena camera. Every presentation tick now restores
position, angle, rotation, distance, height offset, roll and field of view.
Gameplay keys remain enabled. The in-client scroll-wheel/Page Up probe kept
the same arena framing and subsequently entered a match with normal attack
inputs. Evidence: ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/camera-before.png
and ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/camera-after.png.
Build 212201 was used for this check. An earlier instance stalled at "Waiting
for host"; creating the map again in the retained single-player client cleared
the immediate blockage. Its cause is unresolved and should be investigated if
the normal restart path repeats it.

## Shield rolls and spot dodge

Ground dodges now share the tested simulation. Hold shield and freshly press
left/right to roll, or down to dodge in place. Direction edges are collected
until the frame boundary; the order of shield/direction callbacks within the
frame does not choose the action. Held direction does not repeat a roll.
The headless suite passed 65/65 with zero warnings/errors, covering dodge
timing/protection, recovery, facing, platform retention and input arbitration.
See wc3-melee:PHYSICS.md for provisional parameters and intentional differences.

Build 214039 loaded in 23.153 seconds with the same Warcraft process. Native
input entered the match and started a left roll; the subsequent image showed
x=-368 from x=-240. A fresh-match shield/down probe showed spot dodge at frame
9, x=-240, with the fighter faded during its protection window. Evidence:
~/code/wc3-melee/worktrees/test-loop/build/dodge-probe/roll-left.png,
~/code/wc3-melee/worktrees/test-loop/build/dodge-probe/recovered.png and
~/code/wc3-melee/worktrees/test-loop/build/dodge-probe/spot-fresh.png.
This verifies native controls and displayed state, not frame-perfect engine
timing or multiplayer. Dedicated roll/spot-dodge clips remain unfinished;
the current poses use stock animations. The map build still has the two known
SettingsUI initialization warnings. The earlier host-wait stall did not recur
in this reload or the subsequent same-build restart; its cause remains unknown.

## Ground-dodge animation checkpoint

Archer forward/backward rolls now visibly tumble in the native client. The
adapter selects each clip once at dodge entry, uses its exported duration to
match the simulation clock, and restores ordinary animation after recovery.
The match help text describes shield-plus-direction controls. Headless
simulation was unchanged in this pass; its latest result remains 65/65.

Blender importer ebdb212 repairs lost parent links; its regression proves
hierarchy and evaluated mesh deformation. A packaged MDX roundtrip exposed a
wrong authored rotation axis, corrected in game source commit 7b86515. Imported
MDX filenames now include their content hash so changed assets get a fresh
resource identity while retaining the Warcraft process.

Build 220900 loaded in 23.138 seconds and native recordings showed forward and
backward tumble. Build 221221 loaded in 22.979 seconds after correcting the
spot-dodge pelvis translation to game Z. The spot-dodge cue is still subtle
and needs pose tuning. Evidence and videos:
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/forward-poses.png,
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/backward-poses.png,
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/spot-poses.png,
and the corresponding *-client.mp4 files in that directory.
The client remained running; no multiplayer or exact native frame-alignment
claim follows from these recordings. Remaining authored clips include the
requested tilts, jump/double jump and get-up attack, plus Rifleman's animations.

## Jump-animation checkpoint

Build 222152 loaded in 22.610 seconds with the retained client. The native I
press/release/press sequence showed the ground-jump tuck, a distinct air-jump
somersault, and return to normal animation as the fighter descended and landed.
Recording: ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/jump-client.mp4;
contact sheet: ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/jump-poses.png.

The shared simulation now reports actual takeoff events separately from jump
requests. Two focused additions bring the headless suite to 67/67, zero
warnings/errors: ground events wait for squat completion, successful air jumps
emit a distinct event, exhausted/blocked presses do not emit, and reset clears
the event state. The map build retains the two known SettingsUI warnings.
Clip playback is interrupted by landing, attack, hitstun or air dodge. Native
interruption timing beyond the observed landing remains unmeasured.

Archer jump/double-jump clips are now authored and observed in-game. Remaining
named clips are the forward-tilt variants and get-up attack; Rifleman also
needs authored counterparts. A small detached arrow-like visual remains below
the airborne Archer in the recording; this is a deferred presentation defect,
not evidence of a physics fault. Inspect the asset's arrow attachment/animation
when polishing these clips. Exact Melee feel and multiplayer remain unverified.

## Angled forward tilts

Holding Walk + Left/Right + Attack now selects forward tilt. Add Up or Down
for its angled variant. Up/Down without horizontal input retains the existing
up/down tilt. C-stick smashes still take priority on the same frame. The
command queue accepts the new styles, and headless tests exercise their
selection, timing, damage, vertical coverage, facing and range boundary.
The aggregate suite passed 71/71 with zero compiler warnings/errors.

Archer uses authored level/up/down clips, selected through generated metadata
and scaled to move duration; hitlag pauses playback. Non-attacking animations
now explicitly use normal playback speed rather than inheriting jab timing.
The map build passed with the two existing SettingsUI initialization warnings.
Build 223446 reloaded in 24.074 seconds with the same Warcraft process.
Native recordings show accepted normal styles 6, 9 and 10 through the ordinary
Walk/direction/Attack controls. Distinct strike poses were checked on the
exported MDX roundtrip; differences remain subtle at normal in-game framing.
These are prototype animations and hit shapes, not Melee parity.

Evidence:
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/tilt-reload.log
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/tilt-flat-client.mp4
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/tilt-up-client.mp4
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/tilt-down-client.mp4

The fixed camera remains enforced every presentation tick. Still outstanding:
get-up/knockdown behavior and authored get-up attack, stronger jab/spot/tilt
poses, the detached airborne arrow-like element, and multiplayer timing proof.

## Recovery presentation scenario

For repeatable engine checks of knockdown/get-up, build and reload with:

```bash
WC3_SCENARIO=knockdown /home/tom/code/wc3-melee/worktrees/test-loop/loop.sh reload
```

After choosing the fighter and stage, this developer-only fixture starts the
player airborne in tumble above the platform and keeps the bot stationary.
The normal simulation performs impact and recovery; the fixture only selects
initial conditions and suppresses bot decisions. Fresh Attack/Special requests
get-up attack, Up/Jump/Shield requests stand-up, and Left/Right requests a roll.
The existing readiness file records which scenario was compiled.

Restore ordinary match initial conditions and bot behavior with:

```bash
WC3_SCENARIO=normal /home/tom/code/wc3-melee/worktrees/test-loop/loop.sh reload
```

The scenario defaults to normal; unknown values fail the build. A scenario
presentation check does not prove the organic combat route into knockdown;
that route must also pass the headless hit/landing tests.

Recovery simulation passes 77/77 headless tests with no warnings. The first
native scenario exposed unwanted animation looping: the impact clip returned
to its first upright pose during DOWN_WAIT, and get-up attack repeated. The
owning exporter fix is documented in wc3-melee:ANIMATIONS.md. After regeneration,
build 225738 reloaded in 22.690 seconds with the same Warcraft process. Its
recording shows the held prone pose, one get-up attack, and return upright.
Evidence: ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/getup-attack-client.mp4
and ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/getup-attack-fixed.png.
The two preexisting SettingsUI initialization warnings remain in the map build.

The same native scenario also verified Up → stand-up and Right → get-up roll;
the Archer stayed prone before each input and finished upright. Recordings:
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/getup-stand-client.mp4
and ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/getup-roll-client.mp4.
Normal match behavior was restored by build 225944 in 23.269 seconds; the game
reported `SCENARIO normal` and retained its process. The client is left at
fighter selection. Normal reload evidence:
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/recovery-normal-reload.log.

Knockdown/get-up logic and the first Archer clips are implemented. Floor techs,
face-up/down differences, jab resets, final move tuning, aerial normals,
charged smashes, stronger art and multiplayer timing/desync proof remain open.
The existing detached arrow-like element and two SettingsUI warnings remain
recorded defects. The prototype is not yet the full requested fighter.

## Floor-tech presentation scenario

```bash
WC3_SCENARIO=tech /home/tom/code/wc3-melee/worktrees/test-loop/loop.sh reload
```

Choose the fighter and stage, then tap Shield while falling. Holding Left or
Right at contact selects a directional tech roll; neutral input selects the
in-place tech. The scenario starts in tumble at height 300 with enough hitstun
to isolate the tech input from air dodge, and holds the bot still. Both Shield
bindings feed a fresh-press event; holding a key does not keep opening windows.
The normal match build remains the default and is restored with
`WC3_SCENARIO=normal /home/tom/code/wc3-melee/worktrees/test-loop/loop.sh reload`.

Tech presentation initially reuses Archer's get-up and roll clips at the tech
recovery durations. Dedicated tech impact art and Rifleman recovery clips are
still unfinished. This fixture checks controls/presentation; headless tests
own input-window, lockout and recovery boundary claims.

Floor-tech integration passes 87/87 headless tests with zero warnings/errors.
The final regression first failed because the grabbed-state early return
skipped digital shield input and timer aging; tech timing now runs before that
state return. Falco projectile hitstun also correctly cancels vulnerable
recovery. Both fixes remain in the shared simulation.

In native build 230834, neutral Shield before impact displayed "Tech!" and
completed the in-place recovery. Right + Shield displayed "Tech roll!", moved
the fighter from x=-240 to x=-112, and returned to ordinary movement. The
persistent client loaded that scenario in 22.793 seconds. Evidence:
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/tech-reload.log
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/tech-neutral-client.mp4
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/tech-roll-client.mp4
- ~/code/wc3-melee/worktrees/test-loop/build/wurst-tests/tech-final.log

Those recordings validate the ordinary bound-key path and presentation in the
fixture. Boundary timing is proven by Wurst tests, not real-time input sleeps.
Dedicated tech art, exact character-specific roll movement, wall/ceiling techs,
SDI/ASDI, aerial normals, charged smashes, and multiplayer proof remain open.

Restored normal match build 231056 in 23.330 seconds without restarting the
Warcraft process. The game readiness marker reports `SCENARIO normal`.
Evidence: ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/tech-normal-reload.log.

## Aerial attack controls

Attack inputs stay queued until the simulation step. After movement resolves
takeoff or landing, the same command selects a ground normal or an aerial:
neutral Attack gives neutral air; horizontal input gives forward/back air
relative to the fighter's facing; Up/Down gives up/down air. C-stick directions
use the same airborne selection. Walk changes ground normals to tilts but does
not introduce an airborne tilt category. Grab remains grounded; blaster retains
its ground/air recovery difference.

Air drift preserves facing, so reversing direction can produce back air.
Landing cancels an unfinished aerial into move-specific landing recovery.
The initial aerials use stock attack animation and a move-name notice; distinct
authored clips, character-specific tuning, multi-hit moves, and autocancel windows
remain unfinished. See wc3-melee:PHYSICS.md for current tuning.

The integrated suite passes 95/95 tests with zero compiler warnings/errors.
It covers airborne move selection, back-air facing during reverse drift, and
attack selection on takeoff/landing frames alongside the existing mechanics.
Native build 232215 loaded in 23.603 seconds with the same Warcraft process.
Jump + Left + Attack displayed "Back air!", with move 14 at frame 14 and
height 183; the Archer retained its right-facing orientation. The stock attack
clip still points forward, so this proves input selection and retained facing,
not finished back-air art. The later snapshot shows the fighter back at stage
height while fighting the bot; exact landing recovery is covered headlessly.
Evidence:
- ~/code/wc3-melee/worktrees/test-loop/build/wurst-tests/aerial-integration.log
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/aerial-reload.log
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/aerial-back-client.mp4
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/aerial-back-active.png

## L-cancel integration

Fresh Shield or Grab shortly before an aerial landing halves its landing
recovery, rounded down. Holding a key does not refresh the window. The same
Shield press still feeds tech and air-dodge intent, with state eligibility
decided by the simulation. A successful cancel displays "L-cancel!".

The full suite passes 99/99 tests with zero compiler warnings/errors. Coverage
includes last-valid/first-expired contact, held Shield expiry, hitlag retention,
all five recovery reductions, action lockout, tech-lockout independence,
unaffected empty/air-dodge landings, and stock/reset clearing. Details and
remaining reference uncertainty are in wc3-melee:PHYSICS.md.

Build 232706 reloaded in 23.661 seconds with the Warcraft process retained.
The native back-air → Shield → landing sequence displayed "L-cancel!". The
first probe pressed Shield after contact; video established that timing miss,
and an earlier press succeeded with the same build and unchanged simulation.
The native check proves the binding path and success presentation; Wurst tests
prove recovery counts. Evidence:
- ~/code/wc3-melee/worktrees/test-loop/build/wurst-tests/lcancel-integrated.log
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/lcancel-reload.log
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/lcancel-client.mp4
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/lcancel-landed.png

Autocancel windows, dedicated aerial/landing animation, charged smashes,
DI/SDI/ASDI, character-specific move tuning, and multiplayer proof remain open.

## Charged smash input

Hold Attack with a direction to charge a grounded smash, then release Attack
to strike. Walking still selects tilts; airborne commands still select aerials.
C-stick bindings request an immediate smash even when Attack is held. The
command queue carries charge permission with the selected command, and a
same-frame C-stick smash takes priority over a normal smash independently of
callback order. Expired commands cannot leave charge permission behind.

The simulation reads held Attack at the frame boundary. Charge pauses the
attack clock; the renderer freezes its current pose and shows a release prompt.
The initial charge checkpoint and existing smash animation are provisional.
See wc3-melee:PHYSICS.md for the damage curve and timing rules.

The full suite passes 107/107 tests with zero compiler warnings/errors.
Native build 234005 reloaded in 23.218 seconds with the client process retained.
Holding Up + Attack displayed the charge prompt and held up-smash at frame 7.
The shorter release probe resumed that same attack at frame 10 before a later
bot hit interrupted recovery. The first, longer probe was interrupted while
charging; recording the second probe without an in-input screenshot preserved
the release observation. Damage scaling, cap, C-stick priority, interruption,
and simultaneous charged trades are verified headlessly; native evidence covers
the binding path, held pose/prompt, and released attack-clock progression.
Evidence:
- ~/code/wc3-melee/worktrees/test-loop/build/wurst-tests/smash-integrated.log
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/smash-reload.log
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/smash-held.png
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/smash-client.mp4
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/smash-release-observed.png

## Air-dodge motion and landing recovery

Air dodge now clears prior launch momentum and applies decay before displacement
on both axes. Both fighters receive 10 landing-recovery ticks, sourced from their
Melee air-dodge landing tables. The suite passes 133/133 with no errors/warnings.
Speed 8, decay 0.9 and the 26-tick motion duration remain provisional.

Native build 005245 reloaded in 23.364 seconds with the Warcraft process retained.
The first probe was interrupted by the bot before dodging. Moving the jump to
the match-start input sequence allowed an uninterrupted dodge: trace ticks
20–45 show equal horizontal/vertical displacement through all 26 motion ticks;
contact at tick 59 starts landing recovery at 10, reaching zero at tick 69.
The dodge began around height 188 and horizontal motion stopped before landing,
so this proves diagonal motion and recovery, not a low-height wavedash slide.
Headless tests cover retained landing momentum/traction; low-height native feel
and multiplayer timing remain unverified. The camera lock still runs every tick.

Evidence:
- ~/code/wc3-melee/worktrees/test-loop/build/wurst-tests/air-dodge-motion.log
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/wavedash-reload.log
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/wavedash-motion-trace.txt
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/wavedash-client.mp4

## Native ground-slide follow-up

Native ground-slide follow-up (build 005245): a short-hop release and downward
air dodge on descent landed at tick 31, x=-276.533. With directional keys already
released, grounded traction advanced x to -277.650, -278.288, then -278.446;
recovery reached zero at tick 41. This establishes retained landing momentum
and ten-tick recovery through the real input adapter. The 1.913-world-unit slide
is small; the dodge speed remains provisional and this is not Melee-distance
or immediate post-jumpsquat wavedash parity.

Early-dodge attempts exposed the existing roughly 100 ms key-event batching:
jump and shield could arrive together or the dodge could arrive after the
fighter was too high for the current dodge distance. No buffer or physics
adjustment was made to hide that limitation. The successful case used a short
hop followed by a descending dodge. Immediate wavedash feel remains open.

From the default character menu with N confirm, I jump, S/D left/down and
A shield, run wc3-melee:tools/probe-ground-slide.sh. It records the client,
exports the F7 trace and checks for ground displacement during exactly ten
recovery ticks. A failed probe is not a simulation verdict: inspect the input
trace to distinguish timing, bindings or interruption. Evidence:
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/ground-slide-speed8-trace.txt
and ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/ground-slide-speed8.mp4.

## Playable dodge-distance tuning

Speed 18 world units per frame replaces the initial value 8 as independently
chosen prototype tuning. The local reference identifies data-loaded force and
decay parameters but does not establish their numbers. This change adds no
input buffer and leaves the sourced jump values and ten-frame recovery intact.
A regression starts on the ground, advances six jump ticks, then dodges down
diagonally: it failed to land during dodge motion at speed 8 and passes at 18
for both characters, both jump heights, and both directions. The full suite
passes 134/134 with zero errors/warnings.

Build 010423 reloaded in 24.142 seconds with the Warcraft process retained.
wc3-melee:tools/probe-ground-slide.sh early delivered short-hop press/release
at trace tick 0, dodge at tick 12 (0.200 seconds), and landed at tick 21,
x=-305.241. With directions released before landing, x advanced to -333.630
when recovery reached zero at tick 31: 28.389 world units of ground slide.
This verifies useful landing momentum through actual controls, including a
dodge press/release delivered together. It does not prove immediate first-airborne
wavedashing, analog angles, exact Melee distance, or multiplayer timing.

Evidence:
- ~/code/wc3-melee/worktrees/test-loop/build/wurst-tests/air-dodge-speed-before.log
- ~/code/wc3-melee/worktrees/test-loop/build/wurst-tests/air-dodge-speed-after.log
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/wavedash-speed-reload.log
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/ground-slide-speed18-trace.txt
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/ground-slide-speed18.mp4

## Downward attacks on platforms

The platform-input regression first failed: Down + Attack dropped through an
upper platform before the downward normal could be selected. Match stepping now
passes current queued-attack intent into movement, preventing that drop. The
ordinary action-recovery gate also prevents dropping during attack startup,
charge, or recovery. Down alone still drops, including when the attack queue
is empty or its command is expired or scheduled for a future frame.

The full suite passes 109/109 tests with zero compiler warnings/errors.
Build 234557 reloaded in 23.590 seconds in the retained client. In Three Bridges,
the Archer jumped onto the left upper platform and Down + Attack started
down-smash (move 3, frame 5) at height 170. The first native probe short-hopped
and never reached the platform; holding Jump longer established the intended
setup. Evidence:
- ~/code/wc3-melee/worktrees/test-loop/build/wurst-tests/platform-attack-before.log
- ~/code/wc3-melee/worktrees/test-loop/build/wurst-tests/platform-integrated.log
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/platform-reload.log
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/platform-client.mp4
- ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/platform-down-smash.png

## Two-player adapter and native lobby configuration (2026-09-30)

Both human slots now share the tested key-state/pulse sampling path, with
per-player saved controls, character readiness, rematch readiness, and Player 1
stage selection. An absent second human retains the computer opponent; a leaving
second player hands over to it. The combined headless suite passed 143/143.

The build now uses Wurst's native map pipeline for lobby metadata, imports and
objects, then merges the preserved base Lua initialization. The final archive
contains SetPlayers(2). A compiler ordering/cache defect was repaired upstream
and repinned; details are in wc3-melee:WURST.md.

First integrated native reload: build 013707, 34.991 seconds total, 26.228 seconds
from build-start to build-finish, same Warcraft process. The existing solo probe
passed with 10 recovery ticks and a 57.108-world-unit ground slide. This is an
input-timing observation, not a change to the simulation's configured speed.
Native rendering exposed Player 2's panels overlapping Player 1's menu: both
panels now start hidden on every client, before local-owner presentation.

Evidence is under ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/:
two-player-reload.log, two-player-solo-probe.log, and
 two-player-ui-fixed-reload.log. Headless evidence is
~/code/wc3-melee/worktrees/test-loop/build/wurst-tests/two-player-integrated.log.
Two-client synchronization and Player 2's actual local-file restoration remain
unverified. Camera enforcement remains enabled every presentation tick.

The UI-fixed build 013922 reloaded in 36.194 seconds with the client retained.
Observed character menu has no overlapping second-player frames; F1 opens the
controls panel with the existing saved custom bindings, and Escape closes it.
Screenshots: two-player-menu-fixed.png, two-player-settings.png and
two-player-settings-closed.png in the evidence directory above.

## Complete solo match and shield-release jump (2026-09-30)

Build 013922 completed the current two-slot adapter's solo path in the retained
Warcraft client: choose Falco, choose Three Bridges, play, cross the blast zone
until the player's stocks reach zero, and receive Computer wins. Attack then
returned to character select; choosing Archer and Sky Deck started a new match
with both fighters at three stocks. Native input sequence was F, N, F, N,
hold S through stock losses, release S, then N, F, N, S, N. This uses the saved
custom bindings and starts at the default character menu. Five-second stock
screenshots and each menu checkpoint are preserved under
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/match-flow/.
This proves the solo result/rematch path, not two-client readiness or sync.

Ground jump now cancels shield-release lag, following the factual transition
in the local reference recorded in wc3-melee:PHYSICS.md. The test releases an
actual held shield, advances to each possible remaining recovery tick, then
checks ordinary squat and takeoff for both fighters. Separate checks retain
stun and action-recovery restrictions. The focused regression failed before
the change; the full suite passed 145/145 afterward, zero warnings/errors.
Evidence: ~/code/wc3-melee/worktrees/test-loop/build/wurst-tests/shield-release-before.log
and ~/code/wc3-melee/worktrees/test-loop/build/wurst-tests/shield-release-after.log.

Build 014842 includes the shield-release fix and reported ready after 35.342
seconds without restarting Warcraft. The build retains the two known SettingsUI
constructor warnings and an unused-import warning. Reload evidence:
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/shield-release-reload.log.
Exact native shield-release cancel timing remains unmeasured; the headless tests
prove the simulation transition at every release-recovery tick.

## Projectile, selection, and jump corrections (2026-09-30)

Player-facing fighter names are Archer and Rifleman. Space remains directional
Up; tap-jump is disabled. Dedicated custom jump keys I and 9 both produced a
native ground jump followed by a double-jump. Reproduce from character select
with wc3-melee:tools/probe-jump-input.sh I or the same command with 9. Trace
records are under ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/jump-input-I/
and ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/jump-input-9/.

The projectile regression covers both fighters and both directions across
1,600 world units, removal on contact, and no repeated damage. The full suite
passed 149/149 after increasing shot lifetime to 60 simulation ticks. Evidence:
~/code/wc3-melee/worktrees/test-loop/build/wurst-tests/projectile-range-after.log.
Headless tests establish collision and lifetime, not visible arrow playback.

Build 062042 loaded the repaired fighter asset and final portrait labels in
36.345 seconds without replacing the Warcraft process. Native mouse checks
selected Rifleman, switched back to Archer, confirmed, selected Three Bridges,
switched to Sky Deck, and started the match. U then fired shots, proving game
hotkeys still work after the frame clicks. The recording shows a moving arrow,
contact with Rifleman, increased damage, and disappearance afterward. Portrait
and stage screenshots and arrow-native.mp4 are under
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/.
The map build retains the known SettingsUI and unused-import warnings.
Two-client synchronization remains unverified.

## Rifleman animation integration (2026-09-30)

Rifleman now consumes its own authored asset and clip metadata through the same
presentation path as Archer. The native map builder verifies both packaged MDX
files against the asset outputs. Gameplay simulation was unchanged by this pass;
its most recent full result remains 149/149.

The first native sequence exercised all requested Rifleman action families,
but exported pose inspection found reversed up/down tilt elevation. The
Rifleman authoring script now corrects that sign. It also explicitly hides the
stock shell/gore meshes in custom clips. A separate native menu observation
found the solo bot card using Player 2's saved choice while spawning the opposite
fighter; the first-player panel now receives the actual solo opponent choice.

The input probe initially exceeded Unix socket path length and failed before
its first key press. Its socket now uses a short process-specific path under
~/code/wc3-melee/worktrees/test-loop/build/. Cleanup terminates a recorder even
when a probe fails during recorder startup. The later native sequence ran to
completion; the final corrected-asset observation follows below.

Final corrected model 6f56de2c8b70c3b18192317024ce69abac54ee3c3832bb2d8f92da55e12c96a3
loaded in build 063805, in 36.384 seconds with the existing Warcraft process.
The native sequence was recorded at
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/rifleman-clips-20260930-063840/clips.mp4.
The corrected-tilts sheet shows distinct strike angles; the stage screenshot
shows Rifleman versus Archer, matching the actual solo matchup. Other native
observations from the same action sequence show recovery, jumps and rolls
returning to ordinary stance without a detached rifle or stray shell/gore mesh.
These checks establish first-pass playback, not exact Melee contact/feel parity.
The current map compilation still reports the known SettingsUI constructor and
unused-import warnings. Two-client timing and remaining combat/art fidelity
remain open; the overall goal is still active.

Normal-play build 063954 was restored afterward and reported ready in 37.284
seconds in the same client. Its ready marker reports SCENARIO normal. Evidence:
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/rifleman-playable-reload.log.

## Shield presentation (2026-09-30)

The HUD now shows each fighter's shield strength, colored green, yellow at 50%
and red at 25%. An active guard displays Warcraft's AntiMagicShell effect;
its size follows shield energy. Release, break, stock loss and fighter removal
clear the owned effect. A transition to zero energy announces the break. This
pass changes presentation only; SHIELD_MAX is exposed for the adapter instead
of duplicating the capacity constant.

The first native check showed the shell below the platform. Reading the installed
model's Stand bounds found its center at approximately Z=-47.6; placement now
compensates for that offset at the current scale. Build 064457 reloaded in
37.003 seconds, retaining the client. In the corrected recording, Archer guards
inside the shell at 71% shield with 0% damage, then reaches shield break with
the notice visible and the depleted resource recovering. The stock effect can
show a brief death burst when destroyed; it no longer grants protection then.

Repeat from default character selection in a normal solo match using
wc3-melee:tools/probe-shield-visual.sh. Evidence is
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/shield-visual.mp4,
shield-raised.png, shield-low.png and shield-released.png in the same directory.
The rendering check is not a new simulation test: the previous 149/149 result
remains the latest full simulation run. Known map compiler warnings remain.

## Shield-break recovery fixture

Run `WC3_SCENARIO=shield-break ~/code/wc3-melee/worktrees/test-loop/loop.sh reload`,
then `~/code/wc3-melee/worktrees/test-loop/tools/probe-shield-break.sh idle`
from default character selection. The fixture gives Player 1 one shield point
and holds the bot still; a normal shield press triggers the real break logic.
The probe records launch, recovery, dizzy and released screenshots plus phase
transitions in ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/shield-break-idle/.
Reload the fixture before running the `mash` variant. Both variants must observe
air, landing, stand-up, dizzy and release; compare their dizzy-to-release tick
counts to check the ordinary bound-key input path. Trace duration is ten seconds
in this fixture and remains five seconds otherwise.

Both players queue fresh logical action presses at the simulation boundary,
at most once per tick. Key repeat and a second binding for an already held action
do not create mash presses. Simulation owns recovery and interruption; authored
knockdown/stand-up clips and the overhead dizzy effect only display its state.
Restore normal gameplay with `~/code/wc3-melee/worktrees/test-loop/loop.sh reload`.

The shield-break simulation passes 8/8 focused tests and 156/156 full tests,
with no compiler errors or warnings. Integrated build 065513 reloaded in
36.323 seconds without replacing the Warcraft process. Its ordinary Shield
key path reached AIR at trace tick 19, LAND at 54, STAND at 66, DIZZY at 96,
and NONE at 336: exactly 240 dizzy ticks at zero damage. Screenshots show
Archer above the platform after the pop and the overhead dizzy rings after
standing, with shield restored to 50% (30 of 60). Native map compilation
retains the existing SettingsUI and unused-import warnings. This single-client
check does not establish multiplayer synchronization or exact Melee tuning.

The keyboard mash check on build 065617 reached DIZZY at tick 96 and NONE
at 330 (234 ticks). Two fresh N presses arrived at ticks 312 and 324 while
dizzy: six ticks saved, exactly three per press. Both press/release pairs
arrived within one game callback batch and still produced their single queued
edge. Later presses arrived after recovery and were ordinary attacks. Screenshot
captures precede the mash loop; most of its 20 requested presses arrived late. This
is evidence for the two delivered recovery presses, not for 20 mash events.
The trace and screenshots are in
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/shield-break-mash/.

## Human direct-attack scheduling (2026-09-30)

Player 2's keyboard-triggered special, grab and C-stick attacks targeted the
already completed simulation frame. The next game tick incremented the frame
before consumption, so the zero-grace command buffer discarded those commands.
Player 1 correctly targeted the following frame; normal attacks used a separate
queued flag and were not affected. Both human slots now call the same
queueHumanAttack function. Bot decisions made inside the current simulation
tick continue to target that tick. No grace window was enlarged.

The MatchStep regression first reproduced the old routing (Player 2 attack
serial stayed zero while Player 1 advanced), then passed with the shared
next-frame schedule. It covers all five direct styles, matching attack frames
and no repeat consumption. Full suite: 157/157, zero errors/warnings. Logs:
~/code/wc3-melee/worktrees/test-loop/build/wurst-tests/human-direct-before.log
and ~/code/wc3-melee/worktrees/test-loop/build/wurst-tests/human-direct-after.log.
This proves the common queue/step behavior, not delivery across two clients.

## Selection artwork and ledge integration (2026-09-30)

The selection menu now packages ten authored textures: backdrop, metallic roster
and player frames, action/stage art, and rendered Archer/Rifleman portraits and
tiles. Regenerate framing with wc3-melee:tools/selection/build-art.sh and fighter
portraits with wc3-melee:tools/animations/build-portraits.sh. The build checks
that every imported texture matches its input. Selection uses Wurst Framehandle
and ClosureFrames, including click focus release and fullscreen backdrop sizing.
Returning from stage select explicitly restores the fighter tile textures.

Build 072855 rendered all art in the existing client and reached its ready marker
in 23.3 seconds. Evidence lives in
~/code/wc3-melee/worktrees/test-loop/build/loop/20260930-072854-reload/ready.png.
This screenshot exposed left-aligned nameplates; source now centers/repositions
them and extends the background to fullscreen. Those last layout changes compile
but still need a native visual check. This is a closer two-fighter adaptation,
not a verified high-fidelity replica of the supplied reference.

Ledge simulation is integrated with fresh Up/Down edges, jump/shield/attack
options, state tracing, and provisional reused animation clips. The full suite
passes 169/169 with no errors or warnings. The native fixture is
WC3_SCENARIO=ledge with wc3-melee:tools/probe-ledge.sh climb (or jump, roll,
attack, drop). Start the probe at character select. Dedicated hang/climb
animation art remains unfinished.

The native probe did NOT pass: Warcraft displayed "Waiting for host" before
the menu accepted input, and no new trace was written. Evidence is in
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/ledge-climb/.
Disconnecting returned the retained client to Battle.net sign-in. The cause
of the recurring host-wait is unresolved; a ready marker alone does not prove
the session continues accepting input. Next native work must restore a usable
session, validate fighter clicks, stage/back texture restoration and controls
focus, then observe the ledge fixture. Do not infer two-client synchronization
from the headless tests or this rendering check.

### Native follow-up

Reopening the existing Steam Battle.net shortcut restored a signed-in launcher
without credential entry. Launched Warcraft through Play, created the map in
Single Player, and loaded selection-normal. The old client was gone; this new
session is PID 3986327. The cause of the old host-wait remains unresolved.

Mouse clicks selected Rifleman and Archer and updated both player cards.
Controls opened by mouse; Escape closed it and N then confirmed the fighter.
Mouse Back from stage select restored both character tile images. Mouse
confirmation and Three Bridges selection reached a match; I jump input put
Archer airborne at z=59. The corrected nameplates render inside their borders.
Screenshots are in
~/code/wc3-melee/worktrees/test-loop/build/selection-assets/:
mouse-rifleman.png, back-restored.png, mouse-stage.png, and playable.png.
The narrow stage description clipped, so its text now names only the platform
layout. The backdrop still leaves scene strips at the sides on this client;
calling the stdlib fullscreen helper did not remove them. That presentation
issue and reference fidelity remain open.

Ledge fixture build 074203 reloaded in 22.437 seconds with the same game PID.
The climb probe passed: catch at tick 3, (-642,-60); climb entered at tick 73;
ordinary grounded state at tick 98, (-576,0). Its trace and hang/option captures
are in ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/ledge-climb/.
Those files now contain the successful follow-up; the earlier host-wait image
remains at ~/code/wc3-melee/worktrees/test-loop/build/selection-assets/current.png.
Only catch/climb was checked natively in this pass; the other options have
headless coverage. Dedicated hanging/climbing animation work remains necessary.

## Fullscreen selection and developer-key collision (2026-09-30)

The selection backdrop's parent was GAME_UI, which constrained its visible
horizontal extent to the central 4:3 area. The client reported 2880x1920 both
at initialization and readiness, ruling out missing viewport dimensions.
WORLD_UI anchoring alone did not expand a GAME_UI child. Creating the backdrop
under CONSOLE_UI and calling setFullscreenReference() rendered across the full
screen; measured backdrop width was 0.900. Evidence:
~/code/wc3-melee/worktrees/test-loop/build/selection-assets/parent-result.png.
Temporary frame/viewport probes were removed after that result. Developer text
is now hidden during selection and settings so it does not overlap buttons.

Sky Deck and Three Bridges now have separate authored previews: one wide
platform versus the wide platform plus two equal-height upper platforms.
The generator and exact import list package both; the old shared preview is
removed. Native evidence:
~/code/wc3-melee/worktrees/test-loop/build/selection-assets/new-stage-previews.png.

F6 conflicted with Warcraft's native quick-save. During the old restart runs,
the game's Logs/selection.log recorded four "Saving Game: DispatchSaveGame()"
entries, preserved at
~/code/wc3-melee/worktrees/test-loop/build/selection-assets/native-save-before.log.
A host-wait recurred before build 074844 loaded. This establishes a competing
native save action and a plausible explanation for the intermittent restart
failure, not a proof that every historical host-wait had that cause.

Developer restart now uses Ctrl+R, tracing Ctrl+T, through distinct Player 0
meta=2 key events. The restart handler permits one request per map instance;
the old F6/F7 custom handlers are absent. The loop, focused probes and current
instructions use the new chords. Historical F6/F7 measurements above describe
the old driver. A first native-menu restart installed the changed handler.

Ctrl+R build 080119 completed in 22.823 seconds and retained PID 3986327. The
native save log remained at four entries. Ctrl+T then produced a fresh trace
and wc3-melee:tools/probe-jump-input.sh I passed both ground- and double-jump
assertions. Evidence: ~/code/wc3-melee/worktrees/test-loop/build/selection-assets/ctrl-reload-one.log
and ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/jump-input-I/trace.txt.
Headless tests remain 169/169; map compilation retains the three known warnings.
The second warm Ctrl+R reload reached normal build 080229 in 21.989 seconds,
again retaining the PID and four-entry save log. The client is left on that
normal build. These two passes show the new shortcut avoids the observed save
collision; they do not establish an unlimited-session reliability guarantee.

Build 070118 compiled and deployed with the three existing map warnings.
Automatic restart correctly stopped after focus changed; direct F6 followed
by Enter at the observed loading prompt completed the restart without another
build. The retained client reported BUILD 070118 / SCENARIO normal in its ready
marker. No two-client input test was performed in this pass.
## Selection chips and portrait proportions (2026-09-30)

wc3-melee:wurst/SelectionUI.wurst now places circular red P1 and blue P2 or
gray CPU chips over the selected roster portraits. Slots use separate offsets
so a shared character choice can display both chips. Decorative frames are
disabled to preserve mouse selection. Chips hide for stage selection and the
controls overlay. Artwork is owned by
wc3-melee:tools/selection/art/SelectionChip.svg and imported by the map build.

Roster portraits now use square frames. Full portraits are packaged at 768×1024
to match the tall cards, using the existing Blender renders without rerendering.
Both fighter definitions set selection scale to zero to suppress native overhead
healthbars while retaining the custom damage/stocks HUD; in-match confirmation
of this engine behavior remains pending.

Build 080906 compiled with zero errors and the three existing warnings, and
loaded in the retained client in 23.058 seconds. P1/CPU chips and corrected
portrait proportions were visible, but the client then displayed “Waiting for
host.” Chip interaction and healthbar suppression could not be verified.
Evidence: ~/code/wc3-melee/worktrees/test-loop/build/selection-assets/chips-current.png
and ~/code/wc3-melee/worktrees/test-loop/build/selection-assets/chips-reload.log.
This recurrence after Ctrl+R means removing the F6 quick-save collision did
not resolve the host stall. A ready-file receipt proves initialization, not
continued responsiveness; do not report it as a successful interactive test.

## Delayed restart stall and presentation checks (2026-09-30)

The stalled build still accepted native chat input and a mouse click on
Disconnect, but Ctrl+T produced no trace-start receipt. Disconnect reached
Match Results; Back returned to the Single Player map chooser. Recreating the
map recovered selection without restarting PID 3986327.

wc3-melee:loop.sh now requires a fresh build-matched Ctrl+T trace with an end
record after initialization. Build 081736 passed this initial-response check
in 28.157 seconds, then subsequently displayed the host-wait dialog again.
This narrows the defect to a delayed stall after initial input/simulation
progress; it does not fix or establish the cause of the restart failure.
Evidence: ~/code/wc3-melee/worktrees/test-loop/build/selection-assets/responsive-reload.log
and ~/code/wc3-melee/worktrees/test-loop/build/selection-assets/chip-probe-start.png.

A second Disconnect → Back → Create → Start recovered the same client again.
Mouse selection of Rifleman moved P1 to Rifleman and CPU to Archer. Clicking
the CPU chip over Archer then confirming entered a match as Archer, so the
decorative chip did not block its underlying selection button. Both fighters
had no overhead healthbars while Alt was held, with percent/stocks still
visible. Evidence under ~/code/wc3-melee/worktrees/test-loop/build/selection-assets/:
chips-rifleman.png and healthbars-alt.png. The subsequent five-second trace
completed after the idle player had lost the match; it proves continued input
and ticking, not the intended jump. Two-human chips remain untested natively.

The author field is now Tompas, verified directly in packaged war3map.w3i.
The retained client's map browser/loading credit still displayed cached Tom;
refreshing that cached presentation has not been verified.
Returning from results to character selection also left “Computer wins!”
visible above the heading (recovered-selection.png in the same evidence
directory). This nonblocking stale-result notice is recorded for the next UI fix.

## Ledge clips and restart-context experiment (2026-09-30)

Dedicated hang/climb animations are integrated for both fighters; export checks
and the Archer native catch/climb observation are in wc3-melee:ANIMATIONS.md.
The adapter now also hides noticeFrame in both selection phases, fixing the
stale result message's owning visibility condition.

Warcraft's F10 → End Game → Restart Mission path loaded the existing map and
accepted a Ctrl+T trace started 20 seconds after the loading prompt. The trace
completed at 08:31:18, about 25 seconds after entry. Evidence under
~/code/wc3-melee/worktrees/test-loop/build/selection-assets/:
native-restart-time.txt and native-restart-after26s.png. A second native-menu
restart loaded ledge-deferred and completed the catch/climb probe.

An experiment then deferred RestartGame(false) through a zero-second timer,
allowing the synchronized key callback to return first. Build 083601 initialized
and completed its ten-second trace in 32.141 seconds total, but had stalled by
08:36:47. This falsifies that scheduling change as a sufficient repair. The
experimental handler was removed, leaving the previous handler intact; do not
claim the restart defect fixed. Evidence: deferred-reload.log and
deferred-after-trace.png in the same directory. Native-menu success is a bounded
observation, not proof that its path cannot stall.

## Minimal restart isolation (2026-09-30)

wc3-melee:tools/restart-probe/build.sh creates an independent Wurst diagnostic
map using the existing terrain/initialization glue and two-slot configuration,
without fighter assets, UI, camera, or gameplay. The retained client PID3986327
loaded it from Single Player. Direct Ctrl+R/RestartGame(false) observations:

- Plain timer/key probe accepted Ctrl+T at simulation second29 after restart.
- Adding SaveLoadData loaded the existing bindings successfully and accepted
  input at second29; a subsequent restart of that variant accepted input at34.
- Adding all 255 key-down/key-up registrations also accepted input at34.

These samples did not reproduce the delayed host stall; they do not prove the
engine or these dependencies innocent under all conditions. The earliest
unproven boundary now includes the full-map presentation/tick workload and
its interaction with restart. No production restart implementation changed.
The final probe build had zero compiler warnings/errors. Evidence lives under
~/code/wc3-melee/worktrees/test-loop/build/restart-probe/ (bindings30.txt,
bindings-second35.txt, keys35.txt and corresponding screenshots), with the
plain sample screenshot at
~/code/wc3-melee/worktrees/test-loop/build/restart-probe-scripted30.png.
The plain-late.txt copy was taken before confirming a fresh receipt and must
not be interpreted as a later successful input observation.

The full ledge-contact map then restarted through Ctrl+R without starting an
immediate trace. At 35 seconds, the Right key changed selection to Rifleman;
the subsequent ten-second ledge trace and climb completed successfully. This
also limits the earlier suspicion that full-map code alone explains every
restart failure. Two experiment differences remain unresolved: this input
driver holds R for 120ms (wc3-melee:loop.sh uses a much shorter key sequence),
and the standalone probe deployment copied in place while the normal build
atomically replaces the map. Preserve those differences when comparing the
next reproduction; neither is an established cause. Evidence:
~/code/wc3-melee/worktrees/test-loop/build/restart-probe/full-no-trace35.png.

## Ledge contact native acceptance (2026-09-30)

The authored grip now shares the simulation's 24-outward/90-down anchor for
both fighters. Thirteen focused ledge tests pass, both MDX roundtrip contacts
are within 0.001 world units, and the integrated map built with zero errors
and the same three pre-existing warnings. The persistent client verified both
fighters hanging at the left platform lip and climbing in 25 simulation ticks.
Both traces: hang3, climb67, complete92.
Native screenshots/traces are in the character-specific directories described
in wc3-melee:ANIMATIONS.md. The normal map is rebuilt after the fixture check.

## Restart comparison and blast-zone contrast (2026-09-30)

The same retained client remained responsive in four controlled full-map
samples. Each late check changed Archer to Rifleman with Right; screenshots
are under ~/code/wc3-melee/worktrees/test-loop/build/restart-probe/.

| Change from the previous sample | Observation |
| --- | --- |
| Short Ctrl+R sequence used by the loop driver; no rebuild/early trace | Selection changed after 35s (`fast-full35.png`) |
| Atomic replacement with identical map bytes | Selection changed after 35s (`atomic-same35.png`) |
| Rebuild with changed revision; atomic replacement; no early trace | New revision `restart-content-change`; selection changed after 35s (`content-change35.png`) |
| Exact build/reload/early-trace command | Build 091224 completed its trace at 28.627s total, then accepted a selection change after another 30s (`exact-loop-late.png`) |

None reproduced the earlier stall. Key duration, inode replacement, changed
revision and early tracing are therefore not established sufficient causes.
Keep the incident open, capture the next recurrence, and avoid further
unchanged success sampling. The normal warm command remains usable with the
existing documented intermittent limitation; no restart repair is claimed.

The installed Splats/LightningData.slk identifies DRAM's texture as
DrainManaLightning and AFOD's as LightningRed. Both platform and blast lines
previously used DRAM, and the blast boundary appeared blue despite its red
tint setting. Blast lines now select LIGHTNING_FINGER_OF_DEATH while platforms
retain LIGHTNING_DRAIN_MANA. Native build 091621 showed the red/pink KO outline
against blue platforms and entered an active match. Evidence:
~/code/wc3-melee/worktrees/test-loop/build/blast-color-match.png.
Simulation blast thresholds are unchanged.
The final source build 091809 completed build/reload/trace in 27.213s with zero
errors and the three existing warnings. Character selection → Three Bridges
→ match rendered all three blue platforms inside the red/pink boundary:
~/code/wc3-melee/worktrees/test-loop/build/blast-color-three-bridges.png.

## Input frame checkpoint (2026-09-30)

The adapter routes both human direct attacks through queueHumanAttack for
completedFrame + 1. Normal attacks enter that same upcoming simulation frame
from each participant's held input. Both queues are consumed by stepMatch.
A suspected three-event direction-order defect was disproved: the existing
buffer keeps conflicting directions neutral. No gameplay implementation changed.
The added CommandBufferTests regression covers both repeated directions at
each of the three event positions and checks that the next frame is unaffected.

Focused checks passed: CommandBufferTests 9/9 and MatchStepTests 10/10, zero
compiler errors or warnings. Commands are `bash test.sh CommandBufferTests`
and `bash test.sh MatchStepTests` from ~/code/wc3-melee/worktrees/test-loop.
Logs: wc3-melee:build/wurst-tests/command-timing.log and
wc3-melee:build/wurst-tests/match-timing.log. The compiler filter is not a regex:
the attempted combined filter matched zero tests and is not passing evidence.
Deferred tooling issue: the pinned compiler reports success for zero matches;
inspect the executed count until its owning test runner rejects that case.

Two-client proof still requires two actual human slots in the same match,
with both clients observing identical frame-indexed fighter state after inputs
from each participant, including simultaneous attacks and different saved
bindings. Also measure input-to-action delay there; these headless checks
cannot establish network latency, player-two key delivery, or local-file sync.
No client restart or deployment was needed for this simulation-only checkpoint.

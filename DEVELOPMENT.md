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
engine boundary. Blender is installed, but animation authoring remains blocked
on the exporter API issue in wc3-melee:ANIMATIONS.md.

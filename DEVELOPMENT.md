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
The current prototype values and 0.03-second timestep are placeholders, not
verified Melee frame data. Study the factual frame rules in
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

Next required work:

- Move match selection/state/result rules from wc3-melee:wurst/Melee.wurst into
  the simulation, and test character → stage → match → final-stock result.
- Strengthen platform tests: the current below-platform test starts at x=0,
  which is between the upper platforms; make it actually cross one. Test
  short versus full jump, retained wavedash momentum, repeated blast-zone
  updates, respawn and final stock explicitly.
- Check shield minimum-hold/release recovery, air-dodge ending/helpless state,
  and landing recovery against the documented intended rules. Current values
  not backed by sources remain prototype tuning.
- Replace remaining attack/key-event calls into simulation with queued inputs
  applied on the logical frame boundary; avoid timing depending on callback
  ordering. Keep renderer-only animation separate.
- Use focused client checks for shield/air-dodge appearance, animations and
  control feel after those tests. Multiplayer timing remains unverified.

No active delegated runs remain at this checkpoint. The migration worker's
capacity lease was released. The Wurst skill is active in the shared catalog.

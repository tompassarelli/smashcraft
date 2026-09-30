# Smashcraft

An in-development, Melee-inspired platform fighter for Warcraft III, authored
in Wurst. Archer and Rifleman fight on floating stages with jumps, air dodges,
shields, hitstun, knockback, and stocks.

This repository contains source, tests, and asset-authoring tools. Warcraft III
models, textures, base maps, generated maps, and compiler binaries are not
included. Building currently requires the local toolchain and an installed
copy of Warcraft III described below; this is not yet a portable setup.

Authoritative checkout: ~/code/wc3-melee/worktrees/test-loop.
Gameplay is Wurst; the build emits Lua and packages the existing terrain map.

## Development

Run ~/code/wc3-melee/worktrees/test-loop/test.sh for headless simulation tests.
Run ~/code/wc3-melee/worktrees/test-loop/loop.sh reload to compile, deploy and
restart the map in the running Warcraft client. Start that client through the
existing Steam/Battle.net shortcut, not a direct executable launch.

VS Code has default test and build tasks for these commands. The compiler,
stdlib revisions and artifact hash are in wc3-melee:wurst-toolchain.lock.
The compiler jar is a local artifact at
~/code/wc3-melee/worktrees/test-loop/toolchain/wurstscript.jar, Java is at
~/.wurst/wurst-runtime/bin/java. Active compiler source is pinned at
~/code/wurst-compiler/pins/c31f228c4a43dad1bca4d4acc003b1d12a823331; the standard library is pinned at
~/code/wurst-stdlib/pins/4dfc8a0474bd.

The current map provides character and stage selection, two Warcraft fighters,
a bot opponent, floating platforms, blast zones and stocks. Mouse buttons and
W/R + N select a fighter/stage; U goes back. Chips begin visibly in the
active player cards; drag them onto the roster. New Match retains selections.
F1 opens Controls before a match.
Choose QWERTY or Custom, click either key slot to rebind, then Save. Saved
controls load automatically on the next map start. Developer shortcuts are
Ctrl+R to restart the map and Ctrl+T to start an input trace; these chords are
separate from player bindings. F6 and F7 remain reserved from rebinding for
Warcraft's own shortcuts.
In the custom preset: W/R move; I/9 jump; Space aims up;
E fast-falls/drops; Q/8 shield or air-dodge; L grabs; N attacks; U fires a special;
Shield + N or L grabs. C-stick down-air preserves normal aerial momentum.
Attacks can be buffered for six frames, including through jump squat.
Hold ; to walk. N with direction gives a smash, or a tilt while walking.
H/J/M/B are C-stick smashes. Ground blaster has longer recovery than air
blaster. Avoid F5: returning to the menu previously hung
the client; use the persistent map-restart loop while developing.
QWERTY uses 7 for right trigger and 8 for the alternate jump key.

## Current evidence

The headless suites cover simulation, input buffers, bindings, match rules
and the shared match step. The adapter supports two human slots or solo play
against a bot. Both human slots now schedule direct attacks for the next tick;
the regression first reproduced Player 2's discarded commands, then passed.
Two-client synchronization and network latency remain unverified.

Current multiplayer work follows wc3-melee:GOAL.md and
wc3-melee:SMASHCRAFT_NETCODE_PROPOSAL.md. Native input/pose probes and their
observed limitations are recorded in wc3-melee:native-capability-report.md.
Reusable numerical snapshots are implemented and the headless suite passes
214/214; complete adapter replay, fault-injection tests and multiplayer gates
remain open. Gameplay still uses the synchronized-key baseline.

Native checks have covered mouse character/stage selection, saved controls,
jump/double-jump, air dodge/wavedash motion, both fighters' authored action clips,
arrow travel/contact, guarding and shield-break launch/dizzy/mash recovery.
The latest normal-build restoration took 34.517 seconds in the retained client.
Headless tests establish mechanics; these focused native checks do not establish
complete animation polish or exact Melee fidelity. Sourced movement parameters
and provisional combat/recovery tuning are distinguished in wc3-melee:PHYSICS.md.

See wc3-melee:DEVELOPMENT.md for the simulation/engine split,
wc3-melee:PHYSICS.md for sourced values and deliberate differences,
wc3-melee:LOOP.md for launch/reload observations, and wc3-melee:WURST.md for
compiler and UI affordances. Next work is recorded in wc3-melee:DEVELOPMENT.md.

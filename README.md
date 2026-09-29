# Warcraft platform fighter

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
S/F + N select a fighter/stage; U goes back. F1 opens Controls before a match.
Choose QWERTY or Custom, click either key slot to rebind, then Save. Saved
controls load automatically on the next map start.
In the custom preset: S/F move; I/9 jump; Space aims up;
D fast-falls/drops; A/8 shield or air-dodge; L grabs; N attacks; U fires a special;
Hold ; to walk. N with direction gives a smash, or a tilt while walking.
H/J/M/B are C-stick smashes. Ground blaster has longer recovery than air
blaster. F6 reloads the map. Avoid F5: returning to the menu previously hung
the client; use the persistent map-restart loop while developing.
QWERTY uses 7 for right trigger and 8 for the alternate jump key.

## Current evidence

157 headless tests pass across simulation, input buffers, bindings, match rules
and the shared match step. The adapter supports two human slots or solo play
against a bot. Both human slots now schedule direct attacks for the next tick;
the regression first reproduced Player 2's discarded commands, then passed.
Two-client synchronization and network latency remain unverified.

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

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
~/code/wurst-compiler/pins/77f734e27b4d; the standard library is pinned at
~/code/wurst-stdlib/pins/4dfc8a0474bd.

The current map provides character and stage selection, two Warcraft fighters,
a bot opponent, floating platforms, blast zones and stocks. Mouse buttons and
S/F + N select a fighter/stage; U goes back. F1 opens Controls before a match.
Choose QWERTY or Custom, click either key slot to rebind, then Save. Saved
controls load automatically on the next map start.
In the custom preset: S/F move; I/9 jump; Space aims up;
D fast-falls/drops; A/8 shield or air-dodge; L grabs; N attacks; U fires a special;
H/J/M/B perform directional attacks. F6 reloads the map. F5 exit is unverified.
QWERTY uses 7 for right trigger and 8 for the alternate jump key.

## Current evidence

Forty-three headless tests pass across simulation, input buffers, bindings,
match rules and the shared match step. Build 194234 loaded in 23.667 seconds
including build/restart and restored a saved, rebound key in the same client
process. F1, preset selection, rebinding and synchronized startup loading were
observed in Warcraft. Your Custom preset was restored and saved after the test.
The current match has one human and a bot; two-client timing remains unverified.

Air dodge protects frames 4–29 and visibly fades the fighter during that
window. Build 195029 loaded in 23.505 seconds; the client probe captured the
fade and return to normal opacity. Full, short and double-jump apexes now match
the numeric reference in complete trajectory tests for both characters.
Dodge speed/decay still need calibration; custom combat animations are unfinished.

See wc3-melee:DEVELOPMENT.md for the simulation/engine split,
wc3-melee:PHYSICS.md for sourced values and deliberate differences,
wc3-melee:LOOP.md for launch/reload observations, and wc3-melee:WURST.md for
compiler and UI affordances. Next work is recorded in wc3-melee:DEVELOPMENT.md.

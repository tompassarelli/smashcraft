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
~/.wurst/wurst-runtime/bin/java, and library/compiler sources are under
~/code/resources/WurstStdlib2 and ~/code/resources/WurstScript.

The current map provides character and stage selection, two Warcraft fighters,
a bot opponent, floating platforms, blast zones and stocks. Mouse buttons and
S/F + N select a fighter/stage; U goes back. In a match: S/F move; I/9/Space
jump; D fast-falls/drops; A/8 shield; L air-dodges; N attacks; U fires a special;
H/J/M/B perform directional attacks. F6 reloads the map. F5 exit is unverified.

## Current evidence

Nine headless tests passed at the frame-based simulation checkpoint. Warcraft
loaded build 185558 in the existing process in 14.135 seconds including build
and restart. Clicking Falco changed the preview, keyboard confirmation still
worked, and the selected fighter entered a match. These observations do not
prove exact Melee fidelity or multiplayer timing.

See wc3-melee:DEVELOPMENT.md for the simulation/engine split,
wc3-melee:PHYSICS.md for sourced values and deliberate differences,
wc3-melee:LOOP.md for launch/reload observations, and wc3-melee:WURST.md for
compiler and UI affordances. Next work is recorded in wc3-melee:DEVELOPMENT.md.

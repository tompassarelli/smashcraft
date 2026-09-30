# Smashcraft

An in-development, Melee-inspired platform fighter for Warcraft III, authored
in Wurst. Archer and Rifleman fight on floating stages with jumps, air dodges,
shields, hitstun, knockback, and stocks.

**[Download the playable prototype](https://github.com/tompassarelli/smashcraft/releases/download/prototype-2026-09-30/Smashcraft.w3x)**
— [installation, controls, and known limits](https://github.com/tompassarelli/smashcraft/releases/tag/prototype-2026-09-30).
Requires Warcraft III 3.0. Put the map in your Warcraft III Maps folder and
open it from Custom Games. This is an early prototype; two-client multiplayer
verification and Demon Hunter remain unfinished. The release page identifies
which changes are included; newer source changes may not be in that download.

This repository contains source, tests, and asset-authoring tools. Warcraft III
models, textures, base maps, generated maps, and compiler binaries are not
included in the source tree; prebuilt maps are attached to releases.
Building currently requires the local toolchain and an installed
copy of Warcraft III described below; this is not yet a portable setup.

Authoritative checkout: ~/code/wc3-melee/worktrees/test-loop.
Gameplay is Wurst; the build emits Lua and packages the existing terrain map.

## Development

Run ~/code/wc3-melee/worktrees/test-loop/test.sh for headless simulation tests.
Use ~/code/wc3-melee/worktrees/test-loop/build.sh to compile the map. The
Ctrl+R / Restart Mission path currently has an unresolved disconnect; quit
and recreate the custom game instead. Start the client through the
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
Y confirms character/stage selection and chooses the next match after a result;
Y pauses/resumes the active match. A pause freezes combat and match time while
keeping input handling live. Enter is left to Warcraft's chat.
F1 opens Controls before a match.
Choose QWERTY or Custom, click either key slot to rebind, then Save. Saved
controls load automatically on the next map start. Y is reserved for Start/Pause
and cannot be rebound. Ctrl+T starts a developer
input trace. Avoid the currently unreliable Ctrl+R restart shortcut; these chords are
separate from player bindings. F6 and F7 remain reserved from rebinding for
Warcraft's own shortcuts.
In the custom preset: W/R move; I/9 jump; Space aims up;
E fast-falls/drops; Q/8 shield or air-dodge; O grabs; N attacks; U fires a special;
Shield + N or O grabs. C-stick down-air preserves normal aerial momentum.
While holding someone, tap N to pummel or tap a movement/C-stick direction to
throw forward, backward, up or down. Mash action buttons and alternate movement
directions to escape a grab; holding a button does not mash.
Attacks can be buffered for six frames, including through jump squat.
Hold P to walk. N with direction gives a smash, or a tilt while walking.
B (or /) is C-stick left; H is down; J is up; M is right. Ground blaster has longer recovery than air
blaster. Avoid F5: returning to the menu previously hung
the client. Use Warcraft's ordinary Quit Mission and recreate the custom game.
QWERTY uses 7 for right trigger and 8 for the alternate jump key.

Specials use U with movement direction: neutral arrow/bullet, horizontal
multishot/bear, Up for hippogryph/recoil recovery, and Down for Archer
disengage or Rifleman freezing trap. Archer's neutral arrow can be jump
cancelled. Summons and projectile trajectories are numerical simulation state.
The first summon presentation uses Warcraft bear/hippogryph models; dedicated
rider, summon and downward-shot body animations remain unfinished.

## Intentional omissions

### Stale moves and freshness bonuses

Smashcraft deliberately has neither stale-move penalties nor freshness bonuses.
Repeating a move does not reduce its damage or knockback parameters, and using
a different move does not grant a damage bonus.

We consider an attack-history penalty unnecessary inconsistency. Repetitive
play should be punishable because of the game's design: startup and recovery,
spacing, commitment, defensive options, and opponent counterplay. If spamming
a move is too effective, improve those interactions instead of imposing a
hidden penalty for repetition. Move outcomes should remain predictable under
the same combat conditions; victim percent, weight, hit region, and other
explicit mechanics still affect the result.

This is an intentional departure from Melee, not a missing feature to add later.

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

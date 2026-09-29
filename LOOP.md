# Development loop

Working lane: ~/code/wc3-melee/worktrees/test-loop.

## Warm loop

With Melee Prototype already running in Warcraft III:

```bash
~/code/wc3-melee/worktrees/test-loop/loop.sh reload
```

This builds and atomically replaces the installed map, sends F6, waits for the
loading screen's continue prompt, presses Enter, and verifies the new build
number on screen. It records timestamps, the retained game PID, screenshots,
and OCR text under ~/code/wc3-melee/worktrees/test-loop/build/loop/.

Changing desktop focus stops automation before subsequent input. Niri and
Wayland screenshots use logical pixels at scale 1. Avoid X11 mouse coordinates:
they previously disagreed with the visible Wayland cursor. Native `wlrctl`
relative movement and `ydotool` key events have worked on this machine.
Do not reset the pointer by moving it into the top-left corner: that activates
Niri's overview. The Warcraft software cursor has also moved at half the
logical relative distance on this scale-2 display; inspect cursor position
before clicking a new menu. Allow menu slide animations to settle.

## Start a client

Launch the installed Battle.net client through its Steam shortcut:

```bash
steam steam://rungameid/16213922543717842944
```

In Battle.net select Warcraft III and Play. In the game choose Single Player,
Custom Games, Melee Prototype, Create Game, then Start Game. Complete the
loading prompt. Subsequent code tests use the warm loop above and do not
revisit these menus.

The Steam entry uses GE-Proton11-7 and the existing prefix at
~/.local/share/Steam/steamapps/compatdata/3516115571. Do not launch the game
executable directly or start a second competing Proton session in this prefix.
World Editor Test Map preserved injected Lua but reached sign-in; the owner
explicitly retired that testing route.

## Observations

Before Wurst migration, two automatic reloads verified changed revision text
with the same Warcraft process: 12.834 s and 14.970 s total. Build time was
approximately 1.0–1.1 s. These samples are retained under the loop output folder.

The old F5 `EndGame(false)` check timed out with a black screenshot after 45 s.
Returning to the menu is not a verified part of the fast loop. Do not call a
black screen success or terminate the client automatically after a timeout.
Inspect the recorded screenshot and current window/process first.

Wurst build and in-game timings will be recorded only after an actual run.
The map currently needs an initial load before F6 can be used.

## Wurst integration observation (2026-09-29)

The Wurst build 183029 reached its first-tick readiness marker in 12.078 seconds
including compilation and reload, retaining Warcraft PID 2424017. Compiler and
packaging occupied approximately 5.2 seconds. Evidence:
~/code/wc3-melee/worktrees/test-loop/build/loop/20260929-183027-reload.
The character menu and both models rendered on a floating platform. A later
Warcraft default Victory modal blocked menu interaction; first-tick readiness
is therefore not sufficient evidence for a playable match. Remove the base
map's default melee victory rules before repeating the menu-to-match check.

The reload driver explicitly requests WC3_DEPLOY_MAP=1. Standalone builds leave
the live map alone; reload builds atomically replace it before F6.

The base initialization fix was then validated with build 183334: reload took
11.269 seconds, the default victory dialog stayed absent, and input advanced
character select → stage select → match. Selecting Three Bridges rendered its
two upper platforms. A subsequent screenshot showed combat damage and an
airborne fighter; because the bot attacked during input, that screenshot alone
does not isolate jump physics. The custom final-stock result screen also ran.
Screenshots: ~/code/wc3-melee/worktrees/test-loop/build/engine-check-183334.
Use ydotool for gameplay keys; wtype did not reliably trigger map input here.

## Saved controls checkpoint (2026-09-29)

Build 194234 completed build → F6 restart → synchronized settings ready in
23.667 seconds (build finished at 16.006 seconds). The Warcraft process stayed
running. A saved second grab binding K appeared alongside L after restart;
the readiness file contained the exact restored binding encoding. Evidence:
~/code/wc3-melee/worktrees/test-loop/build/controls-probe/restored.png and
~/code/wc3-melee/worktrees/test-loop/build/controls-probe/restored-ready.txt.
Custom defaults were restored and saved after the probe.

The readiness marker now waits for the initial synchronized binding load.
Keyboard registration uses Warcraft virtual key codes, not the Lua backend's
generic handle-identity indices. During that adapter defect, the built-in
F10 → End Game → Restart Mission menu successfully loaded the corrected map
without exiting Warcraft. The normal F6 path then passed again.

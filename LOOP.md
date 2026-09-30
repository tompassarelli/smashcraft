# Development loop

Working lane: ~/code/wc3-melee/worktrees/test-loop.

The current playable output and installed entry are `Smashcraft.w3x`. The old
`Melee_Prototype.w3x` was moved out of the map browser into the ignored
wc3-melee:build/map-backups directory after the renamed build was verified.
The base fixture remains `Melee_Prototype_Base.w3m` and is still the build input.
An already-running old-path session must return to the chooser and select
Smashcraft before the normal restart loop can use this new filename.

The September 30 `dive-dodge-cues` build passed compilation (four existing
warnings), packaging and installed-byte comparison. Ending the prior
`impact-cues-ui` session with the existing F5 handler reproduced the black
return-to-menu screen, still black after Escape. Warcraft was left open.
Screenshots are wc3-melee:build/impact-assets/checkpoint-menu-later.png and
wc3-melee:build/impact-assets/client-input.png. Native checks of the new build
remain pending; packaging success is not a successful launch.

## Warm loop

With Smashcraft already running in Warcraft III:

```bash
~/code/wc3-melee/worktrees/test-loop/loop.sh reload
```

This builds and atomically replaces the installed map, sends Ctrl+R, waits for the
loading screen's continue prompt, presses Enter, and waits for the new build's
initialization receipt. It then sends Ctrl+T and requires a fresh, complete
simulation trace bearing that build ID. Initialization alone does not prove
the map is responsive: a host stall has occurred after that receipt. The trace
adds five seconds for a normal map and ten for the shield-break/ledge fixtures.
It records timestamps, the retained game PID, screenshots, and trace/OCR text
under ~/code/wc3-melee/worktrees/test-loop/build/loop/.

Current limitation: build 081736 completed that five-second trace and then
displayed “Waiting for host.” A successful trace establishes initial input and
simulation progress, not sustained restart reliability. The cause remains open.
Clicking Disconnect, then Back on Match Results, returned this stalled session
to the Single Player map chooser without closing Warcraft. Recreating the map
there recovered the selection screen. This is observed manual recovery, not a
fix for the restart defect.

The stall recurred when attempting build 093439 after successfully loading
093053. Ctrl+R timed out with the old readiness marker still present. Native
Disconnect → results Back → Create → Start Game recovered 093439 in the same
client and produced a complete new trace. Failed and recovered evidence are
kept separately under wc3-melee:build/loop/20260930-093439-reload.

The 2026-09-30 comparison in wc3-melee:DEVELOPMENT.md did not reproduce the
stall using short key presses, atomic replacement, changed map revision, or
the exact early-trace loop. That command took 28.627s and still accepted a
selection change after another 30s. These are successful samples, not a root
repair; preserve a future failure before changing the driver speculatively.

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
Custom Games, Smashcraft, Create Game, then Start Game. Complete the
loading prompt. Subsequent code tests use the warm loop above and do not
revisit these menus.

The Steam entry uses GE-Proton11-7 and the existing prefix at
~/.local/share/Steam/steamapps/compatdata/3516115571. Do not launch the game
executable directly or start a second competing Proton session in this prefix.
World Editor Test Map preserved injected Lua but reached sign-in; the owner
explicitly retired that testing route.

## Observations

The historical observations below retain the F6/F7 shortcut labels used at
those dates. Current developer shortcuts are Ctrl+R for map restart and Ctrl+T
for input tracing; `loop.sh` and the focused probes use the current chords.

Before Wurst migration, two automatic reloads verified changed revision text
with the same Warcraft process: 12.834 s and 14.970 s total. Build time was
approximately 1.0–1.1 s. These samples are retained under the loop output folder.

The old F5 `EndGame(false)` check timed out with a black screenshot after 45 s.
Returning to the menu is not a verified part of the fast loop. Do not call a
black screen success or terminate the client automatically after a timeout.
Inspect the recorded screenshot and current window/process first.

Wurst build and in-game timings will be recorded only after an actual run.
The map currently needs an initial load before Ctrl+R can be used. Ctrl+T
starts the native input trace used by focused probes.

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

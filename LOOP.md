# Development loop

Working lane: ~/code/wc3-melee/worktrees/test-loop.

Installed: `ground-recovery-r2`, normal scenario. Build succeeded with the six
existing warnings; wc3-melee:build/ground-recovery-r2-map.log. The latest observed
running receipt still says `space-camera-r1`. Do not use Ctrl+R to load this map.
It includes the prior, still-native-unverified camera-bounds candidate.

Ground/recovery pass: Archer fist jab and directional kicks, dedicated up/down
tilts for both fighters, speed-scaled walk playback, consistent basic-projectile
flinch, and computer recovery through drift/jump/up-special/ledge climb.
The prior Archer damage-only basic-shot behavior is intentionally replaced
with 11-frame flinch; the existing special-arrow damage/launch remains unchanged.
The CPU clamps chase targets inside the stage and prioritizes recovery over
new attack requests. Eight recovery scenarios (both fighters/sides, with/without
a remaining jump) return to the floor without losing a stock in Wurst tests.
SimulationTests 161/161, SpecialMoveTests 13/13, CombatInputTests 6/6 and
BotRecoveryTests 2/2 pass. Native checks remain pending input coordination.
Textured both-side Archer previews confirm the punch is exposed after keeping
the shoulder cloth down; wc3-melee:build/animation-assets/preview-ground-textured.log.

The unfinished grab-link repair was saved to
wc3-melee:build/grab-in-progress.patch and removed from active source before
this build. Resume with `git apply` on that exact patch, then finish projectile
interruption cleanup, invalid-reference snapshot checks, and ownership tests.
Do not treat that parked repair or full grabs/throws as complete.

September 30 damage/Space checkpoint: the running `space-camera-r1` contains
dedicated ground/air/tumble/shield damage clips and zero native animation blend
time. Native recordings show both fighters changing into their recoil pose for
hitlag; the earlier `damage-poses-r1` recording exposed old-pose retention with
default blending. Three DamagePoseTests pass; aerial/package preservation
passes. See wc3-melee:ANIMATIONS.md for evidence and remaining pose checks.

Space causes a captured one-frame camera excursion between normal arena views.
Setting only the quick-camera destination did not fix it. `space-camera-r2`
is built and installed with camera target bounds collapsed to arena center,
but is not yet verified running. The running readiness receipt still names r1.
Evidence: wc3-melee:build/impact-assets/space-before.mp4,
wc3-melee:build/impact-assets/space-glitch-strip.png and
wc3-melee:build/impact-assets/space-after.mp4. The latest build log is
wc3-melee:build/space-camera-r2-map.log. No input binding changed.

Ctrl+R again produced “Waiting for host” after the r1 reload; the owner recreated
the game. Stop using that shortcut for routine checks pending root repair.
wc3-melee:wurst/Melee.wurst still directly calls RestartGame(false), and
wc3-melee:tools/restart-probe retains the minimal reproduction. Prior small
probes did not reproduce the intermittent full-map failure; they are not proof
of reliability. Native input automation is awaiting coordination with the owner
because human actions overlapped the camera recordings and menu navigation.

Previous installed build: `getup-advantage-r1` (normal matches). The focused
knockdown build `getup-advantage-check` verified a Rifleman mirror-match get-up
hit through N: attack starts frame 73, hits frame 89 for 7 damage/39 hitstun,
and the attacker becomes actionable at frame 123 while the victim is knocked
down. This matches the headless 34-tick contact-to-action result. Evidence:
wc3-melee:build/impact-assets/getup-native-trace.txt and
wc3-melee:build/impact-assets/getup-contact.png. The fixture's opponent now
starts in reach; the tech fixture retains its distant opponent. Exact native
Archer and successful-tech advantage checks remain unobserved.

Get-up attack now has move-specific base knockback 75, explicitly provisional;
damage and animation timings are unchanged. Five focused tests and the full
291/291 Wurst suite pass with zero errors/warnings, including both fighters,
both facing directions, successful tech, shield and whiff cases. Logs:
wc3-melee:build/wurst-tests/getup-recovery-tech.log and
wc3-melee:build/wurst-tests/getup-recovery-full.log. Native compilation/package
checks retain six existing warnings; logs wc3-melee:build/getup-advantage-map.log
and wc3-melee:build/getup-advantage-normal-map.log.

The earlier `special-clips-r2` session's readiness receipt and developer display
agreed. Ctrl+R loaded it, and subsequent character/stage selection and two
matches remained responsive. This does not close the intermittent restart defect.

The r2 multishot probe completed Side+U, showed an angled arrow in flight and
8% opponent damage. Its captures did not isolate all three arrows together;
full spread readability remains open. Evidence:
wc3-melee:build/impact-assets/fan-{windup,release,flight,recovery}.png and
wc3-melee:build/impact-assets/fan-trace.txt.

The r2 trap probe completed Down+U's placement from frames 13–32. Retreating
drew the opponent through the trap; the later screenshot shows the opponent
encased in ice, and the final capture shows release and resumed combat.
Evidence: wc3-melee:build/impact-assets/trap-{placement,contact,held,release}.png
and wc3-melee:build/impact-assets/trap-trace.txt. These sparse captures prove
native hold/release presentation, not an exact five-second wall-clock duration.

Dedicated body clips now cover both fighters' four specials, including separate
ground/air Rifleman gunshot recovery. Authoring, packaging and the existing
aerial-preservation check passed; see
wc3-melee:build/animation-assets/check-special-preservation-final.log.
Re-authoring Archer replaces exact-named clips instead of creating duplicates.

Native `171627` controls/traces show Archer's upward recovery and disengage,
Rifleman's recoil recovery, and a running bear contacting the opponent for 6%.
A trap was visible onstage, but its placement was interrupted; full freeze
duration is not established by this session. The Archer riding silhouette is
cluttered and needs mount alignment work. Multishot was interrupted by a KO;
its fan appearance and the exact frame-4 downward rifle pose remain unverified.
Evidence: wc3-melee:build/impact-assets/clips-archer-trace.txt,
wc3-melee:build/impact-assets/clips-rifleman-trace.txt,
wc3-melee:build/impact-assets/clips-bear-trace.txt and matching clips-*.png captures.

Reload `171627` completed initialization and its five-second trace, then showed
“Waiting for host.” Disconnect → Match Results → Create → Start Game restored
responsiveness without relaunching Warcraft. This is recovery, not a restart
defect repair. Evidence: wc3-melee:build/special-clips-reload.log and
wc3-melee:build/loop/20260930-171626-reload. Enter still opens native chat when
advancing to stage select; Escape closes it before N starts the match.

September 30 directional-specials checkpoint: the whole Wurst suite passes
287/287 with zero errors/warnings, including special movement/contact,
projectile direction after the shooter turns, summon interruption, saved
controls and one-frame vertical taps. Log:
wc3-melee:build/wurst-tests/specials-integrated.log.

Native build `specials-uiop` was loaded through Ctrl+R and its readiness receipt
confirmed the new bindings. Visible human/CPU tray chips, both fighter
selections, retained New Match choices, character-to-stage-to-match flow,
neutral-arrow damage and an I jump were observed. Enter still opened native
chat at stage select; Escape closed chat before N started the match. The first
combat probe ran after a loss; the repeated probe began in MATCH. Its short
vertical direction taps exposed a loss of direction before the tick, now fixed
and covered in Wurst tests. Other directional-special visual results were not
established by those captures. Evidence:
wc3-melee:build/impact-assets/specials-live-trace.txt and
wc3-melee:build/impact-assets/special-up.png.

Current defaults: Q shield, W left, E down, R right; U special, I jump, O grab,
P walk/tilts. Saved K1/K2 default bindings migrate only when their new keys
are free; K3 preserves intentional new rebindings. Chips are visible in all
active player/CPU cards at first load. Rematches retain placed choices.

Remaining immediate native work: inspect the corrected Archer final flip,
refine mount alignment and fan readability, then complete grab/hold and damage
presentation and measure hit advantage. The effect pool
build emits two additional conservative array-initialization warnings alongside
the four existing map warnings; the constructor populates both slots before
presentation. Multiplayer pose restoration and two-client behavior remain untested.

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
wc3-melee:build/impact-assets/client-input.png. A subsequent graceful close and
Battle.net relaunch restored the client; the owner navigated it to Character
Select. The ready receipt confirms `freeze-trap-5s`/normal. Screenshot:
wc3-melee:build/impact-assets/freeze-select.png. The minor follow-up
`freeze-trap-5s-r2` preserves Archer's neutral shot when Down is held; it passed
the normal build and is installed, but the running session still has the first
freeze build. Native combat/effect checks remain pending. Relaunch recovered
usability; it did not repair the return-to-menu defect.

September 30 control follow-up: wc3-melee:build/wurst-tests/dair-buffer-rematch.log
passes 270/270 tests. It covers L and Shield+Attack grabs, short horizontal taps,
first-airborne-frame buffered back-air, normal down-air momentum, and retained
character placements across rematches. The test run reported one indentation
warning in the new down-air test; its indentation was subsequently normalized.
The earlier `grab-tap-chips` map compiled and deployed before the down-air,
buffer, rematch, bullet, and revised animation changes. It is not evidence for
those later changes. Their integrated build and native checks remain pending.

Rifleman's projectile now references the installed native GyroCopter missile
instead of lightning. CASC extraction verified that model exists. An optional
offline model preview failed in war3-model's light-chunk parser; this does not
block Warcraft loading its own asset. Native appearance remains to be checked.

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

Live follow-up on `grab-tap-chips`: input trace
wc3-melee:build/impact-assets/grab-live-trace.txt contains Shield+N starting
style 5 at simulation frame 2252 and Shield+L starting style 5 at 2306.
The plain-L request at 2187 is sampled but not applied; the trace lacks enough
state to identify its exact action lock. Other human input overlaps this probe,
so this is dispatch evidence, not an isolated grab-contact acceptance test.
Grab presentation still uses stock attack and its victim hold is rudimentary.
Enter opened native chat while advancing Character Select to Stage Select;
Escape then Attack entered the match. Retaining rematch selections fixes the
ready-state reset but does not yet resolve this native Enter/chat focus issue.

Pending scope: remaining special acceptance checks above, further native
get-up acceptance and dedicated grab/hold and damage presentation. The native
adapter still uses stock "stand hit" reactions; authored grounded/airborne
damage clips and reliable hitlag phase restoration remain required.
Rifleman blue portrait import now selects Blue and extracts TeamColor01, but
the actual render remains white. The importer SD material-layer chain replaces
the underlying team-color image connection; this needs repair in its owning
mdl-exporter4 source before claiming the blue portrait complete.

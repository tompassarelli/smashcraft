# Development loop

Working lane: ~/code/smashcraft/worktrees/test-loop.

## Current checkpoint — Illidan, craftsmanship and physics, 2026-10-01

Illidan's 88 authored clips / 110 exported sequences are bound. Native checks
cover attacks, specials, coordinated throws, movement/defense, damage/hitlag,
all tech/get-up/ledge options, selection and stock/rematch behavior. His model,
combat volumes and fel offsets use scale 0.8. Exact recordings and remaining
limits are in smashcraft:docs/fighter-animation-work.md. The offscreen KO clip is selected but
immediately hidden; multiplayer and every native collision frame are unverified.

The craftsmanship pass corrected second-participant names, consolidated 83
animation selectors and removed unused helpers/repeated assignment. The physics
pass corrected knockback/hitlag math, launch integration, air steering, jump
momentum and sampled Archer/Rifleman roll travel. The suite passes 402/402;
remaining parity gaps are recorded in smashcraft:docs/physics.md.

Normal active-CPU build `illidan-physics-complete` was built, installed and
observed running with Archer/Rifleman movement and combat controls. The native
trace has zero dropped rows. Evidence: smashcraft:build/physics-map.log and
smashcraft:build/physics-native-controls-trace.txt. Public download unchanged.

The entries below are historical checkpoints; their running sessions and
unfinished-work statements describe those checkpoints, not current state.

## Historical checkpoint — Rifleman throw directions, 2026-10-01

Both fighters now have native capture/pummel and all four throw-direction
observations. Rifleman's new forward/back/up recordings and exact release
frames are in smashcraft:docs/fighter-animation-work.md. A turn/grab attempted after overshooting
missed; its separate failed recording is retained. Pair-pose overlap remains
unfinished. Next work should improve coordinated hold/pummel poses rather than
repeat successful throw activation checks.

Running: passive `special-direction-passive-r1`, P1 Rifleman x=284.879,
0%, facing right; passive Archer 29%. Paused with Y after up-throw recording.
Normal `special-direction-r1` restored atomically from
smashcraft:build/special-direction-normal.w3x; installed byte comparison passed.
Public downloadable release unchanged. No recording process or child is live.
The old load-rifleman-passive script stopped in the native lobby this time;
manual Start followed by screen-confirmed selection completed the load. Do not
assume its fixed sleeps establish a loaded match or use Ctrl+R.

## Current checkpoint — Archer throw directions, 2026-10-01

Native O-grab/pummel/back-, up- and down-throw sequences succeed. Together with
the previous forward throw, all four Archer directions have recorded activation,
damage and release. Back crosses behind the holder; up launches vertically;
down produces tumble, floor contact and prone recovery. Evidence and frame
numbers are in smashcraft:docs/fighter-animation-work.md. Hold/pummel overlap remains an art gap.

Running: passive `special-direction-passive-r1`, P1 Archer at x=-105.121,
0%, facing right; passive Rifleman at 37%, prone after down throw. Paused with
Y. Installed normal map remains `special-direction-r1`; no build/install change
this turn. Continue Rifleman's remaining throw directions and pair readability;
no child was admitted and no recording process remains live.

## Current checkpoint — Archer capture and jump path, 2026-10-01

Walking corrected the failed dash approach. Archer Shield+Attack capture,
pummel and forward throw now observed in Warcraft (0% -> 3% -> 10%, released
with 24 hitstun frames). Hold/pummel readability still needs work. Recording
and trace: smashcraft:build/archer-shield-grab-contact.mp4 and
smashcraft:build/archer-shield-grab-contact-trace.txt.

Simultaneous neutral Special+Jump arrives in one native batch and produces only
jump, consistent with the current jump-before-special ordering. It does not
prove shot cancellation. The existing next-frame arrow/jump test now goes
through stepMatch input for both frames; it passes 1/1 with one existing warning:
smashcraft:build/wurst-tests/archer-arrow-jump-frame.log. Native sequential
shot cancellation remains unverified. No gameplay source change or rebuild.

Running passive Archer/Rifleman match remains paused with Y after recording
smashcraft:build/archer-arrow-jump-native.mp4. Normal `special-direction-r1`
remains installed for next launch. Public downloadable release unchanged.

## Current checkpoint — two-fighter native checks, 2026-10-01

Archer/Rifleman specials were exercised in the passive fixture. Observed
damage-only arrow, multishot fan, hippogryph disengage/contact and mounted
ascent; Rifleman shot flinch, running bear/contact, 300-frame ice freeze and
downward-shot ascent. Rifleman Shield+O, pummel and down-throw contact/release
also observed. Pair readability remains incomplete. Archer Shield+Attack
dispatches grab, but the approach overshot; capture/throw remain unverified.
Detailed evidence and limits: smashcraft:docs/fighter-animation-work.md.

Installed for next launch: normal `special-direction-r1`, restored atomically
from smashcraft:build/special-direction-normal.w3x; byte comparison passed.
Running: passive `special-direction-passive-r1`, Archer versus Rifleman,
paused with Y after the grab attempt. Do not use Ctrl+R. Public release remains
unchanged. No source rebuild was needed for these checks; no multiplayer
conclusion follows. Continue with controlled Archer capture/throws and arrow
jump cancellation, then the remaining two-fighter acceptance gaps.

## Special-direction repair — 2026-10-01

Native testing found a shared input defect: a held Down, Special press, and
batched releases could select neutral-special after the movement edge had
already been consumed. Capturing the direction at Special press fixes the
owning input boundary. Both human slots record the captured axes independently
of current movement; bot recovery supplies explicit special axes; frame-input
copies and equality include them. Repeated unconsumed presses cannot rewrite
the first pending special direction.

Native before: smashcraft:build/illidan-immolate-air-trace.txt selects special 9
after batched releases. Native after:
smashcraft:build/special-direction-release-trace.txt receives Special down/up
and Down up at frame 1787, then selects special 12 at frame 1788 despite
neutral movement. Airborne Immolate additionally connects for 9 damage against
the grounded passive opponent; offstage spike motion remains untested.

Source suite: 365/366 passed initially; the added three-character test lacked
the surface required to place Rifleman's trap. After correcting that fixture,
the focused input suite passes 9/9, including the failing case for all three
characters and immutable pending intent. Logs:
smashcraft:build/wurst-tests/special-direction-all.log and
smashcraft:build/wurst-tests/special-direction-input.log.
The actual native test runs in `special-direction-passive-r1`, paused with Y.
Normal `special-direction-r1` is built and installed for the next launch;
byte comparison passed. Build completed with zero errors and six warnings:
smashcraft:build/special-direction-normal-map.log. The currently running map
remains the paused passive scenario. Public downloadable release is unchanged.

## Current checkpoint — 2026-10-01 landing playback

Installed for next launch: normal `illidan-landing-r1`, restored by atomic
replacement from smashcraft:build/illidan-landing-normal.w3x; byte comparison passed.
Currently running: `illidan-landing-passive-r1`, paused with Y after a clean
normal-jump/air-dodge landing recording. Normal contact crouch -> stand and
air-dodge contact crouch -> stand are visible. The trace records respective
landing recovery of 4 and 10 frames, no damage interruptions and no dropped
records. Evidence and remaining limits are in smashcraft:docs/fighter-animation-work.md.

The earlier active-CPU recording was interrupted by damage and desktop focus
change. Its copied smashcraft:build/illidan-landing-trace.txt is stale (previous
passive grab run) and must not be used as evidence for landing.

## Previous checkpoint — landing bindings

Installed and observed running: normal `illidan-landing-r1`, paused with Y in
an Illidan mirror match. Recreated through Quit Mission and normal menus.
Build passed with zero errors and six warnings; installed byte comparison passed.
Evidence: smashcraft:build/illidan-landing-r1-map.log and
smashcraft:build/illidan-landing-match.png.

Illidan now selects the authored Land clip during landing recovery, or Land
Special after the displayed air-dodge/special-fall state. The initial remaining
landing recovery sets playback rate once; subsequent frames and pause/resume
retain that rate. This is presentation-only and changes no simulation timing.
Landing playback in motion remains unverified. The prior normal map backup is
smashcraft:build/illidan-visibility-normal.w3x. Public release remains unchanged.

## Previous checkpoint — native specials/grab

Installed for the next launch: normal `illidan-visibility-r1`, restored atomically
from smashcraft:build/illidan-visibility-normal.w3x. Byte comparison passed;
SHA-256 adfd7fe9dbbcd322941b91bcffe3ed67dc17174847a1a98afb5936a6a5f44fec.
Currently running: `illidan-passive-r1`, paused with Y after native testing.
Do not confuse the running knockdown/passive fixture with the restored file.

Native traces confirm Mana Burn hit (5 damage, 4 hitlag, 13 hitstun), Immolate
activation, parry-step activation/movement, grab capture, pummel and up-throw
release. Recorded victim damage goes 5 -> 8 -> 14 in the grab sequence.
The earlier recording confirms wing appearance/ascent. See the current native
evidence and limits in smashcraft:docs/fighter-animation-work.md. Other throw directions, pair
readability, Immolate hit/spike, parry protection and remaining animation
transitions still need work. No two-client or netcode conclusion follows.
Public release remains unchanged. Do not use Ctrl+R to recreate the match.

## Previous checkpoint

Installed and observed running: `illidan-visibility-r1`. Fixed combat authoring
sampling stale mesh visibility from alternate/death actions instead of binding
each mesh to Stand Ready. Regression failed on old Attack Jab/frame zero and
passes all 81 rebuilt clips; original 24 actions and 17 geosets preserved.
Logs: smashcraft:build/illidan-visibility-before.log,
smashcraft:build/illidan-visibility-after.log, and
smashcraft:build/illidan-visibility-r1-map.log. Full export completed successfully.
Quit Mission -> Back -> Create -> Start loaded the new build in the same client.
Human/CPU Illidan mirror match now shows both normal textured bodies/weapons,
without the prior black silhouette/dark geometry:
smashcraft:build/illidan-native-match-fixed.png. Y pause sent after capture.
Warcraft window 236 / X11 171966465 remain the current client identifiers.
Remaining: complete action transitions and real-controls moveset/replay checks;
this visual regression fix is not full character acceptance. Public map unchanged.

Previously installed and observed running: `illidan-special-vfx-r1`. Build/deploy passed
with six warnings: smashcraft:build/illidan-special-vfx-r1-map.log. Mana Burn
uses Mana Flare missile art; preallocated static Immolate/parry cues follow
active windows. Their actual action playback has not been individually verified.
Native roster/portraits, both chip placements, Y to stage select and Y to start
an Illidan mirror match worked. HUD portraits/names/stock icons render and
combat advances. Evidence: smashcraft:build/illidan-native-mirror.png and
smashcraft:build/illidan-native-match.png.
VISUAL DEFECT (fixed in visibility-r1 above): during that match one fighter is a black silhouette
with large dark surrounding shapes while the other is textured. Model/material
or action visibility cause is not diagnosed. Fix this before release. Match
was paused with Y for inspection; Warcraft window 236, X11 window 171966465.
Do not restart via Ctrl+R. Public release remains unchanged.
Launch input finding: visible Wayland cursor and reported X11 pointer differed.
Setting X11 pointer within the scaled window made Play work. Battle.net window
83886103 was 2848x1840; Play at window-relative 234,1678. Warcraft is 2880x1920,
so screenshot coordinates at 1440x960 map to twice their values. Map polling
needs a held mouse click (~150ms); instantaneous click missed placement.

Previously installed: `illidan-defense-r2`, normal scenario. Includes Illidan selection/HUD,
air dodge, shield raise/hold/release, jump squat, held fall, resting knockdown,
and dedicated ledge roll/attack bindings. Air dodge playback uses the existing
49-frame animation duration; no combat values changed. Build/deploy and asset
byte comparisons passed with six existing warnings:
smashcraft:build/illidan-defense-r2-map.log.
Native verification remains pending: Battle.net window 199 remained on Play
after pointer and virtual mouse launch attempts; no Warcraft process/window
was observed. Evidence: smashcraft:build/illidan-launch-second.png.
Do not retry Ctrl+R. Remaining fighter work includes movement/landing/charge
transitions, special effects and real-control playthrough. Public map unchanged.

Built, not deployed: `illidan-selection-r2`. Illidan now has a third roster
tile, human/CPU chip selection, portraits, stock icons and HUD name. Character
cycling includes all three fighters; stage cycling still has two stages.
Match-rule checks passed 17/17 and chip-drag checks 10/10, including Illidan
mirror matches and retained New Match choices. Map compilation and packaged
model/texture comparisons passed with six existing warnings:
smashcraft:build/illidan-selection-r2-map.log. Tests:
smashcraft:build/illidan-matchrules-tests.log and
smashcraft:build/illidan-chip-tests.log. Remaining Illidan work includes movement
and defense pose mapping, special effects, and real-control Warcraft validation.
The public build below is unchanged; the defense build above supersedes this local build.

Previously installed: `blue-portrait-r1`, normal scenario. Rifleman's regenerated portrait
now has canonical blue hood/armor accents and the complete gun in frame.
The repaired importer produced the inspected image in 328 seconds;
smashcraft:build/selection-assets/Rifleman-blue-r2.log and
smashcraft:build/selection-assets/RiflemanPortrait.png record the result.
Normalized portrait/tile textures passed the existing silhouette-width check.
Build/deploy and packaged-texture byte comparisons passed with six existing
warnings: smashcraft:build/blue-portrait-r1-map.log. Warcraft is not running;
the installed portrait and newer gameplay still need native verification.
Illidan was unavailable in that build. The public prototype release is
unchanged and still contains `rifleman-shot-flinch-r1`.

Previously installed: `recovery-controls-r1`, normal scenario. Combined recovery/jab-reset
timings and poses, Y Start/Pause, ledge jump budget, up-special helpless fall,
jump-squat buffered wavedash, and airborne turnaround shots. Full source suite
passed 339/339 (one unused-import warning):
smashcraft:build/wurst-tests/integrated-turnaround-r1.log. Both fighter animation
packages passed smashcraft:build/animation-assets/fall-special-check.log.
Build/deploy succeeded with six existing warnings:
smashcraft:build/recovery-controls-r1-map.log. Native behavior remains unverified;
the previous Warcraft window 233 is no longer present. The public prototype
release still contains `rifleman-shot-flinch-r1`, not this integration build.

Previously installed: `rifleman-shot-flinch-r1`, normal scenario. Rifleman body impacts
now add four frames of victim-only impact freeze before the existing minimum
11-frame flinch. The neutral-special test checks attack interruption, damage
pose selection, shooter independence and the first actionable jump tick.
Full tests passed 316/316 with zero errors/warnings:
smashcraft:build/wurst-tests/rifleman-shot-flinch-r2.log. Build/deploy succeeded
with six existing warnings: smashcraft:build/rifleman-shot-flinch-r1-map.log.
Native flinch readability in this build remains unverified.

Previously installed: `arrows-damage-only-r1`, normal scenario. Build/deploy succeeded
with six existing warnings; smashcraft:build/arrows-damage-only-r1-map.log.
Archer basic/running and fan arrows now deal damage without adding hitlag,
hitstun, knockback, shieldstun or interruption. Existing reactions and capture
state remain intact. Full source suite passed 315/315 with no errors/warnings:
smashcraft:build/wurst-tests/arrows-damage-only-r2.log. Native arrow behavior
in this build remains unverified.

Latest observed running: `grab-system-r3`, normal scenario, in the fresh
Warcraft client (window 233). Screenshot:
smashcraft:build/impact-assets/current-client.png. This establishes the loaded
build, not successful pummel/throw behavior. The older stuck client was closed;
the fresh client was left running. Automated input is awaiting coordination
with the owner to avoid competing with play.

Recovery/grab reference continuation: local Melee revision remains
0296f009f32f710495979d30772d8332af2d411a; its original-data directory contains
only the placeholder. Public extracted character/action data is available at
https://melee.theshoemaker.de/dat-dumps/Sheik.json. Local inspection cache:
smashcraft:build/ref-Sheik-data.json and
smashcraft:build/ref-Sheik-recovery-extract.jsonl. The extracted animation lengths
are bound 26, down damage 14, stand 30, attack 50, rolls 36. These are raw clip
lengths, not yet certified actionable durations; reconcile indexing and native
animation termination before adopting the owner's 26/13/30/49/35 table.
The export includes protection events and ground/air events. Use factual data
only; do not vendor the dump or decompiled code into Smashcraft.

The owner approved starting throw motions: Archer forward pivot-kick, back
hip toss, up rising palm, down sweep/slam; Rifleman forward stock shove, back
heave, up lift/toss, down pull/slam. Fresh Attack taps must pummel after capture.
Pummels, four committed throws, damage-dependent hold/mash escape and holder/victim
clips are implemented. Wurst gameplay tests pass 312/312, including contact/release
timing, both slots/facings, interruption, input suppression and replay across
contact. Evidence: smashcraft:build/wurst-tests/grab-system-all-r2.log.
The subsequent KO cleanup correction passed GrabTests 12/12, including immediate
release on stock loss during hold and post-throw recovery. Evidence:
smashcraft:build/wurst-tests/grab-stock-cleanup.log. Native grab-system behavior
is not yet verified. On resume, the client changed from the inspected game
menu to an active old-build match during navigation; automated input stopped
to avoid competing with owner play. No restart or new-build launch is claimed.
Reference ftCommon_GrabMash counts at most one eligible-button contribution
plus one remembered-axis-sign change per call; neutral does not clear those
signs. Fighter input maps Z into A/trigger semantics. CaptureWait decrements
the timer and processes mash before release. SmashWiki's Grab page supplies
the six-frame contribution and damage-dependent timer formula; caches are
smashcraft:build/ref-Grab.html and smashcraft:build/ref-Mashing.html. Complete
grab-context input, pummel, throw commitment/release, mash and snapshot state
together. The timer now uses the equal-ranking profile; ranking/handicap
adjustments remain an explicit omission. See smashcraft:docs/physics.md for original
throw tuning and the exact reference scope.

Previously installed: `grab-system-r3`, normal scenario; now observed running
as recorded above, with native grab acceptance still pending.
Evidence: smashcraft:build/grab-system-r3-map.log (six existing warnings).
Archer throw limb targets and shoulder-cloth orientation were corrected after
offline pose inspection. Authored clip exports and side/reverse previews passed;
see smashcraft:build/animation-assets/grab-author-archer-r3.log and
smashcraft:build/animation-assets/grab-preview-r3.log. These gray previews do
not establish in-game materials, pair contact alignment or release readability.

Prior binding change: `cstick-swap-r1`.
Both presets now use B or / for C-stick left and H for C-stick down. The
owner's saved binding file was swapped too, preserving all other slots.
KeyBindingsTests passed 7/7; build/deploy succeeded with the six existing
warnings. Evidence: smashcraft:build/wurst-tests/cstick-swap.log and
smashcraft:build/cstick-swap-r1-map.log. The running session retains its old
bindings until reload. Automated game input is on hold pending coordination
after the screen changed during testing.

Previously observed running: `hit-timing-r1`, normal scenario. Ordinary
Quit Mission → Create Game → Start Game launch succeeded; the readiness
receipt and recorded trace both identify this build.
smashcraft:build/hit-timing-r1-map.log records successful build/deploy. The timing
pass derives normal hitlag from damage with a 20-frame cap, freezes both bodies
on shield contact, keeps detached projectile/summon hits from freezing their
owner, and lets jump/air dodge act on hitstun's expiry tick. The complete Wurst
suite passed 307/307 with zero errors/warnings:
smashcraft:build/wurst-tests/hit-timing-full.log. Earlier failing timing fixtures
are retained in smashcraft:build/wurst-tests/hit-timing-expiry-before.log.
No staling was added; its intentional omission is recorded in smashcraft:README.md.
Electric/crouch modifiers and exact tumble boundary remain open. The attempted
mechanics-worker handoff failed at message delivery; the child was interrupted
without acknowledgement or edits, its capacity lease released, and the parent
continued directly. The delegation incident remains unrepaired.

Native Rifleman Q+O against Archer entered grab (style 5), but did not connect
in this recording: Archer crossed behind the right-facing Rifleman. Do not
count whiffs as a successful hold check. Evidence:
smashcraft:build/impact-assets/grab-rifleman-shield-hit-timing-r1.mp4,
smashcraft:build/impact-assets/grab-rifleman-shield-hit-timing-r1-trace.txt and
smashcraft:build/impact-assets/grab-rifleman-shield-contact-sheet.png.
The same trace records body-contact hitlag of seven simulation ticks at
frames 119–126, 164–171 and 207–214, with hitstun unchanged during each freeze.
Shield reactions also start with seven hitlag ticks; this trace alone does
not establish both bodies' visual freeze or shieldstun expiry ordering.
Next native checks: successful Rifleman hold with the opponent in front,
shield-plus-Attack, reverse facing, and the remaining timing/pose checks.

Previous observed running: `grab-hold-r1`, normal scenario. Fresh launch
through End Game / Quit Mission / Create Game succeeded without Ctrl+R; the
readiness receipt and trace agree. Build log: smashcraft:build/grab-hold-r1-map.log
(six existing warnings). The owner authorized native control; focus guards
still stop input whenever another window is focused.

Grab ownership now tethers both participants and clears on expiry, interruption,
freeze and reset. Snapshots remap both links into detached state. GrabTests 6/6,
SimulationTests 161/161 and ReplayStateTests 6/6 passed; the focused grab tests
also passed after the simultaneous-grab clash correction. Both fighters have
Grab, Grab Hold and Grabbed clips; asset preservation passed.

Native Archer Q+O successfully held Rifleman four times, each for exactly 20
simulation ticks (71–91, 125–145, 179–199, 227–247). The recording shows the
reaching hand and bent victim together. Evidence:
smashcraft:build/impact-assets/grab-archer-shield-r1-trace.txt,
smashcraft:build/impact-assets/grab-archer-shield-r1.mp4 and
smashcraft:build/impact-assets/grab-archer-contact.png. Plain O entered grab
but the earlier attempts whiffed or were interrupted. Rifleman holding,
Q+N, reverse-facing native checks, pummels and throws remain unfinished.

Space camera check: six Space holds/releases were recorded at 60 fps in this
build. All 384 recorded frames retained the central stage surface in the same
image rows; sampled contact sheets also show the stable arena. Evidence:
smashcraft:build/impact-assets/space-grab-hold-r1.mp4 and matching trace.
This did not reproduce the previous one-frame camera excursion. Character to
stage to match and retained selections on New Match worked in this session.

Ground/recovery pass: Archer fist jab and directional kicks, dedicated up/down
tilts for both fighters, speed-scaled walk playback, consistent basic-projectile
flinch, and computer recovery through drift/jump/up-special/ledge climb.
That historical build introduced 11-frame arrow flinch. The owner's later
damage-only correction supersedes it in `arrows-damage-only-r1` above.
The CPU clamps chase targets inside the stage and prioritizes recovery over
new attack requests. Eight recovery scenarios (both fighters/sides, with/without
a remaining jump) return to the floor without losing a stock in Wurst tests.
SimulationTests 161/161, SpecialMoveTests 13/13, CombatInputTests 6/6 and
BotRecoveryTests 2/2 pass. Native ground-attack/recovery checks remain pending.
Textured both-side Archer previews confirm the punch is exposed after keeping
the shoulder cloth down; smashcraft:build/animation-assets/preview-ground-textured.log.

The old smashcraft:build/grab-in-progress.patch has already been applied and
completed in active source; it is stale and must not be reapplied.

September 30 damage/Space checkpoint: the running `space-camera-r1` contains
dedicated ground/air/tumble/shield damage clips and zero native animation blend
time. Native recordings show both fighters changing into their recoil pose for
hitlag; the earlier `damage-poses-r1` recording exposed old-pose retention with
default blending. Three DamagePoseTests pass; aerial/package preservation
passes. See smashcraft:docs/fighter-animation-work.md for evidence and remaining pose checks.

Earlier Space builds caused a captured one-frame camera excursion between normal arena views.
Setting only the quick-camera destination did not fix it. `space-camera-r2`
is built and installed with camera target bounds collapsed to arena center,
and that change is included in the now-running `grab-hold-r1` check above.
Evidence: smashcraft:build/impact-assets/space-before.mp4,
smashcraft:build/impact-assets/space-glitch-strip.png and
smashcraft:build/impact-assets/space-after.mp4. The latest build log is
smashcraft:build/space-camera-r2-map.log. No input binding changed.

Ctrl+R again produced “Waiting for host” after the r1 reload; the owner recreated
the game. Stop using that shortcut for routine checks pending root repair.
smashcraft:wurst/Melee.wurst still directly calls RestartGame(false), and
smashcraft:tools/restart-probe retains the minimal reproduction. Prior small
probes did not reproduce the intermittent full-map failure; they are not proof
of reliability. Input coordination is now authorized; retain focus guards.

Previous installed build: `getup-advantage-r1` (normal matches). The focused
knockdown build `getup-advantage-check` verified a Rifleman mirror-match get-up
hit through N: attack starts frame 73, hits frame 89 for 7 damage/39 hitstun,
and the attacker becomes actionable at frame 123 while the victim is knocked
down. This matches the headless 34-tick contact-to-action result. Evidence:
smashcraft:build/impact-assets/getup-native-trace.txt and
smashcraft:build/impact-assets/getup-contact.png. The fixture's opponent now
starts in reach; the tech fixture retains its distant opponent. Exact native
Archer and successful-tech advantage checks remain unobserved.

Get-up attack now has move-specific base knockback 75, explicitly provisional;
damage and animation timings are unchanged. Five focused tests and the full
291/291 Wurst suite pass with zero errors/warnings, including both fighters,
both facing directions, successful tech, shield and whiff cases. Logs:
smashcraft:build/wurst-tests/getup-recovery-tech.log and
smashcraft:build/wurst-tests/getup-recovery-full.log. Native compilation/package
checks retain six existing warnings; logs smashcraft:build/getup-advantage-map.log
and smashcraft:build/getup-advantage-normal-map.log.

The earlier `special-clips-r2` session's readiness receipt and developer display
agreed. Ctrl+R loaded it, and subsequent character/stage selection and two
matches remained responsive. This does not close the intermittent restart defect.

The r2 multishot probe completed Side+U, showed an angled arrow in flight and
8% opponent damage. Its captures did not isolate all three arrows together;
full spread readability remains open. Evidence:
smashcraft:build/impact-assets/fan-{windup,release,flight,recovery}.png and
smashcraft:build/impact-assets/fan-trace.txt.

The r2 trap probe completed Down+U's placement from frames 13–32. Retreating
drew the opponent through the trap; the later screenshot shows the opponent
encased in ice, and the final capture shows release and resumed combat.
Evidence: smashcraft:build/impact-assets/trap-{placement,contact,held,release}.png
and smashcraft:build/impact-assets/trap-trace.txt. These sparse captures prove
native hold/release presentation, not an exact five-second wall-clock duration.

Dedicated body clips now cover both fighters' four specials, including separate
ground/air Rifleman gunshot recovery. Authoring, packaging and the existing
aerial-preservation check passed; see
smashcraft:build/animation-assets/check-special-preservation-final.log.
Re-authoring Archer replaces exact-named clips instead of creating duplicates.

Native `171627` controls/traces show Archer's upward recovery and disengage,
Rifleman's recoil recovery, and a running bear contacting the opponent for 6%.
A trap was visible onstage, but its placement was interrupted; full freeze
duration is not established by this session. The Archer riding silhouette is
cluttered and needs mount alignment work. Multishot was interrupted by a KO;
its fan appearance and the exact frame-4 downward rifle pose remain unverified.
Evidence: smashcraft:build/impact-assets/clips-archer-trace.txt,
smashcraft:build/impact-assets/clips-rifleman-trace.txt,
smashcraft:build/impact-assets/clips-bear-trace.txt and matching clips-*.png captures.

Reload `171627` completed initialization and its five-second trace, then showed
“Waiting for host.” Disconnect → Match Results → Create → Start Game restored
responsiveness without relaunching Warcraft. This is recovery, not a restart
defect repair. Evidence: smashcraft:build/special-clips-reload.log and
smashcraft:build/loop/20260930-171626-reload. Enter still opens native chat when
advancing to stage select; Escape closes it before N starts the match.

September 30 directional-specials checkpoint: the whole Wurst suite passes
287/287 with zero errors/warnings, including special movement/contact,
projectile direction after the shooter turns, summon interruption, saved
controls and one-frame vertical taps. Log:
smashcraft:build/wurst-tests/specials-integrated.log.

Native build `specials-uiop` was loaded through Ctrl+R and its readiness receipt
confirmed the new bindings. Visible human/CPU tray chips, both fighter
selections, retained New Match choices, character-to-stage-to-match flow,
neutral-arrow damage and an I jump were observed. Enter still opened native
chat at stage select; Escape closed chat before N started the match. The first
combat probe ran after a loss; the repeated probe began in MATCH. Its short
vertical direction taps exposed a loss of direction before the tick, now fixed
and covered in Wurst tests. Other directional-special visual results were not
established by those captures. Evidence:
smashcraft:build/impact-assets/specials-live-trace.txt and
smashcraft:build/impact-assets/special-up.png.

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
smashcraft:build/map-backups directory after the renamed build was verified.
The base fixture remains `Melee_Prototype_Base.w3m` and is still the build input.
An already-running old-path session must return to the chooser and select
Smashcraft before the normal restart loop can use this new filename.

The September 30 `dive-dodge-cues` build passed compilation (four existing
warnings), packaging and installed-byte comparison. Ending the prior
`impact-cues-ui` session with the existing F5 handler reproduced the black
return-to-menu screen, still black after Escape. Warcraft was left open.
Screenshots are smashcraft:build/impact-assets/checkpoint-menu-later.png and
smashcraft:build/impact-assets/client-input.png. A subsequent graceful close and
Battle.net relaunch restored the client; the owner navigated it to Character
Select. The ready receipt confirms `freeze-trap-5s`/normal. Screenshot:
smashcraft:build/impact-assets/freeze-select.png. The minor follow-up
`freeze-trap-5s-r2` preserves Archer's neutral shot when Down is held; it passed
the normal build and is installed, but the running session still has the first
freeze build. Native combat/effect checks remain pending. Relaunch recovered
usability; it did not repair the return-to-menu defect.

September 30 control follow-up: smashcraft:build/wurst-tests/dair-buffer-rematch.log
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
~/code/smashcraft/worktrees/test-loop/loop.sh reload
```

This builds and atomically replaces the installed map, sends Ctrl+R, waits for the
loading screen's continue prompt, presses Enter, and waits for the new build's
initialization receipt. It then sends Ctrl+T and requires a fresh, complete
simulation trace bearing that build ID. Initialization alone does not prove
the map is responsive: a host stall has occurred after that receipt. The trace
adds five seconds for a normal map and ten for the shield-break/ledge fixtures.
It records timestamps, the retained game PID, screenshots, and trace/OCR text
under ~/code/smashcraft/worktrees/test-loop/build/loop/.

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
kept separately under smashcraft:build/loop/20260930-093439-reload.

The 2026-09-30 comparison in smashcraft:evidence/development-plan.md did not reproduce the
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
~/code/smashcraft/worktrees/test-loop/build/loop/20260929-183027-reload.
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
Screenshots: ~/code/smashcraft/worktrees/test-loop/build/engine-check-183334.
Use ydotool for gameplay keys; wtype did not reliably trigger map input here.

## Saved controls checkpoint (2026-09-29)

Build 194234 completed build → F6 restart → synchronized settings ready in
23.667 seconds (build finished at 16.006 seconds). The Warcraft process stayed
running. A saved second grab binding K appeared alongside L after restart;
the readiness file contained the exact restored binding encoding. Evidence:
~/code/smashcraft/worktrees/test-loop/build/controls-probe/restored.png and
~/code/smashcraft/worktrees/test-loop/build/controls-probe/restored-ready.txt.
Custom defaults were restored and saved after the probe.

The readiness marker now waits for the initial synchronized binding load.
Keyboard registration uses Warcraft virtual key codes, not the Lua backend's
generic handle-identity indices. During that adapter defect, the built-in
F10 → End Game → Restart Mission menu successfully loaded the corrected map
without exiting Warcraft. The normal F6 path then passed again.

Live follow-up on `grab-tap-chips`: input trace
smashcraft:build/impact-assets/grab-live-trace.txt contains Shield+N starting
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
Rifleman blue portrait import selects Blue and extracts TeamColor01; the last
completed portrait still rendered white. The owning material-layer repair is
now committed as mdl-exporter4:966dbe81178ad1790dc06d1ec58f4792da682349 and
passes rendered blend/coverage checks. The follow-up two-portrait rebuild hit
its 240-second command limit while Blender was still processing Archer, before
Rifleman began. That run produced no replacement portrait or map deployment.
Regenerate the Rifleman portrait with a suitably bounded single-fighter run,
inspect its blue clothing and full weapon framing, then package it. The import
phase versus render phase of the timed-out run was not established because its
redirected output remained buffered; do not call that a renderer diagnosis.

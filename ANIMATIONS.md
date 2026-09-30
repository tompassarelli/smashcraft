# Authored fighter animation work

## Archer ground-attack playback discrepancy — 2026-10-01

Real inputs select jab (style 0, frame 1026), forward tilt (6, 1086), down
tilt (8, 1145), and up tilt (7, 1199) in grab-pose-passive-r1. All four
commands execute, with zero dropped trace records. Native readability does
not pass: the recorded up tilt does not visibly reach the authored overhead
pose, including inspection at all 60 recorded frames per second. Evidence:
wc3-melee:build/archer-ground-attacks-native.mp4,
wc3-melee:build/archer-ground-attacks-trace.txt, and
wc3-melee:build/archer-up-tilt-every-frame.png.

Source and exported MDX contact transforms agree within 0.001 unit. The up
tilt foot reaches z=106, above head height 84.6033; the exported skinned mesh
also shows that overhead pose. Forward tilt foot is (44,-10,43), jab hand
(32,-12,76), and down tilt foot approximately (43.472,-9.598,10.540).
Evidence: wc3-melee:build/animation-assets/measure-ground-contact.log,
wc3-melee:build/animation-assets/measure-ground-export-points.log, and
wc3-melee:build/animation-assets/archer-export-Up-Tilt-contact.png.
No authoring or gameplay changes were made from this observation. Native
playback remains the unresolved boundary; a passing export is not visual
acceptance. Next discriminating check: isolate the same unit clip from combat
at natural and gameplay playback rates, then inspect its contact pose.

## Coordinated grab poses — 2026-10-01

Archer and Rifleman now share explicit hold/captive pose authoring. Captive
weapons stay beside their owners; Rifleman's pummel uses a tucked knee while
retaining his grip. Canonical spacing, root positions, timing and damage are
unchanged. Source comparison preserved all 47 Archer and 44 Rifleman actions
outside the grab family, including curve handles and interpolation; package
validation passed. Evidence: wc3-melee:build/animation-assets/check-pair-preservation.log
and wc3-melee:build/animation-assets/check-pair-package.log.

Native build grab-pose-passive-r1 was exercised with each fighter as holder
against the other. Both right-facing holders visibly reach the captive's upper
body with separated weapons, pummel, and release forward. Both traces record
hold at frame 270, pummel at 295 and forward release at 360, with zero dropped
records. Damage progresses 0 to 3 to 10. Evidence:
wc3-melee:build/archer-grab-pose.mp4 and wc3-melee:build/archer-grab-pose-trace.txt;
wc3-melee:build/rifleman-grab-pose.mp4 and wc3-melee:build/rifleman-grab-pose-trace.txt.
Reverse-facing native readability and replay restoration remain unverified.
Normal build grab-pose-r1 is installed for the next launch; the current paused
session still runs the passive fixture. These solo checks are not multiplayer
validation.

## Native buffered back air — 2026-10-01

Rifleman Jump+C-left is sampled at frame 2233 during jump squat. Both the jump
and back air (style 14) apply at frame 2237, his first airborne frame. The
recording shows the back-kick clip, then recovery and landing. Evidence:
wc3-melee:build/rifleman-buffered-bair-native.mp4 and
wc3-melee:build/rifleman-buffered-bair-trace.txt (zero dropped records).
This proves this right-facing native buffer case; it is not both-facing
contact/volume acceptance.

Rifleman Jump+Shield+Left also buffers through jump squat: sampled at frame
2594, takeoff/dodge resolves at 2598 and the following trace sample reports
10 landing frames. He visibly slides left from x=284.879; during landing lag
the recorded position reaches x=141.801. No Down input was sent. Evidence:
wc3-melee:build/rifleman-buffered-wavedash-native.mp4 and
wc3-melee:build/rifleman-buffered-wavedash-trace.txt (zero dropped records).
This verifies the simultaneous-input horizontal wavedash case, not a later
direction change inside jump squat.

The numeric-key variant I+8+W also succeeds with the current custom bindings:
8 maps to action 9, jump+dodge are sampled at 2956, takeoff occurs at 2960,
and the next sample reports 10 landing frames. The recording shows the left
slide (x=29.884 to -113.194 by landing-lag completion). Evidence:
wc3-melee:build/rifleman-eight-wavedash-native.mp4 and
wc3-melee:build/rifleman-eight-wavedash-trace.txt (zero dropped records).
This is simultaneous input, not a later direction change during jump squat.

## Archer and Rifleman native specials — 2026-10-01

Rifleman's remaining throw directions are also observed in the passive native
match. Forward release at frame 492 takes Archer from 3% after pummel to 10%
and gives 25 hitstun frames. Back release at 1460 takes 13% to 20%, gives 27
hitstun frames and launches behind the left-facing holder. Up release at 1936
takes 23% to 29%, gives 28 hitstun frames and visibly launches vertically.
Combined with the earlier down throw, all four Rifleman directions now have
native selection/contact/release evidence. Hold/pummel overlap remains a gap.

Evidence: wc3-melee:build/rifleman-forward-throw.mp4 and
wc3-melee:build/rifleman-forward-throw-trace.txt;
wc3-melee:build/rifleman-back-contact.mp4 and
wc3-melee:build/rifleman-back-contact-trace.txt;
wc3-melee:build/rifleman-up-throw.mp4 and
wc3-melee:build/rifleman-up-throw-trace.txt. Each trace has zero dropped records.
The earlier wc3-melee:build/rifleman-back-throw.mp4 attempt did not capture:
the approach overshot and the simultaneous turn/grab did not produce contact.
Its trace establishes a missed attempt, not a successful back throw. Settling
position/facing before grabbing produced the recorded successful sequence.
These checks do not establish pivot grabs or both-facing visual acceptance.

Archer's four throw directions have now been exercised through native controls.
Forward is recorded below; the subsequent O-grab/pummel/directional sequences
show the remaining releases:

| Throw | Pummel then throw damage | Release frame | Victim reaction at release |
| --- | --- | --- | --- |
| Back, while facing left | 10% -> 13% -> 20% | 3168 | 26 hitstun frames; victim crosses behind holder and launches right |
| Up, while facing right | 20% -> 23% -> 29% | 3644 | 28 hitstun frames; vertical launch |
| Down, while facing right | 29% -> 32% -> 37% | 4031 | 32 hitstun frames and tumble; floor contact leads to downbound, then prone |

Evidence: wc3-melee:build/archer-back-throw.mp4 and
wc3-melee:build/archer-back-throw-trace.txt;
wc3-melee:build/archer-up-throw.mp4 and
wc3-melee:build/archer-up-throw-trace.txt;
wc3-melee:build/archer-down-throw.mp4 and
wc3-melee:build/archer-down-throw-trace.txt. Each trace reports zero dropped
records. This establishes selection, contact damage and release direction for
these scenarios, not both-facing art acceptance or multiplayer behavior.
Holder/victim overlap remains visible during hold and pummel.

Single-client checks in `special-direction-passive-r1` now show:

- Archer neutral arrow deals 7 damage without a victim hitstun transition.
  Multishot visibly emits its fan after windup; this close-range attempt misses
  after Archer passes the target. Disengage summons the hippogryph, moves Archer
  backward and hits for 8 damage with 5 victim hitlag and 20 hitstun frames.
- Archer Up-B visibly mounts/rises with the hippogryph and returns to the floor.
  The trace ends the special at height 355.12 and records 4 landing frames.
- Rifleman's shot deals 3 damage with 4 victim hitlag and 11 hitstun frames.
  His running bear visibly contacts for 6 damage, 5 hitlag and 15 hitstun.
- Rifleman's trap visibly entombs Archer in ice. Freeze begins at frame 1941;
  Archer becomes actionable at frame 2241 with unchanged damage. This is 300
  simulation frames (five logical seconds at 60 Hz), not physical latency.
- Rifleman Up-B shows a downward projectile and upward fighter movement;
  special 6 ends at height 425.699 before descent and 4 landing frames.

Evidence: wc3-melee:build/archer-specials-native.mp4,
wc3-melee:build/archer-specials-trace.txt,
wc3-melee:build/archer-up-native.mp4,
wc3-melee:build/archer-up-trace.txt,
wc3-melee:build/rifleman-specials-native.mp4,
wc3-melee:build/rifleman-specials-trace.txt,
wc3-melee:build/rifleman-up-native.mp4 and
wc3-melee:build/rifleman-up-trace.txt.

Arrow jump cancellation remains unverified: the recorded jump follows the end
of the special. Initial Up-B requests during Archer's ledge state and Rifleman's
trap recovery do not activate; separate standing attempts establish activation.
These checks do not establish protection timing, both facings, multishot contact,
complete recovery acceptance, rollback presentation or multiplayer behavior.

Rifleman Shield+O captures Archer at frame 2580, N starts pummel at 2605
(9% -> 12%), and Down selects down-throw at 2641. Release at 2656 gives
29 victim hitstun frames and raises damage to 17%. Video shows pummel/contact
and release, but the held pair overlaps and still needs readability work.
Evidence: wc3-melee:build/rifleman-shield-grab.mp4 and
wc3-melee:build/rifleman-shield-grab-trace.txt (zero dropped records).
Archer Shield+Attack selects grab style 5, but the preparatory dash overshoots
the opponent; no capture occurs. That recording establishes dispatch only,
not pummel or forward-throw acceptance:
wc3-melee:build/archer-shield-grab.mp4 and
wc3-melee:build/archer-shield-grab-trace.txt.

With the distance corrected using walk, Archer Shield+Attack captures at frame
2244. N pummels (0% -> 3%); Left while facing left selects forward throw at
2305. Release at 2316 raises Rifleman to 10% and gives 24 hitstun frames.
Evidence: wc3-melee:build/archer-shield-grab-contact.mp4, with trace
wc3-melee:build/archer-shield-grab-contact-trace.txt (zero dropped records).
Hold/pummel silhouettes still overlap; the forward release is visible.

The near-simultaneous arrow/jump native attempt samples both presses at frame
2616 but starts jump only. It does not prove cancelling an active shot:
wc3-melee:build/archer-arrow-jump-native.mp4 and
wc3-melee:build/archer-arrow-jump-trace.txt. Current frame ordering advances
movement/jump before starting specials, whose gate rejects jump squat. The
arrow's special state lasts three frames and has zero attack cooldown;
the next-frame shot-to-jump source check now uses complete frame inputs rather
than directly invoking the jump helper. Native sequential cancellation remains
unverified; do not infer it from simultaneous input or a jump after frame three.

A sequential attempt with a 25 ms injected U-to-I gap also arrived in one
synchronized batch: both callbacks at frame 660, both actions sampled at 661,
jump applied at 663, no arrow special started. Evidence:
wc3-melee:build/archer-arrow-jump-sequential-native.mp4 and
wc3-melee:build/archer-arrow-jump-sequential-trace.txt (zero dropped records).
This documents the baseline's input batching, not a physical latency result
or successful cancellation.

## Demon Hunter completion checklist

Grounded Immolate contact is observed in Warcraft: one 7-damage hit with
5 victim hitlag frames, 18 hitstun frames and a horizontal launch. Its green
active cue and victim impact are visible. Evidence:
wc3-melee:build/illidan-immolate-native.mp4 and
wc3-melee:build/illidan-immolate-trace.txt.

The subsequent airborne attempt exposed direction loss, not a verified spike:
Down was held when Special pressed, but both releases arrived before the next
step; Mana Burn was selected. The event trace is
wc3-melee:build/illidan-immolate-air-trace.txt (frames 2544–2545).
The input repair captures special direction at its press independently of
current movement axes, records it in frame inputs, and preserves it in copies
and equality checks. The repaired native trace
wc3-melee:build/special-direction-release-trace.txt confirms all three events
arrive at frame 1787; frame 1788 has neutral movement and selects Immolate
(special 12). Airborne Immolate also hits a grounded target for 9 damage,
6 victim hitlag and 21 hitstun in
wc3-melee:build/special-direction-native-trace.txt and
wc3-melee:build/special-direction-native.mp4. Offstage downward trajectory
remains unverified; this target was standing on the floor.

Normal and air-dodge landing playback is now observed in Warcraft: both show
the authored contact crouch followed by standing. The clean passive-opponent
trace records 4 normal recovery frames and 10 after air dodge, with no damage
interruptions and zero dropped trace records. Evidence:
wc3-melee:build/illidan-landing-passive.mp4,
wc3-melee:build/illidan-landing-passive-trace.txt,
wc3-melee:build/illidan-normal-landing-frames.png, and
wc3-melee:build/illidan-dodge-landing-frames.png. This does not establish
Up-B landing, attack landing, both facings or rollback restoration.

Native checks on 2026-10-01 used `illidan-passive-r1`, the existing knockdown
scenario after both fighters returned to standing. Mana Burn activates from U,
hits for 5 damage and produces victim hitlag/hitstun. E+U activates Immolate
(special 12); R+U activates the parry step (special 10) and moves the fighter.
Those activations do not establish Immolate contact/spike or successful parrying.
The short green/blue-white cues still need closer visual validation.
Earlier active-CPU footage shows Up-B ascent with visible wings.

O captures the passive opponent, N pummels (damage 5 to 8), and Space selects
up-throw (damage 8 to 14), releasing the victim with 25 hitstun frames in the
trace. Pair poses overlap substantially at gameplay scale; readability and
the other three throw directions remain unfinished native checks.
Evidence: wc3-melee:build/illidan-passive-specials.mp4,
wc3-melee:build/illidan-passive-specials-trace.txt,
wc3-melee:build/illidan-passive-grab.mp4,
wc3-melee:build/illidan-passive-grab-trace.txt, and
wc3-melee:build/illidan-specials-native.mp4. Both passive traces finish with
zero dropped trace records. These are single-client tests, not multiplayer proof.

Illidan selection and HUD integration are implemented in the working source;
he is installed in `illidan-visibility-r1`. Native mirror-match entry works.
The previous black silhouette and surrounding dark geometry are absent in the
recreated match, with both fighters textured in their normal bodies.
The cause is stale mesh action-slot visibility during combat authoring: the
skeleton used Stand Ready while the meshes retained alternate/death visibility.
The author now samples every mesh from Stand Ready. The added scene check fails
on the old jab at frame zero and passes all 81 rebuilt clips while preserving
24 stock actions and 17 source geosets. Export, packaged map build and native mirror-match confirmation passed.
Native evidence: wc3-melee:build/illidan-native-match-fixed.png.
Evidence: wc3-melee:build/illidan-visibility-before.log and
wc3-melee:build/illidan-visibility-after.log. The rebuilt
scene contains 236 bones (including emitter helpers), 17 geosets and 24 stock actions;
The authored scene now adds 81 clips, with 103 exported sequences and validated
bindings in wc3-melee:build/illidan-animation/bindings.json. Source commits
096f71e, 57ad0cd and 0ac1db2 preserve the original 24 actions, 17 geosets and
24 FPS timebase. Both-facing previews cover 144 pose samples. Native playback,
action bindings and contact alignment remain unverified. The material repair in
mdl-exporter4 commit 966dbe81178ad1790dc06d1ec58f4792da682349 removes the
white torso polygon in unfiltered side-view previews. Source TeamColor00
panels remain red. Rendered checks cover alpha-over layer composition and
black TeamGlow transparency; export checks preserve source texture paths,
replaceable IDs and filter modes. Native model fidelity is still unverified.
Evidence: wc3-melee:build/illidan-assets/demonhunter-stock-stand-ready-0-profile.png.

| Required coverage | Current state |
| --- | --- |
| Model, textures, attached blades, both gameplay facings | Normal textured bodies/weapons observed in native mirror match after visibility repair; both-facing action coverage incomplete |
| Jab, directional/angled tilts, smashes, dash attack | Combat source-tested; clips authored and bound; native playback unverified |
| Neutral/forward/back/up/down aerials | Combat source-tested; clips authored and bound; native playback unverified |
| Mana Burn, parry/evasion, wing ascent, Immolate | Native Mana Burn contact, wing ascent, ground/air Immolate contact and parry-step movement observed; actual parry protection and offstage spike remain unverified |
| Grab, hold, pummel, escape, four coordinated throws | Native capture/pummel/up-throw confirmed; pair readability, escape and other throw directions still pending |
| Idle, walk/run, turns, crouch, jumps and landings | Normal and air-dodge landing playback observed; jump squat, jumps and idle fall bound; other movement transitions still incomplete |
| Shield, shield reactions/break, spot dodge, rolls, air dodge | Shield raise/hold/release, ground dodges and air dodge bound; native checks pending |
| Ground/air hitstun, tumble, contact-pose hitlag | Reactions authored; freeze/resume verification missing |
| Knockdown, techs, getup options, ledges, KO and respawn | Knockdown/rest, tech/getup and ledge roll/attack bound; remaining transitions/native grounding unverified |
| Action-frame volumes, interruptions, stock reset and replay | Provisional numerical regions and focused interruption/reset/replay checks implemented; animation alignment missing |
| Portraits, selection, mirror match and rematch retention | Portrait/tile generated; third roster tile, human/CPU mirror selection and HUD observed in Warcraft; rematch native check pending |
| Real-control playthrough in Warcraft | Selection/mirror entry and repaired model observed; partial specials/grab/landing checks recorded above; full moveset checks incomplete |

Wings must appear and animate during recovery. Post-ascent glide remains an
unadopted design option. Timing and damage live in combat source; new tuning
must remain explicitly provisional, not presented as extracted Melee data.

Packaging passes after repairing binary event and particle import in
mdl-exporter4. The rebuilt model preserves all nine texture entries and two
source particle emitters, suppresses stock particle effects during custom
combat clips, and exports 81 authored clips / 103 sequences. The model and
animation constants are embedded in map builds. Combat bindings cover normal
attacks, aerials, specials, grabs/throws and several defensive/damage states;
movement/defensive mapping and special effects still have gaps. Native model
fidelity, wing playback and contact alignment remain unverified.
Evidence: wc3-melee:build/illidan-animation/export-particles-r3.log and
wc3-melee:build/illidan-render-r1-map.log.

The integrated source suite passes 360/360 with one existing unused-import
warning: wc3-melee:build/wurst-tests/illidan-integration-all.log. Two added
contact regressions first failed in
wc3-melee:build/wurst-tests/illidan-integration-before.log: grounded attacks
must reach a standing opponent's origin, and Illidan must retain the shared
grab/getup/ledge attack volumes. This does not verify native controls or poses.

## Archer and Rifleman

Ground-attack pass: Archer's jab now extends her right fist while the left hand
holds the bow back. Her forward tilt and angled variants use extended kicks;
up tilt raises the leg overhead and down tilt lowers into a sweeping kick.
Rifleman now has dedicated rising-rifle up tilt and crouched down tilt clips.
The adapter selects and times these clips explicitly instead of using stock
attack for up/down tilt. Startup, active windows and total combat duration are
unchanged. Walking playback now follows actual horizontal speed.
The shoulder-cloth chain hangs from the moving shoulder during the jab; its
stock inheritance otherwise swings a large flap across the punching arm.

Editable authors: wc3-melee:tools/animations/ground_attacks.py and
wc3-melee:tools/animations/rifleman.py. Side/reverse previews are generated by
wc3-melee:tools/animations/preview-ground.py. The package check verifies contact
timing, held active poses and unchanged non-target clips; see
wc3-melee:build/animation-assets/check-ground-preservation.log. This pass still
needs native both-facing checks at gameplay size; Blender views do not prove
Warcraft texture, blend or playback behavior.

Character completion follows the active `smashcraft-character-creation-distilled`
skill, owned at
nixos-config:dotfiles/agents/skills/smashcraft-character-creation-distilled/SKILL.md.
Every fighter requires grounded/airborne damage reactions and exact hitlag pose
holds, alongside the complete normal, aerial, special, defense and grab/throw
coverage. Hitlag freezes the appropriate contact pose; it is not a looping clip.

Both fighters now have authored Damage Ground, Damage Air, Damage Tumble and
Damage Shield clips in wc3-melee:tools/animations/damage.py. Contact is already
posed at frame zero; non-looping clips settle into a held reaction. Wurst selects
ground contact during hitlag, then airborne/tumble presentation on launch.
New damage retriggers the reaction even when the new hitstun is shorter.
Damage selection runs after attack selection, and playback freezes afterward.
Native unit blend time is zero: the first native recording demonstrated that
default blending otherwise retained the old pose throughout the freeze.

Three focused Wurst tests pass; the existing aerial/package preservation check
passes for both fighters. The installed `space-camera-r1` recording shows a
Rifleman grounded recoil held across five simulation hitlag ticks before tumble,
and an Archer grounded recoil held across seven ticks before airborne reaction.
Evidence: wc3-melee:build/impact-assets/space-after.mp4 and its matching trace;
contact strips are wc3-melee:build/impact-assets/damage-r2-strip.png and
wc3-melee:build/impact-assets/damage-archer-r2-strip.png. This verifies those
observed contacts, not exact arbitrary animation seeking or rollback restoration.
Shield reactions, both-facing coverage and replay pose restoration remain open.

The directional-specials pass connects stock bear/hippogryph effect animations
to numerical state. Dedicated body clips now cover neutral fire, fan wind-up,
backward disengage, riding recovery, bear summon, trap placement and downward
gunshot/recoil. Archer authoring is in wc3-melee:tools/animations/archer-specials.py;
Rifleman authoring is in wc3-melee:tools/animations/rifleman.py. Separate ground
and air Rifleman shots preserve the frame-2 firing pose despite different
recovery durations. The adapter scales generated clip durations to the current
special's fixed duration and retains hitlag freezing. Simulation tuning is
unchanged. Offline authoring/package checks and the existing aerial-preservation
check pass; native pose alignment and full gameplay acceptance remain open.

Required initial clips from the owner: jab; forward tilt; up-angled forward
tilt; down-angled forward tilt; jump; double jump; forward roll; backward roll;
get-up attack. Blender 5.1.1 is installed. The first Archer jab is authored,
exported and playing in the client. Forward/backward rolls and a spot dodge
are now authored on the same rig, along with jump, double jump, and three
forward-tilt variants. Knockdown, stand-up and get-up attack are also authored;
jab and spot dodge still need visual tuning
at the normal camera distance.

Preserve editable Blender scenes and exported Warcraft model assets. Author
on a rig compatible with the selected Warcraft fighters; do not claim that a
clip from another skeleton can be dropped onto Archer/Rifleman unchanged.
Keep gameplay displacement and collision in simulation; animation follows
logical move timing for anticipation, contact, recovery and invulnerability.

## Candidate tool boundary

Local references downloaded for inspection:

- ~/code/resources/mdl-exporter at 63848b22becd90243cacea661ecc3f0c7d607514
  (https://github.com/khalv/mdl-exporter).
- ~/code/resources/mdl-exporter4 at ce04acf8eb49e31521a09374bec285d5c5e91e89
  (https://github.com/minicolder/mdl-exporter4).

Both are candidate Blender MDL import/export add-ons. The second still declares
Blender 2.80 in its metadata, so its name does not establish compatibility with
the installed Blender. README documents sequence ranges through paired timeline
markers, reference pose at frame zero, and limitations on classic MDL skinning.
The second add-on's animated export is repaired in
~/code/mdl-exporter4/worktrees/blender5 at commit 409e249. Its reader now uses
Blender's layered-action API; the real Blender regression verifies exported
translation keys at 0ms and 833ms. Animated import is repaired at the same API
boundary: actual Archer and Rifleman imports both save editable Blender scenes.
The importer repair is commit 9f8ceb0 in the same checkout.
The Archer check preserves four mesh geosets and animated pose tracks.
The importer warns that version 1800 models load as version 1000; newer model
features may be lost. In-game visual fidelity remains unverified.
The first import → author → export → in-game playback check passed for jab,
but later pose inspection found its imported hierarchy was incomplete.
Tool commit 3631e24 preserves unused imported actions through Blender saves
and preserves the original event tracks. Commit 83d0cf4 preserves Warcraft
texture paths, material layers and replaceable team-color IDs rather than
exporting Blender-local preview paths. These repairs live in the add-on,
not generated-model patches.

Tool commit ebdb212 repairs Parent decoding in the node parser: imported bones
previously became independent roots. The focused Blender regression checks the
expected hierarchy and confirms that root rotation deforms evaluated geometry.
Archer's scene and authored clips were regenerated through the corrected importer.

The add-ons are GPL tools (repository license GPL-3.0; individual source headers
also contain GPL-2.0-or-later notices). They remain standalone local tools,
not code incorporated into Wurst gameplay. Preserve their notices and license
when modifying/distributing tools; do not copy tool code into the game.

The existing local animation-library archive is
~/code/game-assets/quaternius/Universal Animation Library[Standard].zip.
Its listing contains FBX and GLB variants plus License.txt, but rig/clip contents
have not been inspected. It may help with motion reference/retargeting after
skeleton compatibility is established; Warcraft fighters remain the requested
art direction. No assets have been copied from the archive into the map.

## Installed fighter extraction

Run from ~/code/wc3-melee/worktrees/test-loop:

```bash
nix shell nixpkgs#gcc nixpkgs#bun --command bash /home/tom/code/wc3-melee/worktrees/test-loop/tools/animations/extract.sh
```

Requires ImageMagick on PATH and the built CascLib static library below.
The command extracts Archer and Rifleman from the installed game, converts MDX
to editable MDL, and extracts seven textures to PNG. This installed version
stores DDS textures even though the MDL texture references end in BLP.
Both models have four geosets; Archer has 33 bones/13 sequences, Rifleman has
30 bones/10 sequences. Outputs remain local and ignored under
~/code/wc3-melee/worktrees/test-loop/build/animation-assets.
Set the Blender add-on resourceFolder to that directory's textures subfolder.
Extraction does not grant redistribution rights to Blizzard assets.

Save editable scenes with the repaired local add-on:

```bash
blender --background --threads 2 --python-exit-code 1 --python /home/tom/code/wc3-melee/worktrees/test-loop/tools/animations/import.py -- archer
blender --background --threads 2 --python-exit-code 1 --python /home/tom/code/wc3-melee/worktrees/test-loop/tools/animations/import.py -- rifleman
```

Both commands passed and saved .blend files beside the extracted models.
WC3_MDL_ADDON overrides the local add-on checkout. These scenes preserve
existing motion. The authored jab has a separate editable scene below.

The C++ tool is only the CascLib foreign-library boundary; the TypeScript tool
only converts foreign asset formats. Gameplay remains Wurst.

Dependencies:

- CascLib: https://github.com/ladislav-zezula/CascLib, MIT, upstream
  38a34665624b8775bb875274b36191b21c38d97b plus local portable-pointer repair
  1ccab1a in ~/code/casclib/worktrees/assets. Existing copyright/license notices
  remain in that checkout. No library source is copied into the map project.
- war3-model 4.0.1 (4eb0da/war3-model), pngjs 7.0.0, and transitive gl-matrix
  3.3.0: MIT; exact packages locked in wc3-melee:tools/animations/bun.lock.
  Their license notices remain in the installed packages.

Build CascLib from ~/code/casclib/worktrees/assets:

```bash
cmake -S /home/tom/code/casclib/worktrees/assets -B /home/tom/code/casclib/worktrees/assets/build -DCMAKE_POLICY_VERSION_MINIMUM=3.5 -DCMAKE_BUILD_TYPE=Release -DCASC_BUILD_SHARED_LIB=OFF -DCASC_BUILD_STATIC_LIB=ON
cmake --build /home/tom/code/casclib/worktrees/assets/build --parallel 2
```

Override CASC_SOURCE or WC3_STORAGE when these local checkout/install paths
change. The full extraction command passed in about five seconds.

## Build and play the first authored jab

```bash
nix shell nixpkgs#gcc nixpkgs#bun --command bash /home/tom/code/wc3-melee/worktrees/test-loop/tools/animations/build-assets.sh
```

This extracts local game assets, imports a fresh Archer scene, authors jab,
evasion, jump and forward-tilt clips, exports MDL, and packages MDX plus generated Wurst clip metadata. Asset rebuilds
are separate from the normal gameplay loop; wc3-melee:build.sh consumes their
outputs without rerunning Blender. The asset command writes logs under
~/code/wc3-melee/worktrees/test-loop/build/animation-assets.

Editable scene:
~/code/wc3-melee/worktrees/test-loop/build/animation-assets/archer-jab.blend.
Authoring source: wc3-melee:tools/animations/jab.py, a Blender API boundary.
The clip uses frames 0–36 at 24fps, with extension at frame 4 and retraction
by frame 18. Wurst scales its exported 1.5-second duration to the simulation's
36 ticks at 60Hz (0.6 seconds), and pauses animation playback during hitlag.
The clip is selected by its generated index rather than Warcraft's random
choice among attack names. Archer's ground dodges also use generated indices;
Rifleman's moves and the remaining Archer moves still use native animations.

Build 212201 loaded the custom model and played jab from the normal N input.
Evidence: ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/jab-client.mp4
and ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/jab-poses.png.
The first launch became stuck in Warcraft's "Waiting for host" state. Leaving
that map and creating a fresh single-player instance restored input without
restarting the client. The cause remains undiagnosed; it was not counted as
a successful playback check. Full model fidelity and exact visual contact
alignment remain unverified, and the jab motion needs a stronger silhouette.

## Authored Archer evasions

Authoring source: wc3-melee:tools/animations/dodges.py. Final editable scene:
~/code/wc3-melee/worktrees/test-loop/build/animation-assets/archer-fighter.blend.
The forward/backward clips last 31 source frames (1.292 seconds at 24fps),
and spot dodge lasts 23 frames (0.958 seconds). The adapter scales these
durations to the simulation's 31/23 ticks at 60Hz, freezes playback in hitlag,
and restores normal animation after recovery. The body tumbles in opposite
directions for forward/backward rolls; spot dodge crouches in place.

The full asset build passed after the importer repair, preserving eight
original event tracks. No root translation keys occur within dodge intervals;
gameplay displacement remains solely in Wurst. Generated metadata selects
forward index 7, backward index 6, and spot index 8 in this model, without
hard-coding those numbers into gameplay source. Pose renders establish mesh
deformation; client evidence is recorded separately in wc3-melee:DEVELOPMENT.md.

The roll authoring axis was corrected after a game-aligned MDX → MDL → Blender
roundtrip render: root X turned the silhouette edge-on, while root Z produced
the stage-plane tumble. This is specific to the imported Archer bone basis;
do not assume another rig shares it. The native forward-roll recording now
shows the tumble. Removing PauseUnit did not solve the wrong-axis motion, so
the adapter retains paused, simulation-controlled bodies.

Spot dodge's pelvis translation uses local negative Y so the exported MDL
translates downward on game Z (0, 0, -13 at its held pose), rather than into
depth. Its visual cue is still subtle at the normal camera and needs stronger
pose tuning. Correct export/playback is not a claim of finished animation art.

## Jump and double jump

Archer Jump lasts 24 source frames at 24fps; Double Jump lasts 30. Both are
authored by wc3-melee:tools/animations/dodges.py in the final fighter scene.
Jump tucks the legs; Double Jump uses the established stage-plane somersault
axis. The packaged MDX roundtrip renders verify the poses and show no root
translation tracks in these clips. Their generated indices remain the only
source for runtime clip selection.

The simulation emits a takeoff counter only when ground squat finishes or an
air jump succeeds. The adapter starts the appropriate clip from that event,
runs it over 24/30 simulation ticks, and cancels it on landing, hitstun,
air dodge or attack. Jump key presses rejected by the simulation cannot restart
the clip. The animation does not change jump velocity or airborne collision.

Build 222152 was observed in Warcraft: ground-jump tuck, double-jump somersault,
descent and return to normal animation. Native playback evidence is at
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/jump-client.mp4.
A small arrow-like element remains below the jumping fighter; attachment and
visibility need art cleanup. Native playback is verified, not final visual polish.

Packaged model imports now include a hash of their MDX content in the filename.
The generated Wurst model path and packaged archive entry use the same hash.
This changes resource identity when an asset changes without restarting the
client; unchanged model content retains the same path. A fixed-name restart
kept the previous pose, whereas the new path loaded the regenerated pose.

## Archer forward tilts

The level, up-angled and down-angled forward tilts are authored in
wc3-melee:tools/animations/dodges.py and packaged by
wc3-melee:tools/animations/package.ts. Each uses 28 source frames, with
extension at frame 5, a held strike through frame 7, and recovery to frame 28.
The adapter scales exported durations to 28 simulation ticks and freezes
playback during hitlag. Generated indices select clips independently of
sequence ordering; simulation owns movement and hit coverage.

The full asset build passed. Exported MDX → Blender side-view strike poses
show distinct level, upward and downward arm positions; evidence is under
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/tilt-roundtrip-poses.
These are first-pass animations, not finished Melee-quality motion. Rifleman
still uses its stock attack animation. Native playback evidence and the tested
build are recorded in wc3-melee:DEVELOPMENT.md.

## Archer knockdown and get-up

wc3-melee:tools/animations/dodges.py also authors Knockdown (12 source frames),
Get Up (30), and Get Up Attack (45). The attack sweeps at frames 16–18 and
returns upright by frame 45. As with the other clips, generated metadata
supplies the actual model indices and durations, and Wurst scales playback
onto simulation timing. `grounding.py` now measures the visible skinned mesh at
each source frame and applies the required vertical correction to child and
attachment bones. This keeps the fighter on the stage through the knockdown,
get-up, and get-up attack without adding a `Bone_Root` translation track.

Both fighters now use the same authored recovery clips. The per-frame Blender
check keeps the lowest visible vertex within 0.0001 model units of the preview
stage height across all three clips. The rendered stage-side poses are
wc3-melee:build/animation-assets/archer-recovery-knockdown-12.png,
wc3-melee:build/animation-assets/archer-recovery-getup-00.png, and the matching
`rifleman-recovery-*` images. Native playback still needs a client check.

One-shot action export is repaired at
~/code/mdl-exporter4/worktrees/blender5, commit 4ce7b32. The action-based path
previously hard-coded looping, which the native recovery check exposed as a
knockdown reset and repeating get-up attack. It now consumes the per-action
`war3_non_looping` property and preserves imported sequence flags. The actual
Blender export regression covers explicit true, false, default and imported
flags. Our authored moves set that property; Stand/Walk remain looping.
Generated model bytes are not patched. Rebuild through the normal asset command.

## Archer projectile ownership

Archer's authored poses now retain the stock held-bow pose through
wc3-melee:tools/animations/archer_pose.py. The previous jab keyed only the
right arm; evasions and tilts likewise omitted the left hand and bow grip.
The packaged model consequently had no `Cylinder02` rotation in those clips,
although stock Stand, Walk and Attack rotate that bow bone by 90 degrees.
Its jab roundtrip rendered the bow down beside Archer's legs.

Jab and the other authored body poses now offset Stand Ready, explicitly
keying every bone's rotation and scale and every non-root translation.
Root displacement remains simulation-owned. Non-firing visibility is also
explicit; the bow geometry and original parent hierarchy are preserved.
The packaged MDX check passed for the retained bow rotation in all fourteen
custom clips, complete bone rotation tracks and absent custom root translation.
MDX → MDL → Blender renders show the bow held in jab, all three tilts,
jump and double jump. Sampled stock Stand, Walk and Attack poses still match
the pre-change export. Native attack-to-movement recovery is a separate
adapter/client check; these asset checks do not establish that recovery.

The repaired Archer MDX SHA-256 is
475ae4195dc533dcb6930e208ee52897e1c54fcb7f1f6af0d44082edb9c76372.
Roundtrip images are under
~/code/wc3-melee/worktrees/test-loop/build/animation-assets/bow-archer-packaged-*.png.

The fighter no longer includes the stock model's independently animated arrow
geoset. wc3-melee:tools/animations/dodges.py removes the unique mesh weighted
only to Arrow, retaining the bone. Actual shots use a separate ArrowMissile
effect positioned by the simulation and destroyed when the shot becomes inactive.

The exporter also now preserves animated and single-key geoset visibility:
~/code/mdl-exporter4/worktrees/blender5 commits edb31e4, 3791fbf, and 40fd706.
The actual-model roundtrip regression failed before repair and passed afterward.
The ordinary asset build completed successfully; its final three geosets retain
their visibility tracks. Model SHA-256:
e9aadd07b65d01276ecc0a582ce48c340f713c17d958e1cb29a45f8b9ff44346.

Native build 062042 shows the shot leaving Archer, moving toward Rifleman, and
vanishing after contact as Rifleman's damage increases. No separate animated
arrow follows Archer. Recorded evidence:
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/arrow-native.mp4
and ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/arrow-contact-sheet.png.

## Rifleman authored actions

wc3-melee:tools/animations/rifleman.py authors jab; level, up-angled and
down-angled forward tilts; jump/double jump; forward/backward roll; spot dodge;
knockdown; stand-up; and get-up attack on Rifleman's own skeleton. The rifle
follows its original grip using baked arm poses; it is not an Archer skeleton
retarget. Root displacement remains simulation-owned. Stock shooting and
unmodified model geometry are retained, while the shell/gore geosets are hidden
during the custom clips.

The normal asset build packages both fighters and generates their clip indices,
durations and model paths in FighterAssetInfo. Model import filenames now use
the full SHA-256 digest; the map builder imports and checks both matching files.
The adapter uses each fighter's generated metadata, scales duration to the
logical move duration, and pauses playback in hitlag. These remain first-pass
combat animations rather than a final polish claim.

For the native sequence, build with WC3_SCENARIO=knockdown through
wc3-melee:loop.sh reload, then run wc3-melee:tools/probe-fighter-clips.sh rifleman
from default character selection with the custom preset. The fixture keeps the
bot idle. The script records recovery, jab, three tilts, jump/double-jump,
forward/backward roll and spot dodge. Its successful exit means the input and
recording sequence ran; inspect the recording for the visual verdict. Restore
normal play with wc3-melee:loop.sh reload without WC3_SCENARIO afterward.

The final Rifleman model hash is
6f56de2c8b70c3b18192317024ce69abac54ee3c3832bb2d8f92da55e12c96a3.
Exported checks cover twelve non-looping clips, absent root translation keys,
retained stock Attack, and custom visibility. Exported pose renders and native
build 063805 both show the corrected directional tilts. Native observation and
recording paths are in wc3-melee:DEVELOPMENT.md.

## Dedicated ledge hang and climb

wc3-melee:tools/animations/ledges.py authors Ledge Hang and Ledge Climb on
each fighter's own skeleton, called by the existing Archer and Rifleman author
scripts. Hang holds a raised left arm with relaxed bent legs; climb bends the
supporting arm, lifts the knees and returns to Stand Ready. Rifleman's separate
rifle root follows his torso and retained right-hand grip. The clips contain no
root translation: ledge travel and collision remain simulation-owned.

Hang loops over 24 source frames (1 second); climb is non-looping over 30
frames (1.25 seconds). Generated FighterAssetInfo constants supply
ARCHER_LEDGE_HANG_INDEX, ARCHER_LEDGE_CLIMB_INDEX/SECONDS and the matching
RIFLEMAN constants. The render adapter selects these clips for hang/climb and
scales climb to LEDGE_CLIMB_FRAMES. Roll and attack retain their existing clips.

Both editable fighter scenes and MDX assets were regenerated directly from the
existing source scenes, without extraction or a full asset rebuild. Packaged
MDX checks passed for sequence durations, loop flags, absent root translation
keys and retention of every stock sequence. Exported MDL pose renders show
raised-arm hang and bent-knee pull-up silhouettes for both fighters. Preview
images are local at
~/code/wc3-melee/worktrees/test-loop/build/animation-assets/archer-ledge-hang.png,
~/code/wc3-melee/worktrees/test-loop/build/animation-assets/archer-ledge-pull.png,
~/code/wc3-melee/worktrees/test-loop/build/animation-assets/rifleman-ledge-hang.png
and
~/code/wc3-melee/worktrees/test-loop/build/animation-assets/rifleman-ledge-pull.png.
Native Archer fixture ledge-deferred selects the new hanging pose and completes
climb after 25 simulation ticks (entry tick 67, exit tick 92). The original grip
was visibly above/outside the platform endpoint.
The hang screenshot and trace are under
~/code/wc3-melee/worktrees/test-loop/build/animation-probe/ledge-climb/.
The original observation did not cover Rifleman or intermediate climb poses.

The contact correction measures the original authored wrists at
(18.386, 7.129, 106.240) for Archer and (17.815, 12.737, 92.941) for Rifleman,
against the former stage-plane requirement (x, z) = (42, 60). The shared hang
anchor is now 24 world units outward and 90 downward, within both rigs' reach.
The Blender boundary reads those dimensions and the climb path dimensions
directly from wc3-melee:wurst/Simulation.wurst. Both fighter object definitions
explicitly use model scale one. The support wrist stays on the endpoint through
the first five simulation ticks of climb, then releases toward the ready pose;
root movement remains entirely in the simulation.

Both editable scenes and packaged MDX files were regenerated. MDX → MDL → Blender
checks measured hang wrists at (24.00028, -4.46064, 89.99979) and
(24.00056, 3.55419, 89.99972); all sampled hang and initial climb contact errors
were below 0.001 world units in the stage plane. The generated clips retain
their durations/loop flags and have no root translation keys. All 13 Archer
and 10 Rifleman stock sequence names/loop flags remain; every non-ledge action
channel matches the saved prior scene. The focused Wurst ledge suite passed
13/13 tests. Local check evidence is in
~/code/wc3-melee/worktrees/test-loop/build/animation-assets/check-ledge-contact.log
and ~/code/wc3-melee/worktrees/test-loop/build/wurst-tests/ledge-contact.log.
Native follow-up in build ledge-contact verified both Archer and Rifleman at
the left endpoint: the supporting hand now meets the lip, and each climbs from
(-624,-90) to (-576,0) in 25 simulation ticks. Screenshots and input traces are
under ~/code/wc3-melee/worktrees/test-loop/build/animation-probe/
ledge-contact-archer/ and ledge-contact-rifleman/. This establishes the observed
hang and completed climb, not every intermediate pose or right-edge appearance.

A stock-duration comparison also found existing import/export frame
quantization: Archer Stand - 5 is 3709ms after export versus 3700ms in the
installed model. Non-ledge scene channels are unchanged by this correction;
exact stock millisecond preservation remains an exporter follow-up, outside
this contact fix.

## Aerial clips and interpolation repair

wc3-melee:tools/animations/aerials.py authors neutral, forward, back, up and down
aerials for both rigs. The existing author scripts invoke it; generated asset
metadata supplies clip indices/durations to the live attack renderer. Clips
are nonlooping, include complete rotations, retain weapon grips and have no
root travel. These are first-pass authored poses; animation-derived hurtbox
volumes and native active-frame alignment remain outstanding.

Adding alphabetically earlier actions exposed a general exporter defect:
numeric tracks used interpolation selected from the first action, affecting
unrelated clips. Bezier control conversion also used frame±1 evaluations
instead of the authored curve. Upstream repair:
mdl-exporter4 commit 376f0c2a153d1332ae535ad4cada75cd3340ca6a in
~/code/mdl-exporter4/worktrees/blender5. GPL tooling stays standalone; no exporter
implementation is incorporated into the Wurst map.

Numeric actions now sample independently into Linear tracks. Adaptive sampling
uses a 0.0001 criterion, bounded by integer-millisecond representation; this is
an approximation criterion, not a universal world-space vertex-error guarantee.
Constant transitions use the preceding millisecond; visibility/events retain
DontInterp. Serialization produces unique timestamps and inclusive endpoints.
The focused upstream Blender regression passes mixed interpolation, independent
actions, quaternion motion, constant/single-key tracks, timestamps and endpoints.
It compares evaluated source motion independently of the consumer package check.

wc3-melee:tools/animations/check-aerials.ts compares the current packages against
unchanged retained pre-aerial Blender scenes exported through the same repaired
exporter. Required local baselines are
wc3-melee:build/animation-assets/archer-before-aerial-repaired.mdl and
wc3-melee:build/animation-assets/rifleman-before-aerial-repaired.mdl. Their sources
are the corresponding *-before-aerial.blend scenes retained in that directory.
Both fighters pass: track identities/interpolation, exact key counts/values,
strict timestamp ordering and at most 1ms relative timestamp/duration variation
from existing sequence-offset quantization. The independent comparison covered
10,428 tracks. All 29 Archer and 26 Rifleman prior source actions remain unchanged.

Original ArcherBeforeAerial.mdx and RiflemanBeforeAerial.mdx are retained locally.
They fail the former exact-export comparison, recorded in
wc3-melee:build/animation-assets/check-aerial-interpolation-old-oracle.log.
Preserving authored motion is the accepted target; correcting the old exporter
can change previously displayed between-key poses. No claim of unchanged old
shipped interpolation, exact stock millisecond durations, or native animation
fidelity follows from the passing source-preservation check.

Native integration: isolated build replay-aerial-isolated executes jump,
double jump and neutral aerial for both fighters. Screenshots at aerial frames
8/11 show Archer's bow and Rifleman's rifle retained; input traces confirm
style 12. Evidence and limits are in wc3-melee:native-capability-report.md.
All five aerials per fighter compile/package, but this native check covers
neutral aerial only, outside its active frames. Frame-perfect contact/hurtbox
alignment and remaining clips need further validation.

## Longer neutral/back aerials and Rifleman backward kick

wc3-melee:tools/animations/aerials.py now matches the neutral/back timing in
wc3-melee:PHYSICS.md: source index 3 begins contact, neutral holds through 30
and back through 18, with recovery ending at 41 / 37. Generated durations
(1.708 / 1.542 seconds at 24fps) scale onto those simulation ticks. Both rigs
use the same provisional timing; forward/up/down clips retain their old motion.

Rifleman kicks with the camera-facing right leg instead of the occluded left
leg. Its imported rest knee is bent, so positive knee rotation straightens the
backward extension. Right thigh −100° / knee +40°, a tucked opposite leg, and
25° torso lean expose the boot behind the body. The packaged model's right
ankle is about 38.9 world units behind its hip during the held contact pose.
Root travel remains absent; the rifle retains the existing baked hand grips.

Both editable scenes and packaged models were regenerated. The existing
package check passed durations, nonlooping flags, complete rotations,
visibility and root-travel checks, plus preserved prior exported tracks.
A separate source comparison found all 32 Archer / 29 Rifleman actions outside
neutral/back unchanged, including the other aerials. The simulation package
passed 150/151 tests initially; the new clock test had incorrectly placed its
fixture beyond the blast ceiling. After correcting that fixture, the three
new timing/late-hit/single-hit tests passed with zero compiler warnings.
The other 150 tests, including up aerial's intentional multihit, had passed.

Exported MDX → MDL → Blender previews show the extended boot from the stage
camera and its reverse, through the late window, then retracted by index 32.
wc3-melee:build/animation-assets/rifleman-backair-comparison.png shows the prior
pose, new stage/reverse contact, late contact and retraction; individual views
use wc3-melee:build/animation-assets/rifleman-backair-stage-XX.png and
wc3-melee:build/animation-assets/rifleman-backair-reverse-XX.png. Check logs are
wc3-melee:build/animation-assets/rebuild-backair.log,
wc3-melee:build/animation-assets/check-backair.log and
wc3-melee:build/wurst-tests/backair-timing-focused.log.

A stricter new all-frame grip probe did not pass its 0.02-unit roundtrip
threshold: maximum reimported wrist error was 0.492 world units during startup,
versus source-scene error below 0.000014. The held contact's error is about
0.0077; the last active index measures 0.086. The importer rounds numeric key
times to whole Blender frames, which is a suspected contributor when importing
adaptive subframe samples; exporter versus importer attribution is not yet
isolated. This small transition discrepancy does not block the visible kick,
but is an open tooling defect, not an exact grip-fidelity claim. The original
failing probe remains wc3-melee:build/animation-assets/check-backair-roundtrip.py
and its log; the diagnostic measurement is
wc3-melee:build/animation-assets/measure-backair-roundtrip.log. No gate was
relaxed. Native playback, frame-perfect contact and final art quality remain
separate parent-owned checks.

## Grounded recovery and neutral aerial pose

`grounding.py` applies a per-frame vertical adjustment based on the visible
exported skin, moving the pelvis/chest branches and separate attachment roots
while leaving `Bone_Root` translation absent. The authoring run checked every
frame of Knockdown, Get Up, and Get Up Attack for both rigs; the measured floor
error was 0.0000 model units. This verifies authored mesh contact, not Warcraft
unit height or the feel of the native recovery timing.

The generic neutral aerial extends the camera-facing leg horizontally in the
stage plane, with the opposite leg bent backward. The imported Archer thigh
basis requires rotation on three axes: the earlier Z-only lift sent the leg
toward camera depth, foreshortening the kick. Archer raises her held bow above
the leg, and Rifleman lifts his held rifle clear of it. Both retain contact at
source frames 3–30 and recovery through 41. Exported MDX → MDL → Blender
stage-side previews are wc3-melee:build/animation-assets/archer-aerial-neutral.png
and wc3-melee:build/animation-assets/rifleman-aerial-neutral.png.

Rifleman's Back Air lifts the cape above his extended boot through contact,
then lowers it during recovery to the original drape by frame 32. Its leg pose
and 3–18 contact / 37-frame total timing remain unchanged. Exported contact,
late-contact and settled views use
wc3-melee:build/animation-assets/rifleman-backair-stage-03.png,
wc3-melee:build/animation-assets/rifleman-backair-stage-18.png and
wc3-melee:build/animation-assets/rifleman-backair-stage-32.png.

The existing aerial package check passes. Comparing the saved pre-change models
against the new packages found exact values, counts and relative timestamps for
6,324 Archer and 5,737 Rifleman unchanged tracks, including Rifleman's Back Air
leg and body tracks; only the two Neutral actions and Back Air's Cape04 track
are intentionally changed. Evidence is
wc3-melee:build/animation-assets/rebuild-neutral-kick-final.log. These exported
pose checks do not establish native playback or final art quality at game scale.

Archer Down Air now tucks both legs during its seven-frame startup, then extends
the camera-facing leg straight down while keeping the far leg folded through
20 active frames. The body folds over the extended leg, the bow stays on its
hand rig, and `Bone_Root` has no translation. Total clip length remains 38
frames; Rifleman's Down Air keeps its existing seven-startup/three-active pose.
Stage and reverse contact previews are
wc3-melee:build/animation-assets/archer-dair-contact-stage.png and
wc3-melee:build/animation-assets/archer-dair-contact-reverse.png; startup and
last-active views use the matching `archer-dair-*` names.

Both Spot Dodge clips now end at frame 22, with the protected crouch pose held
from frames 5 through 15. Archer's existing Back Air already reads as one leg
extended backward and the other tucked in the stage-side export; it keeps its
three-startup/16-active/37-total timing. Rifleman's Back Air is unchanged.

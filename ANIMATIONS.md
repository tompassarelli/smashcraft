# Authored fighter animation work

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
onto simulation timing. No root translation was added. Get-up rolls currently
reuse the existing roll clips and still need a transition from the prone pose.

The full asset build and exported MDX → Blender side-view pose check passed.
Knockdown ends prone, stand-up returns upright, and the attack has a visible
sweep in the rendered model. Native playback observations belong in
wc3-melee:DEVELOPMENT.md. Rifleman still uses stock animations.

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

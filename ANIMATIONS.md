# Authored fighter animation work

Required initial clips from the owner: jab; forward tilt; up-angled forward
tilt; down-angled forward tilt; jump; double jump; forward roll; backward roll;
get-up attack. Blender 5.1.1 is installed and background startup passed. No custom clips
have been authored or exported yet.

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
The Archer check preserves four mesh geosets and animated pose tracks.
Actual import → edit → export →
in-game playback remains the deciding check before choosing the pipeline.

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
existing motion; they do not yet contain the requested custom fighter clips.

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
change. The full extraction command passed in about five seconds; authored
animation playback remains unverified.

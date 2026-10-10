# What a player sees

`bun wisp headless --render PRIVATE_DIR --frames 64,132,159,169,206`
draws the requested frames at 1280×720 using the map's imported assets and
classic Warcraft models. `--graphics definitive` draws Definitive Edition:
`_de.w3mod` imports, then HD and base imports, followed by the stock layers.
Each player's look leaves the simulated match unchanged. `render.json` lists
every attempted layer and the map or stock path selected for each asset.
Asset paths come from this checkout's immutable
`build-inputs/`. Stock textures come from `WC3_TEXTURES`, or are extracted
with `CASC_EXTRACTOR` and `WC3_STORAGE`. The extractor
is built by `tools/animations/extract.sh`; DDS textures are converted with
ImageMagick (`magick` on version 7, `convert` on version 6). Ubuntu CI
installs its `imagemagick` package before running the stock-texture tests.
Extracted assets stay in
`~/.local/share/smashcraft-render-assets/` outside the repository.
Stock cache directories use the selected installation's `.build.info` hash;
updating Warcraft therefore extracts the new stock art. For a native comparison,
set `WC3_STORAGE` to that client's installation and `WC3_ASSET_MANIFEST=FILE` to
save its build fields and the SHA256 and size of each returned asset. Keep that
manifest beside the private captures. `WC3_TEXTURES` remains an explicit override;
omit it when the comparison must use the selected installation's textures.

`--journey FILE` replaces the default quick match with capture inputs:
`{"frames":210,"events":[{"frame":30,"player":0,"chat":"-dev quick hero rifleman"}]}`.
Events use Wisp journey chat, key and reload records, in frame order. Keys
may include `down: true` or `down: false` to hold or release an input.
Use the same source revision, fighter, inputs and camera as a native capture.
The existing `test/native/pads/171/` scripts cover Rifleman, Illidan,
Blademaster and Warden at frame 132 (walk) and 169 (run); their `*-cues.pad`
scripts supply strike and special examples; Illidan's Immolation is a
special example. These names alone are capture locations,
not measured renderer agreement.

For the native pad path, run `bun wisp pad SCRIPT --headless --helper BINARY
--out PRIVATE_RUN --render PRIVATE_FRAMES --frames 132,169`. It uses the
same real helper and analog pad inputs as the native parity run, captures
each requested frame using the native capture's held-pose schedule, then renders after
the helpers stop. Without `--frames`, it draws every `capture` in the script.
Each selected frame must name a script capture; a missing drawn frame fails
the command. `--compare NATIVE_RUN` also compares the normal parity records.
`sound-cues.json` records the sounds each client created, started and stopped,
with their label or source path, callback frame and observed match frame.

Logic tests, type checks, the desync guard and the native match gate can all
pass while a player sees no stage or an effect that never leaves. Smashcraft
uses Wisp's player-view checks (wisp:docs/player-view.md) to fail on those:

- **Scene report.** The development entry (smashcraft:ts/src/platform/devMain.ts)
  and the integrity entry start Wisp's scene recorder through
  smashcraft:ts/src/platform/sceneReport.ts. The recorder's clock is the
  confirmed simulation frame. An effect is out of view only when it is parked
  on the ground beneath the floor, where `hideEffect` puts it and
  `AddSpecialEffect` creates it: alpha, scale and time scale do not stop a
  model's particle emitters. Playable entries never import the recorder; their
  emitted Lua is unchanged by it.
- **Frame probe.** One frame per client, captured off-screen from its private
  desktop and kept on disk.

smashcraft:ts/scripts/wisp/playerView.ts declares the expectations. Each kind
of effect lists its models, taken from the game's asset modules where the host
can load them, and the longest a player should see one stay in view. The stage
needs one drawn deck. A model the declaration doesn't list fails the check as
soon as it is in view, so a new model needs a kind before it ships.

## Hidden effects a player still sees

The winter arena's sky, fog and backdrop are declared in
smashcraft:ts/src/game/presentation/stageScenery.ts and drawn by
smashcraft:ts/src/platform/shell/stageScenery.ts. They never enter match or
replay state. Frozen Throne uses classic Lordaeron Winter sky and Icecrown
doodads referenced by their game paths. Its drifting snow is an authored
model from smashcraft:tools/stage/package.ts using the stock snowflake texture:
terrain weather falls below the elevated arena. Each mesh and particle reach
stays behind the fighting volume; fog starts beyond it. The player-view test
checks those bounds in every declared camera and a winter match's scene.
Run `bun wisp headless frozen-throne` from smashcraft:ts/ for the two-client
journey; a developer build accepts `-dev quick frozen-throne` for native capture.

The scene check also applies Wisp's render visibility (wisp:docs/player-view.md):
it fails on a named model that is empty, unknown or draws nothing, on a
collapsed effect in view whose model keeps emitting particles, on a parked
effect whose mesh or particles reach the arena camera's frame, and on an
effect destroyed in view whose death animation emits. It reads:

- **Model facts**: smashcraft:ts/scripts/wisp/model-facts/ (one file per model, read by modelFacts.ts), generated for
  every model a kind names. Imported models are read from the build's
  `--assets` inputs, stock models from the game's archives in the classic
  graphics the clients draw: the smoke in the four-fighter recording is the
  classic GyroCopterMissile's `BlizParticle02` (05266a3). After a model
  changes, or a kind names a new one, regenerate the table; a missing entry
  fails the check:

  ```sh
  # The CascLib extractor, as smashcraft:tools/animations/extract.sh builds it:
  nix shell nixpkgs#gcc --command g++ -O2 -I CASCLIB/src tools/animations/casc-extract.cpp CASCLIB/build/libcasc.a -pthread -o build/animation-assets/casc-extract
  cd ts && bun wisp view models --assets ASSETS --summon ASSETS/summon-original-clips \
    --extractor ../build/animation-assets/casc-extract --storage "WARCRAFT_III_DIR"
  ```

  After deleting a scene model, `bun wisp view models --prune` removes its
  old measurement while retaining current models. A new model still needs
  the full measurement command.

  Only numbers are kept: geosets, triangles, lights, boxes, and each
  emitter's rate, lifespan, reach and when it runs. Model files stay in the
  private inputs and the game's install.
- **Arena cameras**: the camera smashcraft:ts/src/game/presentation/arenaCamera.ts
  frames for every span of live fighters inside the blast zones, in quarters
  of each zone, at the clients' 16:9. Warcraft spreads the 70-degree field of
  view across the frame's width: in the 1280x720 four-fighter recording,
  world x 0 sat at screen x 283 with the camera 592 to its right, where 70
  degrees across the width predicts 274 and 70 degrees down its height 434.
  Its lowest ray falls about 31.5 degrees, and the camera never lowers it to
  meet the ground nearer than 1300 units beyond the stage center.
- **Fighter framing**: each client zooms its copy of the match camera out
  until every live fighter's drawn body, plus one shared margin (80 above,
  100 below, 15 at the sides), is in view and no body is taller than 30% of
  the frame (today's mid-size pairs draw at 28–29%). Bodies come from
  smashcraft:ts/src/game/presentation/fighterViewBounds.ts, the larger of each
  fighter's Classic and Definitive Stand pose, generated by
  `WC3_STORAGE=CLIENT_INSTALL bun scripts/fighterViewBounds.ts` from ts/.
  At the stage's zoom limit (#80) a far fighter may leave the frame and gets
  its offscreen bubble. smashcraft:ts/test/fighter-framing.test.ts checks
  every pair in both looks at 16:9, 16:10 and 4:3.
- **Parking**: `hideEffect` parks hidden effects on the ground beneath the
  stage center, FLOOR_HEIGHT below the floor, where they are created.

With the models of the 0.0.44 inputs, everything a parked effect can draw
stays out of all 225 framings. The margin is how much higher the parking
place could be: about 88 units for Illidan's flames (ImmolationTarget, whose
particles rise and spread from 150 units up), about 280 for the hippogryph's
death spray and the GyroCopterMissile's death bursts, and 400 or more for
every other model.

## Offscreen portraits

Offscreen portrait and arrow frames use `ConsoleUIBackdrop` as their parent.
Warcraft limits custom BACKDROP and TEXT frames parented to GameUI to the
central 4:3 screen area, compressing backdrops and cutting off text beyond
it ([frame positioning, 4:3 limitation](https://www.hiveworkshop.com/threads/the-big-ui-frame-tutorial.335296/#PosFrames_Limitation43)).
At 16:9 our right-side portrait and arrow can lie beyond that area, so their
fullscreen parent is a native rendering constraint. The camera detector
checks it explicitly because the headless frame recorder stores requested
points without reproducing the native clipping. A fresh map creates the
correct parents; hot reload retains the parents of existing native handles.

## Below the deck

The match HUD covers the frame from about 77% of its height down
(smashcraft:ts/src/game/ui/matchHud.ts). Framing fighters 160 below the
camera's target put a fighter under the main deck, and the deck's underside,
behind it: on 0.0.49 the deck's charcoal reached 76–91% of the frame height
and the HUD started at about 82%
(smashcraft:evidence/bot-session-0049-native-20261006/README.md). So when the
lowest fighter would show below 72% of the frame, the camera follows it down,
as Melee's follows a fighter under the stage, keeps up to 100 units below it in
view down to the underside, and backs off to keep the highest fighter's head
below the frame's top 3%. Parking caps how far it lowers: the frame's lowest
ray meets the ground no nearer than 1300 units beyond the stage center, which
keeps the margins above. A framing with every fighter on or above the floor
and the lowest showing above 72% is unchanged.
smashcraft:ts/test/player-view.test.ts places a fighter within 100 units of the
underside, under it or beside the walls, with the other fighter KO'd, on a deck,
high, at the top blast zone or far to a side, and checks the camera the
development build sets: the fighter and the underside nearest it show above
77% of the frame in all 60 cases.

For a native capture, set `CURRENT_BUILD`'s scenario to `underside`
(smashcraft:ts/src/game/shell/currentBuild.ts), build the development map and
run `bun wisp fresh MAP.w3x`. The quick match freezes player 1 in the air
beside the main deck's lower right corner, level with its underside, for ten
seconds, and fresh saves each client's frame at match frame 30.

## Where it runs

- `bun wisp fresh MAP.w3x` checks every client after the quick match's
  receipts: the scene report once the match has run 30 frames (main and
  integrity profiles), and one frame saved to
  `~/.local/state/smashcraft/frames/CLIENT.ppm` (every profile).
- The native journeys (`bun wisp integrity capture --four-fighters`, `integrity capture`)
  check both at each match start, about one second in, saving frames to
  `OUT/player-view-EPOCH/CLIENT.ppm`, and the scene again at each result,
  when every stay in view has ended. The playable journey's build has no
  recorder, so it gets the frame only. The four-fighter and playable journeys
  stop at a failed check. The #26 input-integrity capture records each
  check's result in capture.json (`player-view` events) and goes on, so every
  match still exports its response pages; `bun wisp integrity result` lists the
  failures beside the integrity table and in summary.json
  (`player_view_failures`), and only the integrity gates decide its exit.
- `bun wisp view scene DATA_DIR...` checks each client's latest report, with
  render visibility, and
  `bun wisp view frame FRAME.ppm...` measures frames, from captures or
  recordings, with the same expectations.

A failure names the client, what a player would see wrong, the measurement or
report line that shows it, and the report or frame file.

## Frame features

Bands are fractions of the frame, so a 2560x1440 capture and a 1280x720
recording are measured alike.

- **Arena sky**: at least 50% of the top 40% of the frame is sky (blue at
  least 170 and at least 25 above red). Menus, lobbies and results have none,
  so a capture that missed the match fails instead of passing.
- **Stage in the stage band**: in rows 45% to 71% of the frame height,
  between the fighters' feet at match start and the HUD, at least 1% of the
  frame's height in rows (14 at 1440, 8 at 720) must hold an unbroken run of
  deck colour at least 20% of the frame's width long. Deck colour is the
  charcoal, steel or brass of smashcraft:ts/src/game/assets/stagePalette.ts,
  each channel within 40; the deck model is unshaded, so it renders in those
  colours. The slate top is left out: it is within 32 of the sky and clouds.

Calibration, on the 87 frames at 1 fps of the stage-less native four-fighter
recording (native-delivery-20261005/four-fighters-2, an integrity build of the
0.0.43 code, 1280x720): in the 45 match frames the stage band held at most
1 qualifying row (one transient frame; 44 frames held none) against the 8
required, and sky covered 89.7% to 97.2% of the top band; all 45 fail as
stage-less. The 42 menu, lobby and result frames show at most 3.3% sky and
fail as no match; the stage band alone would pass them, because the
selection backdrop is deck-coloured. At tolerance 40 the match frames'
longest deck-coloured run was 5.9% of the width, apart from the transient
frame's one full-width dark row; adding slate at tolerance 32 lets sky and
clouds reach 24.7%. A frame with the stage drawn has not been measured yet;
the main deck's front face, drawn down to its underside 332 units below the
floor, spans an estimated 35% to 63% of the width over 14% to 28% of the
height at match start.

## Lifetimes

Lifetimes are what a player should see, not what the code that hides an
effect happens to do, with room for a pool slot reused while shown: three
seconds for hit sparks, KO bodies, bear and Illidan's flames;
four for projectiles; six for an ice shell; ten for the dizzy mark; 31 for
an unsprung freeze trap; 75 for a shield bubble, which the lightest press
drains in about 72 s. A stay starts when the game places an effect in view
and ends when `hideEffect` parks it, at that frame. The impact pools reuse a
slot for the next hit or dust while the last may still show; the pool parks
the slot first, so each use is a stay of its own. Dense play with three
fighters keeps a dust slot in view for about 4 s across more than a dozen
uses, each at most its 32 frames.

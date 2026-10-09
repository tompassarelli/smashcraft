# Visual quality: the renderer levers a map has

What Warcraft III 3.0 and 3.0.1 let a map change about how the game looks, what each
lever does and costs on the native clients (Warcraft under Wine), and which
ones Smashcraft uses on which stage. Stage composition (scenery, depth bands,
deck palettes) is in [stage art](stage-art.md); this page is about light,
atmosphere and materials. Every feature added since Reforged, by patch, is
indexed in [Warcraft features since Reforged](warcraft-features.md).

Each claim below names its source: a repository file, a cited document, or a
measured capture. **Unmeasured** marks a lever whose 3.0 behaviour no
Smashcraft capture has shown yet; *(guess)* marks an inference.

## The renderer is fixed

A map ships data and a Lua script; it can't ship shaders or change the
pipeline. 3.0 has three graphics modes, picked by the player (War3Preferences
`[Misc] hd`, 0 Classic, 1 Reforged, 2 Definitive Edition; Definitive replaced
2.0's Classic HD): Classic draws the root asset set with fixed-function
lighting, Reforged and Definitive draw `_hd.w3mod` and `_de.w3mod` assets with
physically based materials (diffuse, normal, ORM, emissive, team colour,
environment map), image-based lighting, shadow maps and point lights
([Blizzard's 3.0.0.24268 patch notes](https://us.forums.blizzard.com/en/warcraft3/t/warcraft-iii-reforged-forsaken-kingdom-patch-notes/38400),
[Hive 3.0 thread](https://www.hiveworkshop.com/threads/warcraft-3-reforged-forsaken-kingdom-expansion-and-major-updates.374111/)).
The map can't read or choose the mode. Everything below is the set of inputs
those fixed pipelines take. The pool clients run 3.0.1.24342 as of 8 Oct
(their `.build.info`); the native names below are unchanged from 3.0.0.

Record the graphics mode in each capture. A client preference is evidence of
the selected mode, not evidence that an individual imported model uses PBR.

## The levers

Native names are from 3.0.0.24268's common.j (wisp:src/natives/warcraft.d.ts).
"On 3.0" says what a Smashcraft native capture or file read has shown; the
measurements are in [Measured on 3.0](#measured-on-30-under-wine).

| Lever | Natives | What it changes | Modes | On 3.0 under Wine |
| --- | --- | --- | --- | --- |
| Lighting model | `SetDayNightModels(terrain, unit)` | The directional key light, its colour and the ambient fill for terrain and for every unit and effect, sampled at the time of day | all; each mode loads its own stock model, an imported one is the same file in every mode | **Measured**: an authored stage light lifts fighter L\* by 8–13 against stock on four stages; the decks and sky barely move |
| Shadow strength | none | No field for it in the MDX 800 light record (smashcraft:ts/scripts/stageLight.ts writes all of them) | — | Version-1800 light records carry 24 bytes the decoder doesn't read; whether they hold shadow settings is unknown *(guess: they might)* |
| Time of day | `SetTimeOfDay`, `SetTimeOfDayScale(0)` | Where the lighting model is sampled; the shell freezes noon (smashcraft:ts/src/platform/shell/shell.ts) | all | Source only; the authored lights are constant over the day, so the frozen hour can't move them |
| Distance fog | `SetTerrainFogEx(style, start, end, density, r, g, b)` | Linear (0), exponential (1) or exponential-squared (2) fog over terrain, units and effects | all | In use (linear, density 0) on every stage; no separate fog measurement |
| 3.0 fog | `SetTerrainFogExV`, `BlzSetTerrainFog{Style,ZStart,ZEnd,Density,HeightStart,HeightEnd,LinearStart,LinearEnd,MaxLinearDensity,DrawOverSky,Color}`, styles 3–5 | Height fog, a density cap and fog drawn over the sky | per PN3 all, with HD fog | **Unmeasured**; `-dev fogv` and the `192-*-linear\|height` checks exist, no run yet |
| Sky | `SetSkyModel`, `BlzShowSkyBox` | The sky dome model; hiding it leaves the clear colour | all; HD-only stock skies are blank in Classic | **Measured**: authored skies fill 76–96% of the top band on all nine #178 stages; hidden, the empty screen reads rgb(4,4,4) |
| Terrain | `BlzShowTerrain` | Hides all terrain | all | Called on every stage draw since #191; no native capture of it yet |
| Weather | `AddWeatherEffect(rect, id)` | Particle weather emitted 768 above the terrain | all; Snowflakes is HD-only | Source only: it falls below the arena, which stands 1,800 above the ground ([stages](stages.md#what-the-clients-can-show)); Frozen Throne's snow is an authored model instead |
| Ubersplats | `CreateUbersplat` | Terrain decals | all | Source only: terrain-only, and the terrain is hidden, so unusable |
| Effect colour and alpha | `BlzSetSpecialEffectColor`, `BlzSetSpecialEffectAlpha`, `BlzSetSpecialEffectColorByPlayer`, `SetUnitVertexColor` | Multiplies a model's vertex colour; fades it | all | In use (7, 15, 2 and 1 source files under ts/src); no lighting-specific measurement |
| Effect models | `AddSpecialEffect` with stock or imported MDX | Additive and emissive-looking layers, particle emitters, ribbons, and in HD modes the model's own point lights | all; point lights in HD modes only, unlimited in HD since 3.0, capped in Classic | Ribbons and emitters in use (their model facts: [render visibility](../../evidence/render-visibility-20261006/README.md)); the tech-contact omni light is **unmeasured** |
| Lightning | `AddLightningEx` | Textured beams between two points | all | In use in 1 file; nothing measured |
| Cinematic filter | `SetCineFilter*`, `DisplayCineFilter` | A full-screen textured overlay, local per player | all | Unused. It covers fighters and backdrop alike, so it can't separate them *(guess)* |
| Depth of field | `CAMERA_FIELD_DEPTH_OF_FIELD_DISTANCE`, `…_SCALE`, `CameraSetFocalDistance` | A full-screen blur by distance | HD | Unused, **unmeasured** |
| HD water | `SetHDWaterParams*`, `BlzSetHDWater*` | HD water's colour, opacity, reflectivity, emissivity, waves | HD modes | Unusable: water is terrain, and the terrain is hidden |
| Point-light shadows | `BlzSetMinShadowCastingPointLightCount` | How many model point lights cast shadows | HD modes | Unused, **unmeasured** |
| Lighting editor, omni lights | World Editor 3.0 (`war3map.w3l`, imported DNC models) | The map's own terrain and unit DNC models; map-placed omni lights and shadow-casting omni lights | HD modes; placed once per map, not per stage | Unused; file format in [Lighting editor output](#lighting-editor-output-war3mapw3l) |
| Map post-processing | World Editor 3.0 (`war3mapPostProcessing.txt`) | Ambient occlusion, bloom, portrait bloom, tone-map exposure and normal-map strength for the whole map | HD *(guess)* | Shipped (#288, smashcraft:ts/scripts/postProcessing.ts): bloom above 0.9 and contact-shadow ASSAO; fields in [Map-level post-processing](#map-level-post-processing-what-the-editor-writes); no native changes them |
| HD materials | stock asset paths | Reforged and Definitive draw the HD PBR copy of a stock path | HD | **Measured** availability: all 25 stock scenery and sky paths resolve in all three modes; the HD draw itself is unmeasured |

### What is impossible

Not available to a map: custom shaders or materials beyond what MDX layers
and HD material slots express, replacing the renderer, colour LUTs, bloom or
exposure from script, creating or moving omni lights at run time (except by
placing effects whose models carry lights), driving PopcornFX particles, and
reading or choosing the player's graphics mode or options
([features index](warcraft-features.md#impossible-for-a-map)).
Editor-level post-processing is available in 3.0 as one file per map:
ambient occlusion, bloom and tone-map exposure are map-wide settings, not
script levers, and there is still no colour grading or LUT
([below](#map-level-post-processing-what-the-editor-writes)). The player's
own settings are theirs (#165).
In 3.0, Point Light Shadows, Water and Supersampling were added, Shadows
became Environment Shadows, and the player-facing Ambient Occlusion, Bloom,
Portrait Bloom, Particles and Spells options were removed.

### What the modern examples change

[The Silent's custom DNC workflow](https://www.hiveworkshop.com/threads/custom-day-night-light-enviroments.274081/)
edits ambient-colour tracks in a 60,000-frame lighting sequence. It changes
the scene's key and fill without repainting every asset. The alternative is
a stock DNC with fog and stock sky selection: less precise mood control, but
it avoids relying on custom DNC support. Smashcraft compares the two on the
same paused fighter scene with `-dev lighting stock` and `-dev lighting stage`.

[POLAT G's HD maps](https://www.hiveworkshop.com/threads/playable-nerubian-%E2%80%93-high-elf-%E2%80%93-naga-races-reforged-hd-only.332605/)
are explicitly HD-only; their 3.0 map listings use hundreds of megabytes of
content. That approach permits HD-only scenery and race models, but cannot
serve Smashcraft's Classic fallback. Keeping stock paths lets Warcraft choose
the appropriate installed variant instead.

[Quenching Mod's 3.0 compatibility reports](https://www.hiveworkshop.com/threads/quenching-mod.331686/post-3738850)
describe replacement object shaders crashing after loading and replacement
post-processing glitching. It modifies the client, so its shader screenshots
do not establish a renderer feature that an ordinary map can distribute.
Smashcraft uses map lighting, atmosphere and the installed graphics variants;
it does not require that client modification.

### Assets and graphics modes

A stock path resolves per mode: `Doodads\Cinematic\FrozenThrone\FrozenThrone.mdx`
draws the classic model in Classic and its HD remake in Reforged and
Definitive. The installed 3.0.0.24268 CASC audit resolves all 21 distinct stock
scenery models and all four distinct skies in Classic, Reforged and Definitive
(25 normalized paths; `.mdl` and `.mdx` aliases counted once). Frozen Throne
is 80,057 bytes in Classic and 8,074,270 in Reforged; glacier models carry
diffuse, normal, ORM and emissive texture slots in the HD files. Byte counts
and texture slots establish asset availability, not successful native drawing.
The recorded numerical audit is
smashcraft:evidence/visual-assets-20261007/asset-summary.json. Some models'
new light-node data exceeds the current `war3-model` decoder; their successful
extraction and byte count remain observed, while their material slots are
not claimed from that decoder.
CASC names these as
`war3.w3mod:PATH` and `war3.w3mod:_hd.w3mod:PATH`; Definitive replacements live
under `war3.w3mod:_de.w3mod:PATH` and absent overrides fall back to installed
shared assets. Verify presence with the existing CASC extractor, and record
the byte counts separately from native draw evidence. HD clients resolve
their PBR scenery from these stock paths. Imported models
(war3mapImported\, the decks, the skies, fighters' clip pools, impact
effects, the stage lights) draw the same file in every mode with classic
materials. The stock lighting models are different files per mode (below);
an imported lighting model is not replaced in HD modes.

Ten stages draw an authored sky sphere (smashcraft:ts/src/game/assets/stageSkyInfo.ts,
generated by smashcraft:tools/stage/skies.ts), imported and so the same in
every mode; Nordrassil keeps the stock FelwoodSky for its aurora
([stage art](stage-art.md#authored-compositions-and-visual-references)).
The HD-only stock skies (IcecrownGlacierSky, NorthrendSky, AshenvaleSky,
BarrensSky, and the Definitive-only NaxxNightSky, UndercitySky, ArcaneSky)
show nothing in Classic, so no stage uses them.

### Lighting models

A day/night (DNC) model is an MDX with one directional light whose `Color`
(key) and `AmbColor` (fill) tracks run over a 60-second `Stand` sequence
mapped to the 24-hour day. The terrain model lights terrain and the unit
model lights units and special effects, so on Smashcraft's floating arena the
unit model lights both the fighters and the scenery. The decks are unshaded
and ignore it; so is the sky.

The stock Lordaeron unit light is a different file in each mode (read from
3.0.1.24342's storage, smashcraft:evidence/stage-lighting-20261008/):

| Mode | Noon key colour (RGB) | Noon key intensity | Noon fill |
| --- | --- | --- | --- |
| Classic | (0.996, 0.996, 0.996) | static, not decoded | (0.84, 0.84, 0.98) |
| Reforged | (0.839, 0.839, 0.980) | 0.92 | static, not decoded |
| Definitive | (1.0, 1.0, 1.0) | 1.0 | static, not decoded |

Classic's night key and fill are (0.31, 0.53, 0.80). All three are MDX
version 1800, whose light records `war3-model` 4.0.1 rejects; the tracks
were read by their chunk tags.

Smashcraft authors one lighting model per stage (smashcraft:ts/src/game/assets/stageLighting.ts;
smashcraft:ts/scripts/stageLight.ts writes the MDL, smashcraft:tools/stage/package.ts
compiles it into the stage-assets family): a directional light with constant
key and fill colours at intensity 1 (a stage's light may set a lower one) and the classic sun's rotation, so the
time of day can't move it. The shell sets it with the sky and fog when a
stage is drawn (smashcraft:ts/src/platform/shell/stageScenery.ts) and loads
them all at map start.

Patch 2.0 broke custom DNC models: one with a light node lit the whole map
with no shadows, one without went black
([Blizzard forum](https://us.forums.blizzard.com/en/warcraft3/t/dnc-light-models-now-bugged-post-patch-20/33763)).
On 3.0 the authored model does take effect, and nothing goes black: it
changes fighter lightness on every measured stage (below). Whether it also
drops shadows, as the 2.0 report says, is **unmeasured**; the check asks the
native owner to record shadow changes.

### Stage light rules

smashcraft:ts/src/game/assets/stageLighting.tests.ts enforces them:

1. Every selectable stage has its own light; no two share one.
2. The key light's luma is at least 210, so a fighter's lit side stays bright.
3. The fill's luma is at least 120 and at most the key's, so a fighter's
   shaded side stays readable against the dark lower backdrop.
4. Neither colour's chroma (largest channel minus smallest) exceeds 80, so a
   tinted light never repaints the team colours.
5. A light's intensity, which scales key and fill together, is above 0 and at
   most 1.25. Blackrock uses 1.2 against its dark cavern; Ahn'Qiraj's is 0.5,
   pinned, so fighters stay darker than its bright
   sandstone ring (#267). Frozen Throne's is 0.8, pinned, so its lit key sits
   below the dimmest stock noon key, Reforged's 0.92 × (0.84, 0.84, 0.98),
   against its bright glacier backdrop (#265). Both follow "light the play,
   not the backdrop" ([stage art](stage-art.md), CEDEC 2019): fighters must
   neither dominate nor vanish.

Rules 2 and 3 hold fighters bright. The measurement below shows that is only
right where the backdrop behind the fighters is darker than they are.

### Chosen stage atmosphere (Classic and Definitive)

The selectable stage chooses its own sky and fog colour, with distance fog
starting at least 5,000 units away from the camera and ending beyond that
start. Height fog's upper edge stays below the deck. These requirements are
pinned through `stageScenery` in
smashcraft:ts/src/game/presentation/stageScenery.tests.ts; the camera-specific
fighter clearance check remains in smashcraft:ts/test/player-view.test.ts.

The light rows live in `stageLighting.ts`; sky and fog are selected by
`stageScenery.ts`. Both modes use the same stage choice and authored DNC
model. Stock scene paths resolve to the player's Classic or Definitive art.
Classic retains distance fog where the client does not draw height fog or
model omni lights. The original imported skies use unshaded materials in
both modes; the three stock skies preserve their stock animation.

| Stage | Key / fill RGB; intensity | Sky | Distance fog start–end; RGB |
| --- | --- | --- | --- |
| Sky Deck | 255,255,255 / 214,214,250; 1 | Original neutral sky | 6,000–12,000; 0.6875,0.8125,0.9375 |
| Frozen Throne | 226,240,255 / 150,172,220; 0.8 | Original glacier sky | 5,000–11,000; 0.375,0.625,0.875 |
| Nordrassil | 236,246,232 / 136,178,172; 1 | Stock FelwoodSky aurora | 5,500–11,000; 0.25,0.5,0.375 |
| Gryphon Aerie | 255,248,226 / 164,182,220; 0.2 | Original mountain sky | 5,500–11,500; 0.25,0.375,0.5 |
| Durotar Skies | 255,226,180 / 190,152,134; 0.3 | Original dusty sky | 5,000–11,000; 0.75,0.5,0.25 |
| Naxxramas | 222,230,255 / 150,136,196; 1 | Original slate-teal sky | 5,000–11,000; 0.25,0.5,0.625 |
| Hellfire Citadel | 255,222,196 / 140,172,120; 1 | Stock Outland_Sky | 5,000–11,000; 0.25,0.5,0.125 |
| Blackrock | 255,248,232 / 170,124,112; 1.2 | Original forge sky | 5,000–10,000; 0.5,0.125,0.0625 |
| Ahn'Qiraj | 230,236,255 / 150,162,204; 0.3 (approved #267) | Original sandstone sky | 5,000–10,000; 0.75,0.625,0.375 |
| Stratholme | 255,214,180 / 170,140,150; 1 | Stock LordaeronFallSky | 5,000–11,000; 0.5,0.28125,0.1875 |
| Tomb of Sargeras | 226,244,255 / 130,176,180; 1 | Original tide sky | 5,000–11,000; 0.25,0.4375,0.46875 |

Nordrassil, Gryphon Aerie and Tomb additionally use the below-deck height
fog described in their stage sections. Blackrock, Hellfire, Naxxramas and
Stratholme carry distant model lights in Definitive. The stage-specific
capture comparisons decide fighter contrast; this table describes the
chosen settings and does not replace those comparisons.

## 3.0.1 and Forsaken Kingdom: what came after the table

There is no Warcraft III 3.1. Forsaken Kingdom is 3.0.0 (build 24268, 12 Sep
2026), the release the tables above already cover. Its only follow-up is
3.0.1 (build 24342, 7 Oct 2026). This section covers what 3.0.1 and the
expansion's art add, read on 8 Oct 2026 from
[Blizzard's 3.0.1 notes](https://us.forums.blizzard.com/en/warcraft3/t/warcraft-iii-reforged-forsaken-kingdom-patch-notes/38400/4)
("PN301"), Blizzard's patch servers, Hive Workshop, and the installed
3.0.1.24342 storage. The storage was read with the CascLib extractor
(smashcraft:tools/animations/casc-extract.cpp) and a CascLib file listing
(175,416 entries).

### Which version runs where

| Who | Version | Evidence |
| --- | --- | --- |
| Battle.net players, every region | 3.0.1.24342 | `http://us.patch.battle.net:1119/w3/versions` on 8 Oct: us, eu and kr all list `3.0.1.24342`. [BlizzTrack](https://blizztrack.com/view/w3?type=versions) indexed it on 7 Oct at 16:33 UTC, replacing 3.0.0.24268 |
| Public test realm | 3.0.1.24332 | `…/w3t/versions` on 8 Oct: one build older than live. No 3.1 test build exists, and no 3.1 topic appears in the [forum's latest topics](https://us.forums.blizzard.com/en/warcraft3/latest) |
| Our test clients | 3.0.1.24342 | The `.build.info` of all 34 offline pool clients (~/.local/share/wisp/lan/clients/), the signed-in clones a–d and Tom's install, all written 8 Oct 00:41 +0800 |
| Our base map | saved by the 3.0.0.24268 editor | The base input's war3map.w3i: format 39, editor 7000, game version 3.0.0.24268, Lua, graphics-modes field 3, game data version 2 (*(guess)* 2 is the Forsaken Kingdom data set that the [Hive bugs thread](https://www.hiveworkshop.com/threads/warcraft-iii-3-0-bugs-issues.374131/) says unversioned maps fall into) |

The #170 lighting captures (7 Oct, 08:11–08:22 UTC) ran before 3.0.1 went
live, so they were taken on 3.0.0. The stock light decode above was read from
3.0.1.

Since 3.0 the Reforged client must stay online (PN3), and Battle.net serves
one live build, so every player who can join a Smashcraft lobby runs
3.0.1.24342. *(guess)* A client on an older build can't join, because
Battle.net has always required the current build. The offline Classic Client
has no Lua and can't run Smashcraft.

How a map uses a newer feature safely:

1. **Engine features (natives): require the live build.** Battle.net forces
   it, so no older build reaches a lobby. A rollout is the one exception: a
   native added after 3.0.1 can be ready before every client updates. In
   Lua each native is a global, so `BlzNewNative ~= nil` detects it; call it
   through a nil-checked Wisp declaration and keep the 3.0 call as the
   fallback until the lane's clients run the new build. Both clients must
   take the same branch, which they do when they run the same build. No
   native returns the patch number: `VersionGet` reports only Reign of Chaos
   or Frozen Throne (common.j).
2. **Graphics-mode features: build in a fallback, because the map can't
   detect the mode.** Most new presentation is mode-dependent.
   - A stock path resolves per mode ([Assets and graphics modes](#assets-and-graphics-modes)).
   - A map can ship its own per-mode copies. Blizzard's Silverpine Sprint
     scenario imports `_DE.w3mod\terrainart\…` files beside its root files,
     so Definitive loads the `_DE` copy and the other modes load the root
     one. *(guess)* `_HD.w3mod\` works the same way for Reforged, as it does
     in stock storage. **Unmeasured** in Smashcraft. With this, a stage light
     could carry Definitive-tuned values while Classic keeps today's.
   - HD-only effects (point lights, depth of field, AO, bloom) only add to the
     picture. The Classic draw without them must already read.
   - Requiring a mode: the w3i graphics-modes field is 3 in Smashcraft's base.
     Both Forsaken Kingdom scenario maps set it to 4 and use Definitive-only
     art. *(guess)* The field is a bitmask: 1 Classic, 2 Reforged,
     4 Definitive. What the client does when the player's mode isn't
     supported is **unmeasured**. Don't require a mode: Mac players report
     that Definitive can't be selected
     ([forum](https://us.forums.blizzard.com/en/warcraft3/t/cant-select-definitive-graphics/38432)).
3. **Player options are the player's.** Point Light Shadows, Water,
   Environment Shadows, Ambient Occlusion and Supersampling can't be turned on
   by a map. The old pool pair 2 baseline (7 Oct) disabled those settings.
   Wisp's `capture-classic` and `capture-definitive` profiles now set
   `lightingquality=2`, `texquality=1`, `shadowquality=2`,
   `pointlightshadowquality=2`, `waterquality=2` and `assao=1`; each records
   its graphics mode (wisp:docs/lan.md, "Profiles"). #287's first box used
   those profiles on 3.0.1; its complete stage baseline still needs the
   stock/mask/stage sets.

   Wisp's headless Classic and Definitive profiles are separate from these
   native client preferences. At Wisp `1383a934`, both draw day/night light,
   fog, sky and sun shadows. Definitive also draws model point lights, PBR
   materials, point-light shadows, ambient occlusion and bloom. Water and
   height-fog falloff still require native captures. A requested unsupported
   lever fails `--look` before drawing; an image with a model named in
   `render.json`'s `notDrawn` cannot tick a complete visual capture box
   (wisp:docs/headless.md, "Graphics profiles"). Take each stock, mask and
   stage frame at the same pose and camera: separate headless journeys at
   the same frame, rather than three different simulation frames. Leave the
   headless journey unpaused: pressing Y opens the pause menu over the stage,
   darkening and covering the scene being measured.

### 3.0.1 presentation changes

From PN301 (art, world editor and bug fix lists):

| Change | Effect on Smashcraft |
| --- | --- |
| Ambient Occlusion is a player option again (`assao` in War3Preferences); it "may result in reduced performance" and no longer affects terrain or close-up cinematic shots | When a player turns it on, AO darkens the creases on fighters and scenery. A map tunes it through its post-processing file (below). Hidden terrain makes the terrain exclusion moot |
| Daytime lighting on Lordaeron Summer biomes is 10% dimmer | This may move the stock baseline `-dev lighting stock` uses (DNCLordaeron). *(guess)* The Reforged noon key intensity of 0.92 read from 3.0.1 may already be the dimmed value. Re-capture stock baselines on 3.0.1. Authored stage lights are imported and don't change |
| About 35 spell effects retuned (Blizzard, Divine Shield, Starfall, Death Coil, Breath of Fire, Banish and others); Pandaren Brewmaster and Orc Grunt reanimated; tint or scale changed on turtles, wildkin, golems and wolves | Re-take reference captures of any stock effect used as a hit or special effect. Chen's private model comes from the stock Brewmaster rig, so re-check his clips against 3.0.1 *(guess: extracted before 3.0.1)* |
| `Doodads\Terrain\CliffDoodad\Waterfall\WaterfallNoMist` added | A waterfall without its mist cloud. HD and Definitive only: storage has no Classic copy |
| Aura effects tilt to the terrain angle; Lordaeron short grass overhauled | No effect: the terrain is hidden and the floor is flat |
| Dynamic portrait animation in Definitive; better lip sync | No effect: Smashcraft draws renders, not unit portraits ([fighter portraits](fighter-portraits.md)) |
| Fixes for imported assets: custom assets and test-map textures load, model paths with periods load, geosets with vertices but no faces no longer crash, item lights no longer stay after pickup, the post-processing dialog keeps its sliders, a second open map keeps its lighting | Imported art behaves as it did in 2.0 |

**Natives: none new for presentation.** The 3.0.1 common.j, read from storage,
was compared with Wisp's generated declarations
(wisp:src/natives/warcraft.d.ts, from 3.0.0). It has exactly 19 names Wisp
lacks, all unprefixed item-equipment natives that 3.0.1 keeps beside their new
`Blz` copies. The 3.0 fog and water natives already had the `Blz` prefix. The
new 3.0.1 natives (`BlzUnitHeal`, `BlzRemoveEffect`, `BlzResetUnitTalents`,
`BlzSetCameraAllowsHotkeyTargetLock`, `SetThematicMusicAbsoluteVolume`) aren't
presentation. Every graphics native a map has on 3.0.1 is in the
[levers table](#the-levers) or the
[features index](warcraft-features.md#300-forsaken-kingdom-september-2026-the-priority-features).
The same file also lists `BlzSetCinematicEnabledDE`, `EnableOcclusion`,
`SetPortraitLight`, `BlzShowUnitTeamGlow`, the per-unit hero-glow natives and
the effect animation natives (`BlzSetSpecialEffectAnimation`,
`BlzQueueSpecialEffectAnimation`, `BlzSetSpecialEffectAnimationBlendTime`).

### Map-level post-processing: what the editor writes

The 3.0 post-processing tool writes `war3mapPostProcessing.txt` into the map
(World Editor.exe names that file and a `CPostProcessingData` type). The file
overrides the game's own `PostProcessingConfig.txt`. Its sections, keys and
stock values, from `war3.w3mod:PostProcessingConfig.txt` in 3.0.1.24342:

| Section | Keys and stock values |
| --- | --- |
| `[ASSAO]` ambient occlusion | Enabled 1, Radius 40, ShadowMultiplier 1.2, ShadowPower 5, ShadowClamp 1, HorizonAngleThreshold 0.5, FadeOutFrom 1300, FadeOutTo 0, DetailShadowStrength 1, PortraitDetailShadowStrength 5, QualityLevel 3, AdaptiveQualityLimit 0.45, BlurPassCount 2, Sharpness 1, TemporalSupersamplingAngleOffset 0, TemporalSupersamplingRadiusOffset 0.5 |
| `[Bloom]` | **Enabled 0**, BloomThreshold 0.72, BloomIntensity 0.9, BloomSaturation 1, BaseIntensity 1, BaseSaturation 1, BlurAmount 3.75, BlurSampleCount 12 |
| `[PortraitBloom]` | BloomThreshold 0.71, BloomIntensity 1.18, BloomSaturation 1.3, BaseIntensity 1, BaseSaturation 1, BlurAmount 1.5 |
| `[Tonemap]` | **Enabled 0**, Exposure 1.0 |
| `[Texture]` | NormalMapStrength 0.8 |

The editor's dialog controls (World Editor.exe) match these fields. They also
include fog (ZStart, ZEnd, Density, HeightStart, HeightEnd, LinearStart,
LinearEnd, MaxLinearDensity), ShadowCastStart and ShadowCastEnd, and the water
EnvMapStrength. *(guess)* The fog and water controls belong to the lighting
editor and are written into `main` as `SetTerrainFogExV` and
`SetHDWaterParamsEx`. Blizzard's Forgotten Hollow scenario ships
`[ASSAO] Radius=6, ShadowMultiplier=3`: tighter and darker contact shadows
than stock. It is the only one of the 369 non-Classic stock maps in 3.0.1.24342
(the 96 Reforged campaign maps among them) that ships the file, and it lists
only the keys it changes.

So bloom, tone-map exposure and AO strength are map-wide. One file serves
every stage, and no native changes it during a match. *(guess)* They apply in
HD modes only, since Classic has no bloom or ASSAO pass, and the player's AO
option gates ASSAO. Whether `[Bloom] Enabled=1` in a map turns bloom on, now
that the player's Bloom option is gone, is **unmeasured**. It is the largest
untested lever for glowing hit sparks and fel or arcane stages.

### Lighting editor output (war3map.w3l)

The 3.0 lighting editor writes `war3map.w3l` (magic `W3L!`, version 3). In
Silverpine Sprint and Forgotten Hollow it holds two GUID-named `.mdl` paths
and some flag bytes. The paths are the map's own terrain and unit lighting
models, imported into the map: Silverpine's `02fbcd95-….mdx` is in its file
list. Smashcraft's base map has an empty one (22 bytes). So the lighting
editor is a lighting-model authoring tool. It makes the same kind of model
smashcraft:ts/scripts/stageLight.ts writes, chosen once per map; script swaps
models with `SetDayNightModels`, as Silverpine does for its cinematics.
Silverpine also imports `OmniLightCar.mdx`, `OmniLightLantern.mdx` and
`OmniLightWithDeath.mdx`, and Forgotten Hollow imports `omnicustom13.mdx`,
`omnicustom14.mdx` and `omnilightorange5.mdx`. *(guess)* These are placed
light-carrying models, the same mechanism as an effect with a light, which
script can create at run time (the tech-contact and slash sparks).

Blizzard's Definitive campaign lighting models, decoded from storage the way
[the stock light](#lighting-models) was (colours RGB; KLAC key colour, KLAI
key intensity, KLBC fill colour, KLBI fill intensity):

| Model (Definitive only) | Noon key | Noon fill | Notes |
| --- | --- | --- | --- |
| `Environment\DNC\DNCCampaign\Act2OutdoorDNC` | (1.0, 0.93, 0.80) at intensity 3.6 | (0.6, 0.6, 0.6) at about 0.93 | dawn key (1.0, 0.42, 0.16); a second light at most 0.065 |
| `…\CloudyDNC` | (0.75, 0.75, 0.73) at 1.6–1.8 | (0.76, 0.76, 0.76) | the same timeline as Act2Outdoor, desaturated |
| `…\DNCUndercityFinal` | (0.09, 0.11, 0.26) at 0.05 | — | a grey second light at intensity 0: nearly unlit, so the scene's light comes from placed point lights |
| `Environment\DNC\DNCLordaeron\DNCLordaeronUnit` (stock, for comparison) | (1.0, 1.0, 1.0) at 1.0 | — | Reforged's copy: 0.92 |

Definitive lighting is authored at high dynamic range, with key intensities
up to 3.6. Smashcraft's lights cap intensity at 1 (stage light rule 5).
*(guess)* Classic clamps lit colour, so a light tuned for Definitive needs its
own `_DE.w3mod` copy rather than one light for every mode.

### Forsaken Kingdom art: what exists in which mode

`.mdx` counts in the installed 3.0.1.24342 storage by prefix (root is Classic,
`_hd` Reforged, `_de` Definitive):

| Set | Classic | Reforged | Definitive | Contents |
| --- | --- | --- | --- | --- |
| `Doodads\Undercity` | 0 | 39 | 228 | Reforged: sewer pipes, walls, arches, path tiles. Definitive adds lanterns, banners, alchemy sets, bones, coffins, ceiling chains, gates, pillars, Naxx decor and `NaxxramasBeam` |
| `Doodads\LordaeronFall` | 0 | 35 | 41 | Lordaeron City spire, dome, main gate and walls, the Andorhal, Brill and Strahnbrad clock towers, Hearthglen Abbey, Strahnbrad trees and a lion statue, many with `_destroyed` variants |
| `Environment\Foliage\LordaeronFall` | 0 | 10 | 10 | fall grass |
| `Doodads\Cityscape` | 96 | 141 | 186 | city props; *(guess)* partly new in 3.0 |
| `Units\Forsaken` | 0 | 0 | 31 | campaign heroes and Forsaken units |
| `Units\Creeps\HeroForsakenPaladin` | 2 | 2 | 2 | the tavern hero; Smashcraft's Forsaken Paladin is built on it |
| UndercitySky, NaxxNightSky, ArcaneSky | 0 | 0 | 1 each | Definitive-only skies |
| LordaeronFallSky, Outland_Sky | 1 | 1 | 1 | in every mode |
| `WaterfallNoMist` | 0 | 1 | 1 | 3.0.1 |
| Campaign lighting models (above) | 0 | 0 | 1 each | — |

A stock path the player's mode lacks draws nothing, as with the HD-only skies.
Map makers report the same for the new models, which are "locked to one
graphics mode and invisible in the others"
([forum](https://us.forums.blizzard.com/en/warcraft3/t/newmodelsshouldusedeversion-onallgraphicsforcustommaps/39520)).
The [Hive 3.0 bugs thread](https://www.hiveworkshop.com/threads/warcraft-iii-3-0-bugs-issues.374131/)
reports these 3.0 rendering defects:

- some rocks draw as shrubs in Definitive;
- Replaceable ID 1 textures flicker in Definitive and Reforged;
- glows and fires draw below units;
- some new models ignore `BlzSetSpecialEffectYaw`;
- older-format models lose their portrait omni lights.

`NaxxramasBeam` carries a PopcornFX emitter (a `CORN` chunk), so script
can't drive its particles. The Undercity lanterns carry no light (no `LITE`
chunk), which matches the Hive report that their light "will have 0".

Forsaken Kingdom art can go on a stage only as garnish whose absence in
Classic, and often in Reforged, still reads. Whether a stage may look richer
in Definitive than in Classic is Tom's product decision.

### What Blizzard's 3.0.1 maps do with the levers

From the Lua and w3i of the two standalone scenarios
(`Maps\ForsakenKingdom\Scenario\(1)SilverpineSprint.w3x` and
`(1)ForgottenHollow.w3x`, saved by builds 24329 and 24324, graphics-modes
field 4):

- **Silverpine Sprint:**
  - imported terrain and unit lighting models, swapped per shot (seven
    `SetDayNightModels` calls);
  - height fog in its w3i (style 3, 50–5,500, density 0.25, colour (50, 70,
    70), maximum opacity 0.5), with nine `SetTerrainFogExV` calls and
    `BlzSetTerrainFogDrawOverSky`;
  - ten `AddWeatherEffect` calls;
  - `EnableOcclusion` toggles and `BlzSetCinematicEnabledDE`;
  - a hit effect on damage, for the local player only. The depth-of-field
    scale rises by 15 × √damage, capped at 50, over 0.15 s and fades over
    0.6 s. A white `MODULATE_2X` cinematic filter flashes with it, its alpha
    rising by 50 × √damage, capped at 255.
- **Forgotten Hollow:** the stock DNCUnderground lighting,
  `SetHDWaterParamsEx`, the ASSAO override above and a local cinematic
  filter.

The depth-of-field flash runs only for the local player and creates no
handles, so it can't desync. *(guess)* It also blurs the fighters, so it
suits KOs and the heaviest hits, not ordinary contact.

### Levers worth using, per stage

For every stage first: the profile, baseline and map-wide rows (G1–G4). Each
row is written to open as an issue. Its check runs on a capture profile that
turns on Environment Shadows, Point Light Shadows and AO and records the mode.

| # | Lever | Done when |
| --- | --- | --- |
| G1 | A visual capture profile (shadows, point-light shadows and AO on, mode recorded), then re-capture the stock/mask/stage triple of every stage on 3.0.1 in Classic and Definitive | 11 stages × 2 modes of triples exist, each recording its mode |
| G2 | `war3mapPostProcessing.txt`: bloom on with a high threshold, so only additive sparks and emissive accents bloom, and a tighter ASSAO for fighter contact shadows (Forgotten Hollow uses radius 6, multiplier 3) | Reforged and Definitive captures of `-dev effects 12` show bloom on the sparks, and fighter ΔE00 against the ring falls on no stage |
| G3 | Definitive copies of the stage lights at `_DE.w3mod\war3mapImported\StageLight-*.mdx` with high-range intensities; Classic and Reforged keep the current files | A Definitive capture shows the copy loaded (a distinct test colour), and contrast holds on the four measured stages |
| G4 | KO punctuation: a local depth-of-field pulse and cinematic-filter flash on KO only, after Silverpine's pattern | A native KO capture shows the pulse, and the two clients' checksums stay equal over a full match |

Per stage (backdrop facts from [Per-stage recommendations](#per-stage-recommendations)):

| Stage | Backdrop | 3.0.1 / Forsaken Kingdom levers worth using | Skip |
| --- | --- | --- | --- |
| Sky Deck (0) | neutral; #178 ΔE00 22.8 | The control for G1–G3: capture it first in both supported modes, AO on and off | Forsaken Kingdom art |
| Frozen Throne (2) | bright ring (L\* 52–54); contrast falls | Height fog (style 3) in deep blue below the deck with a `MaxLinearDensity` cap, to darken the bright lower band instead of dimming the fighters. `DrawOverSky` to pull the sky's horizon into the same tint. Bloom (G2) on the ice's emissive layers | NorthrendSky and IcecrownGlacierSky (HD-only); weather |
| Durotar (3) | bright ring; contrast falls | Height fog in warm dust below the deck. The bloom threshold must leave sunlit sandstone unbloomed | Forsaken Kingdom art |
| Naxxramas (4) | dark ring (L\* 31–33); contrast rises | A cold green omni light from an imported effect by the necropolis (unlimited in HD) with `BlzSetMinShadowCastingPointLightCount(1)`. Undercity and Naxx decor (`naxxdeco0/1`, ceiling chains, Forsaken banners) only as Definitive garnish | NaxxNightSky (Definitive only, one sky slot); DNCUndercityFinal (too dark for fighters) |
| Stratholme (6) | not yet captured | Compare LordaeronFallSky (stock in every mode) with the authored sky. The fall city art (spire, gate, clock towers, Hearthglen Abbey, `_destroyed` variants) exists only in Reforged and Definitive: use it only if Tom accepts a richer HD backdrop. Distant fires as light-carrying effects | — |
| Tomb of Sargeras (7) | not yet captured | `WaterfallNoMist` for the distant waterfall in HD, only with a Classic stock waterfall in its place, so it can't cover the backdrop with mist. Teal height fog over the tide floor | HD water (the terrain is hidden) |
| Nordrassil (10) | stock FelwoodSky aurora | Bloom (G2) on the aurora and wisp emissives; teal-green height fog below the deck | — |
| Gryphon Aerie (11) | pale clouds *(guess)* | GA-4: desaturated blue height fog darkening the cloud field below the deck. Style 3, start/end 5,500/11,500, density 0.25, height -1,800 to -500 relative to the deck origin, cap 0.5, drawn over sky. RGB (0.25, 0.375, 0.5); Classic keeps that tint in distance fog beyond the fight. Existing sky and daylight preserve the airy skyline and Alliance deck accents (GA-1, GA-3) | — |
| Blackrock (12) | lowest #178 ΔE00 (21.2) | Forge-fire effects carrying warm omni lights, one shadow-casting; bloom on lava; the G2 ASSAO for fighter contact shadows. Check it first | — |
| Ahn'Qiraj (13) | bright sandstone; light at 0.5 | Dusk-ochre height fog below the deck; the G3 Definitive light copy | — |
| Hellfire (14) | dark haze *(guess)* | Fel-green omni lights from imported effects; bloom on fel fire. Outland_Sky is available in every mode | — |

Naxxramas's row is in place (#296). NX-1's cold plague-green omni light
frames NX-3's lone necropolis at (1450, 6000, -900), with radius 1400,
intensity 0.875 and no flicker. Its reach ends 4400 units behind the fighter
volume; the one shadow caster adds depth around the citadel. NX-1's teal fog
starts at 5000 and ends at 11000, preserving the clear fighting plane.
One half-scale stock `NaxxDeco0` at (1700, 5900, -1250) is low Definitive-only
garnish. Classic and Reforged keep the stock Necropolis and ruined approach
when that prop is absent; Classic also draws no model omni light. The authored
light-only model is 756 bytes: stock green spell effects add particles and
geometry, while Undercity lanterns have no light, so neither supplies this
steady isolated glow. No stock art is imported.

Tomb's TS-2 hall uses a dark teal sky horizon, RGB (28, 48, 52), behind the
bright tide floor. Its row is in place (#298), following TS-1/TS-2: teal height fog uses
style 3, distance 5,000–11,000, density 0.25, heights −1,800 to −100 relative
to the arena, maximum opacity 0.375 and leaves the sky clear. Classic retains
the existing teal linear fog. TS-c keeps the waterfall on the left: two native
stock `WaterfallNoMist` copies override the ordinary waterfall only under
`_hd.w3mod` and `_de.w3mod`; Classic uses its installed ordinary waterfall.
The private stage-assets files `TombWaterfallHD.mdx` and `TombWaterfallDE.mdx`
are 124,468 bytes each. Preserve these two stock files when regenerating
stage-assets, or re-extract the HD/DE `WaterfallNoMist.mdx` paths with
`tools/animations/casc-extract.cpp`. The ordinary stock waterfall is misty;
the new model is missing in Classic. The three native mode captures decide
whether the mode-specific map overrides draw as intended.

Blackrock's row is in place (#292). Its two forge fires carry light-only
omni models (smashcraft:ts/src/game/assets/stagePointLights.ts): warm orange,
a slow flicker of ±12.5%, and a reach that ends at least 3,000 units behind
the fight, so they light the basalt by the fires and no fighter. The fire
pillar's light casts shadows (`BlzSetMinShadowCastingPointLightCount(1)`
while Blackrock is drawn). Classic draws no model omni lights, so there it
shows the stage as before. The lava gains an additive crest layer
(smashcraft:ts/scripts/stageLiquid.ts). The crests peak above luma 0.9 and
the body stays under the stock bloom threshold of 0.72, so the map-wide bloom
(#288) catches only the veins. Blackrock's AO is #288's map-wide ASSAO.
smashcraft:ts/test/stage-model.test.ts pins these values.

Hellfire's #293 choices follow HF-2/HF-3 in `stage-boards.md`: stock
`Outland_Sky` in all modes, green linear haze beginning at 5,000, and two
small stock Immolation flames beside the distant gate and the right rock.
Their additive fel accents use #288's map-wide bloom in HD; Classic retains
the stock flames and sky. Two light-only omni models add green to the rocks
in HD, one shadow-casting, with slow ±12.5% loops and no reach within 3,000
units of the fighters. The gate and its support move to depth 6,000 so the
far camera can retain the HF-c landmark within its 8,000-unit clip distance.
The directional fighter light stays the board's warm key and green ambient.
Stage tests pin the sky, haze, accents and light values; #287 captures judge
their drawn contrast and bloom.

For fighters on every stage: AO and point-light shadows give contact shading
in HD when the player turns them on. `DisallowHeroGlowOnUnit` and
`BlzShowUnitTeamGlow(false)` remove ground glows that a floating arena can
misplace. *(guess)* The 3.0 HD air-to-ground indicators may draw under
fighters, since fighters use fly height (smashcraft:ts/src/platform/shell/fighterBody.ts);
check one HD capture before any stage issue.

## Measured on 3.0 under Wine

### Stage light against stock light

The #170 lighting batch on offline pair 2, 7 Oct, produced complete
stock/mask/stage triples for four stages, both clients. Same paused pose,
camera, sky and fog; only the lighting model changes. Numbers from
`bun tools/stage/contrast.ts`; the full table, run and provenance are in
smashcraft:evidence/stage-lighting-20261008/. The run did not record its
graphics mode.

| Stage | Fighter L\* rise | Ring L\* rise | ΔE00 stock → stage (a, b) | abs ΔL stock → stage (a, b) | Contrast |
| --- | --- | --- | --- | --- | --- |
| Frozen Throne | 12.2, 12.7 | 4.2, 4.7 | 35.2 → 33.0, 30.9 → 30.1 | 30.6 → 22.6, 26.0 → 18.1 | falls |
| Durotar | 11.9, 11.6 | 0.3, 0.0 | 31.9 → 28.6, 33.3 → 29.8 | 25.9 → 14.3, 28.1 → 16.6 | falls |
| Naxxramas | 9.2, 8.3 | 0.2, 0.1 | 19.7 → 22.0, 18.7 → 20.6 | 3.1 → 12.1, 2.1 → 10.2 | rises |
| Ahn'Qiraj | 11.3, 10.8 | 0.6, 0.0 | 39.3 → 34.8, 25.2 → 25.6 | 33.5 → 22.9, 14.6 → 3.8 | falls |

What this shows:

- The authored light lifts fighters by 8–13 L\* while the ring around them
  (decks, sky, fogged scenery) moves at most 4.7, and the whole frame at
  most 0.5. The lever acts on fighters and scenery effects, not on the
  unshaded decks and sky, as the source says.
- The lift is brighter than stock even though the Frozen Throne key
  (226, 240, 255) and fill (150, 172, 220) are dimmer than Classic's noon.
  *(Guess)* the captures ran in Reforged, whose stock key is 0.92 × (0.84,
  0.84, 0.98); the authored key is intensity 1. Recording the mode settles it.
- Where the backdrop is brighter than the fighters (ring L\* 48–63: Frozen
  Throne, Durotar, Ahn'Qiraj), lifting the fighters moves them toward the
  background and both contrast numbers fall. Where it is darker (Naxxramas,
  ring 31–33), the same lift separates them. #170's rule is that neither
  number falls, so the current lights fail it on three of the four stages.

### Skies and fighter contrast, #178

The #178 after-captures on pair 2 (integrated map with the stage lights;
evidence ~/.local/share/smashcraft-stage-design-178/native-pair2/, recorded
in #178's status): every one of nine stages drew its sky, 76–96% of the top
band; Nordrassil's aurora 76% before and after; fighter ΔE00 against the
backdrop at least 21.2 (Sky Deck 22.8, Frozen Throne 30.9, Durotar 27.3,
Naxxramas 25.9, Nordrassil 28.6, Gryphon Aerie 24.7, Blackrock 21.2,
Ahn'Qiraj 27.4, Hellfire 25.5). Its integrated farm budget run read p99
9.88 ms and worst 13.73 ms, inside #168's bound. With `-dev backdrop off`
(sky, fog, scenery and decks hidden) the empty screen read rgb(4,4,4) in all
eight masks measured from the #170 batch.

### Nordrassil atmosphere (#294)

NO-3 softens the far World Tree's roots with teal-green height fog: style 3,
distance 5,500–11,000, density 0.25, height −2,600 to −600 relative to the
arena origin, maximum linear density 0.5, colour (0.25, 0.5, 0.375). The upper
height stays below the deck. `DrawOverSky` stays off for NO-4: the preserved
stock FelwoodSky aurora fills the upper frame, with #288's map bloom enabled
at threshold 0.9 in HD. Classic retains the stock sky and Moon Well glow
geometry; the old linear fog distances and colour remain the fallback fields.
NO-4's only luminous scenery accents are the two stock Moon Wells; no wisp
or extra point light is added. The existing silver key (236, 246, 232) and
teal fill (136, 178, 172) retain their intensity of 1. No new imports.
The #287 batch must establish the three-mode draw, aurora bloom, rubric,
fighter contrast and frame cost before #294 closes.

### Not yet measured on 3.0

- 3.0 fog: height fog, `MaxLinearDensity`, `DrawOverSky` and styles 3–5.
- `BlzShowTerrain(false)` at both camera extremes (the #191 batch).
- The HD draw of stock scenery, and the Classic draw of everything (no
  capture names its mode).
- Shadows under authored lights; the tech-contact omni light; depth of field;
  point-light shadows.

## Per-stage recommendations

From the measurements above and the stage sources
(smashcraft:ts/src/game/presentation/stageScenery.ts and its
`*StageScenery.ts` siblings). Every stage currently uses linear
`SetTerrainFogEx` with density 0, start 5,000–6,000 and end 10,000–12,000,
behind the fighting volume ([stage art](stage-art.md#rules), rule 6).

Lighting rule for the pass: move fighter lightness away from the ring's.
Over a bright backdrop, keep fighters at or below stock lightness (a lower
key and fill, or intensity under 1); over a dark one, the current lift is
right. Re-capture the stock/mask/stage triple after every change.

| Stage | Light (key / fill) | Sky | Measured | Recommendation |
| --- | --- | --- | --- | --- |
| Sky Deck (0) | Classic noon (255 / 214, 214, 250) | authored | session failed; #178 ΔE00 22.8 | Keep as the neutral baseline; capture the triple |
| Frozen Throne (2) | 226, 240, 255 / 150, 172, 220 at intensity 0.8 (#265) | authored | at intensity 1, contrast fell (ΔE00 −2.2, −0.8) | Re-capture the triple at 0.8 |
| Durotar (3) | 255, 226, 180 / 190, 152, 134, intensity 0.65 (#266) | authored | contrast fell at intensity 1 (ΔE00 −3.3, −3.5) | Re-capture the triple at 0.65 |
| Naxxramas (4) | 222, 230, 255 / 150, 136, 196 | authored | contrast rises (ΔE00 +2.3, +1.9) | Keep; pin the light |
| Stratholme (6) | 255, 214, 180 / 170, 140, 150 | authored | added after the batch | Capture the triple first |
| Tomb of Sargeras (7) | 226, 244, 255 / 130, 176, 180 | authored | added after the batch | Capture the triple first |
| Nordrassil (10) | 236, 246, 232 / 136, 178, 172 | stock FelwoodSky | no stock capture | Capture; *(guess)* its dark aurora backdrop favours the lift, as Naxxramas |
| Gryphon Aerie (11) | 255, 248, 226 / 164, 182, 220 | authored | no mask capture | Capture; *(guess)* its pale cloud field behaves like Frozen Throne |
| Blackrock (12) | 255, 216, 176 / 170, 124, 112 | authored | stock and stage failed | Capture; lowest #178 ΔE00 (21.2), so check it first |
| Ahn'Qiraj (13) | 230, 236, 255 / 150, 162, 204 at intensity 0.3 (approved #267) | authored | At intensity 1, the former warm key reduced contrast (abs ΔL 33.5 → 22.9, 14.6 → 3.8) | Use #267's cool-key comparisons; the frozen #287 table below predates that fix |
| Hellfire (14) | 255, 222, 196 / 140, 172, 120 | authored | stock capture only | Capture; *(guess)* dark haze favours the lift |

The other levers, for every stage:

- **Fog**: keep linear fog. Trial height fog through the `192-*-linear|height`
  checks only to fade scenery bases (stage art rule 11), and adopt it per
  stage only when those captures show the bases fade and fighter contrast
  holds.
- **Sky**: keep the authored spheres and Nordrassil's FelwoodSky; they draw
  in every mode. Don't use HD-only stock skies.
- **Materials**: keep stock scenery paths so HD clients draw the PBR copies;
  imported decks, skies and fighters stay SD in every mode. Capture one
  stage in Classic and Reforged before claiming either draw.
- **Per object**: hit and contact readability comes from effect models,
  colour and alpha (#82); measure the tech-contact light with `-dev effects
  12` in HD before adding lights elsewhere.
- **Not used**: weather and ubersplats (below the arena or on hidden
  terrain), HD water (no terrain water), cinematic filter and depth of field
  (whole-screen, can't separate fighters from backdrop *(guess)*).

## White body flash: can the engine do it? (#308)

The flash (smashcraft:ts/src/game/presentation/whiteGlow.ts) shows a white
copy of the fighter's body over the real one, on exact frames: alpha 220 and
100 alternating during heavy hitlag, 190 on and off during smash charge. The
copies (smashcraft:tools/animations/white-flash-models.ts) are unshaded,
textured pure white with each texture's alpha kept, so a pixel of base
colour B reads `0.86·255 + 0.14·B` at alpha 220 (B = 100 gives 234). That
is the bar below. Fighters are drawn as special effects (the clip pools,
smashcraft:ts/src/game/render/fighterPool.ts), already coloured with
`BlzSetSpecialEffectColorByPlayer(model, Player(slot))`; a unit body is only
the fallback, and units have no native to seek an animation to an exact
time.

Where the copies' bytes are: of the 21 white models' 61.0 MB uncompressed,
bones and helpers are 59.3 MB, meshes 1.03 MB, materials 0.06 MB; the 50
white textures add 12.0 MB raw (0.69 MB in the map). So 97% of the 19.31 MB
is animation keys, not mesh. Any fix that keeps a second timeline of keys
keeps nearly all of the cost.

Natives checked: every name with colour, alpha, emissive, material,
texture, skin, glow, vertex, tint or model in the 3.0.1.24342 common.j read
from storage, plus the unit tint fields. No native brightens a unit or
effect, sets its emissive or material, or swaps an effect's texture; 3.0.0
and 3.0.1 added none ([3.0.1 presentation changes](#301-presentation-changes)).
No game constant colours the ethereal look: Units\MiscData.txt,
UI\MiscData.txt and Units\MiscGame.txt hold only ethereal damage and heal
bonuses. Nothing here can be rendered headless: the headless renderer
draws model files only, ignores material alpha, and models neither buffs
nor player-colour textures, so brightness is computed from the blend rules
and left to the native plan.

| Candidate | Classic / Reforged / Definitive | On and off on the frame | How white | Side effects | Cost | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `SetUnitVertexColor`, `BlzSetSpecialEffectColor`, `UNIT_IF_TINTING_COLOR_*` | all | yes | none: multiplies by at most 1 | none | none | no. Values above 255 are a native question (step 4 below) *(guess: stored as a byte, so they wrap)* |
| `BlzSetSpecialEffectAlpha` | all | yes | none: fades only | none | none | no |
| Ethereal: `Aetl` added and removed, or Banish `AHbn` cast by a hidden dummy | units only; Classic draws a translucent tinted ghost *(guess: greenish, not white)*; HD Spirit Walker uses a separate ethereal model, so the HD look is unknown | `Aetl` add and remove *(guess: same frame)*; Banish needs an order and a cast, so at least a frame late on, and removing its buff is immediate | unmeasured; no constant or vertex colour can push a tint past 1 | ethereal flags (no attacks, physical immunity, ×1.66 magic damage) on a Warcraft unit the sim ignores; Banish plays its buff art and sound | the body must be a unit, which can't seek to an exact pose, or a unit copy, which is the copy again | no |
| Invulnerability (`SetUnitInvulnerable`, `Avul`), Divine Shield `AHds` | all | Avul yes; Divine Shield is a cast | none: Avul has no look (bodies already call `SetUnitInvulnerable(true)`); Divine Shield attaches a gold bubble model, not a white body | Divine Shield art and sound | units only | no |
| Hero glow (`AllowHeroGlowOnUnit`), team glow (`BlzShowUnitTeamGlow`) | all | yes | none: a coloured decal under the unit, not on the body | none | units only | no |
| Skins: `BlzSetUnitSkin`, `BlzCreateUnitWithSkin` | all | swap is immediate *(guess: restarts the animation)* | only as white as the swapped-in model; no stock fighter has a white model | units only | the white model must still ship | no |
| Cinematic filter, model omni lights, map post-processing | all; lights HD only | filter yes; post-processing is per map | the filter covers the whole screen; a light brightens everything near it, not one body | — | — | no |
| Second timeline in the body model: a white layer keyed visible on a mirrored half (t + T), or an alternate sequence picked with `BlzSpecialEffectAddSubAnimation` | all | yes: same effect, same time seek | as the copy, or whiter | none | every bone and helper key twice again (97% of the copies' bytes), so it saves at most about 1 MB (mesh and white textures); three flash levels need three halves | no |
| **Player-colour overlay**: one unshaded Additive layer on each body material whose texture is replaceable ID 2 (team glow); the map imports ReplaceableTextures\TeamGlow files that are black for the slot colours and grey 220, 100, 190 for three unused colours, and a white TeamColor file for those three. Flash on: `BlzSetSpecialEffectColorByPlayer(body, Player(q))` for the level's player q; off: `Player(slot)` | Classic expected; Reforged and Definitive unknown: whether HD honours imported team-colour textures on a classic-material model | expected yes: the call sets the effect's own state, as alpha does | `min(255, B + g)`: at g = 220 every pixel reaches at least the copy's 234 for B = 100, and saturates to 255 for B ≥ 35 | team-colour patches turn white during a flash (wanted); stock team-glow cards on bodies go dark unless baked to fixed textures; alpha-cutout geometry (hair, cloth fringes) shows solid overlay unless the layer skips those materials; slot colours on the HUD and cards are unaffected (they use TeamColor files, not TeamGlow) | removes 19.31 MB; adds one layer per body material (the 21 models' materials are 0.06 MB raw in all) and about ten tiny textures; one extra additive pass over each visible body all the time | **test natively** |

**Recommendation: keep the copies, and test the player-colour overlay
natively.** No engine feature, buff or native brightens a body to white:
everything Warcraft offers multiplies or fades, belongs to units the
fighters aren't, or lands off the frame. The one candidate that can replace
the copies is a model change driven by the effect's player colour. If one
native capture in each of the three modes shows it on and off on the frame
and at least as white as the copy, it replaces the white models; if HD
ignores the imported textures, keep the copies, trimmed to flashable poses
([map size](map-size.md)). The capture plan is on #308.

## How the numbers are taken

Fighter contrast is measured on native captures of the offline LAN pool
with the same resolution and graphics profile for each pair. Pause with Y
after the scene is fully drawn. `-dev backdrop off` (development builds) hides
the sky, fog, scenery and decks, so a capture of it shows only the fighters:
their pixels are the largest connected regions that differ from its empty
background, above the HUD. For each frame of the same stage and moment, the
fighters' mean CIELAB colour is compared with the mean of a ring 4 to 18
pixels around them: the absolute lightness step |ΔL| and the CIEDE2000
difference ΔE00. A change passes when neither falls. Keep the individual
fighter sample and a whole-scene capture, so a mean cannot conceal a missing
fighter. The image reader uses Wisp's decoder for native 8-bit PPM captures;
other formats use ImageMagick conversion to 8-bit RGB. It rejects missing silhouettes or
mismatched dimensions. Run
`bun tools/stage/contrast.ts MASK.png STOCK.png STAGE.png` from smashcraft's
root. The report also gives mean absolute per-pixel lightness distance to the
surrounding ring (`localDL`).

The hide command parks scenery below the floor because alpha does not hide
particle emitters. Wait 13 seconds before capturing the mask: the stage snow's
longest authored particle lifetime is 12 seconds. Restore with
`-dev backdrop on`; switch only the light while the fighters stay paused.
Use one mask for the stock/stage pair, keeping sky, fog, camera and pose fixed.
An actual Classic and Definitive draw is needed for the asset fallback claim.

### Unpaused comparison with shadows and post-processing

The #287 batch uses Smashcraft `9c57ccfa`, Wisp `1383a934` and the installed
Warcraft `3.0.1.24342` stock assets. Each stock/mask/stage triple is drawn
at frame 410 (match frame 380), with separate deterministic journeys and
the same near/far camera and fighter pose. Both clients receive the view
and lighting commands. There is no pause menu over the scene.

The requested look is `day-night-light,fog,sky,shadows,point-lights,pbr,`
`point-light-shadows,ambient-occlusion,bloom`. Both modes draw sun shadows;
Definitive records ambient occlusion and bloom on. Water and height-fog
falloff remain outside this renderer's supported look. Terrain is hidden
on these stages. Frozen's masks use `18868a54` (the same baseline source
with the landed `4354a6e1d` snow-parking fix), retaining every stock and
stage frame. Its parked snow no longer reaches any arena camera.

Each cell is stock → stage **|ΔL| / ΔE00**, measured with
`tools/stage/contrast.ts`. Client 0 is 1920×1080; client 1 is 2560×1080.

| Stage / mode | Near / client 0 | Near / client 1 | Far / client 0 | Far / client 1 | Drawing result |
| --- | --- | --- | --- | --- | --- |
| Sky Deck / Classic | 2.7 / 11.5 → 8.3 / 13.8 | 4.3 / 11.9 → 9.7 / 14.6 | 1.5 / 9.3 → 10.1 / 13.3 | 10.5 / 12.7 → 2.1 / 7.6 | captured |
| Sky Deck / Definitive | 7.8 / 14.6 → 12.1 / 16.9 | 11.8 / 17.3 → 16.2 / 19.9 | 7.0 / 12.4 → 16.3 / 18.5 | 8.6 / 13.3 → 5.4 / 10.6 | captured |
| Frozen Throne / Classic | 3.1 / 8.9 → 5.6 / 9.6 | 4.2 / 9.2 → 6.8 / 10.2 | 6.3 / 9.5 → 9.3 / 11.3 | 5.3 / 8.5 → 8.9 / 10.6 | captured |
| Frozen Throne / Definitive | 9.2 / 11.3 → 12.7 / 13.6 | 13.7 / 14.0 → 16.6 / 16.2 | 9.9 / 11.9 → 15.3 / 15.6 | 8.7 / 10.8 → 15.0 / 15.6 | IceTorch particles not drawn |
| Durotar / Classic | 4.1 / 31.7 → 1.5 / 31.1 | 5.1 / 31.6 → 0.5 / 30.8 | 3.9 / 26.5 → 4.4 / 24.8 | 7.1 / 26.4 → 18.3 / 27.4 | captured |
| Durotar / Definitive | 8.0 / 31.6 → 7.6 / 31.5 | 11.3 / 31.6 → 11.2 / 31.6 | 7.8 / 27.4 → 7.2 / 26.8 | 8.0 / 24.6 → 10.1 / 25.0 | captured |
| Naxxramas / Classic | 10.9 / 17.5 → 14.0 / 18.9 | 11.4 / 17.5 → 14.4 / 18.9 | 11.5 / 17.2 → 16.2 / 20.3 | 3.6 / 13.5 → 10.5 / 17.2 | captured |
| Naxxramas / Definitive | 13.4 / 16.8 → 15.7 / 17.3 | 15.6 / 17.6 → 17.3 / 17.8 | 12.3 / 17.6 → 19.8 / 21.5 | 0.2 / 16.1 → 12.7 / 17.9 | Necropolis particles not drawn |
| Stratholme / Classic | 4.6 / 22.9 → 7.4 / 23.2 | 3.8 / 22.7 → 6.6 / 22.9 | 5.8 / 18.4 → 10.5 / 19.3 | 19.5 / 31.4 → 12.7 / 26.3 | captured |
| Stratholme / Definitive | not captured | not captured | not captured | not captured | RaysOfLight texture missing |
| Tomb of Sargeras / Classic | 6.0 / 23.0 → 10.0 / 23.6 | 6.2 / 23.5 → 10.1 / 24.2 | 1.8 / 23.9 → 7.7 / 24.0 | 7.2 / 20.4 → 1.9 / 16.6 | captured; Hydra facts missing at this source |
| Tomb of Sargeras / Definitive | 11.1 / 25.2 → 15.0 / 26.7 | 12.3 / 27.2 → 16.4 / 28.7 | 3.8 / 25.7 → 13.0 / 27.2 | 5.2 / 21.3 → 6.8 / 18.5 | captured; Hydra facts missing at this source |
| Nordrassil / Classic | 21.8 / 32.9 → 26.1 / 34.0 | 21.1 / 33.2 → 25.3 / 34.2 | 5.5 / 28.2 → 1.0 / 26.1 | 3.6 / 24.8 → 5.7 / 22.5 | captured |
| Nordrassil / Definitive | not captured | not captured | not captured | not captured | RaysOfLight texture missing |
| Gryphon Aerie / Classic | 2.4 / 18.6 → 4.0 / 19.1 | 4.9 / 18.8 → 1.5 / 18.5 | 3.5 / 16.7 → 13.3 / 21.1 | 11.9 / 16.9 → 25.2 / 25.4 | captured |
| Gryphon Aerie / Definitive | 9.7 / 21.5 → 8.8 / 21.2 | 14.5 / 24.6 → 13.9 / 24.3 | 3.0 / 19.0 → 1.5 / 18.9 | 9.2 / 16.9 → 14.8 / 18.8 | captured |
| Blackrock / Classic | 9.2 / 25.8 → 13.0 / 25.7 | 11.1 / 25.9 → 14.8 / 26.0 | 5.8 / 15.8 → 12.0 / 14.9 | 4.5 / 13.1 → 12.4 / 11.8 | captured |
| Blackrock / Definitive | 9.4 / 26.2 → 13.1 / 26.6 | 12.6 / 26.4 → 16.5 / 27.0 | 2.4 / 10.6 → 1.6 / 9.2 | 4.4 / 10.8 → 2.9 / 8.2 | FireTrapUp / FirePillarMedium particles not drawn |
| Ahn'Qiraj / Classic | 4.2 / 30.7 → 2.2 / 29.4 | 5.5 / 30.6 → 3.4 / 29.3 | 2.2 / 28.2 → 4.9 / 25.5 | 13.0 / 28.9 → 16.4 / 26.5 | captured |
| Ahn'Qiraj / Definitive | 11.1 / 32.2 → 12.3 / 32.3 | 14.4 / 33.1 → 15.8 / 33.4 | 3.6 / 29.9 → 6.6 / 28.9 | 12.1 / 28.2 → 8.0 / 24.9 | captured |
| Hellfire / Classic | 10.1 / 32.4 → 13.8 / 32.3 | 12.4 / 32.5 → 15.9 / 32.6 | 5.3 / 28.9 → 11.3 / 27.3 | 5.0 / 26.9 → 13.5 / 26.7 | captured |
| Hellfire / Definitive | not captured | not captured | not captured | not captured | RaysOfLight texture missing |

45 of 76 measured rows keep both contrast values at reported precision;
31 fall, and 12 rows cannot be measured because the texture failure
prevented a stock or stage image. The drawing failures preserve their saved
scene and error log. Particle omissions and missing textures require a
complete Definitive reference before #287's full capture box can pass.

The mask deliberately hides decks, so its ordinary match scene check still
reports missing decks; this is not an ordinary match pass. The frozen Tomb
source also reports absent Hydra model facts, which were added on main
before the snow fix. These numbers describe this frozen baseline; stage
workers' later lighting and composition fixes have their own comparisons.

### 3.0.1 headless comparison reference

The earlier #287 producer at Smashcraft `5e8ef374` and Wisp `9b821201` uses
Warcraft 3.0.1.24342 assets, Classic and Definitive, and separate stock/mask/stage
journeys drawn at frame 410. It pauses at frame 345 (holding match frame 315)
and fixes the near or far camera before the pause. These views differ from
the earlier `view off` comparisons. `--look day-night-light,fog,sky` records
the levers being measured; the native profile's shadows, water and HD
post-processing remain outside this headless reference. Its pause menu is
visible over the stage, so these historical rows are not the current art or
full-profile baseline. The replacement journeys remove the Y key events and
capture all three separate runs at frame 410, with the same near/far view,
pose and camera in each triple.

Hellfire's saved reference for both clients, measured with
`tools/stage/contrast.ts`:

| Mode / view / client | Stock \|ΔL\| / ΔE00 | Stage \|ΔL\| / ΔE00 | Neither falls at reported precision |
| --- | --- | --- | --- |
| Classic / near / 0 | 5.4 / 9.4 | 5.6 / 9.3 | no |
| Classic / far / 0 | 5.3 / 8.6 | 6.1 / 8.2 | no |
| Definitive / near / 0 | 5.2 / 7.6 | 6.2 / 7.4 | no |
| Definitive / far / 0 | 4.5 / 3.9 | 5.3 / 4.0 | yes |
| Classic / near / 1 | 4.7 / 9.8 | 5.0 / 9.8 | yes |
| Classic / far / 1 | 5.5 / 8.1 | 6.6 / 8.5 | yes |
| Definitive / near / 1 | 5.2 / 7.2 | 6.3 / 7.0 | no |
| Definitive / far / 1 | 4.3 / 2.7 | 4.3 / 2.7 | yes |

Wisp deliberately models different screen widths: client 0 uses 1920×1080,
client 1 uses 2560×1080 (wisp:src/headless/lockstep.ts). Both receive chat
commands. The near/far camera limits use each client's aspect ratio, so their
camera distances and fields of view differ even with the same view command.

The failed rows require a lighting adjustment before claiming a contrast
pass. They do not replace #287's full native capture-profile baseline.

Ahn'Qiraj at the same frozen build, before the fighter-only tint correction:

| Mode / view / client | Stock \|ΔL\| / ΔE00 | Stage \|ΔL\| / ΔE00 | Neither falls at reported precision |
| --- | --- | --- | --- |
| Classic / near / 0 | 4.7 / 8.4 | 4.0 / 8.6 | no |
| Classic / far / 0 | 2.6 / 7.8 | 1.3 / 7.4 | no |
| Classic / near / 1 | 4.1 / 8.5 | 3.6 / 8.7 | no |
| Classic / far / 1 | 1.2 / 6.4 | 0.3 / 5.7 | no |
| Definitive / near / 0 | 3.3 / 7.0 | 3.5 / 6.7 | no |
| Definitive / far / 0 | 2.7 / 3.7 | 3.0 / 3.6 | no |
| Definitive / near / 1 | 3.6 / 6.8 | 4.0 / 6.6 | no |
| Definitive / far / 1 | 5.2 / 3.4 | 5.1 / 3.4 | no |

Blackrock at the same build, before the right-crag placement correction:

| Mode / view / client | Stock \|ΔL\| / ΔE00 | Stage \|ΔL\| / ΔE00 | Neither falls at reported precision |
| --- | --- | --- | --- |
| Classic / near / 0 | 5.5 / 7.8 | 5.7 / 7.7 | no |
| Classic / far / 0 | 16.3 / 14.9 | 17.6 / 16.1 | yes |
| Classic / near / 1 | 5.4 / 8.1 | 5.1 / 8.2 | no |
| Classic / far / 1 | 14.9 / 15.2 | 16.7 / 16.8 | yes |
| Definitive / near / 0 | 4.2 / 6.2 | 5.2 / 6.0 | no |
| Definitive / far / 0 | 5.1 / 3.9 | 6.7 / 6.0 | yes |
| Definitive / near / 1 | 4.8 / 5.9 | 5.8 / 6.0 | yes |
| Definitive / far / 1 | 5.6 / 6.4 | 7.9 / 9.3 | yes |

Sky Deck's control at the same build:

| Mode / view / client | Stock \|ΔL\| / ΔE00 | Stage \|ΔL\| / ΔE00 | Neither falls at reported precision |
| --- | --- | --- | --- |
| Classic / near / 0 | 4.5 / 5.9 | 4.8 / 5.5 | no |
| Classic / far / 0 | 3.2 / 3.6 | 4.2 / 3.5 | no |
| Classic / near / 1 | 3.7 / 6.0 | 4.1 / 5.9 | no |
| Classic / far / 1 | 1.6 / 2.8 | 3.1 / 2.7 | no |
| Definitive / near / 0 | 3.2 / 5.0 | 4.4 / 4.9 | no |
| Definitive / far / 0 | 3.7 / 2.8 | 4.5 / 3.2 | yes |
| Definitive / near / 1 | 3.8 / 4.7 | 4.9 / 4.7 | yes |
| Definitive / far / 1 | 4.2 / 2.8 | 4.2 / 2.8 | yes |

Frozen Throne at the same build:

| Mode / view / client | Stock \|ΔL\| / ΔE00 | Stage \|ΔL\| / ΔE00 | Neither falls at reported precision |
| --- | --- | --- | --- |
| Classic / near / 0 | 4.6 / 6.1 | 4.7 / 6.0 | no |
| Classic / far / 0 | 4.5 / 5.2 | 4.8 / 5.3 | yes |
| Classic / near / 1 | 3.7 / 6.2 | 3.8 / 6.1 | no |
| Classic / far / 1 | 4.6 / 5.0 | 4.9 / 5.0 | yes |
| Definitive / near / 0 | 3.7 / 5.3 | 4.5 / 5.3 | yes |
| Definitive / near / 1 | 4.0 / 5.0 | 4.9 / 5.0 | yes |
| Definitive / far / 0 | render timed out | 2.9 / 2.2 | not graded |
| Definitive / far / 1 | render timed out | 4.5 / 3.1 | not graded |

Three concurrent Definitive renders reached Wisp's two-minute render limit.
Serializing only the failed cases recovered the near stock and stage frames;
far stock still timed out. Preserve the passed frames and repair that render
path before grading the far pair.

The shared stage batch keeps the original `170-*` contrast checks and `191-*`
camera extremes in one hosted game. `192-*-linear|height` retains the same
paused far view before and after a 3.0 height-fog candidate; its values remain
development-only until those native captures establish how the height range
fades the prop bases. Run it in Classic and Reforged and record the per-stage
result rather than inferring drawing from native calls.

The authored tech-contact spark retains its additive SD geometry and adds a
small blue omni light, radius 320, fading from intensity 0.55 to zero in 180 ms.
It is part of the same pooled model, so parking the spark also parks its light.
HD modes can draw that contact light through their point-light renderer;
Classic retains the spark geometry. Compare `-dev effects 12` at the same
50 ms capture intervals in the retained unlit and lit maps before claiming
improved contact readability. The model adds no script calls per frame.

Slash hit sparks (the authored Hit model, every `HitElement.slash` contact)
carry the same kind of light: warm white `{1, 0.9, 0.7}`, radius 380,
intensity 0.9 → 0.35 at 70 ms → 0 at 140 ms, inside the spark's 9-frame
pooled life. It adds 204 bytes to the existing imported model and no new
file: no stock contact spark carries a light of that colour and length, and a
second stock effect per hit would add a pool and script calls. Checks
`192-slash-before|after` compare it against the f9d0fbf3 build.

The #168 gate is the measured predicted frame cost (p99 ≤10 ms, worst ≤14 ms)
from a `--samples` run checked with `bun wisp perf budget RUN_FILE`. Run the
matching workload on the hosted farm. GPU frame intervals and #165 profile
comparisons come from the native owner's capture tooling; they are distinct
from Lua/native-call cost predictions. `-dev render-clock` is a #169 probe
of candidate callback clocks, not an established rendering-frame-rate meter.

### Stratholme presentation (#297)

ST-3 uses the stock `Environment\Sky\LordaeronFallSky\LordaeronFallSky.mdx`
against the existing right-third ruined cathedral. The dusk fog stays at
5,000–11,000 with RGB (0.5, 0.28125, 0.1875). A destroyed Androhal clock tower
in the far city band adds a stock HD silhouette; Classic keeps the cathedral,
gate and ruined halls because the tower has no Classic copy.

ST-1 places two warm omni lights on the existing town fires, with radii 1,100
and 900; both stop at least 1,550 units behind the fighting band. Their slow
1,600/2,100 ms loops follow stage-art rule 8. One casts shadows. The models
reuse Blackrock's two shipped light-only models: zero new imported bytes.
The native stock tower is 1,428,524 bytes in Reforged storage, not a map import.
ST-2's roofs and brick surfaces are the separate #276 material work.

## Who sees which mode (patch 3.0.1, Oct 2026)

Sources: Blizzard 3.0.0 (Sep 12) and 3.0.1 (Oct 7) notes at https://us.forums.blizzard.com/en/warcraft3/t/warcraft-iii-reforged-forsaken-kingdom-patch-notes/38400; https://outputlag.com/news/warcraft-iii-reforgeds-definitive-edition-graphics-mode-is-free-for-reforged-owners/ (Sep 12); https://www.masterofwarcraft.net/2026/09/warcraft-3-patch-3-0-forsaken-kingdom-campaign.html (Sep 16).
- (a) Free Battle.net account: unconfirmed. No source says which modes a free account can select.
- (b) Classic / Reign of Chaos / Frozen Throne owner: unconfirmed for Definitive and Reforged; Classic is the guess.
- (c) Reforged owner: confirmed. Classic, Reforged and Definitive are all selectable; Definitive is free to Reforged owners and needs the 3.0 Reforged client.
- (d) Forsaken Kingdom owner: confirmed that the campaign needs the purchase and progress carries across modes; Definitive does not need it. Modes match (c) by inference (guess).
- Lobbies: confirmed that players on different modes can share a multiplayer game. Custom-map lobbies are not stated by any source.
- Guess: custom maps using visuals missing in another mode may look different or be unusable there (Hive Workshop bug list, unverified).

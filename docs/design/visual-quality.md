# Visual quality: the renderer levers a map has

What Warcraft III 3.0 lets a map change about how the game looks, what each
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
| Lighting editor, omni lights | World Editor 3.0 (map file data) | Map-placed omni lights and shadow-casting omni lights | HD modes; placed once per map, not per stage | Unused |
| Map post-processing | World Editor 3.0 (map file data) | The patch notes explicitly add a tool for post-processing at map level | — | No post-processing native appears in the pinned common.j; the editor's exported data is the boundary to inspect |
| HD materials | stock asset paths | Reforged and Definitive draw the HD PBR copy of a stock path | HD | **Measured** availability: all 25 stock scenery and sky paths resolve in all three modes; the HD draw itself is unmeasured |

### What is impossible

Not available to a map: custom shaders or materials beyond what MDX layers
and HD material slots express, replacing the renderer, colour LUTs, bloom or
exposure from script, creating or moving omni lights at run time (except by
placing effects whose models carry lights), driving PopcornFX particles, and
reading or choosing the player's graphics mode or options
([features index](warcraft-features.md#impossible-for-a-map)).
Editor-level post-processing is available in 3.0; its exact controls and
serialized map data need an editor export to establish. Do not infer that
bloom, colour grading or depth of field are separately controllable until
that export demonstrates them. The player's own settings are theirs (#165).
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
   most 1. Ahn'Qiraj's is 0.5, pinned, so fighters stay darker than its bright
   sandstone ring (#267). Frozen Throne's is 0.8, pinned, so its lit key sits
   below the dimmest stock noon key, Reforged's 0.92 × (0.84, 0.84, 0.98),
   against its bright glacier backdrop (#265). Both follow "light the play,
   not the backdrop" ([stage art](stage-art.md), CEDEC 2019): fighters must
   neither dominate nor vanish.

Rules 2 and 3 hold fighters bright. The measurement below shows that is only
right where the backdrop behind the fighters is darker than they are.

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
| Ahn'Qiraj (13) | 255, 240, 204 / 192, 170, 136 at intensity 0.5 (#267) | authored | at intensity 1, contrast fell (abs ΔL 33.5 → 22.9, 14.6 → 3.8) | Re-capture the triple at 0.5 |
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
An actual Classic and Reforged draw is needed for the asset fallback claim.

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

# Visual quality: the renderer levers a map has

What Warcraft III 3.0 lets a map change about how the game looks, what each
lever does and costs on the native clients, and which ones Smashcraft uses.
Stage composition (scenery, depth bands, deck palettes) is in
[stage art](stage-art.md); this page is about light, atmosphere and
materials. Every feature added since Reforged, by patch, is indexed in
[Warcraft features since Reforged](warcraft-features.md).

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
those fixed pipelines take.

Record the graphics mode in each capture. A client preference is evidence of
the selected mode, not evidence that an individual imported model uses PBR.

## The levers

Native names are from 3.0.0.24268's common.j (wisp:src/natives/warcraft.d.ts).

| Lever | Natives | What it changes | Modes |
| --- | --- | --- | --- |
| Lighting model | `SetDayNightModels(terrain, unit)` | The directional key light, its colour and the ambient fill for terrain and for every unit and effect, sampled at the time of day | all; HD modes add their own rim and image lighting |
| Time of day | `SetTimeOfDay`, `SetTimeOfDayScale(0)` | Where the lighting model is sampled; the shell freezes noon | all |
| Distance fog | `SetTerrainFogEx(style, start, end, density, r, g, b)` | Linear (0), exponential (1) or exponential-squared (2) fog over terrain, units and effects | all |
| 3.0 fog | `SetTerrainFogExV`, `BlzSetTerrainFog{Style,ZStart,ZEnd,Density,HeightStart,HeightEnd,LinearStart,LinearEnd,MaxLinearDensity,DrawOverSky,Color}` | Height fog, a density cap and fog drawn over the sky | measured below |
| Sky | `SetSkyModel`, `BlzShowSkyBox` | The sky dome model; hiding it leaves the clear colour | all; the HD modes draw their own sky variants |
| Weather | `AddWeatherEffect(rect, id)` | Particle weather emitted 768 above the terrain | all; falls below Smashcraft's arena, which stands 1,800 above the ground |
| Ubersplats | `CreateUbersplat` | Terrain decals | all; terrain only, so nothing under a floating arena |
| Effect colour and alpha | `BlzSetSpecialEffectColor`, `BlzSetSpecialEffectAlpha`, `BlzSetSpecialEffectColorByPlayer` | Multiplies a model's vertex colour; fades it | all |
| Effect models | `AddSpecialEffect` with stock or imported MDX | Additive and emissive-looking layers, particle emitters, ribbons, and in HD modes the model's own point lights | all; point lights in HD modes only |
| HD water | `SetHDWaterParams*`, `BlzSetHDWater*` | HD water's colour, opacity, reflectivity, emissivity, waves | HD modes; Smashcraft has no water |
| Point-light shadows | `BlzSetMinShadowCastingPointLightCount` | How many model point lights cast shadows | HD modes |
| Lighting editor, omni lights | World Editor 3.0 (map file data) | Map-placed omni lights and shadow-casting omni lights | HD modes; placed once per map, not per stage |
| Map post-processing | World Editor 3.0 (map file data) | The patch notes explicitly add a tool for post-processing at map level | No post-processing native appears in the pinned common.j; the editor's exported data is the boundary to inspect |

Not available to a map: custom shaders or materials beyond what MDX layers
and HD material slots express, replacing the renderer, or choosing the player's
graphics mode from map code. Editor-level post-processing is available in 3.0;
its exact controls and serialized map data need an editor export to establish.
Do not infer that bloom, colour grading or depth of field are separately
controllable until that export demonstrates them. The player's own settings
are theirs (#165). In 3.0, Point Light Shadows, Water and Supersampling were
added, Shadows became Environment Shadows, and the player-facing Ambient
Occlusion, Bloom, Portrait Bloom, Particles and Spells options were removed.

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
(war3mapImported\, the decks, fighters' clip pools, impact effects, the
stage lights) draw the same file in every mode with classic materials. The
lighting models do too: an imported DNC is not replaced in HD modes. Only
IcecrownGlacierSky, NorthrendSky, AshenvaleSky and BarrensSky (and the
Definitive-only NaxxNightSky, UndercitySky, ArcaneSky) are HD-only skies; a
Classic client shows nothing for them, so the stages keep classic skies.

### Lighting models

A day/night (DNC) model is an MDX with one directional light whose `Color`
(key) and `AmbColor` (fill) tracks run over a 60-second `Stand` sequence
mapped to the 24-hour day. Classic Lordaeron's unit light at noon is a white
key with a (0.84, 0.84, 0.98) fill; its night key is (0.31, 0.53, 0.80)
(read from the stock models; MDX stores colours blue first). The terrain
model lights terrain and the unit model lights units and special effects, so
on Smashcraft's floating arena the unit model lights both the fighters and
the scenery. The decks are unshaded and ignore it.

Smashcraft authors one lighting model per stage (smashcraft:ts/src/game/assets/stageLighting.ts;
smashcraft:ts/scripts/stageLight.ts writes the MDL, smashcraft:tools/stage/package.ts
compiles it into the stage-assets family): a directional light with constant
key and fill colours at the classic sun's rotation, so the time of day can't
move it. The shell sets it with the sky and fog when a stage is drawn
(smashcraft:ts/src/platform/shell/stageScenery.ts) and loads them all at map
start.

Patch 2.0 broke custom DNC models: one with a light node lit the whole map
with no shadows, one without went black
([Blizzard forum](https://us.forums.blizzard.com/en/warcraft3/t/dnc-light-models-now-bugged-post-patch-20/33763)).
The 3.0 measurements below say how it behaves now.

### Stage light rules

smashcraft:ts/src/game/assets/stageLighting.tests.ts enforces them:

1. Every selectable stage has its own light; no two share one.
2. The key light's luma is at least 210, so a fighter's lit side stays bright.
3. The fill's luma is at least 120 and at most the key's, so a fighter's
   shaded side stays readable against the dark lower backdrop.
4. Neither colour's chroma (largest channel minus smallest) exceeds 80, so a
   tinted light never repaints the team colours.

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

The #168 gate is the measured predicted frame cost (p99 ≤10 ms, worst ≤14 ms)
from a `--samples` run checked with `bun wisp perf budget RUN_FILE`. Run the
matching workload on the hosted farm. GPU frame intervals and #165 profile
comparisons come from the native owner's capture tooling; they are distinct
from Lua/native-call cost predictions. `-dev render-clock` is a #169 probe
of candidate callback clocks, not an established rendering-frame-rate meter.

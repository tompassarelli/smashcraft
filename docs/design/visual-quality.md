# Visual quality: the renderer levers a map has

What Warcraft III 3.0 lets a map change about how the game looks, what each
lever does and costs on the native clients, and which ones Smashcraft uses.
Stage composition (scenery, depth bands, deck palettes) is in
[stage art](stage-art.md); this page is about light, atmosphere and
materials.

## The renderer is fixed

A map ships data and a Lua script; it can't ship shaders or change the
pipeline. 3.0 has three graphics modes, picked by the player (War3Preferences
`[Misc] hd`, 0 Classic, 1 Reforged, 2 Definitive Edition; Definitive replaced
2.0's Classic HD): Classic draws the root asset set with fixed-function
lighting, Reforged and Definitive draw `_hd.w3mod` and `_de.w3mod` assets with
physically based materials (diffuse, normal, ORM, emissive, team colour,
environment map), image-based lighting, shadow maps and point lights
([3.0 patch notes](https://warcraft.wiki.gg/wiki/Warcraft_III/Patch_3.0.0),
[Hive 3.0 thread](https://www.hiveworkshop.com/threads/warcraft-3-reforged-forsaken-kingdom-expansion-and-major-updates.374111/)).
The map can't read or choose the mode. Everything below is the set of inputs
those fixed pipelines take.

Players' clients: Tom's install and the LAN pool run Classic (`hd=0`); the
signed-in test clients A and B run Definitive (`hd=2`).

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

Not available to a map: custom shaders or materials beyond what MDX layers
and HD material slots express, post-processing (bloom, colour grading, depth
of field), per-object light or shadow parameters at run time, reading the
player's graphics mode, and changing War3Preferences. The player's own
settings (bloom, shadows, lighting quality) are theirs (#165).

### Assets and graphics modes

A stock path resolves per mode: `Doodads\Cinematic\FrozenThrone\FrozenThrone.mdx`
draws the classic model in Classic and its HD remake in Reforged and
Definitive. All 21 stock scenery models and all 7 stock skies the stages use
have `_hd.w3mod` versions (read from the installed CASC storage on 7 Oct), so
HD clients get PBR scenery with no map change. Imported models
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

## Measurements

<!-- filled from the native captures -->

## How the numbers are taken

Fighter contrast is measured on native captures of the offline LAN pool
(1280x720, `visual` profile). `-dev backdrop off` (development builds) hides
the sky, fog, scenery and decks, so a capture of it shows only the fighters:
their pixels are the largest connected regions that differ from its empty
background, above the HUD. For each frame of the same stage and moment, the
fighters' mean CIELAB colour is compared with the mean of a ring 4 to 18
pixels around them: the lightness step ΔL and the CIEDE2000 difference ΔE00.
A change passes when neither falls. `-dev render-clock` (#169) reports the
engine's frame rate on that stage.

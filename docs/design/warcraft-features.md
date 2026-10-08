# Warcraft III features since Reforged: the index

Every engine and World Editor feature Warcraft III added from Reforged
(1.32, January 2020) through 3.0.1.24342 (7 October 2026), following
3.0.0.24268 "Forsaken Kingdom" (12 September 2026), that changes how a map can look or what its
script can drive: lighting, fog, sky, water, particles, materials, terrain,
camera and the natives behind them. For each: the patch, the native or
editor field, whether map script can drive it at run time, graphics modes,
and cost. [Visual quality](visual-quality.md) says which levers Smashcraft
uses and how they are measured; [stage art](stage-art.md) applies them per
stage.

Native names were checked against the pinned common.j
(wisp:src/natives/warcraft.d.ts). Patch-by-patch native sets come from
comparing common.j across releases ([Luashine/jass-history](https://github.com/Luashine/jass-history),
[lep/jassdoc](https://github.com/lep/jassdoc), annotated for 3.0.0.24268):
1.32.10 → 1.36.1 added no natives, 1.36.1 → 2.0.4 added only
`UNIT_RF_FLY_MAX_HEIGHT`, and 2.0.4 → 3.0.0 added about 168 names. So 3.0
is the release with new lighting, fog, water and graphics script access;
2.0.x changed the renderer and assets without new natives.

Graphics modes: 3.0 offers Classic, Reforged and Definitive Edition
(Definitive replaced 2.0's Classic HD); the player picks, and a map can
neither read nor choose it ([visual quality](visual-quality.md#the-renderer-is-fixed)).
"HD" below means Reforged and Definitive.

## 3.0.1 (October 2026): renderer and asset corrections

The [3.0.1 notes](https://us.forums.blizzard.com/en/warcraft3/t/warcraft-iii-reforged-forsaken-kingdom-patch-notes/38400/4)
and the installed common.j/assets are covered in
[visual quality](visual-quality.md#301-presentation-changes). No new
presentation native was added; the 3.0 fog, lighting and water interfaces
below still apply.

| Feature / correction | Map access | Cost / application |
| --- | --- | --- |
| Ambient Occlusion option restored | player option; map post-processing configuration | extra graphics cost; capture profiles record AO explicitly |
| Lordaeron Summer daytime lighting dimmed by 10% | stock day/night models | stock contrast baselines must use 3.0.1; authored models retain their values |
| Stock spell effects retuned; Brewmaster and Grunt reanimated | existing model paths | captures of those effects and animations must name the client build |
| `WaterfallNoMist` asset | HD / Definitive model path; no Classic copy | use a Classic stock waterfall when needed; no map-script emitter controls |
| Definitive portrait animation and lip sync improved | native unit portraits | Smashcraft uses rendered portraits |
| Imported assets, model paths containing periods, item-light cleanup and editor lighting/post-processing fixes | existing imports and editor fields | removes engine defects; no new per-frame script calls |

## Smashcraft application by stage

This table describes the shipped setup in `ts/src/game/presentation/stageScenery.ts`,
its scenery modules, and `ts/src/game/assets/stageLighting.ts` /
`stagePointLights.ts`. Every row has an authored day/night light and distance
fog. Height fog uses `SetTerrainFogExV(3, ...)`, a maximum-density cap and the
listed draw-over-sky choice. Point lights are model lights, with one shadow
caster per lit stage; the shell requests that minimum through
`BlzSetMinShadowCastingPointLightCount`. Classic and Definitive are the
supported player modes. Stage capture and performance results belong in
[#192](https://github.com/tompassarelli/smashcraft/issues/192).

| Stage | Sky | Shipped 3.0 feature application |
| --- | --- | --- |
| Practice / Sky (0) | authored neutral sky | neutral light and linear fog; no atmosphere below the plain practice deck |
| Frozen Throne (2) | authored glacier sky | icy light at 0.8; linear fog; height fog remains a capture candidate |
| Durotar (3) | authored desert sky | warm light at 0.3; linear dust fog; height fog remains a capture candidate |
| Naxxramas (4) | authored necropolis sky | one plague-green model light, shadow-casting; linear teal fog |
| Stratholme (6) | stock Lordaeron Fall | two fire model lights, one shadow-casting; linear dusk fog |
| Tomb of Sargeras (7) | authored sea sky | teal height fog below the deck, cap 0.375, draw-over-sky off |
| Nordrassil (10) | stock Felwood aurora | teal height fog below the roots, cap 0.5, draw-over-sky off to preserve the aurora |
| Gryphon Aerie (11) | authored cloud sky | desaturated blue height fog below the deck, cap 0.5, draw-over-sky on; light at 0.2 |
| Blackrock (12) | authored cavern sky | two forge-fire model lights, one shadow-casting; light at 1.2 and linear ember fog |
| Ahn'Qiraj (13) | authored sandstone sky | ochre light at 0.5; linear fog; height fog remains a capture candidate |
| Hellfire (14) | stock Outland sky | two fel-green model lights, one shadow-casting; linear green fog |

HD terrain-water controls do not affect the model surfaces used for Tomb's
tide floor or Blackrock's lava: terrain is hidden. Existing sky models use
`SetSkyModel`, an older native; 3.0's new sky-related control is fog drawn over
the sky. The shell resets the fog cap, draw-over-sky and shadow-light minimum
between stages so a previous scene does not leave its settings behind.

Slash contact sparks use the existing authored Hit model with a warm-white
omni light: radius 380, intensity 0.9 → 0.35 → 0 over 140 ms. This uses 3.0's
uncapped HD model lights and adds 204 bytes to the existing model, with no
additional file or per-frame script call. The Classic spark geometry is
retained. Native before/after captures determine the readability improvement;
the unchanged #168 gate is p99 ≤10 ms and worst ≤14 ms.

Wisp reports the model, emitter and external effect file for visible
PopcornFX emitters, and fails a render naming unsupported emitters
([wisp#83](https://github.com/tompassarelli/wisp/issues/83)). That failure is
useful evidence of the missing draw; it is not a particle-fidelity pass.
Height-fog appearance, point-light shadows and the slash light still need
the corresponding Classic/Definitive captures when no matched native
reference exists.

## 3.0.0 Forsaken Kingdom (September 2026): the priority features

Source for this section unless noted: the
[3.0.0 patch notes](https://us.forums.blizzard.com/en/warcraft3/t/warcraft-iii-reforged-forsaken-kingdom-patch-notes/38400)
("PN3"), the [Hive 3.0 thread](https://www.hiveworkshop.com/threads/warcraft-3-reforged-forsaken-kingdom-expansion-and-major-updates.374111/),
and common.j.

### Fog (atmosphere, not fog of war)

| Feature | Native / field | Script at run time | Modes | Cost / notes |
| --- | --- | --- | --- | --- |
| Extended fog | `SetTerrainFogExV(style, zstart, zend, density, heightStart, heightEnd, linearStart, linearEnd, r, g, b)` | yes | all (style 0–2); HD per PN3 "view shadows and fog in HD" | parameter set only; no per-frame cost of its own |
| Per-field fog | `BlzSetTerrainFogStyle(fogstyle)`, `…ZStart`, `…ZEnd`, `…Density`, `…HeightStart`, `…HeightEnd`, `…LinearStart`, `…LinearEnd`, `…MaxLinearDensity`, `…DrawOverSky(boolean)`, `…Color(r, g, b)` | yes; each can be tweened | as above | as above |
| Fog styles | `FOG_STYLE_LINEAR` 0, `_EXP` 1, `_EXP2` 2, `_HEIGHT` 3, `_NEW_EXP` 4, `_NEW_EXP_2` 5 (`ConvertFogStyle`) | yes | 0–2 classic; 3–5 new | — |
| Editor fog | "more fog options (height fog, new exponential, draw over sky, max opacity)", live editing of fog and HD water | editor; written into the map script's `main` | — | — |

Smashcraft's native measurements of what height fog, max density and draw
over sky actually do belong in [visual quality](visual-quality.md).

### Lights, shadows, post-processing

| Feature | Native / field | Script at run time | Modes | Cost / notes |
| --- | --- | --- | --- | --- |
| Lighting editor, editable omni lights, shadow-casting omni lights, light range display | World Editor | no native creates or moves them | HD | shadowed point lights obey the player's Point Light Shadows option |
| Minimum shadow-casting point lights | `BlzSetMinShadowCastingPointLightCount(n)`, `BlzGetMinShadowCastingPointLightCount()` | yes | HD | each shadowed light is an extra shadow render |
| Unlimited model lights in HD | engine: lights inside MDX models (effects, units) are no longer capped in HD; SD keeps its cap (jassdoc on `AddSpecialEffect`) | indirectly, by placing effects whose models carry lights | HD unlimited, SD capped | per-pixel cost per light in HD |
| Disable HD shadow flag; shadow-blocker doodads; doodad decals; water doodad | World Editor / object data | editor | HD | — |
| Updated IBL environment maps | engine | no | HD | — |
| Map post-processing tool | World Editor, "apply post-processing effects at map level" | **no native**; fixed per map at edit time | HD | not in common.j |
| Depth of field camera fields | `CAMERA_FIELD_DEPTH_OF_FIELD_DISTANCE`, `CAMERA_FIELD_DEPTH_OF_FIELD_SCALE` via `SetCameraField` | yes | HD | a full-screen blur pass |
| Absolute camera height | `CAMERA_FIELD_ZABSOLUTE` | yes | all | — |
| Player options | added Point Light Shadows, Water, Supersampling; removed Ambient Occlusion, Bloom, Portrait Bloom, Particles, Spells; Shadows renamed Environment Shadows | player only | — | a map can't rely on any being on |

### HD water (the water rework)

| Feature | Native | Script at run time | Modes |
| --- | --- | --- | --- |
| Whole water setup | `SetHDWaterParams(r, g, b, useColor, vertexDisplacement, minOpacity, maxOpacity, reflectivity, emissivity, edgeSoftness, waveStrength)`, `SetHDWaterParamsEx(…, envMapStrength)` | yes (the editor writes it into `main`) | HD, player Water option |
| Per field | `BlzSetHDWaterColor`, `…ColorOverride`, `…VertexDisplacement`, `…MinOpacity`, `…MaxOpacity`, `…Reflectivity`, `…Emissivity`, `…EdgeSoftness`, `…WaveStrength`, `…EnvMapStrength` | yes | HD |
| Classic tint (1.07, still current) | `SetWaterBaseColor(r, g, b, a)`; in HD the alpha affects only the surface | yes | all |

Water is terrain: it draws only where the map's terrain has water. A
floating arena has none in view unless a stage puts terrain water there.

### Doodads, destructables, effects, input

| Feature | Native | Script |
| --- | --- | --- |
| Doodad team colour | `SetDoodadColor`, `SetDoodadColorRect`, `BlzSetSingleDoodadColor` | yes |
| Per-doodad animation and queries | `BlzSetSingleDoodadAnimation`, `BlzGetNumDoodads`, `BlzGetDoodadX/Y/Z/ScaleX/Y/Z/Yaw/Pitch/Roll/Variation/Id/IsUsingModelAxes` | yes |
| Destructable and item colour, pitch/roll creation | `SetDestructableVertexColor`, `SetDestructableColor`, `SetItemColor`, `BlzCreate…Destructable…` variants | yes |
| Effect animation by name, blend time | `BlzSetSpecialEffectAnimation`, `BlzQueueSpecialEffectAnimation`, `BlzSetSpecialEffectAnimationBlendTime` | yes |
| Hero glow per unit | `AllowHeroGlowOnUnit`, `DisallowHeroGlowOnUnit`, `HeroGlowIsAllowedOnUnit` | yes |
| Camera | `SetCameraFieldControlledByInput`, `BlzCameraSetCameraType`, camera blockers | yes |
| Input | `BlzIsKeyPressed`, `BlzIsMouseButtonPressed`, `BlzIsMetaKeyPressed`, `BlzGetMouseScreenPosX/Y`, pixel/frame conversions | yes |

Other 3.0 changes: "1.36 terrain re-added to Reforged mode"; the add-on
system was deprecated; Hive reports that custom model paths without an
extension stopped resolving.

## 2.0.0–2.0.4 (2024–January 2026): renderer and assets, no new natives

- 2.0.0: HD versions of Classic assets (Classic HD); bloom removed; tone map
  updated; ambient lighting raised; skins can be disabled
  ([2.0.0 notes](https://news.blizzard.com/en-us/article/24167122/warcraft-iii-reforged-patch-notes-patch-2-0-0)).
  Custom day/night models broke: one with a light lit the whole map without
  shadows, one without went black ([forum](https://us.forums.blizzard.com/en/warcraft3/t/dnc-light-models-now-bugged-post-patch-20/33763));
  Smashcraft's per-stage lights are measured on 3.0 in [visual quality](visual-quality.md).
- 2.0.2: Reforged environment light direction matches Classic; dungeon
  lighting overhauled ([2.0.2 notes](https://us.forums.blizzard.com/en/warcraft3/t/warcraft-iii-reforged-patch-notes-version-202/35355)).
- 2.0.3: Reforged shaders updated (stronger shadows and lighting); AO and
  bloom options returned (3.0 removed them again); heavy Reforged particle
  counts optimised; tileset limit 16 → 64; `UNIT_RF_FLY_MAX_HEIGHT`.
- 2.0.4: more cliff types ([2.0.3/2.0.4 notes](https://us.forums.blizzard.com/en/warcraft3/t/warcraft-iii-reforged-patch-notes-version-204/36567)).

## 1.33–1.36: no new natives

Balance, editor and bug-fix releases; common.j is unchanged across them.

## 1.32 Reforged (January 2020)

| Feature | Native / field | Script | Modes |
| --- | --- | --- | --- |
| HD asset set and PBR materials (diffuse, normal, ORM, emissive, team colour, environment map), PopcornFX particles in HD models | `_hd.w3mod:` asset paths; map options SD / HD / both; per-mode imports | editor and asset paths; tint, alpha and skins are the only per-material script control | HD |
| Portrait lighting | `SetPortraitLight(dncFile)` | yes | all |
| Depth of field | `CameraSetFocalDistance`, `CameraSetDepthOfFieldScale` | yes | HD |
| Hide terrain or sky | `BlzShowTerrain(boolean)`, `BlzShowSkyBox(boolean)` | yes | all |
| Team glow | `BlzShowUnitTeamGlow` | yes | all |
| Skins | `BlzSetUnitSkin`, `BlzGetUnitSkin`, `BlzCreateUnitWithSkin`, item and destructable `…WithSkin` | yes | all |
| Skin path lookup | `SkinManagerGetLocalPath(key)`: local and mode-dependent, so never feed it into synchronized state | yes | all |
| Cinematic panels | `BlzHideCinematicPanels` | yes | all |

PopcornFX particles can't be authored or driven from a map; converting an HD
model to classic drops them.

## Before Reforged, still the run-time tools (1.29–1.31 and classic)

- 1.29.2 effect control: `BlzSetSpecialEffectColor/Alpha/Scale/Position/Height/X/Y/Z/TimeScale/Time/Orientation/Yaw/Pitch/Roll/ColorByPlayer`, `BlzGetLocalSpecialEffectX/Y/Z`.
- 1.30: `BlzPlaySpecialEffect[WithTimeScale]`, sub-animations, `CAMERA_FIELD_NEARZ`.
- 1.31: `BlzSetSpecialEffectMatrixScale`, `BlzResetSpecialEffectMatrix`, local camera pitch/yaw/roll fields, `BlzFrameSetModel`.
- Classic: `SetDayNightModels`, `SuspendTimeOfDay`, `SetTimeOfDayScale`,
  `SetSkyModel`, `SetTerrainFogEx`, the cinematic filter
  (`SetCineFilterTexture/BlendMode/StartColor/EndColor/Duration`,
  `DisplayCineFilter`: a full-screen textured overlay, local per player),
  `AddWeatherEffect`, `CreateUbersplat`, `TerrainDeform*`,
  `SetDoodadAnimation`, `AddLightningEx`, `SetUnitVertexColor`.

## Impossible for a map

- Custom shaders, colour LUTs, bloom or exposure from script; the 3.0
  post-processing tool is editor-only.
- Creating, moving or recolouring omni lights at run time, except by placing
  effects whose models contain lights (capped in Classic).
- Reading or choosing the graphics mode or the player's graphics options.
- Driving PopcornFX or any material parameter beyond tint, alpha, team
  colour and skin.

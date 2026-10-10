# Tomb water on 3.0.0.24268: source diagnosis and proposed repair

This is the code-side proposal for reopened [#277](https://github.com/tompassarelli/smashcraft/issues/277), following TS-1, TS-2 and TS-3 in [stage boards](stage-boards.md#tomb-of-sargeras-7-two-overhanging-end-platforms). Source baseline: Smashcraft `a42379af9e4efae82a0e3f4b3de06b261e858df8`, fetched origin/main on 10 October 2026; Wisp `e1b0600689500eb99a126b96184cf3361a9abf1e` ([lock](../../ts/wisp.lock)). The stage-assets family is `8226c345ca5ed6abbc3bcafbaf2e9f0d2f1acea9be1e39d1bfa76e00f1697339` ([manifest](../../build-inputs.json)). No implementation, asset generation, client operation or rendering is part of this proposal.

## Done when, before implementation approval

- Trace both looks to their actual water model and texture, with source locations and stored-file hashes.
- Separate patch-dependent features from absent terrain water and unresolved native drawing.
- Give a minimal Tomb-only proposal for water, underside, camera and HUD, and identify the hydra occlusion mechanism.
- Publish this document on `codex/water-277-prep`; leave the visual boxes open for supervisor account b evidence.

Not required: gameplay/current/hazard changes, other stages, imported art, settings changes, Wisp changes, new tests, local builds or native captures. Type checking is unnecessary for this document-only change.

## Which water is drawn

| Look on 3.0.0.24268 | Complete source causal chain | Native fact still needed |
| --- | --- | --- |
| Definitive, account b | [stageScenery.ts:32](../../ts/src/platform/shell/stageScenery.ts#L32) hides terrain. [terrainPieces:117](../../ts/src/game/presentation/stageScenery.ts#L117) always adds imported StageWater at arena z=1 and StageSea at z=-360. [placedPieces:157](../../ts/src/game/presentation/stageScenery.ts#L157) includes both; the shell creates and plays each at [44–51](../../ts/src/platform/shell/stageScenery.ts#L44). Both use MDX 800 textured planes. The broad chevrons are StageSea's authored opaque texture, not an HD terrain-water fallback chosen by a version guard. | Supervisor must confirm the artifact and profile, identify these handles/paths in the running scene, and measure motion. |
| Classic, VM pool | Exactly the same terrain-hidden and two-model path; there is no look or patch branch. Root imported MDX/TGA files are shared. StageWater is a translucent deck overlay; StageSea is the opaque swimming surface. | Pool owner must record one line confirming actual visible handles/paths; source equality is not a native measurement. |

The origin is z=1800 ([arenaCamera.ts:10](../../ts/src/game/presentation/arenaCamera.ts#L10)), so StageWater is world z=1801 and StageSea is world z=1440. [SEA_SURFACE_Z](../../ts/src/game/sim/stageHazards.ts#L110) remains -360. StageWater spans x ±600 and y ±60. StageSea spans x ±12000, y -6200..10600; its center is within map bounds. The shared 3.0 HD-water natives are never called by this path. Showing terrain or tweaking HD-water parameters alone would change neither imported plane.

The exact files are named by [terrainAssetInfo.ts:2–4](../../ts/src/game/assets/terrainAssetInfo.ts#L2):

| Model import | Texture import | Measured texture bytes / SHA-256 |
| --- | --- | --- |
| `war3mapImported\StageWater-57629c3281c4b59f6b809e5af96c4d54153f0694f29342e30563c10bbfd48a01.mdx` | `war3mapImported\StageWater-f0ca8d2d3fed3e7a57153240a347bb7ad3896105a7fe4077ed92e471a520c526.tga` | 16,402 / `f0ca8d2d3fed3e7a57153240a347bb7ad3896105a7fe4077ed92e471a520c526` |
| `war3mapImported\StageSea-cb3c7aadd94bb8d4b8a4caf9f3be47d029f313b1727a6c5214c26568a02ea37c.mdx` | `war3mapImported\StageSea-738cf8202a07994ab390fa0d91711db9ad3dfaad887a8a5c6e3e4f476c013567.tga` | 16,402 / `738cf8202a07994ab390fa0d91711db9ad3dfaad887a8a5c6e3e4f476c013567` |

These hashes were recomputed from the generator and independently read from the pinned private stage-assets store. No asset pixels are included here. [liquids.ts:11–25](../../tools/stage/liquids.ts#L11) builds both from [stageLiquid.ts:19–25](../../ts/scripts/stageLiquid.ts#L19): a sinusoid across x, bent by a sinusoid in y. Both textures are 64×64; Sea forces alpha 255. [liquids.ts:29](../../tools/stage/liquids.ts#L29) tiles Sea 96×64, giving a 250-world-unit horizontal texture period. The authored ripple's analytic x period is 16 texels, approximately 62.5 world units; rounding produces 3,064/3,072 identical RGBA comparisons at x and x+16. This predicts frequent chevrons without needing a patch-specific renderer defect.

Reading the pinned Sea MDX confirmed version 800, the texture path above, UVs `(0,0),(96,0),(96,64),(0,64)`, a looping Stand sequence 0..12000 ms, and UV translation 0→1 across that interval. It has no global sequence; translation belongs to the model's animation clock. At 60 callbacks/s, 30 frames span 500 ms, only 1/24 of a texture repeat (about 10.42 world units on Sea). The source requests motion and does not stop these scenery clocks. A single still image cannot establish absent motion; whether 24268 advances this texture animation, and whether its small displacement is perceptible, belongs to account b.

## What depends on 3.0.1

The repository does **not** support the premise that 3.0.0 lacks the fog, light or water natives used here. [visual-quality.md:391–398](visual-quality.md#301-presentation-changes) records the comparison with 3.0.0 common.j: no new presentation natives in 3.0.1. [The levers table](visual-quality.md#the-levers) lists 3.0 fog and HD water as 3.0.0 features. The source calls stock day/night models, not imported custom lights ([stageScenery.ts:34](../../ts/src/platform/shell/stageScenery.ts#L34)). No patch-native absence is proved by this prep.

What the repository does establish:

- Terrain water is unavailable while terrain is hidden, on both versions and looks ([visual-quality.md:102](visual-quality.md#the-levers)). Classic also lacks the HD terrain-water pipeline. This is a chosen scene path, not a missing 3.0.0 native.
- `WaterfallNoMist` is a 3.0.1-only stock addition with no Classic copy ([asset table](visual-quality.md#forsaken-kingdom-art-what-exists-in-which-mode)). Tomb's current source calls ordinary `Waterfall.mdx` ([homeStageScenery.ts:58](../../ts/src/game/presentation/homeStageScenery.ts#L58)); the pinned stage-assets import list contains no Waterfall override. The source comment about HD/DE replacement is not evidence that this pin ships one. It cannot explain the imported Sea chevrons.
- 3.0.1 fixed custom-asset/test-map-texture loading and other renderer defects ([presentation changes](visual-quality.md#301-presentation-changes)). Whether such a defect affects UV animation on 24268 is unknown. There is no source evidence to blame it yet.
- Historical version statements in visual-quality.md predate the reopened issue; the exact executable build, profile and artifact used in Tom's image must be recorded by the supervisor, not inferred from those historical tables.

## Smallest proposed changes

### 1. Moving, non-tiled water on 24268

Keep the terrain hidden and keep the physical swimming surface at -360. Repair the imported MDX 800 approach first; it uses an existing working asset path and avoids a terrain/base-map rebuild that changes the scene's structure. HD reflection is not a property of this plane; call it animated authored water, and judge whether it reads correctly on 24268.

Proposed diff surface:

```diff
tools/stage/liquids.ts / ts/scripts/stageLiquid.ts
+ Generate TombWater and TombSea variants beside existing Water/Lava/Sea.
+ Tomb variants use a larger authored texture with broad irregular wave bands,
+ several unequal phases and amplitudes, and no repeated 64x64 chevron cell.
+ Map one texture field across each Tomb plane rather than 96x64 repeats.
+ Bind its slow UV translation to a looping global sequence; retain MDX 800.
+ Keep TombSea opaque and TombWater's deck-overlay alpha.

ts/src/game/presentation/stageScenery.ts, terrainPieces(stage===7)
- STAGE_WATER_MODEL / STAGE_SEA_MODEL
+ STAGE_TOMB_WATER_MODEL / STAGE_TOMB_SEA_MODEL
```

The global UV clock is a candidate for continuous motion independent of Stand selection, not a proved cure for a native animation defect. First measure the existing native clock; compare one clock change before combining texture changes. Preserve plane positions, handles per stage, swimming/current rules and the other stages' shared liquid assets. Generate content-addressed paths through the existing package tool; never hand-edit terrainAssetInfo.ts or the private store. The eventual implementation also updates the stage-assets family and existing thumbnail/facts metadata as required by the generator workflow; no packaging is run for this proposal.

Account b must reject the candidate if any visible water-band period remains below 128 px in either camera view, or fixed-pixel luma is unchanged across 30 running frames. Native water remains an alternative only if this measured MDX 800 attempt fails: it would require showing terrain and authored terrain-water heights at 1440 while hiding land, so it is a larger scene/input change requiring its own concrete proposal.

### 2. A continuous rock/vine underside

[stagePalette.ts:162–169](../../ts/src/game/assets/stagePalette.ts#L162) already selects TS-3's RuinsNatural crop for the main body and RuinsVines for the underside. The grid comes from [stageMaterials.ts:11–36](../../ts/scripts/stageMaterials.ts#L11), which clips every face into 128-unit cells and resets each cell's UVs to 0..1. [54–59](../../ts/scripts/stageMaterials.ts#L54) then maps the same crop into each cell. `fitHeight` on platform bricks fixes only vertical scale; it does not remove horizontal repetition.

The minimal repair retains the existing taper and four materials:

```diff
ts/src/game/assets/stagePalette.ts, StageMaterial
+ fitFace?: boolean
Tomb main body and underside only
+ fitFace: true

ts/scripts/stageMaterials.ts, UV mapping inside texturedDeckMdl
+ For fitFace, derive UVs from the complete face's axis bounds rather
+ than each 128-unit cell; keep existing clipped geometry and crop.
+ All other material mappings retain their current UVs.
```

This is one material mapping option parallel to the existing fitHeight, needed to express TS-3's uninterrupted rock/vines. It adds no imported texture or new geometry. Keep carved platform bricks distinct per TS-b. If a face-spanning crop still has a visible grid in native pixels, it fails; do not accept the source option as visual evidence. The existing tapered outline provides depth; sculpting unrelated geometry is outside this repair.

### 3. The lowest camera and full HUD

[matchCamera.ts:243–279](../../ts/src/game/sim/matchCamera.ts#L243) follows the lowest active fighter, including swimmers, and deliberately lowers the target near the underside. [limitCamera:176–182](../../ts/src/game/sim/matchCamera.ts#L176) bounds the target and frustum but never requires the eye to stay above the deck. [arenaCamera.ts:39–45](../../ts/src/game/presentation/arenaCamera.ts#L39) sends the far extreme toward a low target; [view.ts:502–516](../../ts/src/platform/shell/view.ts#L502) applies the local aspect and model-fit pass before setting native fields.

A quiet source probe evaluated the existing extremeCamera and cameraPoint functions:

| Aspect / view | Target z | Distance | Eye z relative to deck | Deck row / swimming-surface row |
| --- | ---: | ---: | ---: | ---: |
| 16:9 near | 100.00 | 1450.00 | 351.79 | 0.6252 / 1.0525 |
| 16:9 far | -187.93 | 1698.01 | 106.93 | 0.3386 / 0.6424 |
| 64:27 near | 100.00 | 1450.00 | 351.79 | 0.6252 / 1.0525 |
| 64:27 far | -278.70 | 1273.51 | **-57.56** | 0.1747 / 0.5903 |

Eye height is `target.z + distance * sin(10°)`; rows use the project's projection, 0 at top. The wide far eye is below the walking plane, which can show a fighter standing on the deck from underneath. Near view also puts the swim surface below the frame; gameplay body fitting can change it, so these are extreme-function results, not native match captures. A source-only two-body observation (Illidan x=200,z=0; Dreadlord x=800,z=-360, 120 camera updates then local body fitting) gave eye z=129.03 at 16:9 and 67.15 at 64:27: the failure depends on pose/spread and cannot be assumed at every swim frame.

Proposed diff: in Tomb's **final local presentation** after fighter fitting, enforce eye z ≥ 80, equivalently `camera.z ≥ 80 - camera.distance * sin(10°)`. At the 64:27 far observation this would raise target z from -278.70 to -141.14. Keep angle 350°, collision, blast bounds and synchronized match camera unchanged. Fit distance upward when needed to retain fighters above the actual HUD boundary, then apply the eye constraint last; refuse a candidate whose constraints cannot fit within the current stage camera range. The provisional 80-unit clearance must be judged on account b before choosing its final value. Fixed near/far commands and ordinary gameplay must share this Tomb final constraint.

The HUD is a separate uncertainty. [matchHud.ts:77–80,130–140](../../ts/src/game/ui/matchHud.ts#L77) parents plates to GAME_UI and uses absolute frame positions; [frames.ts:27–28](../../ts/src/game/ui/frames.ts#L27) does not use the arena camera. Source layout ([plateLayout.ts:12–41](../../ts/src/game/ui/plateLayout.ts#L12), [portraitFrames.ts:14](../../ts/src/game/ui/portraitFrames.ts#L14)) yields plate bottom 0.012, bust bottom 0.022, name bottom 0.016375 and maximum shake displacement 0.004375 UI units: even the plate's worst source bottom is 0.007625 > 0. Camera movement cannot directly translate those screen frames.

Tom's private image is 2000×848 and shows only portrait tops at its bottom edge. That establishes the supplied image's cutoff, not whether it is a cropped capture, a native GAME_UI-origin problem or another layout/runtime difference. Supervisor account b owns this distinction. Request an uncropped framebuffer, actual client dimensions, UI frame centers/sizes and visibility, native camera target/eye/FOV, and the exact map build. If the native full frame places a HUD edge outside its drawable region, propose only the measured safe-bottom offset in the existing plate layout, and derive the camera's reserved HUD boundary from that measured top edge. Do not ship a guessed PLATE_BOTTOM change or treat the eye-floor fix as proof of HUD repair.

## Hydra: measured source mechanism, native silhouette unknown

The hazard uses stock `Units\Creeps\Hydra\Hydra.mdx` ([stageHazards.ts:20](../../ts/src/game/presentation/stageHazards.ts#L20)). [view.ts:435–438](../../ts/src/platform/shell/view.ts#L435) scales it to 0.75 during warning, places its origin 60 units below the opaque sea, and freezes animation time; during strike it uses [hydraStrikeZ:30–33](../../ts/src/game/presentation/stageHazards.ts#L30) at -210, falling 20 units/frame for 18 frames. At yaw 90°, its y=40 placement straddles the fighting plane rather than remaining far behind it.

Recorded Classic bounds are z=-160.65..220.001 ([modelFacts.ts:220](../../ts/scripts/wisp/modelFacts.ts#L220)). Warning therefore spans arena z=-540.49..-254.999, with an opaque plane at -360; at initial strike it spans -370.65..10.001. The waterline intersects the model deliberately, and the model then sinks. This is a concrete occlusion mechanism, not evidence of an engine clipping bug. The Definitive model's pose/visible silhouette, and whether the object in Tom's image is this hazard or a fighter, require account b identification. The nearby TempleOfTides is separately positioned at z=-800, scale 4 ([homeStageScenery.ts:52](../../ts/src/game/presentation/homeStageScenery.ts#L52)); do not conflate it with the hydra.

Once identified, the narrow hydra presentation candidate is to sample the stock swimming/emergence pose and place its neck/body transition at the waterline using that look's measured visible bounds. Preserve the warning/strike clock, damage, x, reach and 18-frame sinking schedule. Keep an obvious complete crest above water before attack, with an existing waterline cue masking the submerged body; an arbitrary whole-model lift would expose the feet and change its apparent reach. No hydra source edit is proposed until the native silhouette measurement names the needed pose/origin offset.

## Native confirmation owned by the supervisor

Use the VM's confirmed 3.0.0.24268 account b for Definitive and an owned Classic pool pair. Record executable build, mode, artifact SHA/input hashes, full drawable rectangle, viewport aspect, callback/held-frame identity and profile with every result. Keep captures/assets private. Wisp images are never evidence for these visual boxes.

Existing command surface, from `ts/`, for the supervisor after preparing a candidate:

```sh
bun wisp client watch b --once --clients-file ACCOUNT_B_CLIENTS_FILE
bun wisp accept --only 191-7-near --only 191-7-far --clients-file ACCOUNT_B_CLIENTS_FILE --solo --map CANDIDATE.w3x --out PRIVATE_DEFINITE_DIR
bun wisp accept --only 191-7-near --only 191-7-far --pair OWNED_CLASSIC_PAIR --map CANDIDATE.w3x --out PRIVATE_CLASSIC_DIR
```

These existing checks pause the scene and cover composition only. They do not provide running-water motion, gameplay's lowest extreme or a hydra strike. For those, reuse the issue's retained frame-410 water pad pair and the owned native input/capture path with `-dev view off`, an on-deck fighter plus a swimmer, and warning/strike/sink frames. `ts/test/native/pads/193/tomb-water.pad` is a checked-in starting script, not a substitute for the reopened box's frame-specific evidence.

The existing `bun scripts/nativeCapture.ts build --out MAP.w3x --control PAD...` and `run --clients-file FILE --client b --install INSTALL --manifest MAP.captures.json --out PRIVATE_DIR --no-audio` provide stamped held captures, but [nativeCapture.ts:226–243](../../ts/scripts/nativeCapture.ts#L226) refuses installed/live build mismatch. If 24268 differs from live, that runner cannot certify this target. Supervisor must use its approved account b capture path with actual-build evidence; do not pass a fabricated versions file, change the runner here or update the client to satisfy the runner. Held/frozen frames also cannot demonstrate a running UV clock.

Four native observations remain: one causal line per look with actual paths; near/far water with a fixed unobstructed pixel sampled 30 running frames apart and no visible period <128 px; continuous underside at both extremes; lowest gameplay and fixed-extreme full-frame captures retaining the complete HUD, all on-stage fighters above the visible deck and an identifiable hydra crest through warning/strike/sink. Performance remains a no-regression comparison against main through the existing #168 owner, not a new frame-budget project.

Remaining risk: MDX 800 UV motion and the Definitive hydra pose still need measurements on the exact 24268 client before any proposed visual change can be accepted.

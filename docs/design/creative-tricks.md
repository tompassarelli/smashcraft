# Creative tricks: what the best maps do with native tools

The tricks that make good Warcraft III maps look better than players expect
from the engine, and how a Smashcraft stage can use each one. The source is
Blizzard's own 3.0 maps in the installed client, plus dated Hive Workshop
threads and contests. [Visual quality](visual-quality.md) lists the renderer
levers and what Smashcraft has measured about them.
[Stage art](stage-art.md) holds the composition rules every trick must obey:
fighters first, no creatures, an ambient motion budget and no ground under the
deck. This page lists ways to use those levers that players won't see coming.

Researched 8 Oct 2026. Blizzard files were read from the installed
3.0.1.24342 storage with the CascLib extractor
(smashcraft:tools/animations/casc-extract.cpp), a CascLib file listing
(175,416 entries) and Wisp's map packer (`map-pack extract`). Those files are:

- **Silverpine Sprint:** `Maps\ForsakenKingdom\Scenario\(1)SilverpineSprint.w3x`.
- **Forgotten Hollow:** `…\(1)ForgottenHollow.w3x`.
- **The Reforged campaign:** 96 maps under `Campaign\Reforged\{roc,tft}`,
  read as JASS. Among them is **`nightelfx03`**, The Frozen Throne's "The Tomb
  of Sargeras".

The Forsaken Kingdom campaign maps are `.w3xd` files with no MPQ header, so
their scripts couldn't be read. Web pages were read on 8 Oct; each technique
gives its page's own date.

**How to read the fields:**

- **Bytes** are what the map download grows by. A stock path costs 0.
- **Frame cost** is the number of script calls per frame. GPU cost is
  **unmeasured** unless a section says otherwise; it is checked against #168's
  budget (visual-quality, "How the numbers are taken").
- **Modes** gives what each graphics mode draws: C = Classic, R = Reforged,
  D = Definitive. The sequence names and lengths come from the Classic
  `war3.w3mod:` files and the Reforged `_hd.w3mod:` files.
- *(guess)* marks an inference that nothing has confirmed.

A map can't detect the graphics mode. So a trick that seeks an animation by
time only works when the sequence has the same length in every mode. Each
section records where it does.

## The techniques at a glance

★ marks the five picks for the Tomb of Sargeras showcase (#299), explained in
[The five for the Tomb](#the-five-for-the-tomb-of-sargeras).

| # | Technique | Bytes | Modes | Best Smashcraft use |
| --- | --- | --- | --- | --- |
| 1 ★ | Stock animation driven by the match clock | 0 | C R D (lengths must match) | The Temple of Tides rising; the sea level following the tide |
| 2 ★ | A current that runs backwards: signed time scale | 0 | C R D | Foam and falls that reverse with the tide |
| 3 ★ | Scheduled lighting: a timed light model driven by the time of day | ~1.5 KB a light | C R D | The light shifts at the tide's turn |
| 4 ★ | Stock models switched between states as lighting cues | 0 | C R D | The Tomb's glyphs flare during the slack |
| 5 | Height fog changed during play | 0 | C R D (HD fog) | A teal haze lying on the tide floor |
| 6 | A sky swapped or cross-faded at a moment | 0 to ~10 KB | C R D | The final stock, sudden death |
| 7 ★ | Stock Rays of Light | 0 to ~2 KB | C R D | Light shafts through the water |
| 8 | Stock models that carry their own lights | 0 to ~0.7 KB | split by mode | Eye of Sargeras glow, braziers |
| 9 | Landmarks built from stock pieces | 0 | C R D | A tomb front built from gate, pillars and spires |
| 10 | Pieces darkened to silhouettes, with lit accents | 0 | C R D | The far band on every stage |
| 11 | Stock models with replaced textures and team colour | 0 to ~0.1 KB | C R D (ID 1 flickers in HD) | Naga teal accents; per-stage reskins |
| 12 | See-through copies: afterimages and fake reflections | 0 | C R D | The temple mirrored under the sea; dash trails |
| 13 | Full-screen tint and flash | 0 | C R D | KO flash; the hydra's strike |
| 14 | Depth-of-field pulse | 0 | R D | Heaviest hits and KOs |
| 15 | Camera shake | 0 | C R D | The hydra's lunge; Blackrock eruptions |
| 16 | A model drawn on the screen: SPRITE frame | 0 | C R D | Stage intro card; screen-edge bubbles |
| 17 | Images as floating marks and contact shadows | 0 | C R D *(guess)* | Fighter shadows on the tide surface |
| 18 | Lightning beams as set dressing | 0 | C R D | A beam from the Eye of Sargeras; chains |
| 19 | One-mode copies at stock and `_DE` paths | per file | per mode | A Definitive-tuned stage light |
| 20 | Map post-processing: bloom, contact shadows | ~0.3 KB | R D *(guess)* | Bloom on sparks, the Eye and the fel stages |

## The techniques

### 1. Stock animation driven by the match clock ★

- **Example:** Smashcraft already seeks effect animations this way. Summon
  poses call `BlzSetSpecialEffectTime(model, pose.seconds)`
  (smashcraft:ts/src/game/render/summonPresentation.ts), and so do the
  combat effects (smashcraft:ts/src/game/render/combatEffects.ts). Hive's
  ["Special Effect Animation by Index"](https://www.hiveworkshop.com/threads/special-effect-animation-by-index.352866)
  (27 Feb 2024) does the same through the time scale: Uncle's
  RingProgressHelper jumps a 10-second Birth animation to one of 16 ticks.
  Daffa found that the time scale doesn't take on effects attached to units.
- **How:** Create the stock effect once. Each frame, or only when the value
  changes, set its time from the match frame:
  `BlzSetSpecialEffectTime(e, f32(frame / 60))` with `BlzSetSpecialEffectTimeScale(e, 0)`.
  The picture is then a fixed function of the match clock. It is the same in
  a replay and after a rollback, so it can't drift between clients.
  smashcraft:docs/netcode-proposal.md asks that seeking be confirmed on each
  asset rather than assumed. The summon path is that confirmation for its
  clips.
- **Stock assets that suit it, read from 3.0.1.24342:**
  - `Buildings\Naga\TempleOfTides\TempleOfTides`: Birth runs 0–60,000 ms in
    both Classic (73,901 bytes) and Reforged (3.4 MB), so a seek by time is
    mode-safe. *(guess)* Birth is the temple rising out of the sea, as Naga
    buildings do when they are built.
  - `Doodads\Cinematic\RisingWaterDoodad`: Stand Alternate 3 s, Stand 5 s and
    Stand Upgrade 5 s in both modes. That's three water states. *(guess)* They
    are the low, rising and high levels from the TFT cinematics.
  - `RisingWaterWideDoodad`: the first two states, also the same in both
    modes.
- **Bytes:** 0.
- **Frame cost:** one call per seeked piece on frames where its value
  changes.
- **Modes:**
  - C R D only where the lengths match: the Temple's Birth and both
    rising-water doodads.
  - Eye of Sargeras doesn't qualify: its Stand is 1.3 s in Classic and 8.3 s
    in Reforged.
- **Suits:** Tomb of Sargeras.
  - The Temple of Tides rises out of the far sea over the first minute of a
    match. It is a one-off reveal on a third of the frame, slow enough for
    rule 8.
  - The rising-water doodad's level follows the tide table
    (smashcraft:docs/design/water-stage.md).
  - The same tool can scrub any stage set piece along a fixed schedule.

### 2. A current that runs backwards: signed time scale ★

- **Example:** Silverpine Sprint spins its car wheels with
  `BlzSetSpecialEffectTimeScale(wheels[k], ±vF * CAR_SPEED_WHEEL_ROTATION_FACTOR)`.
  The two sides get opposite signs, so one stock animation turns forward or
  backward with speed (its war3map.lua, around line 28,941). Hive's
  [time-scale reference](https://lep.duckdns.org/jassbot/doc/BlzSetSpecialEffectTimeScale)
  (read 8 Oct 2026) says a negative scale plays an animation backwards.
- **How:**
  - Give a flowing stock model a time scale that follows the current:
    +1 in flood, 0 at slack, −1 in ebb, eased across the turn.
  - The stock `Doodads\Terrain\CliffDoodad\Waterfall\Waterfall` animates its
    texture (a TXAN chunk in Classic), and its Stand is 3 s.
  - `Abilities\Spells\Other\CrushingWave\CrushingWaveMissile` gives a curling
    wave front (Birth, stand, Death).
  - Turn the model with `BlzSetSpecialEffectYaw` so its flow lies along the
    tide.
  - *(guess)* A negative scale also runs texture animation backwards; the
    wheels show only that bone animation reverses.
- **Bytes:** 0.
- **Frame cost:** one call per piece on each turn (four a 20 s cycle), or
  one per frame across the 60-frame slack while easing.
- **Modes:** C R D. HD copies swap emitters for PopcornFX (a `CORN` chunk in
  `_hd` CrushingWaveMissile), and the map can't drive those particles. Only
  the mesh and texture follow the scale *(guess)*.
- **Suits:** the Tomb's tide. The surface flow visibly stops and reverses
  during each slack, which is the telegraph water-stage.md asks for, drawn by
  the water itself. The same trick suits wind stages: banners and smoke
  running one way, then the other.

### 3. Scheduled lighting: a timed light model driven by the time of day ★

- **Examples:**
  - The Silent's
    ["Custom Day/Night Light Environments"](https://www.hiveworkshop.com/threads/custom-day-night-light-enviroments.274081/)
    (29 Dec 2015) edits the ambient-colour keys of a DNC model's
    60,000-frame cycle.
  - Silverpine Sprint (3.0.1) imports its own `DNCSilverpineTerrain` and
    `DNCSilverpineUnit` models (1,468 bytes each). It swaps to
    `FirstCineShotUnitLight.mdx` for its first cinematic shot and back with
    `SetDayNightModels`, seven calls in all. It pins the hour with
    `SetTimeOfDay(0)` and `SetTimeOfDayScale(0)`.
- **How:**
  - A lighting model's key and fill tracks are read at the current time of
    day. Smashcraft's stage lights are constant (smashcraft:ts/scripts/stageLight.ts),
    so the frozen noon can't move them.
  - Author the stage light with keyframes instead. The tide light, for
    example, keys:
    - flood colour at 12:00;
    - a brighter, cooler slack at 12:30;
    - ebb colour at 13:00.
  - Each match frame, call `SetTimeOfDay` with the hour that frame's tide
    phase maps to. One model then gives a smooth, timed ramp. A model swap
    can only cut.
  - Rules 2–5 of the stage lights must hold at every key, not only at noon
    (smashcraft:ts/src/game/assets/stageLighting.tests.ts).
  - *(guess)* `SetTimeOfDay` re-reads the light the same frame. Native
    clients set it at the same match frame, so it stays in step; the hour is
    also game state (night vision), which no Smashcraft rule reads.
- **Bytes:** ~1.5 KB a timed light (Blizzard's are 1,468; Smashcraft's
  constant ones are 744).
- **Frame cost:** one call a frame during a ramp, none otherwise.
- **Modes:** C R D. An imported light is the same file in every mode. Classic
  clamps bright values *(guess)*, so keys stay within rule 5's intensity 1.
- **Suits:**
  - Tomb: the light breathes at each turn.
  - Every stage: a deliberate dimming for the last stock or sudden death,
    Ultimate Battlefield's eclipse in Warcraft terms (stage-art, "Light is
    controlled, not cycled").

### 4. Stock models switched between states as lighting cues ★

- **Examples:**
  - **`nightelfx03`, "The Tomb of Sargeras":** Blizzard's own map for this
    place drives its glyph doodads through `Stand 1`, `Stand Alternate` and
    `Death` with `SetDoodadAnimationRectBJ` as the player solves each glyph.
    That is 74 calls (lines 5,665–10,605), on doodad types such as `ZCv1`,
    `ZCv2`, `ZZgr` and `XOmr`. It also flips floor plates to
    `"stand alternate"`.
  - **Silverpine Sprint:** puts its lanterns (`LOlp`) into `"death"` to turn
    them off, then `"show"`s and `"hide"`s doodad sets per rect (its
    `SetDoodadAnimationRect` block).
- **How:** Smashcraft scenery is special effects, not doodads. Its equivalents
  are:
  - `BlzPlaySpecialEffect(e, ANIM_TYPE_STAND | ANIM_TYPE_DEATH | ANIM_TYPE_BIRTH)`;
  - `BlzSpecialEffectAddSubAnimation(e, SUBANIM_TYPE_ALTERNATE_EX)`
    (Forgotten Hollow calls `BlzSpecialEffectAddSubAnimation` with
    `SUBANIM_TYPE_SLAM`);
  - the 3.0 `BlzSetSpecialEffectAnimation(e, "Stand Alternate")`.

  The stock `Doodads\Cinematic\GlowingRunes\GlowingRunes0` has Birth, Stand,
  Stand Alternate and Death in both Classic and Reforged (Classic Stand 3 s,
  Stand Alternate 3 s). *(guess)* Stand Alternate is the brighter state.
  Playing by animation type keeps it mode-safe even though the HD names carry
  a " 1" suffix.
- **Bytes:** 0.
- **Frame cost:** one call per piece per change.
- **Modes:** C R D.
- **Suits:**
  - Tomb: runes on the ruins flare to Stand Alternate for each slack and fall
    back as the tide runs. This is Blizzard's own Tomb vocabulary.
  - Naxxramas and Hellfire: a portal or obelisk that "wakes" on a fixed
    schedule.

### 5. Height fog changed during play

- **Examples:**
  - **Silverpine Sprint:** sets `FOG_PARAMS = {3, 0, 0, 0, -10000, -10000, 0, CAMERA_FAR_Z, 0.4, 0.48, 0.57}`.
    That is style 3 (height fog), a blue-grey colour and
    `BlzSetTerrainFogDrawOverSky(true)`, set again in each of its nine
    `SetTerrainFogExV` calls.
  - **The 3.0 Reforged `nightelfx03`:** opens with
    `SetTerrainFogExV(0, 1000, 8000, …)` and
    `BlzSetTerrainFogMaxLinearDensity(1.0)`.
  - **`undeadx07a` and `undeadx07c`:** switch to `LordaeronWinterSkyRed` and
    a red fog (`SetTerrainFogExBJ(0, 600, 4000, 500, 15, 50, 75)`) when an
    event starts.
  - **[HD Terraining Contest #1 results](https://www.hiveworkshop.com/threads/hd-terraining-contest-1-results.348648/)
    (19 Apr 2023):** the judge sent one entrant to "the fog editor instead of
    the standard environmental fog effect".
- **How:** Change one field at a time
  (`BlzSetTerrainFogDensity`, `…HeightEnd`, `…Color`) to tween fog over a
  turn. The list of fields is in visual-quality, "The levers".
- **Bytes:** 0.
- **Frame cost:** one to three calls a frame while tweening.
- **Modes:** C R D per the 3.0 notes, **unmeasured** in Smashcraft (the
  `192-*-linear|height` checks).
- **Suits:**
  - Tomb: a teal fog lying just above the tide floor, thickening a little in
    each slack.
  - Frozen Throne and Durotar: darkening the bright lower band (visual-quality
    per-stage table).

### 6. A sky swapped or cross-faded at a moment

- **Example:** The Reforged campaign calls `SetSkyModel` 513 times, 238 of
  them `SetSkyModel(null)`. Skies change shot by shot and event by event:
  - LordaeronSummerSky 91 times;
  - FoggedSky 21;
  - LordaeronWinterSkyRed 10 (including both `undeadx07` events above);
  - Purple and BrightGreen variants.
- **How:**
  - A hard cut is `SetSkyModel`.
  - For a fade, place a second inward sphere as a special effect and tween
    its `BlzSetSpecialEffectAlpha` across the old sky. Smashcraft's sky
    spheres are 1,024 triangles with one 256×128 texture (stage-art).
  - *(guess)* An effect is fogged and lit where a sky isn't. The cross-fade
    sphere needs the same unshaded, unfogged material as the authored skies,
    and the effect's position must follow the camera, which costs one call a
    frame.
- **Bytes:** 0 for a stock sky. About 10 KB for one more authored sky
  *(guess, from one 256×128 texture)*.
- **Frame cost:** none for a cut; two calls a frame while fading.
- **Modes:** C R D for authored and root skies. The HD-only stock skies are
  blank in Classic (visual-quality).
- **Suits:** the last stock or sudden death on any stage. Nordrassil's aurora
  can deepen for a finale. Keep rule 12: the horizon stays at or below the
  deck.

### 7. Stock Rays of Light ★

- **Examples:**
  - The client's `TerrainArt\Weather.slk` (3.0.1) has two weathers for this:
    - `LRaa` "Rays of Light": texture
      `ReplaceableTextures\Weather\RaysOfLight`, height 200, 64 particles,
      velocity −300, additive;
    - `LRma` "Rays of Moonlight".
  - The texture exists in every mode: 5,616 bytes Classic, 87,536 bytes
    Reforged and Definitive (`textures\raysoflight.dds`).
  - The [HD Terraining Contest #1 results](https://www.hiveworkshop.com/threads/hd-terraining-contest-1-results.348648/)
    (19 Apr 2023) show the risk. The judge found Sapprine's green light beam
    "too strong and too overt", and wanted shadows to guide the eye instead.
- **How:**
  - Weather is emitted relative to the terrain, and the arena stands 1,800
    above it (stages, "What the clients can show"). So the weather alone falls
    below the play.
  - **Native first:** a few tall additive planes in Smashcraft's own stage
    package, textured with the stock
    `ReplaceableTextures\Weather\RaysOfLight` path. The texture costs nothing
    and draws its HD copy in HD.
  - Alternatively, a map-imported `TerrainArt\Weather.slk` row with a larger
    height. CryoniC's
    [custom weather article](http://www.wc3c.net/showthread.php?t=67949) is
    linked from the
    [AddWeatherEffect reference](https://lep.duckdns.org/jassbot/doc/AddWeatherEffect)
    (read 8 Oct 2026). *(guess)* A map's import overrides the slk.
- **Bytes:** ~1–2 KB for the planes *(guess)*, 0 for the texture.
- **Frame cost:** none.
- **Modes:** C R D.
- **Suits:** Tomb: shafts of pale light slanting down through the sea in the
  far band, so the tide floor reads as underwater. Keep them dim (the judge's
  warning) and behind the fighting volume (rule 1). Gryphon Aerie can take
  sunbeams through its clouds.

### 8. Stock models that carry their own lights

- **Examples:**
  - Silverpine Sprint imports `OmniLightCar.mdx`, `OmniLightLantern.mdx`
    (736 bytes: one `LITE`, Stand 1 s) and `OmniLightWithDeath.mdx`. Forgotten
    Hollow imports `omnicustom13/14` and `omnilightorange5`. These are placed
    point lights.
  - The 3.0 notes add "Unlimited lights in HD" and shadow-casting omni lights
    ([Hive 3.0 thread](https://www.hiveworkshop.com/threads/warcraft-3-reforged-forsaken-kingdom-expansion-and-major-updates.374111/),
    12 Sep 2026).
- **Stock assets that carry lights, read from 3.0.1.24342 (by mode):**
  - `Doodads\Cinematic\EyeOfSargeras`: a `LITE` in Classic, but only a
    PopcornFX `CORN` in Reforged.
  - `Doodads\Cinematic\LightningBolt`: a `LITE` in Classic.
  - `Doodads\Ruins\Props\Brazier\Brazier0`: no light in Classic, a `LITE` in
    Reforged.

  Which stock models carry lights is a per-mode accident. Treat the light as
  garnish.
- **How:** `AddSpecialEffect` with the stock path, or Smashcraft's own small
  light model (the tech-contact and slash sparks already carry one;
  visual-quality, "How the numbers are taken").
  `BlzSetMinShadowCastingPointLightCount(1)` lets one of them cast shadows in
  HD.
- **Bytes:** 0 stock, about 0.7 KB authored.
- **Frame cost:** none in script. HD GPU cost is **unmeasured**.
- **Modes:** split by mode, as listed above.
- **Suits:**
  - Tomb: the Eye of Sargeras as a small accent on the temple side, green and
    glowing.
  - Blackrock: forge light.
  - Naxxramas: cold necropolis light.

### 9. Landmarks built from stock pieces

- **Example:** FeelsGoodMan won
  [HD Terraining Contest #1](https://www.hiveworkshop.com/threads/hd-terraining-contest-1-results.348648/)
  (results 19 Apr 2023, score 77.99). Its central piece was "built entirely
  from doodads", and the judge called the placement "superb". The
  [contest rules](https://www.hiveworkshop.com/threads/hd-terraining-contest-1-place-of-cult.347193/)
  (25 Jan–25 Mar 2023) required HD assets and allowed only cropping and
  rotation of screenshots.
- **How:**
  - Smashcraft already stretches stock rock with `matrixScale` (stage-art
    rule 11).
  - Go further: compose one landmark from several stock models overlapped
    and turned with `BlzSetSpecialEffectOrientation`. For example:
    - `Doodads\Cinematic\SargerasGate` (39.5 KB Classic, 1.26 MB Reforged,
      with Stand Hit and Death Alternate states);
    - `Doodads\Ruins\Props\RuinsPillar`;
    - `Ruins_Spires`;
    - coral.

    Together they make a tomb front that no single model gives.
  - The model-facts and player-view checks still apply to each piece.
- **Bytes:** 0.
- **Frame cost:** none in script, one more draw per piece.
- **Modes:** C R D. HD copies are megabytes of memory, not download.
- **Suits:**
  - Tomb: the Tomb's own front as the focal landmark on a third of the frame,
    with the Temple of Tides as its counterweight.
  - Stratholme and Ahn'Qiraj: skylines no single stock model supplies.

### 10. Pieces darkened to silhouettes, with lit accents

- **Example:** in the same
  [HD Terraining Contest #1 results](https://www.hiveworkshop.com/threads/hd-terraining-contest-1-results.348648/)
  (19 Apr 2023), the judge told Shayoo to darken most doodads to near-black
  and use light sources to pick out the key areas.
- **How:** `BlzSetSpecialEffectColor(e, r, g, b)` multiplies a piece's
  colour.
  - Tint the near band toward a dark silhouette.
  - Tint the far band toward the fog colour, so atmospheric perspective holds
    even inside the fog start, which rule 11 notes fog can't reach.
  - Leave colour only on the one lit accent per side.
- **Bytes:** 0.
- **Frame cost:** one call at stage draw.
- **Modes:** C R D. In HD the multiply darkens the PBR base colour *(guess)*.
- **Suits:** every stage's depth bands (stage-art rules 4 and 6). It is the
  cheapest fix for the bright-backdrop stages, where contrast fell.

### 11. Stock models with replaced textures and team colour

- **Examples:**
  - InfernalTater's
    [texture-swap tutorial](https://www.hiveworkshop.com/threads/how-to-change-textures-on-a-tree-or-other-doodad-without-importing-several-models.222212/)
    (3 Sep 2012) reskins a stock tree by copying the destructable and setting
    "Art - Replaceable Texture File", with no model import.
  - Illidan(Evil)X's
    [Replaceable Flag](https://www.hiveworkshop.com/threads/replaceable-flag.278718/)
    (1 May 2016) uses Replaceable ID 1, team colour.
  - Silverpine Sprint calls `BlzSetSpecialEffectColorByPlayer` 7 times, and
    Forgotten Hollow 10.
  - Forgotten Hollow builds 13 destructables with
    `BlzCreateDestructableZWithSkinPitchRollColor(…, ConvertPlayerColor(24))`.
- **How:**
  - On effects, only team colour and glow (IDs 1 and 2) change at run time:
    `BlzSetSpecialEffectColorByPlayer`.
  - Any other texture swap needs a destructable object row with a new
    Replaceable Texture File, created with the 3.0
    `BlzCreateDestructableZWithSkinPitchRollColor`. 3.0 also added doodad
    team colour (`SetDoodadColor`, `BlzSetSingleDoodadColor`; warcraft-features).
  - The [3.0 bugs thread](https://www.hiveworkshop.com/threads/warcraft-iii-3-0-bugs-issues.374131/)
    reports that ID 1 textures flicker in Reforged and Definitive.
- **Bytes:** 0 for team colour. About 0.1 KB per destructable row
  *(guess)*.
- **Frame cost:** none.
- **Modes:** C R D, with the ID 1 flicker in HD.
- **Suits:** Naga teal on stock pieces that have team-colour parts, so the
  Tomb's dressing shares a hue without a texture import. Per-stage reskins of
  one stock rock or wall. Check a capture before relying on ID 1 in HD.

### 12. See-through copies: afterimages and fake reflections

- **Example:** Silverpine Sprint draws ghost cars by duplicating each wheel
  effect at `BlzSetSpecialEffectAlpha(…, car.ghostAlpha)` and moving the
  copies with the car (`car.duplicateWheels`, around line 25,566).
- **How:**
  - Copy a piece at low alpha.
  - For a reflection, place a second Temple of Tides under the tide surface,
    flipped with `BlzSetSpecialEffectRoll(e, π)`, tinted toward the water
    colour and drawn under Smashcraft's StageWater surface (alpha 110;
    water-stage, "Warcraft water rendering options").
  - *(guess)* A roll flips the model without the backface problem a negative
    `matrixScale` would cause.
- **Bytes:** 0.
- **Frame cost:** none for a reflection; one call a frame per copy for a
  moving afterimage.
- **Modes:** C R D.
- **Suits:**
  - Tomb: the far temple and tomb front mirrored in the sea, wavering behind
    the surface ripples.
  - Fighters: dash or KO afterimages, local presentation only.

### 13. Full-screen tint and flash

- **Examples:**
  - Silverpine Sprint flashes `ReplaceableTextures\CameraMasks\White_Mask` in
    `BLEND_MODE_MODULATE_2X` on damage, its alpha rising by 50 × √damage
    (visual-quality, "What Blizzard's 3.0.1 maps do").
  - Forgotten Hollow's `CinematicFadeCommonForPlayer` runs every fade for one
    player only (`GetLocalPlayer() == p`).
  - Hive's [local fade filter](https://www.hiveworkshop.com/threads/local-fade-filter.308127/post-3288424)
    is the community form of the same technique.
- **How:**
  - The stock masks in 3.0.1 are Black, White, LightGray, DreamFilter,
    HazeFilter, HazeAndFogFilter, IceFilter, GroundFog, Scope, DiagonalSlash,
    SpecialPow, SpecialSplat and Panda-n-Cub (`ReplaceableTextures\CameraMasks\`).
  - `SetCineFilterStartUV`/`EndUV` with `SetCineFilterDuration` move the mask
    across the screen.
  - Reforged and Definitive blend the filter in linear light and draw nothing
    below alpha 4: White_Mask at alpha 4 still lifts a black deck to about 37
    luma, so an alpha fade to 0 ends in a step. The KO flash holds alpha 8 and
    fades the filter colour to black instead (#289).
- **Bytes:** 0.
- **Frame cost:** about six calls per flash.
- **Modes:** C R D.
- **Suits:**
  - KO punctuation (visual-quality G4).
  - A short IceFilter flash for a freeze hit.
  - A brief HazeAndFog pulse as the hydra strikes.
  - Never more than three flashes a second (WCAG, stage-art). The overlay
    covers fighters too, so it suits moments, not ambience.

### 14. Depth-of-field pulse

- **Examples:**
  - Silverpine Sprint raises the depth-of-field scale by 15 × √damage, up to
    50, over 0.15 s, then lets it fall over 0.6 s.
  - The Reforged `human03` sets `CameraSetFocalDistance(181)` for its "Grain"
    cinematic and clears it with `CameraSetDepthOfFieldScale(0)` on the way
    out. The campaign has 19 focal-distance and 18 scale calls.
- **How:** `CameraSetFocalDistance` and `CameraSetDepthOfFieldScale` for the
  local player, eased back to 0.
- **Bytes:** 0.
- **Frame cost:** one or two calls a frame across the pulse.
- **Modes:** R D only. Classic draws nothing, so the KO must still read
  without it.
- **Suits:** the heaviest hits and KOs, together with technique 13.

### 15. Camera shake

- **Examples:**
  - 31 of the 96 Reforged campaign maps shake the camera through the
    `…ForPlayer` wrappers: `CameraSetEQNoiseForPlayer` 15 times,
    `CameraSetSourceNoiseForPlayer` and `CameraSetTargetNoiseForPlayer`, and
    `CameraClearNoiseForPlayer` to stop.
  - `nightelfx03`, "The Tomb of Sargeras", is one of six maps that pair an
    earthquake sound with
    `CameraSetSourceNoiseForPlayer(udg_AP1_Player, 20 * GetRandomReal(0.6, 1.4), 1000 * GetRandomReal(0.6, 1.4))`.
  - The [native reference](https://lep.duckdns.org/jassbot/doc/CameraSetSourceNoise)
    (read 8 Oct 2026) describes the noise as a sway of the camera's eye, whose
    range and speed are set by magnitude and velocity.
- **How:**
  - Shake for the local player only, then clear the noise. Use fixed
    magnitudes, not Blizzard's random ones: a random draw is local
    presentation here, but a fixed shake is learnable and matches replays.
  - Smashcraft's camera is placed by script every frame. A shake is better as
    a small offset added in its own camera code, which Smashcraft controls
    and can replay. *(guess)* Native noise is added after the scripted
    camera.
- **Bytes:** 0.
- **Frame cost:** none for native noise; the offset is part of the existing
  camera call.
- **Modes:** C R D.
- **Suits:** the hydra's lunge, Blackrock eruptions and the heaviest KOs.
  Keep it short and rare (stage-art, "Motion and flashes").

### 16. A model drawn on the screen: SPRITE frame

- **Examples:**
  - Rigborn's ["UI: Adding Sprite"](https://www.hiveworkshop.com/threads/ui-adding-sprite.321423/)
    (13 Jan 2020): `BlzCreateFrameByType("SPRITE", …)`, `BlzFrameSetModel`,
    scaled to about 0.001 to avoid "weird screen blackouts". Replies warn
    that particle emitters can glow over the whole screen.
  - Silverpine Sprint builds 45 frames by type and its own dialogs.
- **How:** Parent a SPRITE frame to the game UI and give it a stock model.
  Play animations by index. It draws over the world, unaffected by fog or the
  stage light. It is local presentation and makes no game handles.
- **Bytes:** 0 for a stock model.
- **Frame cost:** none, unless the frame is animated.
- **Modes:** C R D.
- **Suits:**
  - A stage intro card with the stage's emblem model.
  - Bubbles or a caustic shimmer at the screen's lower edge on the Tomb.
  - A KO burst drawn over everything.
  - Keep the fighting area clear (rule 1).

### 17. Images as floating marks and contact shadows

- **Examples:**
  - Antares's
    [SpecialEffectShadows](https://www.hiveworkshop.com/resources/specialeffectshadows.129227)
    (19 Apr 2024, updated 4 Sep 2024) gives special effects shadows made from
    images (`CreateImage`, `SetImageColor`, `SetImagePosition`). It moved
    from shadow models to images so they don't clip on uneven ground.
  - Forgotten Hollow makes 13 images, sets `SetImageRenderAlways` and draws
    item marks with `SetImageAboveWater(image, true, false)`.
- **How:**
  - `CreateImage` with a stock texture (`ReplaceableTextures\Selection\…`, or
    a shadow texture), then `SetImageConstantHeight(img, true, z)` at the
    deck or water height.
  - *(guess)* Images are a terrain layer and may vanish with
    `BlzShowTerrain(false)`. **Unmeasured:** one capture settles it.
- **Bytes:** 0.
- **Frame cost:** one position call a frame per fighter.
- **Modes:** C R D *(guess)*.
- **Suits:** fighter drop shadows on the tide surface and on the decks, which
  help readability when fighters float above the water. The hydra's dark ring
  as an image instead of a model.

### 18. Lightning beams as set dressing

- **Examples:**
  - Silverpine Sprint calls `AddLightning` 12 times and `AddLightningEx` 6.
  - Forgotten Hollow calls `AddLightning` 7 and `AddLightningEx` 10.
  - Since 3.0, new lightning effects no longer remove old ones (Blizzard 3.0 patch notes).
- **How:**
  - `AddLightningEx` between two points, coloured and faded with
    `SetLightningColor`.
  - The stock types in `Splats\LightningData.slk` (3.0.1) are CLPB, CLSB,
    MBUR, CHIM, AFOD, HWPB, HWSB, MFPB, DRAB, DRAL, DRAM, FORK, SPLK, LEAS and
    POSS.
  - Healing-wave (HWPB) and mana-flare (MFPB) beams make soft shafts.
    Chain-like types make rigging.
- **Bytes:** 0.
- **Frame cost:** none for a still beam; `MoveLightningEx` once a frame for a
  moving one.
- **Modes:** C R D.
- **Suits:**
  - Tomb: a faint green beam from the Eye of Sargeras up into the sky, far
    behind the deck.
  - Gryphon Aerie and Stratholme: ropes and chains between pieces.

### 19. One-mode copies at stock and `_DE` paths

- **Example:** Silverpine Sprint imports files at stock paths:
  - `Doodads\Barrens\Plants\Cactus\Cactus0.mdx`, `Doodads\Undercity\Props\Bones\Bones0–9.mdx`
    and others, replacing the stock model for that map only;
  - `_DE.w3mod\terrainart\…` textures, which only Definitive loads.
- **How:** Already designed as visual-quality G3: a Definitive copy of a stage
  light at `_DE.w3mod\war3mapImported\StageLight-*.mdx`, with
  high-dynamic-range values. Classic and Reforged keep today's file.
- **Bytes:** the copy's size, 744 bytes for a light.
- **Frame cost:** none.
- **Modes:** per mode by design. `_HD.w3mod\` for Reforged is a *(guess)*.
- **Suits:** the showcase's goal that every mode look deliberate, starting
  with the Tomb's light.

### 20. Map post-processing: bloom and contact shadows

- **Example:** Forgotten Hollow ships `[ASSAO] Radius=6, ShadowMultiplier=3`
  in `war3mapPostProcessing.txt` (visual-quality, "Map-level
  post-processing"). The 3.0 editor added "a post processing tool to apply
  post-processing effects at map level"
  ([Hive 3.0 thread](https://www.hiveworkshop.com/threads/warcraft-3-reforged-forsaken-kingdom-expansion-and-major-updates.374111/),
  12 Sep 2026).
- **How:** One file for the whole map. Turn bloom on with a high threshold so
  only additive sparks and emissive accents bloom (G2).
- **Bytes:** ~0.3 KB.
- **Frame cost:** HD GPU only, **unmeasured**.
- **Modes:** R D *(guess)*. Whether a map can turn bloom on now that the
  player option is gone is **unmeasured**.
- **Suits:** the Eye of Sargeras, hit sparks, and the fel and arcane stages.
  It is map-wide, so one setting must suit every stage.

## The five for the Tomb of Sargeras

The Tomb's idea (#299, water-stage.md) is the tide: a current that runs right
for ten seconds and then left, with a one-second slack before each turn.
These five tricks make the stage itself perform that clock. Each moment is a
fixed function of the match frame, so it is learnable, replay-identical and
safe under rollback. They cost nothing in Classic except one ~1.5 KB light,
and each needs a single native capture to confirm.

1. **A current that runs backwards (technique 2).** The best telegraph is the
   water itself. Foam and falls stop during the slack and then run the other
   way. Players read the hazard from the scenery without a notice. It costs
   one call per turn and no bytes.
2. **Scheduled lighting by time of day (technique 3).** It is the "light and
   fog shift when the tide turns" #299 asks for, done with one authored model
   driven smoothly by the match clock instead of hard swaps. It is
   Silverpine's own lighting technique, made continuous. Pair it with the
   height fog of technique 5.
3. **The glyphs flare in the slack (technique 4).** Blizzard's own "The Tomb
   of Sargeras" map lights its glyphs by switching stock rune models between
   Stand, Stand Alternate and Death. Using the same stock runes on
   Smashcraft's ruins turns each slack into a recognisable Tomb moment.
4. **The Temple of Tides rises (technique 1).** Its stock Birth animation is
   exactly 60 seconds in both Classic and Reforged, so seeking it from the
   match clock is safe in every mode. A landmark that slowly rises out of the
   sea during the first minute is the moment no one expects from Warcraft.
   *(guess: what Birth shows; one capture confirms it.)* The rising-water
   doodad's three states can follow the tide the same way.
5. **Light shafts through the sea (technique 7).** The stock Rays of Light
   texture exists in every mode. A few dim additive planes in the far band
   turn the tide floor into an underwater scene, at almost no cost. Keep them
   softer than the HD Terraining Contest judge's "too strong" beam.

Runners-up: the mirrored temple under the sea (12) and the tomb front built
from stock pieces (9). Each stands alone and can be added once the five
above pass their captures.

## Seen but not usable here

- **Painting terrain at run time:** Forgotten Hollow calls `SetTerrainType`
  for its generated dungeons. Unusable while terrain is hidden.
- **HD water and `SetWaterBaseColor`:** Forgotten Hollow and `nightelfx03`
  call `SetHDWaterParamsEx(0, 0, 0, false, 20, 0, 100, 10, 0, 10, 100, 100)`.
  Unusable while terrain is hidden (water-stage).
- **Weather as ground fog banks:** Silverpine places nine dungeon-fog weathers
  (`FDgl`, height 10) in rects. They emit near the terrain, below the arena.
- **Stock underwater creatures:** `FishSchool` and similar break stage-art
  rule 7, no creatures. The 1.8 KB `BubbleGeyser` is allowed.

## Sources

Read 8 Oct 2026 unless noted.

- **Blizzard, installed 3.0.1.24342 storage:**
  - `Maps\ForsakenKingdom\Scenario\(1)SilverpineSprint.w3x` and
    `(1)ForgottenHollow.w3x` (war3map.lua, listfile, imported models);
  - `Campaign\Reforged\{roc,tft}\*.w3x` (96 scripts), including `nightelfx03`,
    `human03`, `undeadx07a` and `undeadx07c`;
  - `TerrainArt\Weather.slk`;
  - `Splats\LightningData.slk`;
  - the model sequence tables named above, Classic `war3.w3mod:` and Reforged
    `_hd.w3mod:`.
- **Hive Workshop:**
  - [Custom Day/Night Light Environments](https://www.hiveworkshop.com/threads/custom-day-night-light-enviroments.274081/), 29 Dec 2015;
  - [HD Terraining Contest #1](https://www.hiveworkshop.com/threads/hd-terraining-contest-1-place-of-cult.347193/), 25 Jan–25 Mar 2023, and its [results](https://www.hiveworkshop.com/threads/hd-terraining-contest-1-results.348648/), 19 Apr 2023;
  - [HD Terraining Contest #2 results](https://www.hiveworkshop.com/threads/%F0%9F%8F%86hd-terraining-contest-2-results.351964/), 20 Dec 2023 (vindorei, FeelsGoodMan, Celaquil; the post describes no techniques);
  - [Special Effect Animation by Index](https://www.hiveworkshop.com/threads/special-effect-animation-by-index.352866), 27 Feb 2024;
  - [SpecialEffectShadows](https://www.hiveworkshop.com/resources/specialeffectshadows.129227), 19 Apr 2024;
  - [UI: Adding Sprite](https://www.hiveworkshop.com/threads/ui-adding-sprite.321423/), 13 Jan 2020;
  - [Texture swap without imports](https://www.hiveworkshop.com/threads/how-to-change-textures-on-a-tree-or-other-doodad-without-importing-several-models.222212/), 3 Sep 2012;
  - [Replaceable Flag](https://www.hiveworkshop.com/threads/replaceable-flag.278718/), 1 May 2016;
  - [Local fade filter](https://www.hiveworkshop.com/threads/local-fade-filter.308127/post-3288424);
  - [Forsaken Kingdom thread](https://www.hiveworkshop.com/threads/warcraft-3-reforged-forsaken-kingdom-expansion-and-major-updates.374111/), 12 Sep 2026;
  - [3.0 bugs thread](https://www.hiveworkshop.com/threads/warcraft-iii-3-0-bugs-issues.374131/).
- **Native references:** [BlzSetSpecialEffectTimeScale](https://lep.duckdns.org/jassbot/doc/BlzSetSpecialEffectTimeScale), [AddWeatherEffect](https://lep.duckdns.org/jassbot/doc/AddWeatherEffect) (linking CryoniC's [custom weather article](http://www.wc3c.net/showthread.php?t=67949)), [CameraSetSourceNoise](https://lep.duckdns.org/jassbot/doc/CameraSetSourceNoise).
- **No dated Reforged showcase video was found:** web searches on 8 Oct
  turned up none that names its techniques. The HD Terraining Contest #2
  results mention a showcase video without linking it.

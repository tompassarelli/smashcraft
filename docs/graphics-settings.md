# Graphics settings

Warcraft III 3.0 keeps its graphics settings in the `[Video]` and `[Misc]`
sections of `Documents/Warcraft III/War3Preferences.txt`. A map can't read or
change them (smashcraft:docs/design/visual-quality.md, "The renderer is
fixed"), so Smashcraft chooses them in three places: the offline LAN pool's
profiles, `bun wisp play`'s recommended defaults, and the advice to players
below.

## What Smashcraft reads on screen

Players and the visual checks read the same things: fighter silhouettes and
team colour against the stage, hit sparks and special effects, the startup cue
of each special, stage decks and platforms, and the HUD (percent, stocks,
mana). Settings that change those are load-bearing; settings that only dress
the scenery are not.

## Settings

CPU is cores per client in an offline LAN match at the 60 fps cap; GPU is the
client's DRM GPU-engine time over the same interval. "Unmeasured" means no
per-setting sample exists yet; the measurement procedure is
wisp:docs/lan.md ("Profiles"), one active script, one setting changed at a time.

| Setting (`War3Preferences` key) | Values | CPU per client | GPU per client | Visual impact on what Smashcraft reads |
|---|---|---|---|---|
| Graphics mode (`[Misc] hd`) | 0 Classic, 1 Reforged, 2 Definitive | Unmeasured | Unmeasured | Load-bearing for visual checks: Reforged/Definitive draw HD fighters, PBR lighting and point lights; Classic loses stage lighting (#170). Parity runs read no pixels. |
| Window/render size (`reswidth`, `resheight`) | any | Unmeasured | Unmeasured | Load-bearing below 1280×720: the HUD and hit sparks become hard to read. |
| Frame cap (`maxfps`, `backgroundmaxfps`) | 1–… | Unmeasured | Unmeasured | The simulation is a fixed 60 Hz; above 60 only presentation changes (smashcraft:docs/high-refresh.md). A cap below the 33 turns/s turn rate is untested. |
| Texture quality (`texquality`) | 0–2 | Unmeasured | Unmeasured | Medium (1) keeps fighter detail readable at match zoom. |
| Lighting quality (`lightingquality`) | 0–2 | Unmeasured | Unmeasured | Load-bearing for stage lighting contrast (#170, `bun tools/stage/contrast.ts`). |
| Environment shadows (`shadowquality`) | 0–3 | Unmeasured | Unmeasured | Not load-bearing: the side-on camera reads position from the decks, not shadows. |
| Point-light shadows (`pointlightshadowquality`) | 0–3 | Unmeasured | Unmeasured | Not load-bearing. |
| Foliage (`foliagequality`) | 0–2 | Unmeasured | Unmeasured | Not load-bearing: scenery only. |
| Water (`waterquality`) | 0–2 | Unmeasured | Unmeasured | Not load-bearing: scenery only. |
| Anti-aliasing, supersampling (`antialiasing`, `supersampling`) | — | Unmeasured | Unmeasured | Not load-bearing. |
| Vertical sync (`vsync`) | 0, 1 | Unmeasured | Unmeasured | No visual check reads it; on, it adds up to a refresh interval of input-to-display latency. |
| Particles, spells, bloom, ambient occlusion (`particles`, `spellfilter`, `bloom`, `portraitBloom`, `assao`) | — | — | — | 3.0 removed these from the options menu; the pool still writes them at 0. |
| Sound (`[Sound]`) | on, off | Unmeasured | — | Off loads and mixes no sound; only audio checks need it. |

Every setting at its lowest (the `parity` profile below) measured 0.74 and
0.52 cores for the two clients of one pair (`/proc` sample, 7 Oct).

## LAN pool profiles

`bun wisp lan pool --pool-profile parity|visual` (wisp:scripts/wisp/lan/pool.ts
`PROFILES`):

- `parity`: 800×600, every quality setting lowest, Classic models, sound off,
  60 fps. For checksum, parity and input runs, which read no pixels.
- `visual`: 1280×720, Reforged models, lighting quality 2, texture quality 1,
  every other quality setting lowest, sound and music on, 60 fps. These are
  the load-bearing settings in the table above; everything not load-bearing
  stays lowest. Whether a still cheaper set keeps every visual check passing
  needs the per-setting samples above.

## Recommended player settings

Smashcraft's own reading needs Reforged or Definitive mode, medium textures,
high lighting and vertical sync off; everything else buys scenery, not
legibility, and can go to its lowest:

| Setting | Recommended |
|---|---|
| Graphics mode | Reforged or Definitive |
| Texture quality | Medium |
| Lighting quality | High |
| Environment shadows, point-light shadows, foliage, water | Off / lowest |
| Vertical sync | Off |
| Window, resolution, refresh rate, frame cap | Your display's own |

`bun wisp play` declares these as recommended settings
(smashcraft:ts/scripts/wisp/commands/play.ts `RECOMMENDED_GRAPHICS`): it writes
each one only when the player's file has no value for it, so a setting the
player chose is never replaced (wisp:docs/display-settings.md).

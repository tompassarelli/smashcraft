# Map size

Players download the map in the lobby, and a smaller map downloads faster, so
more of them stay (#264). Prefer Warcraft's built-in assets: reshape, recolour,
rescale or recombine stock models, doodads, effects and animations before
importing a file. Custom assets are fine where stock can't do the job well.
The size is a number to watch, not a ban.

## How it is measured

`bun wisp map build` prints the built map's size and its imported bytes, e.g.
`map 177.8 MB, imports 168.6 MB (95%) in 2455 files`. An import's bytes are what
it occupies inside the archive (compressed), read from the map's MPQ block
table (smashcraft:ts/scripts/mapSize.ts). Imports are the files the build
declares plus every other file in a folder of the archive; the map's own root
files (`war3map.lua`, `war3map.w3i`, ...) are not.

The default build (no `--profile`) compares the map with
smashcraft:ts/map-size-baseline.tsv and fails when it is more than 10% larger,
naming the five largest new or grown imports. After a justified import or a
cut, rebuild with `MAP_SIZE_UPDATE=1` and commit the rewritten baseline.

## Measurement, 8 Oct 2026

Build of main at 88e494da (`bun wisp map build --name Smashcraft`):

| Part | Files | Size |
| --- | ---: | ---: |
| Whole map | | 177.8 MB |
| Imports, total | 2455 | 168.6 MB (95%) |
| - declared by the build | 2211 | 138.3 MB (78%) |
| - carried from the container, not declared | 244 | 30.3 MB (17%) |
| Map's own files (`war3map.lua` 1.16 MB) | 20 | 1.2 MB |
| Free space left by replaced entries, tables | | 7.9 MB |

By kind (all imports, by file name): fighter clip-pool models 89.6 MB in 1963
files, textures and portraits 37.1 MB in 342, white-flash body copies 19.3 MB
in 71, other models 13.0 MB in 72.

The 10 largest imports:

| Import | Size | Note |
| --- | ---: | --- |
| `IllidanWhite-7299c290….mdx` | 4.16 MB | white flash copy |
| `DemonHunterFighter-d586986c….mdx` | 4.04 MB | |
| `DemonHunterFighter-eabc4b5a….mdx` | 3.56 MB | older version, not declared |
| `RiflemanWhite-d95ad99e….mdx` | 3.28 MB | white flash copy |
| `RiflemanFighter-9f110074….mdx` | 3.25 MB | |
| `ArcherWhite-6783f3c3….mdx` | 3.20 MB | white flash copy |
| `ArcherFighter-94cea621….mdx` | 3.17 MB | |
| `ArcherFighter-33738800….mdx` | 3.05 MB | older version, not declared |
| `RiflemanFighter-f9912ada….mdx` | 2.93 MB | older version, not declared |
| `ForsakenPaladin.mdx` | 1.57 MB | |

All are under `war3mapImported\`. The largest cheap cut is the 30.3 MB the
container still carries that the build no longer declares (older fighter
versions and portraits), plus the 7.9 MB of free space a fresh archive would
not have.

## Live imports, 8 Oct 2026 (#291)

The live imports are the 2211 files the build declares (`importedAssets` in
smashcraft:ts/scripts/wisp/mapInputs.ts, read from the inputs in
smashcraft:build-inputs.json at a75b307b), 138.3 MB. Sizes are the bytes
each one occupies in the built map (smashcraft:ts/map-size-baseline.tsv, the
88e494da build); four stage light and impact models newer than that build are
counted at 40% of their file size, under 0.1 MB together. The 244 undeclared
files #286 removes are not counted. #286's reference scan may still drop a
few declared files.

### By category

| Category | Files | Size | What it is |
| --- | ---: | ---: | --- |
| Animations (clip pool) | 1741 | 73.75 MB | One model per sequence for each of 21 fighters, each carrying the whole body mesh |
| Portraits | 260 | 28.63 MB | Card, bust, tile and stock icon TGAs, neutral plus four slot colours, for 13 fighters (11.86 MB as BLP since #307) |
| White-flash bodies | 71 | 19.31 MB | Every fighter's mesh and keys on one timeline with white materials, plus 50 white textures |
| Fighter models | 6 | 12.61 MB | Full Archer, Rifleman, Illidan, Forsaken Paladin and Lich King models (KO bodies, winner pose, unit) |
| Textures (UI, model) | 29 | 2.83 MB | Selection backdrop and cards, HUD plates, shield bubbles, Lich King textures |
| Stage art | 83 | 0.92 MB | Decks, skies, lights, palettes, water, lava, snow and stage thumbnails |
| Effects | 17 | 0.23 MB | Impact sparks, shields' models, bear clips |
| Sounds | 0 | 0 | Every sound is a stock label (model sounds, music) |
| UI frames | 4 | 0.00 MB | FDF and TOC files |

Fighters are 134.3 MB, 97% of the live imports. Stage art is under 1 MB
because stages are built from stock terrain and doodads.

### By fighter

Size (files). Stock heroes import no full model: their KO bodies and unit use
the stock model.

| Fighter | Full model | Clip pool | White flash | Portraits | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Illidan | 4.04 (1) | 9.29 (124) | 4.16 (1) | 1.74 (20) | 19.23 MB (146) |
| Forsaken Paladin | 1.57 (1) | 12.61 (109) | 1.57 (1) | 1.86 (20) | 17.62 MB (131) |
| Rifleman | 3.25 (1) | 4.50 (73) | 3.28 (1) | 2.28 (20) | 13.30 MB (95) |
| Archer | 3.17 (1) | 4.35 (77) | 3.20 (1) | 2.34 (20) | 13.05 MB (99) |
| Goblin Tinker | - | 8.49 (98) | 0.62 (1) | - | 9.11 MB (99) |
| Lich King | 0.58 (2) | 4.13 (97) | 0.56 (1) | 2.21 (20) | 7.48 MB (120) |
| Dreadlord | - | 3.09 (66) | 0.43 (1) | 2.64 (20) | 6.16 MB (87) |
| Pit Lord | - | 2.29 (65) | 0.56 (1) | 2.54 (20) | 5.38 MB (86) |
| Warden | - | 2.02 (65) | 0.39 (1) | 2.41 (20) | 4.81 MB (86) |
| Mountain King | - | 1.90 (76) | 0.33 (1) | 2.47 (20) | 4.71 MB (97) |
| Beastmaster | - | 1.70 (62) | 0.30 (1) | 2.60 (20) | 4.60 MB (83) |
| Shadow Hunter | - | 1.64 (65) | 0.33 (1) | 2.46 (20) | 4.43 MB (86) |
| Lich | - | 1.99 (64) | 0.33 (1) | 1.54 (20) | 3.86 MB (85) |
| Blademaster | - | 1.75 (72) | 0.17 (1) | 1.54 (20) | 3.46 MB (93) |
| Kael'thas | - | 2.44 (92) | 0.40 (1) | - | 2.85 MB (93) |
| Chen Stormstout | - | 2.36 (97) | 0.29 (1) | - | 2.66 MB (98) |
| Cairne | - | 2.04 (93) | 0.42 (1) | - | 2.46 MB (94) |
| Sylvanas | - | 1.88 (78) | 0.50 (1) | - | 2.38 MB (79) |
| Thrall | - | 1.89 (88) | 0.20 (1) | - | 2.10 MB (89) |
| Jaina | - | 1.81 (90) | 0.18 (1) | - | 1.99 MB (91) |
| Peon | - | 1.53 (88) | 0.39 (1) | - | 1.92 MB (89) |
| White textures, shared | | | 0.69 (50) | | 0.69 MB (50) |

A clip costs about one copy of its fighter's mesh: Blademaster's clips are
all 49 to 65 KB raw, the Forsaken Paladin's 178 to 301 KB. The pool's cost is
clips times mesh, so high-poly fighters with many sequences cost most.

### By stage

| Stage | Files | Size |
| --- | ---: | ---: |
| Hellfire Citadel | 5 | 97 KB |
| Naxxramas | 5 | 94 KB |
| Blackrock | 5 | 59 KB |
| Ahn'Qiraj | 5 | 58 KB |
| Gryphon Aerie | 5 | 57 KB |
| Durotar Skies | 5 | 56 KB |
| Tomb of Sargeras | 5 | 45 KB |
| Stratholme | 5 | 44 KB |
| Frozen Throne | 5 | 43 KB |
| Nordrassil | 4 | 41 KB |
| Sky Deck (test) | 5 | 40 KB |
| Shared (backdrop, water, lava, snow, chip, palettes) | 28 | 253 KB |
| Three Bridges thumbnail, no stage in the catalog | 1 | 29 KB |

Each stage is a deck slab, a main deck, a light, a sky and a thumbnail
(Nordrassil keeps the stock aurora sky).

## Portraits as BLP, 8 Oct 2026 (#307)

The build encodes each fighter portrait from its TGA in the `fighter-renders`
input to a one-level BLP1 JPEG at quality 90 (smashcraft:ts/scripts/blp.ts),
cached by source hash under `~/.cache/smashcraft/blp-portraits/`; the map
script names the `.blp` files. Build of 4af9c1d3 plus #307: the 260 portraits
take 11.86 MB in the map instead of 28.63 MB, and the map measured 162.7 MB.
smashcraft:ts/test/portrait-blp.test.ts holds every portrait import to BLP and
their total to 12.5 MB in the committed baseline.

| Quality | Portraits | Worst portrait PSNR | Largest channel error |
| ---: | ---: | ---: | ---: |
| 90 | 12.03 MB | 38.4 dB | 22 |
| 85 | 10.54 MB | 35.4 dB | 34 |
| 80 | 9.00 MB | 33.3 dB | 42 |
| 75 | 8.13 MB | 31.9 dB | 54 |
| 70 | 7.54 MB | 30.7 dB | 59 |

Sizes are the encoded files; error is decoded with war3-model's BLP reader
against the source, over opaque pixels' colour and every pixel's alpha.

## Items over 1 MB

Eight files are over 1 MB, and so are 21 clip pools, four portrait sets and
the white-flash set taken as groups. No stock asset replaces a fighter's
pose-by-pose body: the custom fighters' meshes and the appended recovery,
grab and drill clips exist only in the imports. The levers are packing the
same frames into fewer bytes.

| Item | Size | Option | Saves | Visual cost |
| --- | ---: | --- | ---: | --- |
| 21 clip pools | 73.75 MB | Draw the body from one model per fighter with every sequence on one seekable timeline, as the white-flash bodies already do (smashcraft:tools/animations/white-flash-models.ts), with original materials. The mesh is stored once instead of once per clip. | about 55 MB (the 19 timeline bodies weigh about what the white set does, 18.6 MB) | None expected: the white flash already follows the pool frame for frame on that timeline. Static lights and model-sound cues keyed to pooled clips move to timeline times. Unknown: why the pool was chosen over a timeline; check one fighter natively first. |
| Clip pools, same | | Drop sequences no fighter plays: cinematic, portrait and test sequences | 1.8 MB (1.7 MB of it the Forsaken Paladin's 13 cinematics) | None |
| Forsaken Paladin clip pool | 12.61 MB | Halve the community model's polygons | about 6 MB now, about 0.8 MB after the timeline | Medium: the hammer and armour lose detail up close |
| `IllidanWhite.mdx` | 4.16 MB | Keep keys only inside clips that can flash (hitlag poses and smash charge, smashcraft:ts/src/game/presentation/whiteGlow.ts); drop the rest of the timeline's keys | about 1.7 MB (assumes 40% of keys stay) | None: other poses never flash |
| `RiflemanWhite.mdx` | 3.28 MB | Same | about 1.3 MB | None |
| `ArcherWhite.mdx` | 3.20 MB | Same | about 1.3 MB | None |
| `ForsakenPaladinWhite.mdx` | 1.57 MB | Same | about 0.3 MB (mesh-heavy, few keys) | None |
| White-flash set, all 71 | 19.31 MB | Same, plus removing keys that linear interpolation reproduces | about 8 MB | None at a small tolerance |
| `DemonHunterFighter.mdx` | 4.04 MB | KO bodies, winner pose and the fighter unit draw from the pool or the timeline body instead of a full model (smashcraft:ts/src/game/render/combatEffects.ts `fighterModel`) | 4.04 MB | None |
| `RiflemanFighter.mdx` | 3.25 MB | Same | 3.25 MB | None |
| `ArcherFighter.mdx` | 3.17 MB | Same | 3.17 MB | None |
| `ForsakenPaladin.mdx` | 1.57 MB | Same; the timeline body is derived from it, so the source stays in private inputs only | 1.57 MB | None |
| Archer, Rifleman, Illidan keys (full, white, pool) | about 30 MB | Remove keys that linear interpolation reproduces within a small tolerance; these baked models carry about 405,000 keys each (Archer) | about 10 MB (unmeasured; assumes half the keys go) | None at a small tolerance; motion may soften at a coarse one |
| Portraits, 260 TGAs | 28.63 MB | Done (#307): JPEG BLP at quality 90, encoded at build time, one mip level | 16.77 MB (now 11.86 MB) | Worst portrait 38.4 dB PSNR against its source, largest channel error 22 of 255. The 5.7 MB estimate does not hold for BLP: Warcraft decodes BLP JPEG as four B, G, R, A planes with no colour transform, so colour can't be subsampled. 7 MB needs about quality 65 (30 dB) |
| Portraits, same | | Drop the four slot-colour variants and keep the neutral portrait | 80% of what is left (about 4.6 MB after BLP) | The card and plate lose the slot's outfit colour |
| `FighterCard*` set | 11.06 MB (65) | Covered by the BLP row | about 8.8 MB | As above |
| `FighterBust*` set | 8.90 MB (65) | Covered by the BLP row | about 7 MB | As above |
| `FighterTile*` set | 7.85 MB (65) | Covered by the BLP row | about 6.3 MB | As above |

Smaller textures (resolution) are not worth it here: the portraits are
already at the size their frames draw (smashcraft:docs/design/fighter-portraits.md),
and the selection backdrops compress to 0.9 MB.

## Budget for the finished game

### Platform limit

- Patch 1.27b (December 2016) raised the map file size limit from 8 MB to
  128 MB ([PCGamingWiki, patch archive](https://community.pcgamingwiki.com/files/file/1180-warcraft-3-standalone-patches-all-languages-windows/);
  [Hive Workshop, "Custom map size limit {solved}"](https://www.hiveworkshop.com/threads/custom-map-size-limit-solved.291599)).
- Reforged players reported the limit doubled to 256 MB in 2021. A 2024 Hive
  thread says the game opens files up to 512 MB but Battle.net's map cloud
  storage, which hosting needs, stops at 256 MB
  ([Hive Workshop, "Is it possible to host map above the 256mb limit?"](https://www.hiveworkshop.com/threads/is-it-possible-to-host-map-above-the-256mb-limit.355073)).
  Blizzard has published no figure since 1.27b.
- Big maps download slowly in lobbies: a 2021 report says a 202 MB map hosts
  only if early players seed it.

Treat 256 MB as the hard ceiling.

### What other maps weigh

Featured Reforged maps on maps.w3reforged.com and Hive Workshop (8 Oct 2026):
the median of 15 is 20.7 MB. Ambitious maps are larger: Warcraft Legacies
96 MB, Pokemon Legends 150 MB, Pumpkin TD 163 MB. The largest confirmed is
Heroic Origins Galaxy TD at 276 MB.

### Proposed budget: 120 MB

A whole game with a classic mode and an adventure has more content than
Warcraft Legacies and sits below the maps players call heavy. 120 MB is
under half the ceiling, so a lobby download stays bearable.

| Share | Budget | Today (live) | After the top savings |
| --- | ---: | ---: | ---: |
| Fighters (21 now) | 50 MB | 134.3 MB | about 35 MB (1.7 MB each), room for about 8 more |
| Stages | 15 MB | 0.9 MB | 0.9 MB; about 1 MB a stage for custom decks, skies, backdrops and home-stage scenery (#195, #268) |
| Classic mode (#284) | 10 MB | 0 | Boss models, ending art (21 endings at about 50 KB as BLP is 1 MB) |
| Adventure (#269) | 20 MB | 0 | Stock units cost nothing; custom leaders, scenes and cutscene art |
| UI, effects, textures | 5 MB | 3.1 MB | 3.1 MB |
| Map script and own files | 5 MB | 1.2 MB | 1.2 MB |
| Reserve | 15 MB | | |
| Total | 120 MB | 139.5 MB + #286's 38 MB | about 40 MB |

The baseline gate (10% growth per build) stays the per-change check; this
budget is the line it should never reach.

### Savings, by bytes per hour

| Rank | Saving | Bytes | Work | MB per hour |
| ---: | --- | ---: | ---: | ---: |
| 1 | Portraits as JPEG BLP | 22.9 MB | 3 h (BLP writer, renderer output, frame paths, one look in game) | 7.6 |
| 2 | Full models replaced by pool or timeline for KO bodies, winner pose and unit (only if 3 waits) | 12.0 MB | 2 h | 6.0 |
| 3 | Timeline bodies replace the clip pools and full models | about 67 MB (55 pool + 12 full) | 12 h (generator exists for whites; presentation, lights, sound cues, a native check per fighter) | 5.6 |
| 4 | White flash keeps keys only in flashable clips | about 8 MB | 3 h | 2.7 |
| 5 | Key reduction on Archer, Rifleman and Illidan | about 10 MB (unmeasured) | 4 h | 2.5 |
| 6 | Halve the Forsaken Paladin's polygons | about 6 MB, 0.8 after 3 | 3 h | 2.0, 0.3 after 3 |
| 7 | Drop cinematic, portrait and test sequences | 1.8 MB | 1 h | 1.8 |

Doing 1, 3 and 4 brings the fighters from 134 MB to about 35 MB and the map
to about 40 MB, a third of the budget.

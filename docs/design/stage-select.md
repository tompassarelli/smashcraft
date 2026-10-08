# Stage select

How other platform fighters present stage select, and the card every
Smashcraft stage gets on the stage panel (#304). The cards are generated from
the current stage data, so they never go stale: `bun scripts/stageThumbnails.ts`
from ts/ regenerates them and smashcraft:ts/test/stage-thumbnails.test.ts fails
until it has run after a stage changes.

## References

Screenshots are kept privately, with exact URLs and SHA-256 in `provenance.txt`,
under `~/.local/share/smashcraft-stage-design-178/references/` (copyrighted;
private visual study only, no pixels reused).

| Game | File | Source |
| --- | --- | --- |
| Super Smash Bros. Ultimate | `s304-ultimate-stage-select.png` | https://ssb.wiki.gallery/images/d/d5/Stage_Select_Ultimate_Normal.png |
| Super Smash Bros. Melee | `s304-melee-stage-select.png` | https://ssb.wiki.gallery/images/8/80/Stage_Select_Melee.png |
| Rivals of Aether 2 (1.2.2) | `s304-rivals2-stage-select.png` | Steam news, Patch 1.2.2, 6 May 2025: https://clan.akamai.steamstatic.com/images/43889344/9ff17620a74802a5f5a8f58e0df034250c66a0a6.png |
| Rivals of Aether 2 (1.1.5) | `s304-rivals2-stage-select-2.png` | Steam news, Patch 1.2.0, 2 Apr 2025: https://clan.akamai.steamstatic.com/images/43889344/b03c32a2e36223a98a16acf3a3610ea74b0b58e1.png |

What they do:

- **Ultimate**: an 11-column grid of roughly 4:3 tiles (about 108x84 px at
  1080p) separated by thin dark gaps, no name on the tile; a large preview
  (about 610x480) at the left names the hovered stage. Tiles are art renders
  of each stage, not gameplay captures.
- **Melee**: loose rows of small 4:3 tiles in bevelled grey metal frames, a
  red frame on the hovered one; the stage's name in large italic script at the
  lower left; no preview pane.
- **Rivals of Aether 2**: one carousel of tall slanted cards with a thin grey
  border, orange when selected; a full in-engine render of the selected stage
  fills the right two-thirds; the left side shows the stage's outline and
  blast-zone numbers; the name in bold italics over a translucent band.

What Smashcraft takes: one picture per stage framed the same way on every
card (Ultimate), the selected stage large beside the grid (Ultimate, Rivals),
and a drawn outline of the stage's layout (Rivals), so a player reads the
platforms before picking.

## The card

Every card has the same three parts (smashcraft:ts/src/game/ui/stageCard.ts):

1. **Picture**, a square at the card's left, full height: Warcraft's own
   campaign loading art for the stage's zone, or for a stage with none, a
   render of the stage from its hero camera (below).
2. **Panel**, coal (`TeamColor20`) filling the rest of the card, holding the
   **layout silhouette**: every surface of the stage at rest, in snow
   (`TeamColor21`, alpha 230), the main deck thick and platforms thin at their
   true spacing, centred in a box 84% of the panel's width and half as tall.
   The silhouette is generated from the stage's surfaces into
   smashcraft:ts/src/game/menu/stageSilhouettes.ts.
3. **Name banner** on grid tiles: a coal strip (alpha 210) along the bottom
   22% of the card with the stage's name in the menu font. The large preview
   leaves it out: its name and description sit below it.

Sizes, in Warcraft's UI units: grid tiles 0.094 x 0.059 (picture 0.059
square), the preview 0.372 x 0.25 (picture 0.25 square), the loading screen's
picture 0.18 square. Random Stage keeps its icon tile.

## Picture sources

Warcraft 3.0.1's storage (Steam build, read 8 Oct 2026) holds the classic
chapter loading screens as four DDS quadrants per zone under
`war3.w3mod:ui\glues\loading\backgrounds\campaigns\`: `ZONE-topleft` and
`-topright` 512x512, `-botleft` and `-botright` 512x256, with
`ZONEbackground.mdx` assembling them. All 16 zones (Ashenvale,
AshenvaleExpansion, Barrens, BarrensExpansion, BarrensExpansionQuest01-03,
Dalaran, DrownedRuinsExpansion, IcecrownExpansion, Lordaeron,
LordaeronExpansion, Northrend, OutlandExpansion, QuelThalas, Tutorial) sit in
the root `war3.w3mod:`, and `_hd.w3mod` overrides none of them, so Classic and
HD players see the same art. Each top-left quadrant is the zone's painted map
or scene, so a card uses it alone as its square picture, by its `.blp` path
(Warcraft serves the DDS).

Reforged's per-mission loading images (134 files under
`war3.w3mod:webui\loadingscreen\campaign\`, such as
`tft\01_sentinel\sentinel03_the tomb of sargeras.jpg`,
`rebirth\02_undead\undeadre03b_naxxramas.png` and
`roc\02_human\human02_blackrock and roll.jpg`) are JPEG and PNG pages for the
game's browser UI, not textures a frame loads, so using one means importing a
converted copy. The campaign menu backgrounds (`ui\glues\mainmenu\mainmenu3d*`)
are 3D scenes, not pictures. Neither is used.

| Stage | Picture | Classic and HD | Import bytes |
| --- | --- | --- | ---: |
| Frozen Throne | `IcecrownExpansion-TopLeft` (Icecrown Glacier map) | both | 0 |
| Nordrassil | `AshenvaleExpansion-TopLeft` (Mount Hyjal, the World Tree) | both | 0 |
| Durotar Skies | `BarrensExpansion-TopLeft` (Durotar and the Barrens) | both | 0 |
| Naxxramas | `LordaeronExpansion-TopLeft` (the Plaguelands) | both | 0 |
| Hellfire Citadel | `OutlandExpansion-TopLeft` (Hellfire Peninsula) | both | 0 |
| Stratholme | `Lordaeron-TopLeft` (the human campaign's Lordaeron) | both | 0 |
| Tomb of Sargeras | `DrownedRuinsExpansion-TopLeft` (the Broken Isles) | both | 0 |
| Gryphon Aerie | hero render `StageCardGryphon.blp` (no Hinterlands art) | imported | 34,468 |
| Blackrock | hero render `StageCardBlackrock.blp` (only a Reforged web image) | imported | 27,158 |
| Ahn'Qiraj | hero render `StageCardAhnQiraj.blp` (no Silithus art) | imported | 42,372 |
| Sky Deck (test) | hero render `StageCardSkyDeck.blp` | imported | 18,045 |

smashcraft:ts/src/game/menu/stageCatalog.ts names each picture;
smashcraft:docs/design/map-size.md records the import bytes.

## Hero renders

For the four stages without zone art, smashcraft:ts/scripts/stageThumbnails.ts
plays a headless quick match on the stage with items off at the widest camera
(`-dev view far`), captures frame 80, and re-draws that scene with the headless
renderer (smashcraft:docs/player-view.md) without fighters, HUD or menus from
the stage's hero camera (smashcraft:ts/scripts/stageThumbnailSpec.ts,
`HERO_CAMERAS`):

- rotation 80 (10 degrees off the gameplay view, showing the deck's side),
  angle of attack 340 (20 degrees down), target 220 below the floor at the
  stage's centre, distance 1900 (Sky Deck 1700), field of view 52, far clip
  20000.
- Rendered at 768x768, then resized to the stored 512x512.
- Colour grade, the same for every render: where no model draws, a vertical
  gradient from the stage's fog colour at the horizon to 35% of it at the top;
  then `-modulate 100,94,100 -sigmoidal-contrast 2.5x42%`.
- Format: opaque BLP1 with JPEG content at quality 82, one level, written by
  the portraits' encoder (smashcraft:ts/scripts/blp.ts, #307): Warcraft reads a
  BLP's JPEG as raw B, G, R, A components with no colour transform, which
  general encoders don't write (ImageMagick's four-component JPEG is YCCK).
- Budget: under 1 MB for all pictures together (8 Oct: 122,043 bytes).

The pictures are stored as the `stage-thumbnails` build-input family
(smashcraft:docs/build-inputs.md); smashcraft:ts/stage-thumbnails.json records
each one's bytes, SHA-256 and the hash of its inputs.

## Staying current

`bun scripts/stageThumbnails.ts` (from ts/, through the capacity helper:
about a minute) rewrites the silhouettes, re-renders the four pictures,
stores the family and writes ts/stage-thumbnails.json and build-inputs.json;
commit all three with the stage change. smashcraft:ts/test/stage-thumbnails.test.ts
fails when a selectable stage has neither zone art nor a recorded render, when
a rendered stage's inputs (its scenery, terrain, lighting model, decks and
surfaces, hero camera, the card format and the `stage-assets` family hash)
hash differently from the recorded hash, when build-inputs.json names other
pictures than the record, or when the silhouette file differs from what the
stages' surfaces draw now.

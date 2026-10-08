# Stage boards

Each Smashcraft stage has a board: the two to four Ultimate and Rivals of
Aether 2 references it follows, what to take from each, its material set
(deck top, edge, body and underside, platforms) and a pass/fail rubric that a
reviewer can check from native screenshots alone. The principles behind the
boards are in [stage art](stage-art.md); stage layouts and the Warcraft asset
inventory are in [stages](stages.md). Every stage change names the board item
it follows (stage art rule 14), for example "follows FT-2".

## The reference pack

Reference images are private, in
~/.local/share/smashcraft-stage-design-178/references/; provenance.txt there
gives each file's exact URL, source date, what it shows and its SHA-256.
They are copyrighted screenshots kept for composition study only; no pixels,
textures or geometry from them enter Smashcraft. Board items name the private
file and its public source.

- `u272-*.jpg`: 18 official Ultimate stage screenshots from the
  [official stage list](https://www.smashbros.com/en_US/stage/index.html)
  (base game 7 Dec 2018; DLC stages April 2019 to October 2021).
- `r272-*.png`: 11 stage shots from the official Rivals 2 press kit
  (rivals2.com/presskit, files dated 2022-09 to 2025-05, archive 7 Jan
  2026), the 1.6.0 (7 Apr 2026) and 1.7.1 (1 Sep 2026) patch images, and one
  Steam store gameplay shot. Press-kit shots use a raised beauty camera; the
  gameplay framing is confirmed only by `r272-steam-air-armada-gameplay.jpg`
  and `r272-stage-outlines-julesvale.png`.
- Older #178 files (`ultimate-*.png`, `rivals-steam-*.jpg`,
  `melee-final-destination.png`) are described in
  [stage art](stage-art.md#authored-compositions-and-visual-references).

Archetype coverage: flat (Final Destination, Pokémon Stadium 2, Rock Wall),
platforms (Battlefield, Small Battlefield, Midgar, Hodojo, Fire Capital),
walk-off and walled (Mishima Dojo, Treetop Bridge, Kalos), moving (Smashville,
Lylat Cruise, Spirit Train, Air Armada, Merchant Port) and home-themed
(Hollow Bastion, Castle Siege, Yggdrasil's Altar, Garreg Mach, Dracula's
Castle, Mementos, Godai Delta, Hyperborean Harbor, Julesvale, Tempest Peak).

### Measured scale

| Stage | Ledge to ledge | Ledge to side blast zone | Camera half-width | Source |
| --- | --- | --- | --- | --- |
| Ultimate Battlefield | 160 | 160 | 170 | [rubendal ssbustagedata.json](https://github.com/rubendal/SSBU-Calculator) 5584e8a, 29 Oct 2021 |
| Ultimate Final Destination | 160 | 160 | 180 | same |
| Ultimate Smashville | 139.3 | 160 | 160 | same |
| Ultimate Pokémon Stadium 2 | 187.6 | 156 | 180 | same |
| RoA2 Aetherian Forest | 1,280 | 1,380 | — | [dragdown](https://dragdown.wiki/wiki/RoA2/Stages), 15 Sep 2026 |
| RoA2 Fire Capital | 2,020 | 1,670 | — | same; side cut 2,824 → 2,680 from centre in [1.2.5](https://store.steampowered.com/news/app/2217000/view/1802354289729705), 17 Jun 2025 |
| Smashcraft (every stage but Frozen Throne) | 1,200 | 963 | — | smashcraft:ts/src/game/sim/stageBounds.ts |

Ultimate's camera reaches about 2.1 deck widths across at its widest, so a
landmark at a third of the frame sits about one deck width from centre;
Smashcraft's rule 3 band (1,000–1,600 units at landmark depth) agrees.
RoA2's stages are 6.4 (Aetherian Forest) to 10 (Fire Capital) character
heights wide with ~2 m characters ([RoA2 workshop docs](https://rivals2.com/workshop)).

## How the references build a stage body

What both games do, read from the pack; each material set below applies it.

- **Top, edge and body are three materials.** The walking surface is the
  lightest, simplest material (Battlefield's grass-and-paving band,
  Smashville's planks, Pokémon Stadium 2's field, Rock Wall's sandstone);
  the edge is a separate trim band (Battlefield's gold-lit stone, Julesvale's
  gold filigree, Air Armada's hull trim, Pokémon Stadium 2's edge lights);
  the body below is darker, rougher and of another material (Battlefield's
  ice keel, Hyperborean Harbor's ice pillar under timber, Aetherian Forest's
  root mass under moss, Smashville's earth under planks).
- **The body tapers and has a silhouette of the place.** No reference stage
  is a slab: Battlefield and Final Destination taper to a point, Hollow
  Bastion hangs pipes and roots, Godai Delta and Yggdrasil's Altar are round
  drums, Tempest Peak is stepped, Lylat Cruise is a hull.
- **Platforms are thin and of a third kind.** Drop-through platforms look
  thin ([Sakurai, Denfaminicogamer, 21 Dec 2018](https://news.denfaminicogamer.jp/projectbook/181221)),
  carry lit or decorated ends ([CEDEC 2019, Famitsu](https://www.famitsu.com/news/201909/09182823.html)),
  and are often held by a themed object: Tempest Peak's statues, Hodojo's
  torii, Merchant Port's crates, Smashville's balloons.

### Warcraft sources for materials

Native assets first, in this order:

1. **Terrain tile textures**, `TerrainArt\<tileset>\<file>.blp`, from the
   game's terrain.slk (classic set). Each is an atlas whose first 64×64 cell
   of a 256×256 sheet is the plain repeating tile: map a deck face's UVs into
   that cell and repeat it per 128 world units. These are seamless and
   cover every race, so they carry tops, edges and bodies.
2. **Stock model textures**, read from the models the stages already place
   (2026-10-08 read of their MDX texture chunks): `Textures\Ice_Natural01.blp`
   (Glacier), `Textures\BarrensNatural02.blp` (Barrens rocks),
   `Textures\BarrensNatural.blp` (ruined arch), `Textures\Ruins_Rock.blp`,
   `Textures\RuinsNatural.blp`, `Textures\RuinsDoodads1.blp`,
   `Textures\RuinsVines.blp`, `Textures\CityBuildingsRuin.blp`,
   `Textures\Watchtower.blp` (Orc timber and hide), `Textures\Minecart.blp`,
   `Textures\CreepyNecropolis.blp`, `Textures\NewZigguratscarycreepytex.blp`,
   `Textures\DemonGate.blp`, `Textures\DemonRune1.blp`–`6`,
   `Textures\CrystalOpaque.blp`, `Textures\FrozenThrone.blp`,
   `Textures\HumanBase.blp`, `Buildings\Human\GryphonAviary\GriffonAviary.blp`,
   `Buildings\NightElf\MoonWell\MoonWell.blp`,
   `Doodads\Ashenvale\Structures\Worldtree\WorldTree256.blp`. These are
   unwrapped atlases, not tiles: use one only where a region of it repeats
   (planks, bricks), chosen by looking at the extracted sheet, or keep the
   whole model as a platform's undercarriage.
3. **A stock model as the body.** A rock, glacier or ruin model placed in
   the deck's own layer under the walking line gives a keel or root mass
   without a new mesh (Battlefield's ice keel is decoration that "does not
   collide with anything", [SmashWiki](https://www.ssbwiki.com/Battlefield_(SSBU))).
   It counts as deck, not scenery; its facts go in
   smashcraft:ts/scripts/wisp/modelFacts.ts like any model.

Rule 10's value bands still hold: a texture is tinted (a static geoset
colour) until the walking surface, body and underside meet the luma and ΔE00
limits in smashcraft:ts/src/game/assets/stagePalette.tests.ts. The
`stagePalette.ts` colours become each material's tint target.

## Shared rubric lines

Every stage's rubric starts with these three. Captures are one native batch
at both camera extremes (`-dev view near|far`), with the `-dev backdrop off`
mask for contrast.

- **S1 Fighters stand out.** `bun tools/stage/contrast.ts MASK FRAME...`
  reports fighter ΔE00 against the backdrop of at least 20 and absolute ΔL\*
  of at least 15 on both clients at both extremes (#178's floor was 21.2;
  the #170 batch's worst ΔL\* 3.8 on Ahn'Qiraj is the failure being fixed).
- **S2 Nothing below.** No terrain, ground texture or prop base shows below
  the deck's underside at either extreme; below the deck there is only the
  underside, sky and atmosphere (stage art rule 11).
- **S3 Textured, not grey.** The deck top, the edge band, the body and every
  platform each show a visible repeating texture pattern (not a flat fill),
  in the stage's set below, and no face of deck or platform is the neutral
  slate (136, 151, 157) within 10 per channel, except on Sky Deck.

## Boards

### Frozen Throne (2), Battlefield layout

Lich King's home: Arthas climbs Icecrown to the throne.

| Item | Reference | Take |
| --- | --- | --- |
| FT-1 | Ultimate Battlefield, `u272-battlefield.jpg` and `ultimate-battlefield.png` | **Silhouette and layering**: a thin bright walking band over a long jagged keel, platforms with lit gold ends, one backlit source with a rim light ([CEDEC 2019, 4Gamer](https://www.4gamer.net/games/412/G041234/20190906163/)). In Warcraft: a runed Icecrown floor over a saronite keel that ends in a Glacier point, platform ends lit pale blue. |
| FT-2 | RoA2 Hyperborean Harbor, `r272-hyperborean-harbor.png` | **Palette**: warm-dark deck over a luminous blue ice body, distance desaturated to pale grey-blue. In Warcraft: the dark deck reads against bright ice beneath; the Frozen Throne massif stays pale and fogged. |
| FT-3 | Ultimate Final Destination, `u272-final-destination.jpg` | **Lighting**: cool slab with cyan ring lights along its edge. In Warcraft: an Ice_Ice edge band tinted brightest of the deck's faces, the "mysterious" ledge light. |

Material set:

| Part | Material | Source |
| --- | --- | --- |
| Deck top | Runed Icecrown paving | `TerrainArt\Icecrown\Ice_RuneBricks.blp` |
| Edge | Clear ice band, brightest lip | `TerrainArt\Icecrown\Ice_Ice.blp` |
| Body and underside | Saronite blocks tapering to a narrow keel; Glacier point below | `TerrainArt\Icecrown\Ice_BlackSquares.blp`; keel tip `Doodads\Icecrown\Rocks\Glacier\Glacier0` (`Textures\Ice_Natural01.blp`) |
| Platforms | Thin tiled-brick slabs with dark-brick undersides and pale lit ends | `TerrainArt\Icecrown\Ice_TiledBricks.blp`, `TerrainArt\Icecrown\Ice_BlackBricks.blp` |

Topology: the existing thin lip over a long taper to a narrow keel (stages.md, Main-deck topology), its taper broken into two uneven ice steps.

Rubric:

- S1, S2, S3.
- FT-a: the deck top shows rune bricks, the body dark blocks; the edge band is the brightest horizontal line of the deck in a grayscale copy of the frame (FT-3).
- FT-b: the keel ends in one point below the deck centre's third, not a flat bottom (FT-1).
- FT-c: the Frozen Throne massif is visible at the far extreme on the right third and is lighter and less saturated than the deck (FT-2).
- FT-d: no scenery is brighter than the fighters' lit side directly behind the deck (the #265 failure, FT-2).

### Nordrassil (10), Dream Land layout

The Sentinels defend the World Tree at Mount Hyjal.

| Item | Reference | Take |
| --- | --- | --- |
| NO-1 | RoA2 Aetherian Forest, `r272-aetherian-forest.png` | **Silhouette**: a moss-capped island whose body is a root mass wrapping down to a point; dark violet trees frame it. In Warcraft: Ashenvale grass on top, vines over the edge, a root-and-rock bowl below. |
| NO-2 | Ultimate Dream Land, `ultimate-dream-land.png` | **Landmark**: one recognisable tree, other vegetation low and small. In Warcraft: the World Tree is the only tall shape; Moon Wells stay low. |
| NO-3 | Ultimate Yggdrasil's Altar, `u272-yggdrasils-altar.jpg` | **Layering**: a giant tree island far behind a round altar with a gold rim; the tree is softened by distance. In Warcraft: the World Tree in the far band, fogged; the deck lip carries a moonwell-teal accent. |
| NO-4 | Ultimate Fountain of Dreams, `ultimate-fountain.png` | **Palette**: cool purple and teal, small luminous accents framing the stage. In Warcraft: the preserved FelwoodSky aurora, Moon Well glow as the only lights. |

Material set:

| Part | Material | Source |
| --- | --- | --- |
| Deck top | Ashenvale grass, lumpy | `TerrainArt\Ashenvale\Ashen_GrassLumpy.blp` |
| Edge | Hanging vines, moonwell-teal tint | `TerrainArt\Ashenvale\Ashen_Vines.blp` |
| Body and underside | Rock and rough earth bowl, roots below | `TerrainArt\Ashenvale\Ashen_Rock.blp` body, `TerrainArt\Ashenvale\Ashen_DirtRough.blp` underside |
| Platforms | Leaf-litter tops on vine undersides, thin | `TerrainArt\Ashenvale\Ashen_leaves.blp`, `TerrainArt\Ashenvale\Ashen_Vines.blp` |

Topology: the deep rounded bowl, like a root mass, with an uneven lower edge (NO-1).

Rubric:

- S1, S2, S3.
- NO-a: the deck top reads green, the edge as a different (teal or vine-dark) band, the body brown-grey (NO-1).
- NO-b: the World Tree is visible at the far extreme, on the left third, and is the only shape taller than the deck's height above the horizon (NO-2).
- NO-c: the FelwoodSky aurora covers at least 50% of the top 40% of the frame (NO-4; checklist A).
- NO-d: the only lit accents are Moon Well glows, none behind a ledge (NO-4).

### Gryphon Aerie (11), Yoshi's Story layout with a carried platform

Rifleman and Jaina's home: Wildhammer gryphons and Alliance riflemen.

| Item | Reference | Take |
| --- | --- | --- |
| GA-1 | Ultimate Castle Siege, `u272-castle-siege.jpg` | **Palette and material**: dressed grey masonry with one red accent colour. In Warcraft: dwarven granite blocks with Alliance gold and blue, kept to the lip. |
| GA-2 | RoA2 Tempest Peak, `r272-tempest-peak.png` | **Silhouette**: a stepped stone block in a cloud sea; statues hold the platforms. In Warcraft: the body steps in twice; the carried platform hangs from a gryphon-aviary-style frame, not a creature. |
| GA-3 | Ultimate Pokémon Stadium 2, `u272-pokemon-stadium-2.jpg` | **Lighting**: lights along the deck's front face mark the ledges. In Warcraft: a gold-tinted lip line the full length of the deck. |
| GA-4 | Ultimate Battlefield, `u272-battlefield.jpg` | **Layering**: an airy skyline, small distant structures for scale. In Warcraft: the aviary small and distant on the right, clouds desaturated. |

Material set:

| Part | Material | Source |
| --- | --- | --- |
| Deck top | Dressed square stone | `TerrainArt\Cityscape\City_SquareTiles.blp` |
| Edge | Brick lip tinted Alliance gold | `TerrainArt\Cityscape\City_BrickTiles.blp` |
| Body and underside | Granite in two steps, rough rock shell | `TerrainArt\LordaeronWinter\Lordw_Rock.blp` body, `TerrainArt\Village\Village_Rocks.blp` underside |
| Platforms | Round-tile tops on granite; the carried platform a timber deck | `TerrainArt\Cityscape\City_RoundTiles.blp`; carried: a plank region of `Buildings\Human\GryphonAviary\GriffonAviary.blp` |

Topology: flat lip, a step in, then a lower shell (Pokémon Stadium), stepped twice (GA-2).

Rubric:

- S1, S2, S3.
- GA-a: the deck top reads as cut stone blocks and the body as rougher rock, with a visible step in the silhouette (GA-2).
- GA-b: a gold line runs the deck's full front edge, unbroken from ledge to ledge (GA-3).
- GA-c: the carried platform's material differs in hue from the static platforms (GA-2).
- GA-d: the aviary is visible at the far extreme on the right third and smaller on screen than the main deck (GA-4).

### Durotar Skies (3), Smashville layout

Home of the Horde fighters: Thrall founds Durotar.

| Item | Reference | Take |
| --- | --- | --- |
| DU-1 | Ultimate Smashville, `u272-smashville.jpg` | **Material**: a plank walking surface over an earth mass; the drifting platform is a single distinct object. In Warcraft: Orc hide-and-timber planks over red Barrens earth. |
| DU-2 | RoA2 Godai Delta, `r272-godai-delta.png` | **Silhouette and landmark**: a rock drum with horizontal strata, the landmark off-centre on the right third, sunset sky. In Warcraft: red rock strata in the body; the watchtower on its mesa sits on a third. |
| DU-3 | RoA2 Rock Wall, `r272-rock-wall.png` | **Palette**: light sandstone top over a darker body, wood caps as accents. In Warcraft: pale dusty top, rust lip, dark-wood body. |
| DU-4 | RoA2 Fire Capital background, `r272-fire-capital-background.png` | **Layering**: the background plate under heavy haze and low contrast ([Fornace, SED 1853, 16 Dec 2025](https://softwareengineeringdaily.com/wp-content/uploads/2025/12/SED1853-Aether-Studios.txt)). In Warcraft: mesas fade into the dusty fog; this is the fix for #266's bright backdrop. |

Material set:

| Part | Material | Source |
| --- | --- | --- |
| Deck top | Barrens red earth | `TerrainArt\Barrens\Barrens_Dirt.blp` |
| Edge | Timber and hide band, rust-iron tint | a plank region of `Textures\Watchtower.blp` |
| Body and underside | Red rock strata undercut to a deep point | `TerrainArt\Barrens\Barrens_Rock.blp`, tip `Textures\BarrensNatural02.blp` |
| Platform | Timber deck on a hide-lashed frame | a plank region of `Textures\Watchtower.blp`, frame `TerrainArt\Barrens\Barrens_DirtRough.blp` |

Topology: the floating spire, a thin rim undercut to a deep point (DU-2's strata run across it).

Rubric:

- S1, S2, S3.
- DU-a: the deck top reads red-brown earth, the edge as timber, the drifting platform as timber distinct from the top (DU-1).
- DU-b: the body shows horizontal banding and narrows to one point (DU-2).
- DU-c: the watchtower is visible at the far extreme on the left third, standing on its mesa (DU-2).
- DU-d: the band of backdrop behind the deck is darker or lower in contrast than the fighters' lit side; its mean L\* is below the fighters' (DU-4, #266).

### Naxxramas (4), Town and City layout

Lich and Sylvanas's home: Kel'Thuzad's floating necropolis.

| Item | Reference | Take |
| --- | --- | --- |
| NX-1 | Ultimate Midgar, `u272-midgar.jpg` | **Lighting and palette**: a lit industrial slab with red beacons at its edges against a dark teal skyline. In Warcraft: black-iron and Scourge stone deck, plague-green lights at the ledges, slate-to-teal sky. |
| NX-2 | Ultimate Lylat Cruise, `u272-lylat-cruise.jpg` | **Silhouette**: a bright-edged hull against near-black space; the stage body is a built object. In Warcraft: the body is a stepped iron ziggurat, edges lit. |
| NX-3 | Ultimate Hollow Bastion, `u272-hollow-bastion.jpg` | **Landmark**: one castle silhouette framed by cliffs in a V, hazy. In Warcraft: the Necropolis alone, fogged, on the right third. |

Material set:

| Part | Material | Source |
| --- | --- | --- |
| Deck top | Scourge black squares | `TerrainArt\Icecrown\Ice_BlackSquares.blp` (or `TerrainArt\Undercity\UC_Naxx_MetalTiles.blp` once its classic presence is checked) |
| Edge | Glyph band, plague-green tint | `TerrainArt\Icecrown\Ice_RuneBricks.blp` (or `TerrainArt\Undercity\UC_GlyphBricks.blp`) |
| Body and underside | Ziggurat stone, three steps in | a block region of `Textures\NewZigguratscarycreepytex.blp`, underside `TerrainArt\Icecrown\Ice_BlackBricks.blp` |
| Platforms | Necropolis iron plates; the two patrols differ in tint | a plate region of `Textures\CreepyNecropolis.blp` |

Topology: the inverted ziggurat, three steps in (NX-2).

Rubric:

- S1, S2, S3.
- NX-a: green light marks both ledges and the ends of both moving platforms (NX-1).
- NX-b: the body shows three steps in its outline (NX-2).
- NX-c: the Necropolis is visible at the far extreme on the right third and is the only building taller than the deck on screen (NX-3).
- NX-d: the two moving platforms are told apart by hue or tint (NX-1).

### Hellfire Citadel (14), Pokémon Stadium layout

Illidan, Pit Lord and Kael'thas's home: Magtheridon's citadel in Outland.

| Item | Reference | Take |
| --- | --- | --- |
| HF-1 | Ultimate Pokémon Stadium 2, `u272-pokemon-stadium-2.jpg` | **Silhouette and lighting**: a heavy flat slab with straight walls and lights on the front face. In Warcraft: tall red fel-stone walls, fel-green rune light along the lip. |
| HF-2 | Ultimate Mementos, `u272-mementos.jpg` | **Palette**: two strong hues and black, a bold graphic body. In Warcraft: red stone, black char and fel green only. |
| HF-3 | RoA2 Fire Capital background, `r272-fire-capital-background.png` and `rivals-steam-02.jpg` | **Layering**: a recessed, hazy backdrop so fighters and platforms read first. In Warcraft: the Demon Gate deep in green haze, sparse rock fragments. |

Material set:

| Part | Material | Source |
| --- | --- | --- |
| Deck top | Light Outland cracked earth and flat stone | `TerrainArt\Outland\Outland_FlatStonesLight.blp`, first 64×64 cell of its 512×256 sheet |
| Edge | Fel-rune band, green tint | `Textures\DemonRune1.blp`; its white runes preserve the green tint without scene lighting |
| Body and underside | Charred stone walls, broad blunt base | `TerrainArt\Outland\Outland_Rock.blp` walls, `TerrainArt\Outland\Outland_Abyss.blp` underside |
| Platforms | Black Citadel brick slabs | `TerrainArt\BlackCitadel\Citadel_LargeBricks.blp` |

Topology: the heavy slab, tall straight walls and a broad blunt base (HF-1).

Rubric:

- S1, S2, S3.
- HF-a: a green line runs the deck's front edge, ledge to ledge (HF-1).
- HF-b: the deck shows only red-brown, black and green hues; no blue or gold face (HF-2).
- HF-c: the Demon Gate is visible at the far extreme on the left third, inside haze that is lower in contrast than the deck (HF-3).
- HF-d: the walls are vertical in the silhouette, not tapered (HF-1).

### Blackrock (12), Hollow Bastion layout over the cannon

Mountain King's home: the Dark Iron forges.

| Item | Reference | Take |
| --- | --- | --- |
| BR-1 | Ultimate Brinstar, `ultimate-brinstar.png` | **Palette and lighting**: a quiet dark upper cavern, warm light from beneath, the lip the brightest horizontal line. In Warcraft: charcoal basalt, a molten lip. |
| BR-2 | Ultimate Mishima Dojo, `u272-mishima-dojo.jpg` | **Material**: a flat stone floor with a central emblem under low-key light. In Warcraft: Dark Iron square tiles with a forge-plate pattern; the brightest thing is the forge glow. |
| BR-3 | RoA2 Crystal Oasis, `r272-crystal-oasis.png` | **Landmark and props**: a mine platform with track, carts and one giant centrepiece. In Warcraft: the mine cart for industrial scale; the basalt crag as the one landmark. |

Material set:

| Part | Material | Source |
| --- | --- | --- |
| Deck top | Dark Iron flagstones | `TerrainArt\Dungeon\Cave_SquareTiles.blp` |
| Edge | Molten lip | `TerrainArt\Dungeon\Cave_LavaCracks.blp` |
| Body and underside | Dark basalt | `TerrainArt\Dungeon\Cave_DarkRocks.blp` |
| Platform | Iron-bound forge plate | `TerrainArt\Dungeon\Cave_Brick.blp`, edge `Textures\Minecart.blp` iron region |

Topology: the forge anvil, with walls and an underside like every stage; the cannon's shot passes up through it (#338).

Rubric:

- S1, S2, S3.
- BR-a: the molten lip is the brightest horizontal line on screen, and nothing brighter sits behind either ledge (BR-1).
- BR-b: the forge platform's material differs from the main deck's top (BR-2).
- BR-c: the upper third of the frame is darker than the lower half of the backdrop (BR-1).
- BR-d: the basalt landmark is visible at the far extreme on the right third (BR-3).

### Ahn'Qiraj (13), Final Destination with a timed lift

No fighter's home: the Qiraji ruins.

| Item | Reference | Take |
| --- | --- | --- |
| AQ-1 | RoA2 Rock Wall, `r272-rock-wall.png` | **Material**: sandstone blocks, lighter top, darker body, warm desert distance. In Warcraft: Ruins sandstone with large bricks in the body. |
| AQ-2 | Ultimate Yggdrasil's Altar, `u272-yggdrasils-altar.jpg` | **Silhouette and lighting**: a round temple floor with a gold rim and a stone keel below. In Warcraft: a scarab-gold lip, the body an even trapezoid. |
| AQ-3 | Ultimate Garreg Mach, `u272-garreg-mach.jpg` | **Lighting**: light falls on the floor, the surrounding architecture stays darker. In Warcraft: the backdrop dimmer than the deck and fighters, the #267 fix. |

Material set:

| Part | Material | Source |
| --- | --- | --- |
| Deck top | Pale sand paving | `TerrainArt\Ruins\Ruins_Sand.blp` |
| Edge | Small bricks, scarab-gold tint | `TerrainArt\Ruins\Ruins_SmallBricks.blp` |
| Body and underside | Large sandstone bricks in an even trapezoid | `TerrainArt\Ruins\Ruins_LargeBricks.blp`, underside `Textures\Ruins_Rock.blp` |
| Lift | Round tiles with obelisk carving | `TerrainArt\Ruins\Ruins_RoundTiles.blp`, edge a carved region of `Textures\RuinsDoodads1.blp` |

Topology: the temple, an even trapezoid taper (AQ-2).

Rubric:

- S1, S2, S3.
- AQ-a: the deck's body shows larger bricks than its top, and the lip is a gold band (AQ-1, AQ-2).
- AQ-b: the backdrop band behind the deck has a mean L\* below the fighters' lit side (AQ-3, #267).
- AQ-c: the obelisk is visible at the far extreme on the left third (AQ-1).
- AQ-d: the lift's material differs from the deck top (AQ-2).

### Stratholme (6), three rooftop platforms

Forsaken Paladin and Dreadlord's home: the Culling.

| Item | Reference | Take |
| --- | --- | --- |
| ST-1 | Ultimate Dracula's Castle, `u272-draculas-castle.jpg` | **Palette and lighting**: moonlit gothic stone, warm firelight accents, dark purple-brown. In Warcraft: Lordaeron cobbles and scorched brick, town fires as the warm accent. |
| ST-2 | Ultimate Castle Siege, `u272-castle-siege.jpg` | **Silhouette**: a rampart walkway with roofs and towers as the stage body. In Warcraft: rooftop platforms with slate roofs; the city wall as the counterweight. |
| ST-3 | RoA2 Julesvale, `r272-julesvale.png` | **Landmark and layering**: a town block against a backlit sunset sky, building silhouettes layered behind. In Warcraft: the ruined cathedral backlit at dusk on the right third. |

Material set:

| Part | Material | Source |
| --- | --- | --- |
| Deck top | Cobble street | `TerrainArt\Village\Village_CobblePath.blp` |
| Edge | Kerb stones, Alliance-blue tint | `TerrainArt\Village\Village_StonePath.blp` |
| Body and underside | Scorched brick foundation | `TerrainArt\Cityscape\City_BrickTiles.blp` on both, tinted brown-black below |
| Platforms | Slate roofs on ruined walls | a roof region of `Textures\CityBuildingsRuin.blp` |

Topology: cobbled slopes, as the stage has; the body a foundation wall with one broken corner (ST-2).

Rubric:

- S1, S2, S3.
- ST-a: the deck top reads as cobbles, the platforms as roofs, in different hues (ST-2).
- ST-b: the cathedral is visible at the far extreme on the right third against a sky brighter near the horizon than at the deck's height band (ST-3).
- ST-c: the only warm light sources are the town fires, none directly behind a ledge (ST-1).
- ST-d: the body reads as brick wall, darker than the top in grayscale (ST-1).

### Tomb of Sargeras (7), two overhanging end platforms

Warden's home: Maiev hunts Illidan to the Broken Isles.

| Item | Reference | Take |
| --- | --- | --- |
| TS-1 | RoA2 Merchant Port, `r272-merchant-port.png` | **Palette**: turquoise water around a warm dock. In Warcraft: shallow tide over sunken stone, coral-gold accents. |
| TS-2 | Ultimate Kalos Pokémon League, `u272-kalos-pokemon-league.jpg` | **Lighting**: the floor glows brightest inside a darker teal hall. In Warcraft: the tide floor brighter than the temple behind. |
| TS-3 | Ultimate Hollow Bastion, `u272-hollow-bastion.jpg` | **Silhouette**: a floating ruin chunk with pipes and roots hanging under it. In Warcraft: Naga ruins with coral and vines hanging below the end platforms. |

Material set:

| Part | Material | Source |
| --- | --- | --- |
| Deck top | Sunken round tiles under the tide | `TerrainArt\Ruins\Ruins_RoundTiles.blp`, with the existing tide water model |
| Edge | Coral-gold lip | `TerrainArt\Ruins\Ruins_SmallBricks.blp` tinted coral |
| Body and underside | Natural sunken rock with vines | `Textures\RuinsNatural.blp` region, vines `Textures\RuinsVines.blp` |
| Platforms | Large carved bricks overhanging the edges | `TerrainArt\Ruins\Ruins_LargeBricks.blp` |

Topology: the two end platforms overhang the ledges on visible ruin brackets (TS-3).

Rubric:

- S1, S2, S3.
- TS-a: the tide floor is the brightest surface of the deck; the Temple of Tides is darker (TS-2).
- TS-b: the end platforms read as carved brick, unlike the deck top (TS-3).
- TS-c: the Temple of Tides is visible at the far extreme on the right third and the waterfall on the left (TS-1).
- TS-d: the deck shows teal and coral-gold only, no grey face (TS-1).

### Sky Deck (0), test stage, Final Destination layout

The neutral baseline; it keeps a neutral slate hue but is still textured.

| Item | Reference | Take |
| --- | --- | --- |
| SD-1 | Melee Final Destination, `melee-final-destination.png` | **Layering**: a quiet void, no props behind the lane. In Warcraft: the plain authored sky, no scenery. |
| SD-2 | Ultimate Final Destination, `u272-final-destination.jpg` | **Silhouette and lighting**: one slab tapering to a point below, rings of cool light along its edge. In Warcraft: a brass lip, a tapered underside. |

Material set:

| Part | Material | Source |
| --- | --- | --- |
| Deck top | Dalaran square tiles | `TerrainArt\Dalaran\Dalaran_SquareTiles.blp` |
| Edge | Brass band | `TerrainArt\Dalaran\Dalaran_BrickTiles.blp`, brass tint |
| Body and underside | Black marble taper | `TerrainArt\Dalaran\Dalaran_BlackMarble.blp` |

Rubric:

- S1, S2; S3 except the neutral hue, which Sky Deck alone may keep.
- SD-a: no scenery model is drawn (SD-1).
- SD-b: the brass lip is the brightest horizontal line of the deck in grayscale (SD-2).
- SD-c: the deck top shows a tile pattern, not a flat fill (SD-2).

## Choosing between options

Where a row names two sources, take the first unless its texture fails the
classic-graphics check (the client draws it with `hd=0`). Tilesets added for
Reforged (Lordaeron Capital, Undercity, Cityscape Ruins) are listed in
terrain.slk but their classic presence is unconfirmed; check the classic set
first. A "region of" a model texture means a crop chosen from the extracted
sheet; record the crop rectangle beside the material in stagePalette.ts.

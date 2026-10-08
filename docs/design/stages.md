# Stages

What Melee and Ultimate players pick, why, which layouts and hazards they
accept, and which Warcraft places and built-in assets could dress Smashcraft's
stages. Descriptive and sourced; the stance is the owner's
([gameplay design](../gameplay-design.md)). The last two sections evaluate the
draft list of eight in issue #75; current choices are in
[gameplay design's stage defaults](../gameplay-design.md#stage-defaults).
How each stage's sky and scenery are composed is in [stage art](stage-art.md);
which fighter calls each stage home is in [home stages](home-stages.md).

Units: Melee lengths are Melee units; Ultimate lengths are Ultimate units (its
Battlefield is 160 wide against Melee's 136.8). Smashcraft's world uses 6
world units per Melee unit (smashcraft:ts/src/game/sim/tuning.ts).

## Melee's competitive stages

### Layouts

Read from the NTSC 1.02 disc's stage files (collision `coll_data`, ground
scale `grGroundParam +0x0`, blast zone points 0x97/0x98; the private readers
are stage-collision-facts.ts and blast-zone-facts.ts under
~/.local/share/smashcraft-melee-reference/). Every value is scaled by the
stage's ground scale. Heights are the platform's top surface above the main
floor.

| Stage | Scale | Main floor (ledge to ledge) | Platforms (height × width) | Blast zones (side, top, bottom) |
|---|---|---|---|---|
| Battlefield (GrNBa) | 0.8 | ±68.4 (136.8) | two at 27.2 × 37.6 (x ±20 to ±57.6); one at 54.4 × 37.6 | ±224, 200, −108.8 |
| Final Destination (GrNLa) | 1.0 | ±85.57 (171.1) | none | ±246, 188, −140 |
| Pokémon Stadium (GrPs), neutral form | 1.0 | ±87.75 (175.5) | two at 25 × 30 (x ±25 to ±55) | ±230, 180, −111 |
| Yoshi's Story (GrSt) | 0.7 | ±56 (flat ±39.2, then slopes down 3.5) | two at 23.45 × 31.5 (x ±28 to ±59.5); one at 42 × 31.5; Randall 11.9 wide | −175.7 / +173.6, 168, −91 |
| Dream Land N64 (GrOp) | 1.0 | ±77.27 (154.5) | left 30.14 × 29.7, right 30.24 × 31.4; top 51.43 × 38.0 | ±255, 250, −123 |
| Fountain of Dreams (GrIz) | 0.75 | ±63.35 (126.7) | three 28.5 wide; the sides move up and down (below) | ±198.75, 202.5, −146.25 |

Walls and undersides: Final Destination and Battlefield have undersides a
fighter can pass beneath; Yoshi's Story's and Fountain of Dreams' walls run
down past the bottom blast zone, so nobody recovers under them, and Fountain's
pillar lets wall-jumping fighters recover. Pokémon Stadium is the only legal
stage with walls (during transformations), which allow Fox's drill-shine
infinite (SmashWiki, Pokémon Stadium).

Stage variance:

- **Battlefield, Final Destination**: static.
- **Yoshi's Story**: Randall, a cloud platform on a fixed loop through the
  bottom of the stage (Hazards, below), and Shy Guys that only interfere with
  projectiles and some recoveries.
- **Dream Land**: Whispy Woods' wind (Hazards, below).
- **Fountain of Dreams**: the side platforms drift up and down independently
  at random, from just under the top platform to below the floor; there is no
  tell of when or how far they will move (SmashWiki; melee:src/melee/gr/grizumi.c
  draws their targets with `HSD_Randf`).
- **Pokémon Stadium**: transforms between the neutral form and Fire, Grass,
  Rock and Water forms with walls and slopes; "frozen" Stadium is a mod that
  keeps the neutral form.

### Legal list and history

The Smash Back Room ruleset lists Battlefield, Dream Land, Final Destination,
Fountain of Dreams, Yoshi's Story and Pokémon Stadium; Final Destination and
Pokémon Stadium are starter or counterpick depending on whether frozen Stadium
is a starter, and Fountain of Dreams is banned in doubles for frame-rate drops
(SmashWiki, Stage legality).

Formerly legal counterpicks, now banned: Big Blue, Brinstar, Corneria, Green
Greens, Jungle Japes, Kongo Jungle, Kongo Jungle N64, Mushroom Kingdom,
Mushroom Kingdom II, Mute City, Onett, Poké Floats, Princess Peach's Castle,
Rainbow Cruise, Yoshi's Island. Never legal: Brinstar Depths, Flat Zone,
Fourside, Great Bay, Icicle Mountain, Temple, Venom, Yoshi's Island N64.

Frozen Stadium was first used sporadically in regional scenes (Battle of BC
3), became widespread when Slippi netplay made it the default during the 2020
online era, and was the offline norm for a few years; Slippi's default
"prior to August 2025" was frozen, and SmashWiki reports most majors have since
reverted to the transforming stage over legal concerns with Nintendo
(SmashWiki, Pokémon Stadium; Project Slippi). Riptide is named as a modern
event that used it.

### Pick and ban rates

No sourced aggregate of Melee stage picks or bans was found. Liquipedia's
yearly Melee statistics pages publish character and matchup counts but no
stage distribution, and its per-game stage data needs an API key. What the
sources say qualitatively: Battlefield is the usual game-one stage; Final
Destination was once the only legal stage in Japan and later became unpopular
because it swung best-of-five sets; Yoshi's Story is the main counterpick
against Jigglypuff and Peach (Dignitas, Ins and Outs of Every Competitive
Stage; SmashWiki, Yoshi's Story and Final Destination). This is a gap to fill
from Slippi replay data if a decision needs numbers.

### Why players like or dislike each

- **Battlefield**: symmetric, three platforms, big enough for movement but not
  for stalling; the default neutral.
- **Final Destination**: no platforms; strongest for chain grabs and
  projectiles (Ice Climbers, Marth, Fox and Falco lasers), worst for
  platform-reliant or evasive characters (Jigglypuff, Sheik vs top tiers);
  disliked for swinging matchups.
- **Yoshi's Story**: smallest blast zones, low platforms, close quarters;
  favours Fox, Marth, Falco and Sheik; hurts floaty Peach and Jigglypuff, and
  Captain Falcon. Randall is a known recovery aid.
- **Dream Land**: the largest legal stage, high top blast zone, high
  platforms; floaty characters survive long; the wind is mild.
- **Fountain of Dreams**: high ceiling, narrow sides, a pillar to wall-jump
  on; random platforms break wavedash and waveland timing; favours Peach and
  Mario, hurts Captain Falcon.
- **Pokémon Stadium**: wide and low-ceilinged; Fox and Falco camp with
  lasers; transformations waste time (Rock and Fire) and add walls.

## Ultimate's legal stages

### Layouts

From rubendal's Smash Ultimate Data Viewer (patch 13.0.1 stage files) and
KuroganeHammer. Competitive play turns hazards off.

| Stage | Ledges | Platforms (height × width) | Blast zones (side, top, bottom) | Hazards off |
|---|---|---|---|---|
| Battlefield | ±80 | two at 24.1 × 34.6 (x ±24.8 to ±59.4); one at 47.2 × 34.6 | ±240, 192, −140 | static |
| Small Battlefield | ±80 | two at 24.1 × 34.6 (x ±22.8 to ±57.4) | ±240, 180, −140 | static |
| Final Destination | ±80 | none | ±240, 180, −140 | static |
| Pokémon Stadium 2 | ±93.8 | two at 27.1 × 31.0 (x ±25.2 to ±56.1) | ±250, 180, −125 | no transformations |
| Smashville | −69.1 to 70.2 | one at 28.8 × 47.7 | −229 / 230, 190, −115 | the platform stays in the middle |
| Town and City | −81.8 to 83.2 | Town: centre 27.5, sides 41.5; City: two; all 38.5 wide | ±230, 190, −123 | still cycles Town ⇄ City |
| Kalos Pokémon League (Main Hall) | ±80, with walls | two at 30 × 35, overhanging the ledges (x ±62.2 to ±97.2) | ±245, 192, −118 | Main Hall only |
| Hollow Bastion | ±80 | one at 25 × 48 | ±240, 180, −140 | static |
| Northern Cave | ±80 | two at 24.1 × 35 at the ends (x ±58 to ±93) | ±237, 177, −140 | static |
| Yoshi's Story | ±68 | two at 28.5 × 38.3; one at 51 × 38.9 | ±227.1, 180, −117.8 | no Randall or Shy Guys |

Town and City stays about 30 seconds in each area and takes about 15 to
transition; the platforms leave and return during the transition, and with
hazards off they only move while offscreen. Returning platforms make a brief
walk-off that can kill at very low percent (SmashWiki, Town and City).

Smashville's platform moving side to side was a Brawl and Smash 4 starter for
a decade; Ultimate's hazards-off setting holds it in the middle, so the
moving version is not what Ultimate tournaments play (SmashWiki, Smashville).

### Legal lists

SmashWiki's estimate from recent majors: starters Battlefield, Pokémon Stadium
2 or Small Battlefield (one is the starter, the other a counterpick), and Town
and City; counterpicks Final Destination, Smashville, Hollow Bastion; disputed
Yoshi's Story and Kalos. Northern Cave and Lylat Cruise are infrequently legal
(Tournament rulesets (SSBU); Stage legality).

- Unified North American Ruleset (5 June 2024, approved by Nintendo):
  starters Battlefield, Final Destination, Town and City, Small Battlefield,
  Hollow Bastion; counterpicks Pokémon Stadium 2, Smashville, Kalos.
- Midwest ruleset: starters Battlefield, Pokémon Stadium 2, Small Battlefield,
  Smashville, Town and City; counterpicks Final Destination, Hollow Bastion,
  Kalos.
- Unified European Ruleset (Netherlands from 2021): nine stages with no
  starter split, the only major list with Yoshi's Story.

### Usage

Ultimate Stage Data aggregates every start.gg set that reported both
characters and stages since launch, online and offline: 7.28 million games.
Summing each stage's games across all 87 character pages (each game counted
once per player), on 6 Oct 2026:

| Stage | Share of games |
|---|---|
| Pokémon Stadium 2 | 32.1% |
| Small Battlefield | 13.5% |
| Town and City | 11.4% |
| Final Destination | 10.7% |
| Battlefield | 10.7% |
| Smashville | 9.8% |
| Kalos Pokémon League | 5.5% |
| Hollow Bastion | 2.9% |
| Yoshi's Story | 2.3% |
| Lylat Cruise | 0.9% |
| Yoshi's Island, Pokémon Stadium, Unova, Northern Cave, Castle Siege | 0.4% together |

These are plays, not picks or bans: they mix game-one strikes with
counterpicks, early lists (Lylat, Yoshi's Island) with current ones, and
online events. Survey data for Frostbite 2019 and Genesis 6 (pools captains'
sheets; github.com/EverAnh/ssbu-stage-data) records strikes and bans for
early Ultimate.

Per-character swings are largest on Yoshi's Story: a reddit analysis of a
million pre-8.0.0 games found Sonic winning 18% of 1,171 games there and Mario
77% (EventHubs). That is why counterpick lists are kept short.

## What competitive players accept as low variance

Across both games' lists, a legal stage has:

- one solid main platform with grabbable ledges and no permanent walls or
  walk-offs;
- zero to three soft platforms in fixed, symmetric places;
- blast zones within a band: Melee's legal stages run from Yoshi's Story's
  ±176 / 168 / −91 to Dream Land's ±255 / 250 / −123;
- no hazard that damages or kills, no scrolling, no caves of life, no frame
  drops.

Variance players have accepted, and kept:

- **Moving soft platforms** whose motion is slow or learnable: Smashville's
  platform (Brawl, Smash 4), Town and City's cycle, Randall, even Fountain of
  Dreams' random platforms, which stayed a Melee starter.
- **Mild forces**: Dream Land's wind.
- **Temporary transformations** with walls: Pokémon Stadium, legal for two
  decades, though the frozen version shows players will remove it when they
  can.

Rejected (SmashWiki, Stage legality, "commonly cited reasons"): random or
damaging hazards (Corneria's Arwings, Onett's cars, Jungle Japes' Klaptrap),
one-hit kills, permanent walk-offs and walls that make camping or infinites
possible, caves of life, scrolling stages that make the fight about keeping up
(Rainbow Cruise, Icicle Mountain, Poké Floats), and stages so large or high
that circle camping wins (Temple, Kongo Jungle).

## Hazard stages

### Dream Land's wind (Whispy Woods)

melee:src/melee/gr/groldpupupu.c with GrOp.dat's `yakumono_param`:

- Whispy idles for a random 600 to 1,200 frames (10 to 20 s), blinking every
  180 to 360 frames.
- He then turns towards the side the fighters are on (random if both), and
  blows. The blow animation plays a sound on frame 45 and pushes fighters on
  frames 46 to 319 (up to 4.6 s), with a camera quake.
- The push is 0.2 units per frame horizontally, inside a box near the floor
  (y −10 to 40; x −74 to −18 when blowing left, −17 to 76 when blowing right).
- Telegraph: the turn and the frame-45 sound; the timing itself is random.

### Yoshi's Story's Randall

Randall is a map animation with moving collision (melee:src/melee/gr/grstory.c;
only its puff effect is random). He is absent for the first ten seconds, then
emerges every ten seconds on alternating sides; a full trip through the stage
and out the other side takes 20 seconds. Players track him by the timer: he
enters the stage when the seconds digit shows 9 and comes out at 4, from the
left when the tens digit is even (SmashWiki, Yoshi's Story). Deterministic and
read off the clock, he is an accepted recovery aid.

### Kongo Jungle N64's barrel

melee:src/melee/gr/groldkongo.c with GrOk.dat's `yakumono_param`:

- The barrel moves along its path under the stage: it accelerates by 0.005 to
  full speed, travels 3,000 to 6,000 frames, decelerates, and pauses 300 to
  600 frames (all ranges random).
- It turns: waits 180 to 360 frames, then rolls 90 to 110 frames at 4° per
  frame towards a direction drawn by weight: up 50, up-left and up-right 10
  each, the five others 1 each (up two times in three).
- A fighter within 15 units is caught; the barrel fires on a press or after
  479 to 480 frames (8 s), and 10 frames into the shot the fighter takes a
  0-damage launch of base knockback 180 in the barrel's direction.

### Why Kongo Jungle and similar stages left the lists

Kongo Jungle N64's barrel is not what banned it. Its cited reasons are its
size, which favours fast and projectile characters, a high ceiling that forces
horizontal kills, a pitch-black background with camera errors, and high
platforms that allow camping; a GENESIS match of Pink Shinobi (Jigglypuff)
circle-camping RockCrock across the two top platforms is remembered as the
turning point. In Smash 64 its barrel was "easy to punish" and impossible to
stall in (SmashWiki, Kongo Jungle; Stage legality). Melee's own Kongo Jungle
was banned for a camping rock and for Klaptrap riding the barrel cannon.

The pattern across hazard stages is that players drop a stage when its
element is random (Fountain of Dreams survives, but is the most argued), when
it kills or damages (Klaptrap, Arwings, cars), when it changes what wins
(scrolling, circle camping), or when the stage's size breaks the band above.
A wind, carried platform or cannon on a published schedule removes random
timing; fixed advance warnings let players plan around it. It can still change
recovery and permit camping, so layout, blast zones and safe routes decide
whether it belongs in competitive play. Smashcraft's hidden hazard stages use
those schedules and warnings (smashcraft:docs/stage-hazards.md); passing their
determinism checks does not establish stage legality.

## Warcraft inspiration and built-in assets

### What the clients can show

The test clients run classic graphics (War3Preferences.txt `hd=0`), which load
the game's root asset set; Reforged-only assets live under `_hd.w3mod` and a
newer `_de.w3mod` set and are absent in classic. Below, every asset is in the
classic set unless marked **HD**. Paths come from the game's own listings:
Doodads.slk with doodadskins.txt, DestructableData.slk, Weather.slk,
WorldEditData.txt's sky list, and the CASC file list.

- Skies (`SetSkyModel`) in classic: BlizzardSky, DalaranSky, FelwoodSky,
  FoggedSky, Sky\SkyLight, LordaeronFall/Summer/WinterSky, the winter sky's
  BrightGreen, Pink, Purple, Red and Yellow variants, and Outland_Sky, each at
  `Environment\Sky\<Name>\<Name>.mdl`. **HD**: IcecrownGlacierSky, NorthrendSky,
  AshenvaleSky, BarrensSky, DalaranRuinsSky, VillageSky, VillageFallSky,
  PrologueSky; `_de` only: NaxxNightSky, UndercitySky, ArcaneSky.
- Weather (`AddWeatherEffect(rect, id)`) is particle-drawn from Weather.slk's
  textures, all in classic except Snowflakes (`VWsf`, **HD**). Emitters start
  `height` above the terrain (768 for snow and rain), while the arena floor
  stands 1,800 above the ground (smashcraft:ts/src/game/presentation/arenaCamera.ts),
  so weather placed on the ground falls below the fight; the stage lane must
  place it or emit it at arena height.
- Lighting: `SetDayNightModels` takes the tileset lights under
  `Environment\DNC\` (Lordaeron, Ashenvale, Felwood, Dalaran, Dungeon,
  Underground).
- Doodads and units are drawn as special effects, as the decks already are
  (smashcraft:ts/src/platform/shell/view.ts); tiles only matter for ground the
  camera sees behind the stage.

### Undead and the Scourge

- Places: Icecrown Glacier and the Frozen Throne (The Frozen Throne's Scourge
  campaign ends with Arthas ascending the throne), Stratholme (the Culling),
  Lordaeron's capital and the Undercity, Azjol-Nerub, Dalaran (Kel'Thuzad
  summons Archimonde); WoW raids Naxxramas and Icecrown Citadel.
- Tilesets: Icecrown Glacier (`I`), Northrend (`N`), Lordaeron Winter (`W`).
- Doodads: The Frozen Throne `Doodads\Cinematic\FrozenThrone\FrozenThrone`,
  the Lich King `Doodads\Cinematic\LichKing\LichKing`, Icecrown obelisk
  `Doodads\Icecrown\Props\IceCrownObelisk\IceCrownObelisk0`, pillar
  `...\IceCrownPillar\IceCrownPillar0`, ice arch
  `Doodads\Icecrown\Structures\IC_IceArch\IC_IceArch`, glacier
  `Doodads\Icecrown\Rocks\Glacier\Glacier0`, crystals, skull torch
  `Doodads\Icecrown\Props\IceTorch\IceTorch`, spider statues, Icecrown gate
  `Doodads\Icecrown\Terrain\IceCrownGate\IceCrownGate`, ice bridge;
  Frostmourne `Buildings\Other\Frostmourne\Frostmourne`; Necropolis, Ziggurat;
  units Frost Wyrm `Units\Undead\FrostWyrm\FrostWyrm`, Kel'Thuzad,
  Abomination, Gargoyle, Anub'arak, undead Arthas `Units\Undead\EvilArthas\UndeadArthas`.
  **`_de` only**: the floating Naxxramas `Doodads\Cinematic\Naxxramas\Naxxramas`.
- Skies: BlizzardSky, LordaeronWinterSky, LordaeronWinterSkyPurple;
  **HD** IcecrownGlacierSky, NorthrendSky.
- Weather: Northrend Blizzard `SNbs`, Heavy Snow `SNhs`, Light Snow `SNls`,
  Wind `WNcw`, Rays of Moonlight `LRma`, Plague `VWpl`, Dungeon Heavy Blue Fog
  `FDbh`.

### Human and the Alliance

- Places: Lordaeron (Strahnbrad, Hearthglen, the capital's throne room),
  Stratholme, Dalaran's Violet Citadel, Quel'Thalas and the Sunwell, Theramore;
  WoW: Aerie Peak (Wildhammer gryphons, the Hinterlands).
- Tilesets: Lordaeron Summer/Fall (`L`, `F`), Cityscape (`Y`), Village (`V`,
  `Q`), Dalaran (`X`), Dalaran Ruins (`J`).
- Doodads: King Terenas statue and city statue
  `Doodads\Cityscape\Props\City_Statue\City_Statue`, knight statue, ruined
  Violet Citadel `Doodads\Ruins\Props\DalaranVioletCitadelRuin\DalaranVioletCitadelRuin`,
  Sun Well `Doodads\Cinematic\SunWell\SunWell`, Sunfury Spire, windmill
  `Doodads\LordaeronSummer\Structures\Windmill\Windmill`; Gryphon Aviary
  `Buildings\Human\GryphonAviary\GryphonAviary`, Town Hall; units Gryphon
  Rider `Units\Human\GryphonRider\GryphonRider`, Gyrocopter, War Eagle,
  Mountain King, human battleship. **HD**: the Lordaeron throne room set
  (`Doodads\LordaeronCapital\...`).
- Skies: LordaeronSummerSky, LordaeronFallSky, DalaranSky; **HD** VillageSky.
- Weather: Lordaeron Light Rain `RLlr`, Rays of Light `LRaa`, Autumn Leaves
  `VWgl`, Dalaran Shield `MEds`.

### Orc and the Horde

- Places: Durotar and Orgrimmar (The Frozen Throne's bonus campaign), the
  Barrens, Stonetalon, Ashenvale (Grom and Cenarius), Thrall's internment camp;
  WoW: Blackrock Spire, Hellfire Citadel, Orgrimmar's Ring of Valor.
- Tilesets: Barrens (`B`), Ashenvale (`A`), Outland (`O`) for Hellfire.
- Doodads: Hellscream's throne `Doodads\Barrens\Props\HellscreamThrone\HellscreamThrone`,
  Thrall's hut `Doodads\Cinematic\ThrallsHut\ThrallsHut`, rock spires
  `Doodads\Barrens\Rocks\Barrens_Spires\Barrens_Spires0`, rock arch
  `Doodads\Barrens\Structures\BRockArch\BRockArch`, fire pit
  `Doodads\Northrend\Props\FirePit\FirePit`; Great Hall; units Goblin Zeppelin
  `Units\Creeps\GoblinZeppelin\GoblinZeppelin`, Wyvern Rider, Thrall, orcish
  transport ship. **HD**: tauren totem.
- Skies: LordaeronSummerSky, LordaeronWinterSkyRed or Yellow for dusk;
  **HD** BarrensSky.
- Weather: Wind `WNcw`, Outland Wind `WOcw` (dust), Ember Rain Orange `VWeo`.

### Night Elf

- Places: Ashenvale, Mount Hyjal and Nordrassil (Reign of Chaos' finale,
  Archimonde's defeat), Felwood, Moonglade, the Barrow Deeps, the Broken Isles.
- Tilesets: Ashenvale (`A`), Felwood (`C`), Lordaeron Fall (`F`).
- Doodads: World Tree `Doodads\Ashenvale\Structures\Worldtree\Worldtree`,
  Keeper statue, Guardian Statue of Aszune, Tyrande's large wooden bridge
  `Doodads\Cinematic\TyrandeWoodBridgeLarge\TyrandeWoodBridgeLarge`; Moon Well,
  Ancient of Wind `Buildings\NightElf\AncientOfWind\AncientOfWind`, Ancient
  Protector, Tree of Life, Horn of Cenarius; units Hippogryph, Chimaera,
  Mountain Giant.
- Skies: FelwoodSky, LordaeronFallSky; **HD** AshenvaleSky.
- Weather: Ashenvale Rain `RAlr`, Rays of Moonlight `LRma`, Summer Leaves
  `VWgr`, Dungeon Green Fog `FDgl` for Felwood.

### Burning Legion (candidate)

- Places: Mount Hyjal's summit, Dalaran's summoning, Outland (Hellfire
  Peninsula, the Black Temple, the Dark Portal), Felwood.
- Tilesets: Outland (`O`), Black Citadel (`K`), Felwood (`C`).
- Doodads: floating rock cluster `Doodads\Cinematic\Outland_FloatingChunksCluster\Outland_FloatingChunksCluster`,
  shimmering portal, Black Citadel statue, Outland magma rock, Eye of Sargeras
  `Doodads\Cinematic\EyeOfSargeras\EyeOfSargeras`; Dark Portal
  `Buildings\Other\DarkPortal\DarkPortal`, demon gate; units Infernal,
  Doomguard, Pit Lord, Mannoroth `Units\Demon\Mannoroth\Mannoroth`,
  Archimonde `Units\Demon\Warlock\Warlock`.
- Skies: Outland_Sky, FelwoodSky, LordaeronWinterSkyRed or BrightGreen.
- Weather: Ember Rain Green `VWee`, Acid Rain `VWra`, Outland Wind `WOcw`.

### Naga (candidate)

- Places: the Broken Isles and the Tomb of Sargeras (The Frozen Throne's
  Sentinel campaign), Nazjatar.
- Tileset: Sunken Ruins (`Z`).
- Doodads: coral `Doodads\Ruins\Water\Coral\Coral0`, ruins statue, naga circle
  `Doodads\Ruins\Props\Ruins_NagaCircle\Ruins_NagaCircle`, ruins fountain,
  Statue of Azshara `Doodads\Dungeon\Props\AzsharaStatue\AzsharaStatue`, school
  of fish, Eye of Sargeras; Temple of Tides
  `Buildings\Naga\TempleOfTides\TempleOfTides`, Tidal Guardian; units Naga
  Royal Guard, dragon turtle, hydra. **HD**: coral arch.
- Skies: FoggedSky, LordaeronWinterSkyBrightGreen.
- Weather: Bubbles `VWbb`, Ashenvale Heavy Rain `RAhr`, Dungeon Blue Fog
  `FDbl`.

### WoW raids

- **Molten Core and Blackwing Lair** (Blackrock Mountain, Ragnaros, Nefarian):
  Dungeon/Underground tilesets (`D`, `G`) with lava; fire trap and fire pillar
  `Doodads\Cinematic\FireTrapUp\FireTrapUp`, `...\FirePillarMedium\FirePillarMedium`,
  glowing brazier; Fire Lord `Units\Creeps\HeroFlameLord\HeroFlameLord` as a
  Ragnaros stand-in, Lava Spawn, Black Dragon
  `Units\Creeps\BlackDragon\BlackDragon`, black dragon roost; dwarven cart
  `Units\Other\DwarfCar\DwarfCar`, Mortar Team, TNT barrel
  `Units\Other\TNTBarrel\TNTBarrel`; sky LordaeronWinterSkyRed; Ember Rain
  Orange `VWeo`, Dungeon Heavy Red Fog `FDrh`; Dungeon lighting.
- **Ahn'Qiraj** (C'Thun, the Qiraji): Barrens desert and Sunken Ruins sand
  tiles; Obsidian Statue `Units\Undead\ObsidianStatue\ObsidianStatue`,
  Anub'arak, scarabs, Faceless One `Units\Creeps\FacelessOne\FacelessOne`,
  Nerubian Queen, ruins obelisks. No tentacle model exists in any asset set.
- **Naxxramas**: see Undead; its floating-necropolis model is `_de` only.
- **Icecrown Citadel**: see Undead.

## Evaluation of the draft list of eight

The draft in #75 (6 Oct), with the evidence for each. Platform heights and
widths are given as the reference stage's, in Melee units unless noted.

1. **Frozen Throne** (Undead, Icecrown): Battlefield layout, blizzard visuals,
   tournament standard. Battlefield is the default game-one stage in both games.
   Layout: 136.8 wide, platforms 27.2 and 54.4 high, 37.6 wide; blast zones
   ±224, 200, −108.8. No hazard. Assets: the Frozen Throne and Lich King
   cinematic doodads, Icecrown obelisks, pillars and glacier, a Frost Wyrm
   circling for the animated background; sky BlizzardSky or
   LordaeronWinterSkyPurple in classic (IcecrownGlacierSky is HD only); Northrend
   Blizzard or Heavy Snow placed at arena height. No change suggested.
2. **Nordrassil** (Night Elf, Hyjal): Dream Land layout with wind on a fixed
   cycle. Dream Land is the largest Melee starter: 154.5 wide, platforms 30.1
   and 51.4 high, blast zones ±255, 250, −123. Melee's wind is random in timing
   and aims at the fighters; a fixed cycle with Whispy's tell (turn, sound,
   then 4.6 s of 0.2 units per frame) keeps the strength players accepted.
   Assets: World Tree or Ancient of Wind as the blower, Keeper statues, Moon
   Well; FelwoodSky or LordaeronFallSky; Rays of Moonlight, Summer Leaves.
   Starter or counterpick.
3. **Gryphon Aerie** (Human): Yoshi's Story layout with a gryphon carrying a
   platform on a fixed loop. Yoshi's Story: ledges ±56, platforms 23.45 and
   42 high, 31.5 wide, the smallest blast zones (±176, 168, −91); Randall's
   20-second loop is already deterministic. Its small blast zones make it the
   strongest counterpick in Melee and the largest per-character swing in
   Ultimate, so it suits a counterpick slot. Assets: Gryphon Rider carrying
   the platform, Gryphon Aviary, War Eagles; LordaeronSummerSky; Rays of Light.
4. **Durotar Skies** (Orc): Smashville layout, a goblin zeppelin drifting.
   Smashville's moving platform was a Brawl and Smash 4 starter; Ultimate
   tournaments freeze it, and its static twin Hollow Bastion is a counterpick.
   Smashville (Ultimate units): ledges −69 to 70, one platform 28.8 high and
   47.7 wide, blast zones −229 / 230, 190, −115. Assets: Goblin Zeppelin as the
   platform, Hellscream's throne, Thrall's hut, rock spires; LordaeronSummerSky
   or WinterSkyRed at dusk; Wind. Starter.
5. **Naxxramas** (Scourge): Town and City layout, two platforms on different
   patterns. Town and City is a starter on most lists and 11% of Ultimate's
   games. Town and City (Ultimate units): ledges −82 to 83, platforms 27.5 and
   41.5 high, 38.5 wide, ~30 s per area and ~15 s transitions; blast zones
   ±230, 190, −123. Its accepted risk is the walk-off when platforms return;
   patterns that never leave the stage avoid it. Asset caveat: the floating
   Naxxramas model is `_de` only, so classic clients would need Necropolis,
   Frost Wyrm, Kel'Thuzad and plague fog instead. Starter.
6. **Ring of Valor** (Orc, Orgrimmar arena): Pokémon Stadium layout,
   tournament standard. Pokémon Stadium 2 is Ultimate's most played stage
   (32%); Melee's frozen Stadium is the low-variance version. Layout: ledges
   ±87.75, platforms 25 high and 30 wide; blast zones ±230, 180, −111. Swap
   to consider: Orc and Undead each have two stages while the Burning Legion
   and Naga candidates have none; the same layout as Hellfire or Black Temple
   (Outland_Sky, floating rocks, Dark Portal, Ember Rain Green) or the Tomb of
   Sargeras (Sunken Ruins, Eye of Sargeras) would give one of them a stage.
7. **Blackrock** (Dark Iron, Ragnaros): Kongo Jungle layout with a dwarven
   cannon on a fixed swing. Kongo Jungle N64 was banned for its size, high
   ceiling and high camping platforms, not its barrel. Swap to consider: keep
   the cannon but put it under a stage inside the legal size band (Battlefield
   or Dream Land proportions) rather than Kongo Jungle's. Melee's barrel:
   caught within 15 units, auto-fires after 8 s, base knockback 180 in the
   barrel's direction; a fixed swing, an always-visible aim, and a fixed
   auto-fire time make it learnable. Assets: Fire Lord, Lava Spawn, Black
   Dragon, dwarven cart or Mortar Team as the cannon, fire traps and pillars;
   LordaeronWinterSkyRed; Ember Rain Orange, red fog. Counterpick.
8. **Ahn'Qiraj** (Qiraji, C'Thun): wide, flat-ish layout with a tentacle
   rising at fixed intervals as a temporary platform. Closest references:
   Final Destination (171 wide in Melee, the most matchup-swinging starter)
   and Town and City's City form. A timed platform on a flat stage is the
   only platform relief, so its timing decides who can escape juggles.
   Asset gap: no tentacle model exists; the Obsidian Statue, Anub'arak,
   scarabs and Faceless One are built in, or the tentacle needs an authored
   model. Counterpick.

The flat stage stays outside the eight, as the draft says.

## Main-deck topology

Each ranked stage's main deck has its own silhouette, as Melee's and
Ultimate's legal stages do (Battlefield's tapered keel, Final Destination's
slab, Pokémon Stadium's flat with its lower shell). The walking line stays
flat and 1,200 wide on every stage, so blast zones, camera limits, bots and
hazards keep their measurements; what changes is everything under it.
smashcraft:ts/src/game/sim/stage.ts declares each profile as its right side
from the ledge down, in Melee units, mirrored for the left.

| Stage | Archetype | Under the walking line |
| --- | --- | --- |
| Sky Deck | Final Destination | Melee's FD walls and underside (the reference) |
| Frozen Throne | Battlefield | a thin lip over a long taper to a narrow keel |
| Nordrassil | Dream Land | a deep rounded bowl, like a root mass |
| Gryphon Aerie | Pokémon Stadium | a flat lip, a step in, then a lower shell |
| Durotar Skies | floating spire | a thin rim undercut to a deep point |
| Naxxramas | inverted ziggurat | three steps in |
| Hellfire Citadel | heavy slab | tall straight walls, a broad blunt base |
| Blackrock | forge anvil | a thick lip over a sheer face, then a stepped, blunt foot; the cannon's shot passes up through it |
| Ahn'Qiraj | temple | an even trapezoid taper |

Competitive rules every profile keeps:

- **Mirror-symmetric collision**, with a wall dropping straight from each
  ledge so both ledges are grabbable corners.
- **No overhang, no pocket**: every line of a side descends and stays inside
  its ledge, so each height crosses the body once and nothing can hold a
  fighter under the lip. No walk-offs and no cave-of-life walls.
- **Seven profile points**: five walls and an underside line per side, then
  the level underside, so every stage has the same number of body lines.
- **Recoverable**: every fighter gets back onto every stage from below
  either ledge (smashcraft:ts/src/game/match/stageRecoveryContracts.tests.ts);
  smashcraft:ts/src/game/sim/stageTopology.tests.ts checks symmetry, ledges,
  one outline per stage and the level underside.

Melee-reference contracts (wall techs, the underside scenario, the oracle and
the interaction graph) measure Final Destination's walls on stage 0; the
wall bounce, wall tech and wall-tech jump are also played against every
stage's own side wall, all 11 stages
(smashcraft:ts/src/game/match/wallTechInputContracts.tests.ts). Each
stage's drawn main deck is generated from its own outline by
smashcraft:tools/stage/package.ts.

## Layout archetypes

Platforms decide how a stage plays, more than its art (#154). From the
layouts and player accounts above:

- **Low platforms** (Yoshi's Story's 23.5, Pokémon Stadium's 25) are
  reached in one hop, so they extend combos and let a juggled fighter land
  quickly; they also give camping fighters a nearby ledge to retreat to.
- **High platforms** (Dream Land's 30 and 51.4) take a double jump to the top;
  juggles run longer under them and floaty fighters live longer beneath a
  high ceiling.
- **Three platforms** (Battlefield) give the most landing options, so
  juggles break more often than on two or none; Battlefield is the default
  neutral because it is "large enough for movement tech but not large enough
  to encourage stalling"
  ([SmashWiki](https://www.ssbwiki.com/Battlefield_(SSBU))).
- **No platforms** (Final Destination) favour chain grabs, projectiles and
  juggles: nothing to land on, nowhere to camp above.
- **One platform**: Smashville moves it, so its value changes with time;
  Hollow Bastion holds one still and is the hazards-off Smashville with
  Final Destination's blast zones, a starter on some lists
  ([SmashWiki](https://www.ssbwiki.com/Hollow_Bastion)).
- **Timed platforms** (Town and City's alternating sets, Randall) make
  stage position a matter of timing: a fighter reads where relief will be.

### Smashcraft's layouts

Each ranked stage takes a different archetype; the main deck is 1,200 wide on
every stage (Main-deck topology, above). Heights are above the main deck in
world units, then in full hops and in a full hop plus double jump of the
reference fighter (Archer, and every hero: 188 and 429; Rifleman 309 and 559,
Illidan 245 and 517). Ledge to blast zone: Frozen Throne 1,270 sideways, 1,500
up, 816 down; every other stage 963, 1,128 and 840 (Final Destination's,
smashcraft:ts/src/game/sim/stageBounds.ts).

| Stage | Archetype | Platforms (width at height; hops; share of jump and double jump) |
| --- | --- | --- |
| Frozen Throne | Battlefield | two 330 at 163 (0.87; 0.38), one 330 at 326 (1.74; 0.76) |
| Nordrassil | Dream Land, high | two 180 at 180 (0.96; 0.42), one 228 at 309 (1.64; 0.72) |
| Gryphon Aerie | Yoshi's Story, low, with Randall | two 189 at 141 (0.75; 0.33), one 189 at 252 (1.34; 0.59), and a carried 220 looping from 120 to 300 |
| Durotar Skies | Smashville | one 360 drifting side to side at 180 (0.96) |
| Naxxramas | Town and City | a 260 lift from 120 to 300 on the left, a 240 looping 150 to 270 on the right |
| Hellfire Citadel | Pokémon Stadium | two 180 at 150 (0.80; 0.35) |
| Blackrock | Hollow Bastion | one 360 at 150 (0.80; 0.35), static, over the swinging cannon |
| Ahn'Qiraj | Final Destination with a timed lift | the 260 lift from 120 to 300 only |
| Sky Deck (test) | Final Destination | none |

Blackrock was a second Battlefield; it now holds one static forge platform,
so no two ranked stages share a layout.
smashcraft:ts/src/game/sim/stageTopology.tests.ts checks that and that
every fighter reaches every static platform with a jump and a double jump;
smashcraft:ts/src/game/match/stageRecoveryContracts.tests.ts checks
recovery to every stage.

## Smashcraft decisions

The questions this research raised about the flat arena, platform motion,
starter/counterpick roles, hazard variety and effects, blast zones, race themes,
classic graphics, Ahn'Qiraj art and list size are resolved in
[stage defaults](../gameplay-design.md#stage-defaults).
The eight-stage evaluation above describes the original #75 draft; the current
stance and catalog supersede that draft where they differ. It is not evidence
of competitive balance or external tournament adoption.

## Sources

- Disc reads: NTSC 1.02 GALE01 rev 2 stage files GrNBa, GrNLa, GrPs, GrSt,
  GrOp, GrIz, GrOk (collision, blast zones, `yakumono_param`); decompilation
  melee:src/melee/gr/ (grbattle.c, groldpupupu.c, grstory.c, groldkongo.c,
  grizumi.c, ground.c, grdatfiles.c).
- SmashWiki: [Stage legality](https://www.ssbwiki.com/Stage_legality),
  [Tournament rulesets (SSBU)](https://www.ssbwiki.com/Tournament_rulesets_(SSBU)),
  [Pokémon Stadium](https://www.ssbwiki.com/Pok%C3%A9mon_Stadium),
  [Yoshi's Story](https://www.ssbwiki.com/Yoshi%27s_Story),
  [Fountain of Dreams](https://www.ssbwiki.com/Fountain_of_Dreams),
  [Kongo Jungle](https://www.ssbwiki.com/Kongo_Jungle),
  [Whispy Woods](https://www.ssbwiki.com/Whispy_Woods),
  [Smashville](https://www.ssbwiki.com/Smashville),
  [Town and City](https://www.ssbwiki.com/Town_and_City),
  [Small Battlefield](https://www.ssbwiki.com/Small_Battlefield),
  [Hollow Bastion](https://www.ssbwiki.com/Hollow_Bastion),
  [Northern Cave](https://www.ssbwiki.com/Northern_Cave),
  [Kalos Pokémon League](https://www.ssbwiki.com/Kalos_Pok%C3%A9mon_League),
  [Pokémon Stadium 2](https://www.ssbwiki.com/Pok%C3%A9mon_Stadium_2),
  [Battlefield (SSBU)](https://www.ssbwiki.com/Battlefield_(SSBU)),
  [Final Destination (SSBU)](https://www.ssbwiki.com/Final_Destination_(SSBU)),
  [Project Slippi](https://www.ssbwiki.com/Project_Slippi).
- [Ultimate Stage Data](https://ultimatestagedata.com/) (Corncycle; start.gg sets).
- [rubendal's Smash Ultimate Data Viewer](https://github.com/rubendal/ssbu)
  stage data, patch 13.0.1; [KuroganeHammer stages](https://kuroganehammer.com/Ultimate/Stages).
- [EverAnh/ssbu-stage-data](https://github.com/EverAnh/ssbu-stage-data)
  (Frostbite 2019 and Genesis 6 surveys).
- [EventHubs on the million-game Ultimate analysis](https://www.eventhubs.com/news/2020/jul/04/reddit-user-reportedly-analyzed-1-million-super-smash-bros-ultimate-tournament-matches-calculate-character-match-ups-and-stage-choices-data/).
- [Dignitas: The Ins and Outs of Every Competitive Stage in Melee](https://dignitas.gg/articles/the-ins-and-outs-of-every-competitive-stage-in-melee).
- Warcraft III's installed data: Doodads\Doodads.slk, Doodads\DoodadSkins.txt,
  Units\DestructableData.slk, TerrainArt\Weather.slk, TerrainArt\Terrain.slk,
  UI\WorldEditData.txt, and the CASC file list.

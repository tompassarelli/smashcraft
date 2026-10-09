# Stage art: backgrounds, skies and scenery

Tomb of Sargeras is the showcase chosen for the other stages' quality bar
(#299). Its [creative brief](showcase-tomb.md) gives each visual lever a job:
the luminous tide floor, a dark temple on the right third, falling water on the
left and an open fighting centre. Its TS-1 through TS-3 board and TS-a through
TS-d rubric remain the reference for judging the result.

Other stages must match that deliberate relationship between materials,
lighting and silhouette: three distinct deck materials, themed platforms,
three receding scenery bands, an immediately recognisable landmark and small
accents that follow the stage's clock. Stock assets come first. Classic and
Definitive must each compose a complete scene, with visible ledges and fighter
contrast at both camera extremes. Bloom, shadows or fog earn their place by
supporting that scene, and each stage keeps its frame and motion budgets.

The quality judgment uses captures beside the stage's Ultimate and Rivals of
Aether 2 references, line by line against its board. A missed line is fixed or
filed before the finished showcase is used to grade another stage.

How a Smashcraft stage's backdrop is composed so it tells its place without
competing with the fight. The stage pass applies these rules to every
selectable stage; a new stage follows them before it ships. Stage layouts,
hazards and the asset inventory per race are in [stages](stages.md).

## What the research says

- **Fighters first.** Melee's director made "the characters easy to identify on
  the stage" through stage size and restrained colour, so backgrounds would not
  "blend in or distract from the fighters" ([Source Gaming](https://sourcegaming.info/2017/07/22/melee_stage_design/)).
  Ultimate's art team balanced each stage's game elements (where the platforms
  and ledges are) against its art, and confirmed visibility by viewing the stage
  in grayscale ([CEDEC 2019, CGWorld](https://cgworld.jp/feature/201912-cedec-smashbros.html)).
- **Symmetric collision, asymmetric dressing.** For Ultimate's Battlefield:
  "the collision is left-right symmetric for gameplay, but balance is reached
  by varying object placement left and right and breaking up block
  continuity" (same CEDEC talk). Ultimate's Battlefield and Ω forms make the
  same point from the other side: every form has identical geometry and
  differs only in music and look ([SmashWiki](https://www.ssbwiki.com/Battlefield_form)).
  The look is free to vary; the geometry is not.
- **Light the play, not the backdrop.** Ultimate lit platforms and especially
  grabbable ledges, "even if the lighting was unnatural", layered stages into
  foreground, midground and background with focus on the nearer layers, and
  balanced brightness and saturation so fighters neither dominate nor vanish
  (CEDEC 2019).
- **Depth by atmospheric perspective.** The nearest plane carries the most
  saturation and light–shadow contrast; each receding plane loses saturation,
  gains lightness and shifts toward the sky's hue. Action games mute or
  simplify backgrounds so the actors stay contrasted ([Slynyrd, Pixelblog 62](https://www.slynyrd.com/blog/2026/5/27/pixelblog-62-landscape-backgrounds)).
  Most readability failures are value failures: actors need a different
  brightness band from the background ([Bugnet](https://bugnet.io/blog/readable-game-art-why-clarity-beats-detail)).
- **Layer budget.** Rivals of Aether's workshop stages get six background
  layers, one ground layer and two foreground layers ([Rivals workshop](https://rivalsofaether.com/stages/)):
  depth comes from a few distinct planes, not from many objects on one.
- **Players switch busy backgrounds off.** Brawlhalla added "Simple
  Backgrounds" and three blur levels in patch 6.10, for players who have
  "issues seeing movements of the Legends" ([Dashfight](https://dashfight.com/news/new-brawlhalla-patch-blurred-background-balance-changes-1868)).
  A background that needs such an option has failed rule 1 below.
- **Too quiet is a failure too.** Reviews of Nickelodeon All-Star Brawl found
  its stages "aren't very interesting when it comes to their backgrounds",
  with cameo-filled stages as the standouts ([WayTooManyGames](https://waytoomany.games/2021/10/06/review-nickelodeon-all-star-brawl/)).
  No published MultiVersus background guidance was found.
- **Motion and flashes.** Decorative motion and parallax can trigger
  vestibular distress; nothing should flash more than three times a second
  ([WCAG 2.3.1](https://www.w3.org/WAI/WCAG21/Understanding/three-flashes-or-below-threshold.html),
  [Universal Design](https://universaldesign.ie/communications-digital/web-and-mobile-accessibility/web-accessibility-techniques/developers-introduction-and-index/ensure-images-video-and-audio-are-accessible-to-everyone/take-extreme-care-when-designing-for-video-audio-and-animation)).

### Floating stages: what is under the deck

Tom's 7 Oct playtest found terrain showing beneath most stages. The prior
art (researched 7 Oct; inferences are marked):

- **The island floats; its underside is a modelled mass.** Ultimate's
  Battlefield, the template every Battlefield form copies, is a solid main
  platform over "a giant, jagged piece of ice at the bottom, surrounded by
  rock" that "does not collide with anything"
  ([SmashWiki, Battlefield (SSBU)](https://www.ssbwiki.com/Battlefield_(SSBU))).
  Final Destination floats over a void ([SmashWiki](https://www.ssbwiki.com/Final_Destination_(SSBU))).
- **Ground, when shown, is far below and behind.** Town and City is "suspended
  above the scenery below", Smashville above a town
  ([SmashWiki, Town and City](https://www.ssbwiki.com/Town_and_City),
  [Smashville](https://www.ssbwiki.com/Smashville)): the ground reads as a
  distant layer, never a surface right under the playfield.
  (Inference) Ground that looks near the deck reads as somewhere to land and
  hides the bottom blast zone: the collision-readability problem of Sakurai's
  "Emphasize Objects with Collision" ([YouTube](https://www.youtube.com/watch?v=FfPN4ZGgBpo),
  [summary](https://gonintendo.com/contents/11538-sakurai-covers-object-collision-in-his-latest-video)).
- **Layers by distance from the fighter line.** Ultimate splits backgrounds
  into layers by distance from the characters' plane and gives each a
  different strength of emphasis "to achieve both a sense of depth and
  visibility"; it checks stages in greyscale; ledges carry conspicuous
  light-emitting objects; fighters get reflector fill so their shaded side
  reads when zoomed out; and the camera is a narrow 30° so ledge positions
  read ([CEDEC 2019, CGWorld](https://cgworld.jp/feature/201912-cedec-smashbros.html)).
- **Readability beats scenery, and players punish failures.** Competitive
  rulesets ban stages for dark or distracting backgrounds (Kongo Jungle 64,
  Miiverse, Umbra Clock Tower, Unova Pokémon League; [SmashWiki, Stage legality](https://www.ssbwiki.com/Stage_legality)).
  Rivals of Aether 2 added a Stage Outlines setting in 1.7.1 (Sep 2026)
  because geometry stopped reading under a flatter camera
  ([Steam](https://store.steampowered.com/news/app/2217000/view/1842212951314215)),
  and Rivals 1 shipped a "Basic" version of each stage, its developers
  writing "we favor readability in gameplay"
  ([Rivals dev update, Nov 2014](https://rivalsofaether.com/developer-update-november-2014/)).
- **Light is controlled, not cycled.** Ultimate's Battlefield moves between
  light and dark with an eclipse instead of a full day cycle, keeping the
  stage's brightness range bounded ([SmashWiki](https://www.ssbwiki.com/Battlefield_(SSBU))).

### Primary sources on stage art, 2018–2026

Researched 8 Oct (#272); each stage's board in [stage boards](stage-boards.md)
applies these. The reference images are private, listed there.

- **Terrain outshines backdrop.** Sakurai tells stage artists "your
  backdrop's outshining your terrain": play up what you can stand on, play
  down the rest. Haze on everything but terrain helps, but alone it "really
  hurts the overall look"; balance the two and give gameplay "the slight
  edge" ([Emphasize Objects with Collision, 28 Oct 2022](https://www.youtube.com/watch?v=FfPN4ZGgBpo)).
- **Mark the edge, not just the top.** Ultimate lights floor edges' side
  faces, stripes them or darkens them for contrast, and gives ledges a
  deliberately unexplained light ([CEDEC 2019, 4Gamer, 7 Sep 2019](https://www.4gamer.net/games/412/G041234/20190906163/));
  thin platforms carry lights or decoration, the near side of narrow paths is
  darkened, and the walkable centre line is checked in black and white
  ([Famitsu, 9 Sep 2019](https://www.famitsu.com/news/201909/09182823.html)).
- **Fighters are small; contrast rises as they shrink.** A fighter can be as
  small as 24×39 pixels, so Ultimate raises contrast when they are small and
  rejected depth of field because it made them look like miniatures; the
  camera tilts 30°, not 40°, so a fighter on a ledge is not hidden
  (4Gamer, above). A TV fills about 30° of view, so budget screen space for
  play ([A Small Window Into the World, 25 Nov 2022](https://www.youtube.com/watch?v=DGIJk0Uh8jU)).
- **One culture, one light.** Ultimate's Battlefield brief: one culture and
  era, a repeated motif, open gaps in the frame, an asymmetric-looking layout,
  varied stones, backlit with a rim light from a single source (4Gamer,
  above). Battlefield was built first and set every other stage's base look
  (Famitsu, above).
- **Paint the light, judge the frame.** Background art shows the light
  objects reflect: a coloured key light, brightened lit spots, slight hue
  variation, then atmosphere ([Draw the Light, Not the Asset, 6 Sep 2022](https://www.youtube.com/watch?v=FuAtKjEuck8)).
  What counts is how the whole frame comes together after post-processing,
  not each model; Ultimate blends hues where Melee gave each object its own
  ([Final Output, 11 May 2024](https://www.youtube.com/watch?v=MGPwDINsVbU)).
  Lower saturation and matched texture detail unify a style
  ([Unifying Visual Style, 20 Jul 2023](https://www.youtube.com/watch?v=BLzEMMcwUKk), via GoNintendo's summary).
- **Backgrounds low in contrast, by design.** Rivals 2's director: "even the
  backgrounds are designed in a way where they can have less contrast but
  still look nice. That's all to serve the purpose of the gameplay"
  ([Dan Fornace, Software Engineering Daily 1853, 16 Dec 2025](https://softwareengineeringdaily.com/wp-content/uploads/2025/12/SED1853-Aether-Studios.txt)).
  Its Fire Capital background plate (press kit, 7 Nov 2024) sits under heavy
  blue-grey haze.
- **A stage body is three materials and a place-shaped silhouette.** Across
  both games' stage shots, the walking surface is the lightest and simplest
  material, the edge a separate trim band and the body a darker, rougher
  material that tapers in a shape of the place; drop-through platforms look
  thin ([Sakurai, Denfaminicogamer, 21 Dec 2018](https://news.denfaminicogamer.jp/projectbook/181221)).
  Observations and files are in [stage boards](stage-boards.md#how-the-references-build-a-stage-body).
- **When hues match, outline the stage.** Rivals 2 1.7.1 added Stage Outlines
  because geometry stopped reading under its Rivals 1 camera; its patch
  image shows a dark edge line separating a stage from a background of the
  same hue ([Steam, 1 Sep 2026](https://store.steampowered.com/news/app/2217000/view/1842212951314215)).
- **Skins vary the look on fixed geometry.** Rivals 2 adds stage skins with
  the same gameplay: Crystal Oasis over Rock Wall
  ([1.2.0, 2 Apr 2025](https://store.steampowered.com/news/app/2217000/view/1795917897297995)),
  Metal Graveyard over Aetherian Forest
  ([1.4.0, 7 Oct 2025](https://store.steampowered.com/news/app/2217000/view/1811772772644125)),
  Low Poly Fire Capital ([1.4.2, 4 Nov 2025](https://store.steampowered.com/news/app/2217000/view/1815034433041596)),
  Underground Arena over Godai Delta
  ([1.5.0, 6 Jan 2026](https://store.steampowered.com/news/app/2217000/view/1819386365126340)).
  Rule 2's split, look free and geometry fixed, is the genre's practice.
- **Lighting is tuned per stage after release.** Rivals 2 fixed Hodojo's
  lighting in 1.4.5.1 (20 Dec 2025) and Julesvale platforms that "appear
  darker than intended" in 1.7.0.2 (6 Aug 2026), and added warning visuals
  before casual-stage hazards move in 1.6.0.3 (9 Apr 2026) (Steam news,
  app 2217000).
- **Simplify what play can't read.** Rivals 2's workshop guidance: "If a
  detail cannot be clearly read from gameplay distance… simplify"
  ([workshop docs](https://rivals2.com/workshop), read 8 Oct 2026).

## Rules

Smashcraft's arena camera looks along +y, ten degrees down; scenery `x` is
across the screen, `y` is depth behind the fighting plane and `z` is height
from the floor (smashcraft:ts/src/game/presentation/stageScenery.ts).

1. **The fight plane belongs to the fighters.** Every mesh and particle stays
   behind the whole fighting volume in every arena camera, and fog starts
   beyond it. smashcraft:ts/test/player-view.test.ts enforces this for every
   stage.
2. **Deck symmetric, dressing not.** Collision, blast zones and platform
   paths stay mirror-symmetric. Scenery never pairs a model with its mirror
   twin: two pieces of one model on opposite sides differ in scale (at least
   25%), depth (600 units) or height (300 units), and sit at different
   distances from the centre. smashcraft:ts/src/game/presentation/stageScenery.tests.ts
   enforces it. Turn each model with `yaw` so repeats don't present the same
   face.
3. **One focal landmark, off the centre line.** The landmark that names the
   stage sits on a third of the frame (about 1,000–1,600 units from centre at
   its depth), not directly behind the main deck, where the fighters spend
   most of the match. The opposite side gets a counterweight of a different
   kind and size, not a copy.
4. **Three depth bands, uneven per side.** Near band (y 2,000–3,000): low,
   dark silhouettes below the deck line that frame the stage. Mid band
   (y 3,000–4,500): the supporting props. Far band (y 4,500–7,000): the
   landmark, softened by fog. Each side holds a different count and mix.
5. **Keep the deck's silhouette clean.** Nothing tall and bright sits directly
   behind the main deck's ledges or the platforms' ends; ledges must read
   against sky or fog. Near-band pieces stay below the deck line.
6. **Fog is atmospheric perspective.** Fog takes the sky's horizon hue, so
   distant pieces fade toward the sky, and starts beyond the fighting volume.
   The fog colour stays darker or less saturated than the fighters' team
   colours.
7. **No creatures in the background.** Owner decision (6 Oct): background
   creatures distract. Scenery is buildings, terrain and props only: no units,
   critters, flyers or vehicles that move, and no statues of figures: a
   posed or parked unit still reads as a creature (the Obsidian Statue
   looked like a winged creature holding a staff; the Dwarf Car carries a
   dwarf), so no unit model appears, and no doodad named for a figure
   (statue, totem, idol). Use ruins, obelisks, walls and doodad props such
   as the dungeon mine cart. The scenery test enforces both. This also keeps every fighter-shaped thing on screen a fighter.
   A stage hazard that is a creature is not background: it may appear only
   while it warns and strikes, inside the fight, and is gone otherwise. The
   Tomb of Sargeras hydra is allowed under this rule (Claude, with Tom's
   delegated authority, 8 Oct, #277): it shows only in its 45-frame tell and
   its bite (smashcraft:docs/stage-hazards.md).
8. **Motion budget.** Ambient motion only: fire, water, glow and weather that
   loop in place, never flashing and never crossing the fighting area.
   Gameplay motion (moving platforms, cannon, wind cues) stays the most
   visible motion on screen.
9. **Theme by silhouette.** One landmark plus two or three supporting props
   tell the place; prefer a few large, readable shapes to many small ones.
   The practice stage (Sky Deck) stays a plain sky as the neutral baseline.
10. **Decks wear the stage's materials, in fixed value roles.** Owner note
    (6 Oct): each stage's platforms take its place's materials: Icecrown ice
    over saronite, Night Elf bark, Dwarven granite and Alliance gold, Orc hide
    planks over dark wood, Scourge stone over black iron, red fel stone,
    Blackrock basalt with a molten lip, Qiraji sandstone. Sky Deck keeps the
    neutral slate. Whatever the theme, the walking surface reads at least 40
    luma from the stage's fog and the body sits at least 50 luma below it, so
    the walking line and ledges read in grayscale as Ultimate checks them.
    Below the lip, the body and underside differ by at least ΔE 15
    (CIEDE2000) from the near-black lower half of the sky that the arena
    camera shows beneath every deck (lightness about 4 in the 7 Oct native
    captures): CIEDE2000 rather than plain Lab distance because it counts how
    little a step among dark values shows, which is why Nordrassil's and
    Hellfire's bodies at lightness 19 and 15 read as faint.
    The lip carries the theme's accent.
    smashcraft:ts/src/game/assets/stagePalette.tests.ts enforces the values;
    smashcraft:ts/src/game/assets/stagePalette.ts declares the palettes.
11. **The deck sits in a world** (Tom's 9 Oct playtest, #360). Water, cliffs or
    structure fill the space beneath and beside the deck; no background
    surface is presented as another place to land. Tomb's opaque sea sits at
    its real swimming height and covers its sunken ruin bases. Matches draw
    no terrain. Background pieces that would
    stand on the ground fade into that atmosphere before their bases show,
    so nothing beneath the deck reads as a place to land, at either camera
    extreme (`-dev view near|far`). Fog alone can't do it: the near band sits
    inside the fog start. So, as on Ultimate's Battlefield, where background
    towns stand on cliffs and waterfalls that fall out of the frame, every
    piece reaches below the frame bottom of the far extreme or hides its base
    behind the deck or the rock it stands on. Natural forms (rock, ice, coral,
    trees, obelisks, the waterfall) are stretched downward with
    `matrixScale`; buildings and props stand on a stretched stock rock of the
    stage's kind (Barrens rock, Icecrown glacier, Ruins rock).
    smashcraft:ts/test/player-view.test.ts enforces it for every stage.
12. **The sky is one smooth gradient; the horizon sits at or below the deck.**
    The brightest region and the busiest clouds stay out of the deck's height
    band; the lower sky is the abyss colour the atmosphere fades to.
13. **Hazards are deterministic and trackable** (Tom, 8 Oct, #274). A stage
    hazard's position, timing and effect are a fixed function of the match
    clock and the fighters' own state and actions, never of a random draw.
    It is visible or telegraphed before it can hurt, and its schedule
    repeats so a player can learn it. Randall the cloud on Yoshi's Story is
    the model: hard to track, but on a fixed path anyone can learn; so are
    the Shy Guys, who fly across on a fixed schedule. Corneria's Arwings are
    the counterexample: they shoot a player out of the sky at moments no one
    can predict. Chaos is welcome; randomness that happens to a player is
    not. smashcraft:ts/src/game/match/stageHazardTracks.tests.ts plays every
    stage with hazards under two match seeds and requires identical hazard
    tracks, and smashcraft:ts/test/stage-hazard-random.test.ts refuses
    hazard code that reads the match's random source.
14. **Every stage change names its board item.** A commit, issue box or
    review that changes a stage's scenery, sky, fog, light, deck or platform
    look names the item of that stage's board in
    [stage boards](stage-boards.md) it follows (for example "follows FT-2"),
    and is judged against that stage's rubric there. A change that follows no
    item first adds one to the board, with its source and date.
15. **Three materials, lit edge.** Deck top, edge and body are different
    materials from the stage's set in [stage boards](stage-boards.md); the
    edge reads as its own band, distinct from top and body, in grayscale, and each
    platform's material differs from the deck top.

### Art checklist

Every stage passes these, judged from one batch of native captures at both
camera extremes (smashcraft:ts/scripts/wisp/stageCompositionChecks.ts):

| | Check | Measured by |
| --- | --- | --- |
| A | **Sky**: the stage's sky draws; at least 50% of the top 40% of the frame is sky; no hotspot in the deck's band | `bun wisp view frame` sky feature; look |
| B | **Nothing below**: no terrain or ground texture and no cut-off prop base below the deck, near and far | look at both extremes; rule 11 |
| C | **Underside**: the deck's body and underside read against the lower sky (ΔE00 ≥ 15, rule 10) | smashcraft:ts/src/game/assets/stagePalette.tests.ts |
| D | **Depth layers**: three bands, each farther one lower in contrast and closer to the fog colour (rules 4, 6) | look; fog test in smashcraft:ts/test/player-view.test.ts |
| E | **Playfield vs background**: walking surface ≥ 40 luma from the fog (rule 10); fighter contrast not reduced by the stage's atmosphere | stagePalette tests; `bun tools/stage/contrast.ts` |

## Warcraft limits

Scenery is special effects from the stock classic-graphics models the clients
draw, placed by smashcraft:ts/src/platform/shell/stageScenery.ts and loaded
before the match by smashcraft:ts/src/game/presentation/stagePreload.ts. A new
model needs model facts (smashcraft:docs/player-view.md) before the player-view
checks accept it, so a pass reuses the models those facts already list unless
it regenerates them. Skies come from `SetSkyModel`; their classic choices are
listed in [stages](stages.md#what-the-clients-can-show). Deck models and
their palette textures are generated by smashcraft:tools/stage/package.ts;
a new palette needs that generator run, the map's stage assets refreshed and
the new models' facts added.

The arena camera's far clip (`CAMERA_FIELD_FARZ` 8000) is measured from the
eye, which sits about 1,700 units in front of the fighting plane at the far
extreme, so a piece deeper than about y 6,300 is not drawn there (headless
render, 8 Oct, #193).

## Authored compositions and visual references

Actual reference screenshots are retained in
~/.local/share/smashcraft-stage-design-178/references/. Their exact download
URLs and local SHA-256 values are in the private provenance.txt; the table
below identifies the source files and what is observed in them. These are
Nintendo/HAL/Sora copyrighted game screenshots via SmashWiki, used only for
private composition study. No screenshot pixels, geometry or textures are
copied into a model or published. Atmospheric textures and sky spheres are
original art generated by smashcraft:ts/scripts/stageSky.ts and
smashcraft:tools/stage/skies.ts. Warcraft scenery remains installed stock
models, referenced by path and never copied into Git.

| Private reference file | Exact image source | Observable composition |
| --- | --- | --- |
| melee-final-destination.png | [Melee Final Destination](https://ssb.wiki.gallery/images/0/03/Final_Destination_Melee.png) | Bright platform edge against a quiet dark void; sparse distant stars, no props behind the fighting lane. |
| ultimate-battlefield.png | [Ultimate Battlefield](https://ssb.wiki.gallery/images/thumb/8/86/SSBU-Battlefield.png/1200px-SSBU-Battlefield.png) | Pale distant mountains and water; near cliffs descend below the island; small distant structures give scale. |
| ultimate-brinstar.png | [Ultimate Brinstar](https://ssb.wiki.gallery/images/thumb/d/d1/SSBU-Brinstar.png/1200px-SSBU-Brinstar.png) | Quiet dark upper cavern, muted vertical background, warm light beneath the deck; the lip supplies the brightest horizontal line. |
| ultimate-dream-land.png | [Ultimate Dream Land](https://ssb.wiki.gallery/images/thumb/6/68/SSBU-Dream_Land.png/1200px-SSBU-Dream_Land.png) | One recognizable tree, supporting vegetation low and small; uncluttered sky surrounds the raised platforms. |
| ultimate-fountain.png | [Ultimate Fountain of Dreams](https://ssb.wiki.gallery/images/thumb/c/c3/SSBU-Fountain_of_Dreams.png/1200px-SSBU-Fountain_of_Dreams.png) | Cool purple/blue atmosphere and a curved tree silhouette; small luminous accents frame rather than fill the stage. |
| ultimate-northern-cave.png | [Ultimate Northern Cave](https://ssb.wiki.gallery/images/thumb/e/ee/SSBU_Northern_Cave.png/1200px-SSBU_Northern_Cave.png) | Low rocky horizon and dark undersides; stage accents remain distinct against warm distant terrain. Its bright central meteor is deliberately not adopted. |

Melee and Ultimate are complemented by actual Rivals of Aether screenshots
and concrete skyline observations in
smashcraft:docs/design/patrol-stage-composition.md. Its provenance table names
the official Steam screenshot revisions and their private local files.

The per-stage table below is #178's composition pass; each stage's current
references, material set and rubric are its board in
[stage boards](stage-boards.md), which governs where they differ.

All nine stages keep their collision layouts. Stock model bounds matter more
than nominal scale: the old World Tree at scale 2 reached 8,425 world units
high and spanned 8,907 units horizontally before turning; scale 0.625 makes
it a distant landmark rather than a foreground wall. The Frozen Throne's
5,995-unit width at scale 1 is similarly halved.

| Stage | Reference and concrete composition |
| --- | --- |
| Sky Deck | Melee Final Destination's quiet space: no props, muted blue horizon and dark lower atmosphere; the neutral deck is the sole horizontal landmark. |
| Frozen Throne | Battlefield's distant island silhouette: a half-size throne massif on the right, glacier counterweight low on the left, small crystals below the fighting line, restrained steel-blue sky. Snow remains behind the arena. |
| Nordrassil | Dream Land's identifiable tree plus Fountain's cool well accents: smaller World Tree on the left, two asymmetrically placed low wells, one right crag. **The Felwood aurora sky is preserved exactly.** |
| Gryphon Aerie | Battlefield's airy skyline: a small distant right aviary, two different low crags form a descending left ridge, a desaturated blue cloud field leaves space around the carried platform. |
| Durotar Skies | Northern Cave and Rivals Fire Capital's low skyline: uneven mesa chain with one small watchtower; warm dusty horizon and dusky upper sky. |
| Naxxramas | Final Destination's quiet field and Battlefield's distant structures: one distant necropolis, small low Scourge ruins, slate-to-teal atmosphere. |
| Hellfire Citadel | Northern Cave's separated rock planes and Rivals' recessed scenery: one distant gate, descending rock field, restrained green haze beneath violet upper sky. |
| Blackrock | Brinstar's charcoal upper cavern and warm lower basin: original smoke-grey/rust sky replaces red winter clouds; right basalt landmark counterweighted by a lower left crag. Fire accents are 1.25–1.5 scale below the deck, and the small cart gives industrial scale. |
| Ahn'Qiraj | Battlefield's asymmetric architectural skyline: distant left obelisk at scale 4.5, lower right broken arch at scale 4, recessed fallen wall and low stones. Sand horizon and desaturated mauve zenith separate the gold deck edge from sky. |

Original skies use one seamless inward sphere of 1,024 triangles and one
256×128 texture each, no particles, lights or animated tracks. Sky draws
behind the world with unshaded, unfogged materials and no depth writes.
Only one sky draws at a time. Regenerate all stage art with
`bun tools/stage/package.ts`, pin the stage-assets family with
`bun wisp inputs add stage-assets DIR` from smashcraft:ts/, and use a full map
build when content-addressed sky paths change. Nordrassil remains a stock
sky so its existing animated aurora is unaffected.

Warcraft draws no effect whose position lies outside the map's world bounds,
and keeps units inside its playable bounds. The base map's playable area is
52 x 52 cells (x -3,328..3,328, y -3,584..3,072, centre y -256), and the arena
and its blast zones stand inside it. Scenery stands up to 7,600 behind the
fighters (y 7,344), so the terrain runs 40 boundary cells north of the playable
area instead of the editor's 8 (64 x 96 cells, world y -4,096..8,192; #298).
The extended base copied the top row of terrain points, pathing and shadow
into the 32 new rows and raised the top camera-bounds complement in
war3map.w3i from 8 to 40. smashcraft:ts/test/player-view.test.ts checks every
placed piece against the world bounds and every blast zone against the
playable bounds.

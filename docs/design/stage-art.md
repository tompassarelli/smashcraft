# Stage art: backgrounds, skies and scenery

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
11. **No ground under the stage** (Tom decided, 7 Oct, delegated). Matches
    draw no terrain: below the deck a player sees only the deck's underside,
    the sky and the stage's low atmosphere. Background pieces that would
    stand on the ground fade into that atmosphere before their bases show,
    so nothing beneath the deck reads as a place to land, at either camera
    extreme (`-dev view near|far`).
12. **The sky is one smooth gradient; the horizon sits at or below the deck.**
    The brightest region and the busiest clouds stay out of the deck's height
    band; the lower sky is the abyss colour the atmosphere fades to.

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

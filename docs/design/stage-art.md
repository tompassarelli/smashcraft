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
   critters, flyers or vehicles that move. A unit model may appear only as an
   inanimate prop (a stone statue, a parked mine cart); the scenery test lists
   those. This also keeps every fighter-shaped thing on screen a fighter.
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
    The lip carries the theme's accent.
    smashcraft:ts/src/game/assets/stagePalette.tests.ts enforces the values;
    smashcraft:ts/src/game/assets/stagePalette.ts declares the palettes.

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

# Water stage: the Tomb of Sargeras tide

Tom (8 Oct, #277): at least one stage makes heavy use of water, Smash-style.
A fighter who falls in is carried by a current, as in Melee's Jungle Japes, and
a creature attacks a fighter who stays in the water too long. Every part of it
follows the hazard rule of #274: position, timing and effect are a fixed
function of the match clock and the fighters' own actions, visible or
telegraphed before they can hurt, and learnable.

Units: Melee units (mu) where a source gives them; Smashcraft world units are
six per Melee unit (smashcraft:ts/src/game/sim/tuning.ts). Frames are 60 per
second.

## Reference 1: Jungle Japes' river (Melee)

Read from the owner's NTSC 1.02 disc (GALE01 rev 2, `GrGd.dat` SHA-1
671cbf509c61d6e0c1c470598456c10059a91762, its `yakumono_param` table) and the
decompilation melee:src/melee/gr/grgarden.c:

| `yakumono_param` | Value | Use |
| --- | --- | --- |
| +0x00 | −40.0 | River surface height. A fighter whose position is below it is in the river |
| +0x04 | −3.0 | Current: mu added to the fighter's x every frame in the river (leftward) |
| +0x10 | 80 | Klaptrap's shortest wait between swims, frames |
| +0x14 | 640 | Klaptrap's random extra wait, `HSD_Randi(640)`: 0–639 frames |
| +0x18, +0x1C | −30.0, 30.0 | Klaptrap's random x range for each swim |

- **Direction and strength.** `grGarden_8020349C` is registered as the stage's
  fighter "wind device" (`ftCo_800C06E8`, type 4). Each frame a fighter is
  below y −40 it returns the vector (−3.0, 0, 0), which
  `Fighter_procUpdate` (melee:src/melee/ft/fighter.c) adds straight to the
  fighter's position after its own motion, as it adds Whispy's 0.2 mu wind.
  The river moves a fighter 3.0 mu a frame, 180 mu a second, to the left, more
  than three times the fastest air speed in Smashcraft's cast (0.88 mu).
  Drifting against it is useless.
- **Region.** The whole river below y −40; there is no horizontal limit. Only
  x moves; gravity keeps pulling the fighter down.
- **Escape.** Melee has no swimming: a fighter falls through the water
  (SmashWiki: they "will simply fall to their death"). The only escape is up:
  a double jump or recovery special that lifts the fighter back above y −40
  ends the push that frame. SmashWiki calls getting caught "likely to result
  in a KO as it is hard to get back on the stage."
- **Where it carries you.** Left, toward the left blast line or down to the
  bottom one, whichever the fighter reaches first.
- **Tell.** Entering the river splashes (effect scaled by the fighter's size,
  sound 410000); the river itself is the tell: always there, always one way.
- **Klaptrap, the creature.** After 80 + 0–639 random frames it swims at a
  random x between −30 and 30, its sounds on its animation frames 38 and 148
  and 110 and 210 (`grGarden_80203250`). SmashWiki gives "every 8–17 seconds"
  in Melee, 30% and a spike strong enough to KO anyone. Both its timing and
  its place are random, so Smashcraft does not copy it.
- **Later versions.** Brawl lets fighters swim and float, so the river carries
  them "from the right platform to the left blast line in only a few seconds"
  and the Klaptrap comes "consistently every 10 seconds"; Ultimate keeps the
  leftward river and swimming, restores the Melee Klaptrap's one-hit spike,
  and keeps the current with hazards off (SmashWiki, Jungle Japes). Brawl's
  fixed ten-second Klaptrap is the learnable precedent.

Swimming in the later games (SmashWiki, Swimming): Brawl and Ultimate allow
240 frames of swimming, 2.5 frames fewer per 1% damage, then 150 frames of
drowning before the fighter sinks. Swim speed is at most 0.6 mu a frame
(acceleration 0.05); buoyancy is 0.1 mu/frame² capped at 3 mu a frame up in
Ultimate (Brawl 0.08, cap 1). In Ultimate each jump out of the water without
touching land multiplies the next water jump by 0.91, at most four times
(0.686), and swim time resets only on landing.

## Reference 2: the creature in the water

**Identified: Sandover Village, PlayStation All-Stars Battle Royale (2012),
and its Lurker Shark** (PlayStation All-Stars wiki, Sandover Village and
Lurker Shark). The stage is "a classic map with lots of platforms to jump on
and water below with a Lurker Shark patrolling"; Samos the Sage's hut stands
on a rock above the village, with a rotating platform below it, and the Rift
Gate's ring rises behind (our reading: the sage's hut, its Precursor
machinery and the ring are the "observatory" Tom remembers; the sources don't
call it one). It is a shark, it lives in the stage's water, and in its source
game, Jak and Daxter: The Precursor Legacy, it eats Jak "whenever [he] would
swim too far across the ocean".

Its mechanic, as the wiki records it (no frame data is published):

- **Trigger.** "If a fighter falls into the water, the fish will pop out and
  start swimming back and forward trying to eat everyone that is in its path.
  After some time, it will submerge."
- **Effect.** A bite sends the fighters it catches "to the upper left of the
  stage stunned and releasing AP" (the game's super meter).
- **Too long in the water.** Before patch 1.07 fighters could swim freely
  below the stage, dying only to the shark or by swimming out of bounds;
  from 1.07 "characters will automatically die if they stay in the water for
  too long" (wiki trivia, no patch-note source found).

Smash's nearest equivalents, checked for the same memory:

- **Summit** (Brawl, Ultimate): the Balloon Fight fish "will pop out of the
  sea to eat any character that stays in the water at the bottom of the stage
  for too long", choosing whoever has been in the water longest, on a fixed
  arc; its tail deals 15% and strong upward knockback, and a fighter it
  swallows is carried through the bottom blast line. It appears only while
  the iceberg sits in the water. Ultimate lets a swallowed fighter mash out:
  90 + 1.7 × percent, less 8 per stick input and 14.4 per button (SmashWiki,
  Summit; Fish). Summit has no building like an observatory.
- **Tortimer Island** (3DS, Ultimate): a shark "will attack fighters if they
  approach"; its trigger is nearness, not time, and the island's layout is
  random (SmashWiki, Tortimer Island).
- **Pirate Ship** (Brawl onward): no creature; the ship's motion makes
  swimmers drift toward the right blast line, and swimming into the bow is a
  20% one-hit meteor (SmashWiki, Pirate Ship).
- **Great Bay** (Melee, Ultimate): the Marine Research Laboratory and the
  turtle, which sinks about 30 seconds in; no creature attacks in the water
  (SmashWiki, Great Bay).
- **Delfino Plaza** (Brawl, Ultimate): water at some stops of its tour, no
  creature.

## Reference 3: newer water stages

- **Ultimate** adds no new current; its water rules are the swim, drown and
  water-jump numbers above, and Jungle Japes keeps its current with hazards
  off. The Summit fish's mash-out rule is the one new creature mechanic.
- **Rivals of Aether's Merchant Port** (Orcane's home; RoA 1, kept in Rivals 2's
  starter list per Combo Breaker's ruleset) is an offshore rig whose two pipes
  "constantly draw water from the ocean below" and, "when they are completely
  filled, can be triggered for a powerful attack"; its Basic version removes
  the pipes (Rivals developer update, Feb 2015). The Fraymakers port fills
  them in about 28 seconds. Take from it: a water hazard on a visible fill
  gauge is learnable. Rivals 2's Hyperborean Harbor is a counterpick; no
  published account of water play on it was found.

## Smashcraft design: the tide at the Tomb of Sargeras

**Home stage: Tomb of Sargeras (stage 7).** It is already "sunken ruins
awash in the tide": a shallow tide floor (friction 0.5, smashcraft:docs/physics.md),
two end platforms overhanging the sea, a distant Naga temple and waterfall.
In The Frozen Throne's "Terror of the Tides" Maiev hunts Illidan across the
Broken Isles by sea and into the Tomb, and in "Rise of the Naga" Illidan calls
Lady Vashj's naga up out of the ocean. It is the Warden's home stage; the
Murloc (smashcraft:docs/design/murloc.md), a coastal creep with no home stage
yet, belongs here when he becomes selectable. No new stage, collision layout
or catalog tile is needed.

### The sea

- **Surface.** The sea fills the stage's whole width, blast line to blast
  line, with its surface at z −360 (mu −60), 60 below the deck's deepest
  underside (−300), so a fighter passes under the deck. It sits inside the
  camera's bottom (−480) and 480 above the bottom blast line (−840)
  (smashcraft:ts/src/game/sim/stageBounds.ts).
- **In the water** means the fighter's position is below the surface.
- **Buoyancy.** In the water a fighter's vertical speed gains 0.6 world
  units/frame² upward (Ultimate's 0.1 mu), capped at 18 up (3 mu), until it
  reaches the surface, where it floats. A fighter launched in fast still
  sinks first: entering at 30 a frame downward it travels 750 before buoyancy
  stops it, past the bottom blast line, so spikes into the sea still kill;
  a fall or a weak hit floats.
- **Swimming.** At the surface, left and right swim at up to 3.6 a frame
  (Brawl's 0.6 mu, acceleration 0.3). There is no swim or drowning timer:
  the current and the hydra end every stay.

### The current: the tide turns every ten seconds

Rule 2 of smashcraft:docs/design/stage-art.md keeps the stage
mirror-symmetric, so unlike Jungle Japes the current alternates, on a
1,200-frame cycle counted from match frame 1:

| Cycle frames | Tide | Current |
| --- | --- | --- |
| 1–540 | flood | 4.8 world units a frame (0.8 mu) to the right |
| 541–600 | slack, the turn | none; the cue runs |
| 601–1,140 | ebb | 4.8 a frame to the left |
| 1,141–1,200 | slack, the turn | none; the cue runs |

- **Region and push.** Every fighter in the water, across the whole width,
  is moved 4.8 a frame in the tide's direction, added to its position after
  its own motion, exactly as Melee adds Jungle Japes' river and Whispy's wind
  and as Smashcraft's wind already does (smashcraft:docs/stage-hazards.md).
  Hitstun and hitlag don't stop it; it moves fighters only.
- **Strength.** A quarter of Japes' 3.0 mu: from the ledge a floating fighter
  reaches the side blast line (±1,562.6) in 201 frames (3.3 s), from under the
  deck's centre in 326 (5.4 s). Swimming against it at 3.6 still loses 1.2 a
  frame, so swimming only buys time; swimming with it doubles the speed.
- **Learnable.** The tide changes every ten seconds of match time: it runs
  right in the first ten seconds of every twenty and left in the second,
  with a one-second slack before each change.
- **Telegraph.** Foam lines on the surface always move with the tide. During
  each slack they stop and the notice names the coming direction, as the
  wind's notice does.
- **Escape.** Jump. A fighter in the water can jump out with its full ground
  jump, keeping its double jump and recovery special; each re-entry before it
  lands multiplies that water jump by 0.91, at most four times (Ultimate's
  rule). From the surface a jump and a double jump clear the deck: the
  lowest such reach on record is 429 (every hero,
  smashcraft:docs/design/stages.md), above the surface's 360 depth, before
  any recovery special; box 2's test checks every fighter. Where the deck
  body blocks a jump from under it, a fighter swims or rides out first.
  Leaving the water ends the push that frame.

### The hydra

The stage's creature is a hydra of the Broken Isles, the amphibious creep
(stock unit sounds include `HydraDeathSwim`, smashcraft:ts/test/fixtures/stock-sound-labels.txt).

- **Trigger.** Each fighter has a water count: frames spent in the water since
  it last landed on a deck. Leaving the water pauses it; landing resets it.
  When it reaches 150 (2.5 s, Brawl's drowning time), the hydra's tell starts
  under that fighter. A fighter's own actions are its only input.
- **Tell, 45 frames** (the wind's cue length, Whispy's frame-45 sound): a
  dark ring and the hydra's crest break the surface at the fighter's x on the
  tell's first frame, with its stock attack sound. The mark then drifts with
  the tide at the current's speed; it never steers toward a fighter.
- **Strike, on frame 46.** The hydra lunges up through a circle of radius 90
  (15 mu) round the mark, from the surface to 150 above it. Every fighter in
  it takes 15% (Summit's fish) and a launch straight down of base knockback
  120 with no growth, through ordinary body-hit resolution as Blackrock's
  lava uses: from the surface that carries a fighter through the bottom blast
  line at any percent, the bite Tom remembers. Shields don't help in the
  water; invincibility and dodge intangibility do.
  The stock hydra rises above its crest at the drifting mark on impact and
  sinks over the following 18 frames; its last strike frame is replayed with
  the fighter, so correcting a prediction restores the same lunge.
- **Dodge.** Jump out during the tell, or swim against the tide: the mark
  drifts with the current and a fighter swimming against it opens 3.6 a frame,
  162 over the tell, enough to leave the circle.
- **Once per visit.** After a strike the hydra submerges; that fighter's
  count restarts from zero.
- **Hazards Off** removes the hydra. The current stays, as Ultimate keeps
  Jungle Japes' river: it is the stage, not an event.

### What the policy asks, answered

| #274 rule | The tide | The hydra |
| --- | --- | --- |
| Fixed function | of the match frame and the fighter's position | of the fighter's own water count and position on the tell's first frame, then of the match frame |
| Telegraphed | foam always shows the flow; a one-second slack and notice before every turn | a 45-frame ring, crest and sound before any hit |
| Learnable | every ten seconds, right first | 2.5 s in the water, then 0.75 s |
| No random draw | none | none |

Stage art rule 7 bars creatures from the background. The hydra is a hazard,
not scenery: it shows only in its tell and strike, inside the fight, as the
cannon's barrel does, and is gone otherwise. Rule 11 ("no ground under the
stage") stays true: the sea is the stage's playing surface, drawn as water,
never as land.

## Warcraft water rendering options

From smashcraft:docs/design/visual-quality.md and
smashcraft:docs/design/warcraft-features.md. Classic and Definitive are the
supported looks.

| Option | Natives or source | Modes | For this stage |
| --- | --- | --- | --- |
| HD water | `SetHDWaterParams`, `SetHDWaterParamsEx`, `BlzSetHDWater*` (colour, opacity, reflectivity, emissivity, edge softness, waves, environment map) | Definitive, with the player's Water option on | Terrain water hides with terrain. The Tomb hides terrain, so these controls cannot draw its sea |
| Classic water tint | `SetWaterBaseColor(r, g, b, a)` | all | Same terrain-water limit |
| 3.0 water doodad | World Editor / object data | HD | Placed per map at edit time; *(guess)* may draw water without terrain. Needs an editor export to confirm |
| Stock water models as effects | `AddSpecialEffect` with stock paths: the Tomb's waterfall, coral `Doodads\Ruins\Water\Coral\Coral0`, wave and water-missile spell art for foam | all; HD clients draw the stock path's HD copy | Native first: foam lines and the hydra's ring from stock spell art |
| Smashcraft's StageWater model | `STAGE_WATER_MODEL`, generated by smashcraft:tools/stage/liquids.ts (rippled, alpha 110) | all | Already drawn on the Tomb's tide floor; scaled across the width it is the fallback surface, no new import |
| Fog and HD materials | `SetTerrainFogEx` and 3.0 height fog; stock paths' PBR copies | all / HD | Tint the sea's far edge toward the sky; keep fighter contrast (visual-quality rule) |

Cause (#277): the shared 64×64 ripple repeats across the sea, and each 128-unit deck cell restarts the same rock/vine crop.
Tomb alone uses authored 512×512 TombWater/TombSea fields with a 240,000 ms global UV loop in MDX 800; sea alpha is 255 and the deck overlay remains 110.
The sea spans 10×7 texture tiles, about 4.7 world units per texel, with irregular ripples and a second highlight layer moving across it at a different UV scale and direction.
The highlight strength varies on the same global loop; the deck overlay keeps the sea's texel density.
TombSea adds moving stock Water00 highlights, stock White_64_Foam1 strips at the deck and cliff waterlines, and depth bands darkening away from the deck.
The main body and underside use one continuous stock natural-rock crop across the whole face, with shallow facets inset below the ledge; the walking plane and collision outline stay fixed.
The main walking surface uses warm stone tint so it remains distinct from the teal sea; platform brick mapping stays fixed.
The final local Tomb camera raises its target as needed to keep the eye at least 80 units above the walking plane after fighter fitting; the synchronized match camera retains its existing behavior.
Terrain stays hidden, swimming stays at z −360, and the terrain-water controls do not affect these authored surfaces.

## Stage board: Tomb of Sargeras (water)

In #272's format; it moves into smashcraft:docs/design/stage-boards.md when
that file lands.

| Reference | Take | In Warcraft terms, native first |
| --- | --- | --- |
| Ultimate Jungle Japes (SmashWiki) | **Layering**: the river is one clear horizontal band under the play, its flow visible in surface streaks; upstream falls give it a source | The sea as one flat value band, darker than the deck's walking surface; stock foam lines moving with the tide; the Tomb's existing waterfall on the upstream side as the source |
| Melee and Ultimate Great Bay (SmashWiki) | **Landmark**: one coastal building off the centre line, sea to the horizon | The Naga Temple of Tides `Buildings\Naga\TempleOfTides\TempleOfTides` on a third of the frame in the far band, a low broken ruin as the counterweight (rule 3) |
| PlayStation All-Stars Sandover Village (PSASBR wiki) | **Silhouette**: the creature is seen only when it comes for someone, and its fin is the warning | The hydra breaks the surface only in its tell and strike; the ring and crest read in grayscale against the water |
| Rivals of Aether Merchant Port (Rivals developer update, Feb 2015) | **Lighting and cue**: an ocean stage whose water hazard shows its own gauge, the pipes filling before they can fire | Tomb's cool light (226, 244, 255 / 130, 176, 180) over a teal sea; the slack notice is the gauge; Sunken Ruins doodads, Bubbles weather `VWbb` only if placed at arena height |

## Sources

- Owner's GALE01 rev 2 disc, `GrGd.dat` `yakumono_param`; melee:src/melee/gr/grgarden.c, melee:src/melee/ft/ftdevice.c, melee:src/melee/ft/fighter.c (`Fighter_procUpdate` wind offset).
- SmashWiki: [Jungle Japes](https://www.ssbwiki.com/Jungle_Japes), [Swimming](https://www.ssbwiki.com/Swimming), [Summit](https://www.ssbwiki.com/Summit), [Fish](https://www.ssbwiki.com/Fish), [Tortimer Island](https://www.ssbwiki.com/Tortimer_Island), [Pirate Ship](https://www.ssbwiki.com/Pirate_Ship), [Great Bay](https://www.ssbwiki.com/Great_Bay).
- PlayStation All-Stars wiki: [Sandover Village](https://playstationallstars.fandom.com/wiki/Sandover_Village), [Lurker Shark](https://playstationallstars.fandom.com/wiki/Lurker_Shark).
- [Rivals of Aether developer update, February 2015](https://rivalsofaether.com/developer-update-february-2015/) (Merchant Port); [McLeodGaming wiki, Merchant Port](https://mcleodgaming.fandom.com/wiki/Merchant_Port) (Fraymakers fill time); [Combo Breaker, Rivals of Aether II](https://combobreaker.org/cb_tournaments/roa2/) (stage list).

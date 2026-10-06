# Hurtbox legibility: "played right, still lost"

Why players of Super Smash Bros. Ultimate report spacing that looked right by
every visible cue and still lost the exchange, which collision mechanisms
produce it, whether any of it is random, and Melee's comparable cases. This is
a descriptive reference and takes no position; Smashcraft's rules are in
[gameplay design decisions](../gameplay-design.md#legible-hurtboxes). The
vocabulary (hitbox, hurtbox, disjoint, interpolation) is in
[fighting-game design language](fighting-games.md#hitboxes-and-hurtboxes).
Retrieved 2026-10-06. Entries marked (secondary) come from news summaries or
search results rather than the primary post or game data.

## The complaint

- **The thread.** On 26 September 2026 Juan "Hungrybox" DeBiedma asked
  Ultimate players for their "painful truth" after eight years, offering his
  own: "ultimate is probably the only modern fighting game where you can
  truly, truly outplay your opponent across all games and still lose a best of
  five set" ([post](https://x.com/LiquidHbox/status/2103978593005027356),
  text and date read through the public embed API; about 850 replies and 550
  quotes at retrieval). EventHubs summarized the replies: balance across
  nearly 90 characters, "Steve just hiding behind blocks", "Sonic running away
  for minutes at a time", "Snake spamming projectiles", and DLC characters
  "so overtuned and defensive"
  ([EventHubs, 26 Sep 2026](https://www.eventhubs.com/news/2026/sep/26/hungrybox-smash-painful-truths/)).
- **The replies Tom highlighted** (as reported in #97 and #98; the reply
  pages need an X login and were not retrievable here): a coach whose student
  spaced correctly and was still hit, because hurtbox shapes change at
  breakpoints during animations; and a reply that projectiles are too strong
  and make play safe and boring ([projectiles](projectiles.md)).
- **Earlier statements of the same complaint.** Coach Ramin "SF"
  (@Mr_RSmash), 2 March 2021: "Never forget that hurtbox shifting is one of
  the stupidest things about Ultimate. I'll never stop complaining about this"
  ([post](https://x.com/Mr_RSmash/status/1366821753301966849), quoting a clip
  of a set lost to Hero). Charliedaking, 17 September 2021, on Wolf failing to
  grab R.O.B. from point blank because R.O.B.'s idle animation drops his chest
  out of the grab box: "This game's hitboxes are way too specific for a game
  where you can't run past people … some of the side effects are dogs**t"
  ([Dexerto](https://www.dexerto.com/smash/smash-ultimate-pro-reveals-dogst-hitboxes-that-need-updating-for-next-game-1655706/), secondary).

## Mechanisms in Ultimate

Each is a deterministic rule of the engine unless the entry says otherwise.

| Mechanism | What it does | How it defeats visible spacing | Source |
|---|---|---|---|
| Bone-attached hurtboxes | Hurtboxes are spheres and capsules on the skeleton's bones and "follow their movement even if the character themselves do not change position" | The hittable shape changes every frame of every animation, idle and dash included; spacing that clears one frame of an opponent's animation meets another frame's limb or misses a lowered chest | [SmashWiki Hurtbox](https://www.ssbwiki.com/Hurtbox) |
| Per-move hurtbox states | Single parts turn intangible or invincible per frame: Mario's head during up smash, Ridley's wing, head and arm during up tilt | A strike that visibly connects passes through or is absorbed; the state is shown only in Training Mode (blue intangible, green invincible) | [SmashWiki Hurtbox](https://www.ssbwiki.com/Hurtbox), [Training Mode](https://www.ssbwiki.com/Training_Mode) |
| Hitbox interpolation | A hitbox occupies its current position, its position one frame earlier "and all the space in between (in a straight line, regardless of what the animation might look like during intervening subframes)" | An arcing swing hits along the chord between frames, not the drawn arc; the reach a player saw on screen is not the volume that was tested | [SmashWiki Hitbox](https://www.ssbwiki.com/Hitbox) |
| Hurtboxes do not interpolate | Only the hitbox is swept | A fast-moving fighter can pass through a slow hitbox it visibly crossed | [SmashWiki Hurtbox](https://www.ssbwiki.com/Hurtbox) |
| Stretched hitboxes | From Brawl, some moves stretch rather than interpolate (Zero Laser, Aura Storm) | Long beams occupy their whole extent at once | [SmashWiki Hitbox](https://www.ssbwiki.com/Hitbox) |
| Hit-pose switch ("hurtbox shifting") | A fighter hit in one pose enters its hit animation during hitlag, so a paused or slowed frame shows the attack's hitbox far from the body it hit; "especially prominent in Ultimate with the addition of Special Zoom and Finish Zoom", which slow time and zoom on the hit | The replay a player studies after losing shows a body that was not where the hit was tested | [SmashWiki Hurtbox](https://www.ssbwiki.com/Hurtbox), [Special Zoom](https://www.ssbwiki.com/Special_Zoom), [CaptainTechnicality](https://captaintechnicality.wordpress.com/2023/07/13/the-de-evolution-of-hurtboxes-in-fighting-games/) |
| Glancing blows | A hitbox less than 0.1 units through a hurtbox counts as no hit, with a spark and sound but no damage or hitlag (unchanged from Brawl in Smash 4 and Ultimate) | A move that visibly touches does nothing | [SmashWiki Phantom hit](https://www.ssbwiki.com/Phantom_hit) |
| Hitbox stack | When several hitboxes of one move connect on one frame, the lowest ID wins | Which part of a move hit (sweet or sour) depends on an invisible order, not only on where it touched | [SmashWiki Hitbox](https://www.ssbwiki.com/Hitbox) |
| Close-range lock | Fighters cannot run through each other (Charliedaking's "can't run past people") | Exchanges happen at the distances where idle-pose detail decides grabs | [Dexerto](https://www.dexerto.com/smash/smash-ultimate-pro-reveals-dogst-hitboxes-that-need-updating-for-next-game-1655706/) (secondary) |
| No hurtbox display | Training Mode colours intangible and invincible states; the community Training Modpack visualizes "hitboxes and grabboxes" only | Players learn hurtbox shapes from wiki images and losses, not from the game | [SmashWiki Training Mode](https://www.ssbwiki.com/Training_Mode), [UltimateTrainingModpack](https://github.com/jugeeya/UltimateTrainingModpack) |

### Is any of it random?

Collision is not. Hurtbox selection, interpolation, glancing blows and the
hitbox stack are deterministic functions of the frame; Ultimate replays store a
seed rather than every random outcome
([SmashWiki Randomness](https://www.ssbwiki.com/Randomness)). Real randomness
in Ultimate is in specific moves: Hero's smash attacks have a 1/8 chance of a
critical hit with double damage and knockback, Command Selection draws four of
21 spells, Whack and Thwack can KO instantly with a percent-dependent chance,
Mr. Game & Watch's Judge draws 1 to 9 (never the same number twice in a row),
and Luigi's Green Missile misfires one time in ten (same source). Idle poses
"play at random if a character stands still for a length of time"
([SmashWiki Wait](https://www.ssbwiki.com/Wait)); because hurtboxes follow the
bones, such a pose moves the hurtbox, which is the one path from a random draw
into collision (an inference from the two cited facts, not a measured case).
The "played right, still lost" reports above are about deterministic rules
that players cannot see, not about chance.

## Why Ultimate shows it more than Melee

Melee has the same collision model: bone-attached capsules with per-part states
and swept hitboxes against static hurtboxes (below). The difference lies in
what surrounds it:

- **Presentation of the hit.** Special Zoom and Finish Zoom slow and enlarge
  the hit moment, so the hit-pose switch is shown to every viewer
  ([SmashWiki Hurtbox](https://www.ssbwiki.com/Hurtbox)).
- **More contact at close range.** The quoted pro ties grab whiffs to fighters
  being unable to pass each other; Ultimate also adds 4 frames to a shield grab
  after blocking ([SmashWiki OoS](https://www.ssbwiki.com/OoS)), which pushes
  punishes toward spaced attacks where body detail matters.
- **Glancing-blow band.** Ultimate's threshold is 0.1 units, ten times Melee's
  0.01 ([SmashWiki Phantom hit](https://www.ssbwiki.com/Phantom_hit)).
- **Random moves in the cast.** Hero adds critical hits, random spells and
  instant KOs to a cast that already had Judge and misfires; the 2021
  complaint quotes a set lost to a Hero. Melee's random moves are fewer
  (below).
- **Roster size and model detail.** About 90 fighters, each with its own
  animation-driven hurtboxes and no in-game display, leave players to learn
  each one's shapes by losing (EventHubs and the Training Mode entries above;
  this connection is the commenters', not a measured count).

## Melee's comparable cases

From the decompilation at revision 0296f009f32f710495979d30772d8332af2d411a
(read-only reference; facts only, no implementation copied) and SmashWiki:

- **Same structure.** A fighter carries up to 15 hurt capsules
  (melee:src/melee/ft/types.h, `hurt_capsules[15]`), each attached to a bone
  with two offsets and a scale, a state (enabled, disabled, intangible), a
  low/mid/high height and a grabbable flag (melee:src/melee/lb/types.h,
  `HurtCapsule`, `FighterHurtCapsule`).
- **Swept hitbox, static hurtbox.** The hit capsule keeps its previous and
  current position (`HitCapsule` +0x58 and +0x4C; ftcoll.c copies the current
  into the previous on reset), and the hit-against-hurt test takes both
  against the hurt capsule's two current endpoints
  (melee:src/melee/lb/lbcollision.c, calls to `lbColl_80006E58`).
- **Phantom hits.** A hitbox less than 0.01 units through a hurtbox is a
  phantom hit; Jigglypuff's Rest is the famous case, where a phantom hit lets
  the victim survive ([SmashWiki Phantom hit](https://www.ssbwiki.com/Phantom_hit)).
- **Hurtbox shifting through hitlag.** The pose switch exists in Melee too;
  without zoom it shows only when a player pauses during hitlag
  ([SmashWiki Hurtbox](https://www.ssbwiki.com/Hurtbox)).
- **Random moves.** Judge draws one of nine with equal chance and never the
  last two numbers; Green Missile misfires one time in eight; Peach's forward
  smash draws one of three weapons; turnips have random faces and rare items
  ([SmashWiki Randomness](https://www.ssbwiki.com/Randomness)).
- **Exposed body under the shield.** A shrinking shield exposes hurtboxes to
  pokes in both games ([SmashWiki Shield](https://www.ssbwiki.com/Shield));
  Melee's analog light shield adds a player-controlled size
  ([Melee defence](melee/defense.md)).

## Smashcraft's current collision, for comparison

Described, not judged; the source is smashcraft:docs/hurtboxes.md.

- A fighter's body is a short list of authored capsules chosen from replay
  state (character, kit, attack style and frame, crouch, facing). Standing,
  movement and idle share one body; crouch has its own; attacks list poses by
  frame range. Nothing random selects a body.
- A pose replaces the previous body on its first frame: the body changes in
  steps at authored frame boundaries, not continuously.
- Strikes are authored capsules per frame range (the swept path is part of the
  authored capsule, not interpolated from a previous frame); the fighter's own
  movement between frames is not swept.
- Simultaneous strikes resolve from the same pre-contact state
  ([gameplay design decisions](../gameplay-design.md#attack-geometry-and-commitment)).
- `bun wisp view hurtboxes` draws the volumes over the skinned model and prints
  per-frame coverage both ways; the shipped game shows no volumes.

# Platform-fighter design language

How platform fighters (Smash, Rivals of Aether, Slap City, Brawlhalla and
their relatives) extend or twist the language of
[traditional fighting games](fighting-games.md), and the reasons designers and
analysts give. It is descriptive and sourced and states no preference.

- Melee's own numbers, patterns and jank: the Melee case study
  ([#65](https://github.com/tompassarelli/smashcraft/issues/65)).
- Mechanics later platform fighters added or changed (perfect shield on
  release, air-dodge limits, rage, ledge trumping, parry buttons, wall jumps):
  [modern platform fighters](modern-platform-fighters.md).
- Tech windows, buffers and reaction limits: [execution windows](execution-windows.md).
- Smashcraft's computed interaction graph:
  [#67](https://github.com/tompassarelli/smashcraft/issues/67).
- Smashcraft's decisions: only [gameplay design decisions](../gameplay-design.md).
  Its implementation: [physics](../physics.md), [move data](../move-data.md),
  [move comparisons](../move-comparisons.md).

A frame is 1/60 s. Sources were retrieved on 2026-10-06. SmashWiki pages state
rules per game; where a number is specific to one game, the game is named.

## What changes from traditional fighters

| Traditional fighters | Platform fighters |
|---|---|
| Health bar | Percent that raises knockback; a stock ends at a blast zone |
| Directional block, high/low/left/right | A shield bubble that blocks every direction, plus dodges |
| Throws beat block | Grabs beat shield; attacks beat grabs |
| Corner | Ledge and offstage |
| Knockdown and okizeme | Techs, tech chases, ledge options |
| Combos from hitstun tables | Combos that depend on percent, weight, fall speed and the victim's DI |

- Sakurai: "Super Smash Bros. is all about knockback, so the knockback systems
  are very detailed"
  ([Knockback in Super Smash Bros.](https://www.youtube.com/watch?v=HVktK4a9Yfo),
  2023, description).
- Sirlin notes that "fighting games with ring out such as Virtua Fighter and
  Soul Calibur are especially good at avoiding slippery slope properties"
  ([Slippery Slope and Perpetual Comeback](https://www.sirlin.net/articles/slippery-slope-and-perpetual-comeback)).
  Percent changes how far a fighter flies, not which moves it has, and a stock
  ends only at a blast zone.
- Smash's percent knockback (Melee's formula is in [physics](../physics.md),
  "Hit timing and knockback") and Rivals of Aether's
  (knockback = base + scaling × percent after hit × knockback adjust × 0.12;
  [Rivals Academy glossary](https://rivals.academy/library/glossary/)) both
  grow linearly with percent, so the same move is a combo starter at low
  percent and a finisher at high percent.

## Shield as a universal block

- **What it blocks.** A shield blocks everything except grabs, unblockable
  moves and Final Smashes; it drains while held and when hit, regenerates when
  released, shrinks as it drains so attacks can poke the exposed body (a
  shield poke), and breaks into a long stun when empty. Tilting the stick
  shifts it to cover a direction. Shield health and rates per game: Melee 60
  (drain 0.28 per frame, regeneration 0.07), Smash 4 50 (0.13 / 0.08),
  Ultimate 50 (0.15 / 0.08). Melee alone has the analog light shield, which is
  wider and shrinks more slowly but takes more shieldstun and pushback
  ([SmashWiki Shield](https://www.ssbwiki.com/Shield)).
- **Out of shield (OoS).** After shieldstun the defender acts from shield:
  roll, spot dodge, jump (then any aerial) and grab directly; other attacks
  only after dropping shield, which takes 15 frames in Melee, 11 in 64 and
  Ultimate, and 7 in Brawl and Smash 4. Ultimate makes jump squat 3 frames for
  almost everyone, allows up special and up smash directly from shield, and
  adds 4 frames to a shield grab right after blocking
  ([SmashWiki OoS](https://www.ssbwiki.com/OoS)). A traditional block leaves
  the whole moveset available once blockstun ends; a shield's exits are these
  options or the shield-drop delay.
- **Shieldstun is a designed per-class number.** Melee digital:
  (damage × 0.45 + 2) × 200/201 ([physics](../physics.md)); Ultimate:
  0.8 × damage × t × m × p + 2, with t = 0.725 for smash attacks, 0.33 for
  aerials, 1 otherwise, p = 0.29 for projectiles, capped at 60
  ([SmashWiki Shieldstun](https://www.ssbwiki.com/Shieldstun)). Ultimate thus
  gives an aerial a third of the shieldstun a ground move of the same damage
  gets; Melee uses one formula for both.
- **Shield advantage.** "The difference (in frames) between when the attacker
  can perform an option and when the shielding opponent can perform an OoS
  option"; high shieldstun and low ending lag give advantage
  ([SmashWiki OoS](https://www.ssbwiki.com/OoS)). The arithmetic of
  [fighting games](fighting-games.md#frame-advantage-safety-and-punishes)
  applies with each OoS option's real startup: shield-drop or jump-squat frames
  plus the move's own startup, and its reach after pushback. Z2G's Smash 4
  safety charts compare move frame data against each character's OoS options
  this way, setting pushback and spacing aside
  ([SSBWorld, 2017](https://ssbworld.com/blog/40/breaking-down-safe-on-shield)).
- **Designers who removed or kept the shield.** Rivals of Aether removed
  shields with grabs: "Once we eliminated grabs, we had to remove shields. We
  essentially removed rock-paper-scissors from a fighting game." Its parry
  (2 startup, 8 active, 20 recovery) served "a focus on offensive combat"
  (Dan Fornace, [Gameverse interview, 2015](https://gameverse.com/2015/12/01/dan-fornace-talks-rivals-of-aether/)).
  Rivals 2 restored shields because they are "familiar to fans of the genre
  and easier to use at beginner levels than the Rivals of Aether parry", and
  grabs "because they counter shields"; it dropped Rivals 1's extra recovery
  on whiffed attacks because shields already let players "defend against spam
  with much less risk" ([Rivals 2 FAQ](https://rivals2.com/faq)). In Rivals 1
  that whiff penalty multiplied flagged windows by 1.5 and aerial landing lag
  by 1.5 on a miss ([Rivals attack grid](https://rivalsofaether.com/attack-grid-indexes/)).
  Brawlhalla and MultiVersus also have no shield
  ([modern platform fighters §11](modern-platform-fighters.md#11-shield-removal-rivals-1-brawlhalla-multiversus)).

## Tilts and aerials instead of high and low

A shield needs no guard direction, so the traditional high/low and left/right
guesses lose most of their force. The guessing moves elsewhere:

- **Grab or hit.** Grabs beat shield, attacks beat grabs, shield beats
  attacks. Ultimate's spirit types restate the triangle: "Attack has an
  advantage over Grab, Grab has an advantage over Shield, and Shield has an
  advantage over Attack" ([SmashWiki Spirit](https://www.ssbwiki.com/Spirit)).
  When a grab and a hitbox connect on the same frame, Melee gives the grab
  priority and Smash 4 onward the hitbox
  ([SmashWiki Priority](https://www.ssbwiki.com/Priority)).
- **Empty hop.** A jump that lands without attacking baits a shield raised
  for the expected aerial, then grabs (the "tomahawk";
  [SmashWiki Tomahawk](https://www.ssbwiki.com/Tomahawk)).
- **Side.** A cross-up that ends behind the shield cannot be shield-grabbed,
  though some out-of-shield moves hit behind faster, and repeated cross-ups
  leave the attacker exposed ([SmashWiki Crossup](https://www.ssbwiki.com/Crossup)).
- **Height and shrink.** The residue of high/low is the shield's geometry:
  a shrunken or tilted shield exposes parts of the body to shield pokes
  ([SmashWiki Shield](https://www.ssbwiki.com/Shield)).
- **Space covered.** Tilts are quick grounded pokes whose direction (forward,
  angled up or down, up, down) decides which space they cover; the height
  question becomes which region a move protects (an anti-air above, a low
  poke in front), not which stance blocks it.
- **Timing.** Rising or falling, early or late, fast-fall or not: "An early,
  FF Uair as Marth may cover the same drill timing as a late non-FF Uair"
  (Rishi, [The Art of Aerial Drift](http://dignitas.gg/articles/blogs/smash/12371/the-art-of-aerial-drift),
  Melee, 2018).

## Aerials on shield: spaced, advancing, fade-back, fade-forward

An aerial's outcome on shield depends on its shieldstun, the frames between
contact and landing, its landing lag, pushback, the attacker's drift in that
time, and the reach and side of the defender's OoS options.

- **Spaced.** Contact from the tip or a disjoint at a distance the defender's
  OoS options cannot reach after pushback; the safety comes from distance,
  not frames ([SmashWiki Spacing](https://www.ssbwiki.com/Spacing) names the
  related threat bubble and whiff punish).
- **Advancing (unspaced).** Landing in front of the shield; the safety is pure
  frame arithmetic, shieldstun against time to land plus landing lag, and the
  fastest OoS option (often grab or a jump-cancelled aerial) decides it.
- **Fade-back.** Drifting away after contact widens the gap and baits an OoS
  option into whiffing: "You can fadeback aerials, thereby baiting Marth into
  punishing where Fox might otherwise go" (Rishi,
  [The Art of Aerial Drift](http://dignitas.gg/articles/blogs/smash/12371/the-art-of-aerial-drift)).
- **Fade-forward (cross-up).** Drifting through to land behind denies the
  shield grab and can punish the defender's OoS movement: "an early, non-FF
  aerial cross-up and punish their movement out-of-shield"; or waiting "until
  you're almost past their shield" for a "safe FF aerial to begin 'safe'
  shield pressure" ([same article](http://dignitas.gg/articles/blogs/smash/12371/the-art-of-aerial-drift);
  [SmashWiki Crossup](https://www.ssbwiki.com/Crossup)).
- **Spacing zones.** N.M. Whittier divides Melee neutral into zones by "the
  edge of where one is threatened by the opponent's most conventional
  immediate approach option", with baits worth more at longer range where
  whiff punishing is less tight
  ([Neutral Spacing, 2022](https://nmwhittier.wordpress.com/2022/10/30/leveraging-and-avoiding-baits-part-2-neutral-spacing/)).
- **Landing lag is the aerial's recovery.** Melee's L-cancel halved it on
  input; Rivals adds lag only on whiff; Smashcraft's choice is in
  [gameplay design decisions](../gameplay-design.md#l-cancelling); other games'
  alternatives are in [modern platform fighters §15](modern-platform-fighters.md#15-landing-lag-alternatives-to-l-cancel).

## Clank, trade and grab priority

- **Clank.** When two ground attacks' hitboxes meet and their damage differs by
  9% or less (10% in Smash 64), both rebound; with a larger difference the
  stronger continues and the weaker rebounds. Melee rebound lasts
  ⌈0.559 × (damage + 10)⌉ frames; Smash 4 ⌊(damage + 4) × 15/8⌋, capped at 58 in
  Ultimate ([SmashWiki Priority](https://www.ssbwiki.com/Priority)).
- **Aerials trade.** Normal aerials do not clank with ground attacks or other
  aerials; both hitboxes persist and both can hit. Aerials can clank with
  projectiles but do not rebound. Transcendent hitboxes never clank
  ([SmashWiki Priority](https://www.ssbwiki.com/Priority)).
- **Grabs.** In Smash 64 and Melee a grab wins against a hitbox; from Smash 4 a
  hitbox beats a grab ([SmashWiki Priority](https://www.ssbwiki.com/Priority)).

## Ledge play

- **The ledge is the platform fighter's corner and wakeup.** A fighter hanging
  on the ledge can climb, attack, roll, jump or drop; ledge-trapping covers six
  exits (getup, getup attack, roll, jump, drop and aerial, staying)
  ([SmashWiki Ledge](https://www.ssbwiki.com/Ledge)), the counterpart of
  okizeme's limited wakeup choices.
- **Intangibility on grab.** Melee: 30 frames after the 7-frame grab
  animation; Brawl: 23 after 23; Smash 4 and Ultimate: by airtime and damage,
  23 to 123 frames. A fighter is hittable for exactly two frames after
  catching the ledge before intangibility starts, which edgeguarders exploit
  ("two-framing") ([SmashWiki Ledge](https://www.ssbwiki.com/Ledge)).
- **Occupancy.** Melee and Brawl let a fighter on the ledge deny it to a
  recovering opponent (edgehogging); Smash 4 and Ultimate let the second
  fighter take it (trumping), and Ultimate caps regrabs at six per airtime
  with shrinking intangibility ([SmashWiki Ledge](https://www.ssbwiki.com/Ledge);
  [modern platform fighters §9](modern-platform-fighters.md#9-ledge-rules-edgehogging-ledge-trumping-ledge-decay)).
- **No ledge at all.** Rivals of Aether 1 removed ledge grabs, after Fornace's
  competitive Brawl experience, in favour of one wall jump per airtime, usable
  even from helpless fall; Rivals 2 brought ledges back as "intuitive for new
  players and familiar for veterans"
  ([Gameverse](https://gameverse.com/2015/12/01/dan-fornace-talks-rivals-of-aether/),
  [Rivals 2 FAQ](https://rivals2.com/faq)).

## DI and SDI

- **DI.** Holding the stick during hitlag rotates the launch angle, up to
  about 18° in Melee and 0.17 rad (about 9.74°) in Smash 4 and Ultimate. Victims
  use combo DI at low percent to escape follow-ups and survival DI toward the
  upper corners at high percent ([SmashWiki DI](https://www.ssbwiki.com/Directional_influence)).
  Ultimate adds launch speed influence ([modern platform fighters](modern-platform-fighters.md)).
- **DI mixups.** Because the attacker cannot know the DI in advance, follow-ups
  become guesses: attackers "throw out an unexpected move which punishes the
  player for their DI", most often horizontal moves
  ([SmashWiki DI](https://www.ssbwiki.com/Directional_influence)). The victim's
  input is a choice against the attacker's choice, not a solo execution test.
- **SDI and ASDI.** Stick inputs during hitlag shift the victim: 6 units per
  input in Melee (ASDI 3, once, after hitlag). A move with under two frames of
  hitlag cannot be SDI'd; multi-hit moves are easiest to escape because each
  hit adds hitlag. Brawl sets per-move SDI multipliers from 0 to 1.5
  ([SmashWiki SDI](https://www.ssbwiki.com/Smash_directional_influence)); Rivals
  hitboxes carry drift-DI and SDI multipliers
  ([Rivals hitbox grid](https://rivalsofaether.com/hitbox-grid-indexes/)).
  Melee's SDI extremes are part of the case study
  ([#65](https://github.com/tompassarelli/smashcraft/issues/65)); Smashcraft's
  bounded design is [#70](https://github.com/tompassarelli/smashcraft/issues/70).

## Tech chases

- **Teching.** A timed press before hitting the floor lets a tumbling fighter
  stand in place or roll left or right instead of being knocked down; Melee's
  window is 20 frames with a 40-frame lockout after hitlag, so mashing does not
  work; the tech animations end with a few vulnerable frames (6 for most of
  Melee's cast) ([SmashWiki Tech](https://www.ssbwiki.com/Tech); other games in
  [execution windows](execution-windows.md)).
- **Missed tech.** The fighter lies down and chooses among getup, getup attack
  and getup rolls, or stays and risks jab resets (Smashcraft's version:
  [physics](../physics.md), "Grounded knockdown and jab resets").
- **Tech chasing** follows or predicts the tech: "it is possible to read (or, in
  some cases, react to) the direction of a player's tech and punish them." It
  is "less effective in SSB4 and Ultimate because the duration of tech
  rolls … has been reduced, giving less time for the tech-chasing player to
  react" ([SmashWiki Tech-chasing](https://www.ssbwiki.com/Tech-chasing)). The
  length and visual distinctness of each option decide whether the chase is a
  reaction test or a read, against the reaction figures in
  [execution windows](execution-windows.md).

## Launchers and follow-ups

- **Combos.** A true combo keeps the victim in hitstun; other strings leave
  escape windows that DI or techs exploit. What decides a follow-up is hitstun
  against the attacker's recovery, knockback (distance), the victim's weight
  and fall speed, the percent window and the victim's DI and tech
  ([SmashWiki Combo](https://www.ssbwiki.com/Combo)). Reach after the launch is
  the second condition, as in [fighting games](fighting-games.md#frame-advantage-safety-and-punishes).
- **Hitstun scales with knockback.** Melee: floor(0.4 × knockback)
  ([physics](../physics.md)). Rivals: hitstun multiplier × (base knockback ×
  (knockback adjust × 2.4 + 1.6) + scaling × percent after hit × knockback
  adjust × 0.312), rounded up
  ([Rivals Academy glossary](https://rivals.academy/library/glossary/)).
- **Hitstun level shapes the whole game.** Smash 64's high hitstun gave "every
  character … a confirmed zero-death combo"; Melee's lower hitstun and DI made
  combos harder; Brawl's air dodge out of hitstun reduced them to locks,
  infinites and chain grabs; Ultimate raised combo potential again with faster
  fall speeds ([SmashWiki Combo](https://www.ssbwiki.com/Combo)).
- **Juggles.** A juggled fighter escapes with DI, air dodge and fall-breaking
  moves, and escapes more easily at higher percent because knockback grows
  ([SmashWiki Juggle](https://www.ssbwiki.com/Juggle)).
- **Launcher into situation.** A launch often leads not to a true combo but to a
  situation with a short option list: a tech chase on landing, a juggle, a
  ledge, an edgeguard. These are the platform-fighter analogue of a knockdown
  into okizeme.
- **Designed out.** Slap City's designers: "Chaingrabs and moves that combo
  easily and infinitely into themselves are no fun", and an infinite that
  remains was missed ([Slap City design blog](https://slapcity.se/blogs/design)).

## Edgeguarding and recovery mixups

- **Edgeguarding** keeps an offstage opponent from returning: jumping off to
  intercept (risky), holding the ledge, covering from the stage with strong
  ground moves (safest), or projectiles from the edge
  ([SmashWiki Edge-guarding](https://www.ssbwiki.com/Edge-guarding)).
- **Recovery quality.** Distance, the number of tools (mid-air jumps, recovery
  moves), hitboxes, disjoints, armor or invincibility on the recovery move,
  startup, ledge sweet-spot size, and above all predictability: a single
  "effective but predictable" route is easy to edgeguard
  ([SmashWiki Recovery](https://www.ssbwiki.com/Recovery)).
- **High/low returns offstage.** The recovering fighter mixes high against low,
  ledge against stage, and the timing of jumps and air dodges, while the
  edgeguarder chooses which route to cover. This is where the platform fighter
  restores the traditional fighter's high/low guess, with a stock at stake.
- **Ultimate shrank ledge sweet spots**, making recovery harder and
  edgeguarding easier ([SmashWiki Edge-guarding](https://www.ssbwiki.com/Edge-guarding)).

## Weight, fall speed and archetypes

- **Weight** resists knockback. Heavy fighters survive longer but some throws
  and chain grabs work differently on them; light fighters escape combos
  earlier but die earlier, and the KO effect dominates. Melee spans 55 (Pichu)
  to 117 (Bowser); Ultimate 62 to 135 (average about 96)
  ([SmashWiki Weight](https://www.ssbwiki.com/Weight)).
- **Fall speed.** Fast fallers (Melee's Falco 3.1 units per frame) approach
  quickly but have shorter recoveries and suffer more from chain grabs and
  combos; floaty fighters (Jigglypuff 1.3) chain aerials, recover easily, but
  are juggled and killed off the top earlier
  ([SmashWiki Falling speed](https://www.ssbwiki.com/Falling_speed)).
- **Archetype names.** Smash's own archetype word is the "space animal" (Fox
  and Falco) ([Infil Archetype](https://glossary.infil.net/?t=Archetype));
  the traditional archetypes are in [fighting games](fighting-games.md#character-archetypes-and-trade-offs).
- **Identity per character.** Fornace describes Rivals movesets as designed
  holistically so that each character has its own identity
  ([Gameverse](https://gameverse.com/2015/12/01/dan-fornace-talks-rivals-of-aether/));
  Sakurai's view that each fighter needs strong points the others counter is in
  [fighting games](fighting-games.md#character-archetypes-and-trade-offs).

## The interaction graph

Rock-paper-scissors is the smallest case: three options, each beaten by
exactly one other, equal payoffs. A fighting game is a real-time,
many-option relative of it:

- **Gingold** argues "competitive fighting games, such as Capcom's Street
  Fighter II, are indeed also variants of Rock, Paper, Scissors", and later
  states the design rule that "the graph of player choices … should contain no
  sinks whatsoever (sources are OK)": no choice may go unbeaten
  ([From Rock, Paper, Scissors to Street Fighter II, ACM Sandbox 2006](https://cragl.cs.gmu.edu/rps/)).
- **Sirlin** calls a dominant move the worst thing in a competitive game and
  requires counters to counters up to yomi layer 3
  ([viable options](https://www.sirlin.net/articles/balancing-multiplayer-games-part-2-viable-options),
  [Playing to Win, ch. 7](https://www.sirlin.net/ptw-book/7-spies-of-the-mind)).
- **Unequal payoffs** change how often each option is right: the arithmetic of
  a mixup and Schreiber's weighted rock-paper-scissors are in
  [fighting games](fighting-games.md#the-arithmetic-of-a-mixup).
- **Tuning to remove a sink.** Rivals 2 made the parry's startup slower, which
  "prevents it from always being the best way out of shield pressure", and
  values shields because they give "multiple options each with their own
  counters" ([Rivals 2 FAQ](https://rivals2.com/faq)).

In a platform fighter the graph is larger and conditional:

- **Nodes are situations,** not single choices: neutral at a given spacing,
  shield pressure after a given aerial, the ledge, a knockdown, a juggle at a
  given height, an offstage recovery.
- **Each situation is a table of option pairs.** Attacker options (spaced,
  advancing, fade-back or fade-forward aerial, empty hop and grab, tilt, wait)
  against defender options (shield and each OoS option, spot dodge, roll,
  jump, parry, retreat). Each cell holds an outcome and its reward.
- **Edges carry conditions.** Whether A beats B depends on spacing, side,
  frame windows, percent, weight and the victim's DI. The same pair can flip
  between situations, which is why a single triangle no longer describes the
  game.
- **Outcomes are situations.** A won exchange leads to damage plus a new
  situation (tech chase, ledge, juggle, edgeguard) or back to neutral, so value
  propagates along the graph.
- **Option selects and reactable options remove branches.** An option select
  covers two branches with one input
  ([fighting games](fighting-games.md#option-selects)); an option slow enough to
  react to becomes a check rather than a guess
  ([Infil Reactable](https://glossary.infil.net/?t=Reactable),
  [execution windows](execution-windows.md)).

### Measuring outcomes

Project Slippi's replay statistics for Melee measure the graph's results from
play ([slippi-js stats](https://github.com/project-slippi/slippi-js/tree/master/src/common/stats)):

- an **opening** (conversion) starts when a player damages or grabs the
  opponent and ends when the opponent has been actionable for more than 45
  frames or loses the stock;
- **openings per kill** and **damage per opening** summarize how much each
  won exchange is worth;
- openings are classed as **neutral wins**, **counter-attacks** (starting while
  the opponent's own opening was in progress) or **trades** (both at once),
  giving a neutral win ratio, counter-hit ratio and beneficial-trade ratio.

## Open design questions for the owner

One line each, neutral; the options are those the sources above describe.

- Shield geometry: a shrinking bubble that can be poked and tilted (Melee), a fixed bubble, or no shield (Rivals 1, Brawlhalla)?
- Aerial shieldstun: the same formula as ground moves (Melee) or reduced for aerials (Ultimate t = 0.33)?
- Whiff penalty: extra recovery or landing lag only on a miss (Rivals 1 × 1.5, Street Fighter 6 patches), or none?
- Cross-ups: out-of-shield options face the original side only, or some (or all) reach behind?
- Grab against hitbox on the same frame: grab wins (Melee) or hitbox wins (Smash 4, Ultimate)?
- Clanking: Smash's 9% rebound rule for ground attacks, aerials always trade, or a different rule?
- Ledge: a two-frame vulnerability before intangibility, or intangible from the first frame?
- DI strength: Melee's 18°, Smash 4 and Ultimate's 9.74°, or another bound?
- Tech chases: tech rolls long and distinct enough to chase on reaction (Melee), or short enough to need reads (Ultimate)?
- Launchers: does every fighter need a launcher into a follow-up situation (tech chase, juggle, ledge), or is that per fighter?
- Recovery: a minimum number of distinct recovery routes per fighter (high/low, ledge/stage, timing), or none?
- Physical spread: the roster's weight and fall-speed ranges (Melee spans weight 55–117, fall speed 1.3–3.1)?
- Interaction graph: which properties to require per situation (no sink, a minimum option count, payoff ratios), measured by #67?

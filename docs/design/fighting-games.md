# Fighting-game design language

The vocabulary and arithmetic that traditional fighting games (Street Fighter,
Guilty Gear, Tekken and their relatives) use to describe moves, spacing,
guessing games, collision volumes and characters, with the reasons designers
and analysts give for them. It is descriptive and sourced and states no
preference.

- How platform fighters extend or twist this language:
  [platform-fighter design language](platform-fighters.md).
- Melee's own numbers and patterns: the [Melee case study](melee/README.md).
- Mechanics later platform fighters added:
  [modern platform fighters](modern-platform-fighters.md).
- Human reaction and execution limits:
  [execution windows](execution-windows.md).
- Smashcraft's decisions: only [gameplay design decisions](../gameplay-design.md).
  Its implementation: [physics](../physics.md), [move data](../move-data.md),
  [move comparisons](../move-comparisons.md).

A frame is 1/60 s. Sources were retrieved on 2026-10-06. "Infil" is Infil's
[Fighting Game Glossary](https://glossary.infil.net/), a community reference;
its entries are linked as `?t=Term`. Where an article was reached only through a
summary or a secondary transcription, the entry says so.

## Anatomy of a move

- **Startup, active, recovery.** Startup is the windup before the move can
  touch the opponent; active frames are those in which a hitbox exists;
  recovery is the follow-through until the attacker can act again
  ([Infil Startup](https://glossary.infil.net/?t=Startup),
  [Active](https://glossary.infil.net/?t=Active),
  [Recovery](https://glossary.infil.net/?t=Recovery)). Many communities count
  the first active frame inside startup, so "8-frame startup" means it hits on
  its 8th frame and punishes anything at −8 or worse
  ([Infil Startup](https://glossary.infil.net/?t=Startup)). State the
  convention whenever frame numbers are compared; Smashcraft's own export
  counts zero-based ([move data](../move-data.md)).
- **Hitstop.** On contact both fighters freeze briefly for impact; those frames
  sit outside startup, active and recovery
  ([Infil Hitstop](https://glossary.infil.net/?t=Hitstop)). Sakurai demonstrates
  its effect on impact and lists the hitstop techniques Smash Ultimate uses in
  [Eight Hit Stop Techniques](https://www.youtube.com/watch?v=tycbMSjDDLg)
  (2022) and [Stop for Big Moments!](https://www.youtube.com/watch?v=OdVkEOzdCPw).
- **Lead-in and follow-through.** Sakurai's animation episodes split an attack
  into lead-in, attack and follow-through: the lead-in must read as instant
  and impactful, and the follow-through (the recovery) can be surprisingly
  long ([Breaking Down Attack Animations](https://www.youtube.com/watch?v=LewXWM7HDd8),
  [Making Lead-ins Instant and Impactful](https://www.youtube.com/watch?v=E8DKndKkHw8),
  [Follow-Throughs Make the Impact](https://www.youtube.com/watch?v=cIB0BUe6Ihk);
  claims from the video descriptions).
- **Hitstun and blockstun.** The time the defender cannot act after being hit
  or after blocking. Pushback moves the attacker away on hit or block; a move
  that is punishable by the numbers can be safe because nothing reaches after
  pushback ([Infil Pushback](https://glossary.infil.net/?t=Pushback)).

## Frame advantage, safety and punishes

Measure from the end of hitstop (both fighters freeze for the same number of
frames in the usual case). Let the defender's stun last S frames and the
attacker need R frames (remaining active plus recovery) to act again. The
**frame advantage** is A = S − R: positive is "plus", negative "minus"
([Infil Frame Advantage](https://glossary.infil.net/?t=Frame%20Advantage),
[Plus](https://glossary.infil.net/?t=Plus)).

With the double-counting convention above:

- **Punish.** At A = −P, any defender move with startup s ≤ P that also reaches
  across the post-pushback distance hits before the attacker can act.
  **Safe** means no such move exists: the gap is smaller than the opponent's
  fastest reaching move, so a move can be minus and still safe
  ([Infil Safe](https://glossary.infil.net/?t=Safe),
  [Punish](https://glossary.infil.net/?t=Punish)).
- **Frame trap and blockstring.** At A > 0, the attacker's next move of
  startup s₂ lands on the defender's (s₂ − A)-th actionable frame. It beats any
  defender attack slower than that, trades with an equal one, and loses only to
  faster moves or to invincibility. s₂ − A ≤ 0 means the defender is still in
  stun (a blockstring); a small positive value is a frame trap
  ([Infil Frame Trap](https://glossary.infil.net/?t=Frame%20Trap)).
- **Reach is a second condition.** Timing alone does not make a punish or a
  link; the follow-up must also reach. Smashcraft's comparison fixtures
  separate "timing window but reach miss" from reachable punishes for this
  reason ([move comparisons](../move-comparisons.md)).
- **Hit confirm.** A player checks that the first hit landed before committing
  to a follow-up that would be unsafe on block
  ([Infil Hit Confirm](https://glossary.infil.net/?t=Hit%20Confirm)). Whether a
  confirm is humanly possible depends on the hitstun window against reaction
  time ([execution windows](execution-windows.md)).
- **Counter hit.** Hitting an opponent during their startup; many games add
  damage or stun, which can enable combos that need the counter hit
  ([Infil Counter Hit](https://glossary.infil.net/?t=Counter%20Hit)).

Capcom's balance patches for Street Fighter 6 change exactly these quantities
as their tuning levers: block advantage ("−4 frames to −3"), recovery added
only when a move misses, landing recovery on a whiffed aerial special, knockback
on block, and per-frame hurtbox sizes (Battle Change List of 27 February 2024,
as reproduced by
[Shacknews](https://www.shacknews.com/article/138897/street-fighter-6-battle-change-list-2-27-2024-patch-notes)).

## Highs, mids and lows

- **Definitions.** A low must be blocked crouching, an overhead standing, a
  mid either way; in 2D games most attacks are mids
  ([Infil Low](https://glossary.infil.net/?t=Low),
  [Overhead](https://glossary.infil.net/?t=Overhead),
  [Mid](https://glossary.infil.net/?t=Mid)). In 3D games (Tekken, Virtua
  Fighter) the words shift: a "mid" must be blocked standing and a "high" can
  be ducked ([Infil High](https://glossary.infil.net/?t=High)).
- **Left and right.** A cross-up attacks after switching sides, usually by
  jumping over, so the block direction must flip
  ([Infil Cross-up](https://glossary.infil.net/?t=Cross-up)). Some games accept
  any block when a high and low (or left and right) arrive on the same frame,
  to prevent setups that are unblockable by construction
  ([Infil Unblockable Protection](https://glossary.infil.net/?t=Unblockable%20Protection)).
- **Why overheads are slow.** Grounded overheads work best once the opponent has
  settled into blocking repeated fast lows, and are usually much slower than
  other attacks ([Infil Overhead](https://glossary.infil.net/?t=Overhead)). Reliably
  reacting to about 20 frames of startup is very good play; most attacks are
  far below that, which is why most defence is pre-emptive rather than
  reactive ([Infil Reactable](https://glossary.infil.net/?t=Reactable)).
- **Fuzzy guard.** When a move's low branch hits on frame 20 and its high branch
  on frame 23, blocking low until 20 and then high covers both without a guess;
  it fails if the attacker can delay either branch or if both can hit on the
  same frame ([Infil Fuzzy Guard](https://glossary.infil.net/?t=Fuzzy%20Guard)).
  Timing like this, or a reaction, separates the branches and turns the
  guess into a check.

## Footsies, spacing and whiff punishing

- **Footsies** is the fight for the space in front of each player: getting to
  a range you like and denying the opponent theirs, typically with long,
  low-risk pokes ([Infil Footsies](https://glossary.infil.net/?t=Footsies),
  [Poke](https://glossary.infil.net/?t=Poke),
  [Range](https://glossary.infil.net/?t=Range)).
- **Whiff punishing** hits an attack's recovery after it misses. Walking in to
  invite an attack and stepping back out of its reach is the core footsies
  pattern ([Infil Whiff Punish](https://glossary.infil.net/?t=Whiff%20Punish)).
  A whiff punish needs punisher startup plus travel to fit inside the whiffed
  move's remaining recovery, against whatever hurtbox the whiffing move leaves
  exposed.
- **Hurtbox extension makes whiff punishing possible.** Designers normally put
  hurtboxes in a similar space to an attack's hitboxes, so a whiffed attack
  leaves "something hittable sticking out"
  ([Infil Disjointed Hitbox](https://glossary.infil.net/?t=Disjointed%20Hitbox)).
  Street Fighter 6 tunes this frame by frame: "The size of the feet
  hurtboxes between frames 6 – 24 has been expanded" (Luke's crouching
  medium punch), "The size of the arm hurtbox
  between frames 2 – 6 has been expanded" (Ken's standing light punch)
  ([Shacknews reproduction of Capcom's list](https://www.shacknews.com/article/138897/street-fighter-6-battle-change-list-2-27-2024-patch-notes)).
  Dhalsim's stretching limbs in Street Fighter II created "fishing for a limb",
  counter-poking an extended hurtbox ([CaptainTechnicality, 2023](https://captaintechnicality.wordpress.com/2023/07/13/the-de-evolution-of-hurtboxes-in-fighting-games/)).
- **Zoning and anti-air.** Zoners use long-range attacks to keep the opponent
  out, to provoke a jump that an anti-air then punishes
  ([Infil Zoning](https://glossary.infil.net/?t=Zoning),
  [Anti-Air](https://glossary.infil.net/?t=Anti-Air)).
- **A minimal footsies game.** HiFight's FOOTSIES keeps one ground-based
  character with horizontal movement and one attack button (a standing kick,
  a crouching kick, an uppercut and a donkey kick) and still makes spacing,
  hit confirms and whiff punishes the deciding skills; it ships a hitbox,
  hurtbox and frame-data viewer ([Steam page](https://store.steampowered.com/app/1344740/),
  [EventHubs, 2018](https://www.eventhubs.com/news/2018/jul/12/hifight-develops-his-own-fighting-game-based-around-hit-confirms-fundamentals-and-footsies-called-footsies/)).
  Core-A Gaming discusses accessible reduced games (Divekick, Fantasy
  Strike) as a way to preserve depth
  ([The Simplest Fighting Games](https://www.youtube.com/watch?v=-sUVNqNSo5M),
  from its description).

## Okizeme and the wakeup game

- **Knockdowns.** A hard knockdown fixes the time on the ground and offers no
  wakeup choices; a soft knockdown lets the defender quick-rise or roll and so
  choose when (and sometimes where) to stand
  ([Infil Hard Knockdown](https://glossary.infil.net/?t=Hard%20Knockdown),
  [Soft Knockdown](https://glossary.infil.net/?t=Soft%20Knockdown),
  [Quick Rise](https://glossary.infil.net/?t=Quick%20Rise)).
- **Okizeme** ("oki") is the attacker's offence as the opponent stands; the
  defender's choices are limited, and wakeup describes the same moment from
  the defender's side ([Infil Okizeme](https://glossary.infil.net/?t=Okizeme),
  [Wakeup](https://glossary.infil.net/?t=Wakeup)).
- **Meaty.** An attack timed to be active on the first frame the defender can
  be hit, so any button the defender presses is still in startup; also an
  attack that connects on a late active frame for more advantage
  ([Infil Meaty](https://glossary.infil.net/?t=Meaty)).
- **Reversal and safe jump.** A reversal is a move on the first possible frame
  after stun or knockdown, usually an invincible one such as a dragon punch.
  A safe jump lands a jumping attack so late that, if the defender reverses,
  the attacker lands in time to block
  ([Infil Reversal](https://glossary.infil.net/?t=Reversal),
  [Safe Jump](https://glossary.infil.net/?t=Safe%20Jump)).
- **Vortex.** A mixup whose success leads back into the same mixup, so a wrong
  guess repeats until the defender guesses right
  ([Infil Vortex](https://glossary.infil.net/?t=Vortex)).
- **Slippery slope.** Sirlin notes that Street Fighter's knockdown has "a bit
  of slippery slope", bounded because "you regain all your moves and you
  cannot get doubly knocked down"
  ([Slippery Slope and Perpetual Comeback](https://www.sirlin.net/articles/slippery-slope-and-perpetual-comeback)).

## Strike, throw and block

- **The triangle.** Throws are fast, close-range and unblockable
  ([Infil Throw](https://glossary.infil.net/?t=Throw)); "attacks beat throws,
  throws beat blocks, and blocks beat attacks", each with a different payoff
  ([Schreiber, Game Balance Concepts](https://gamebalanceconcepts.wordpress.com/2010/09/01/level-9-intransitive-mechanics/)).
  Sirlin's Yomi card game resolves the same choices by simultaneous reveal
  ("attack beats throw"; "if you both attack at the same time, the faster one
  wins"), with block and dodge as the defensive cards
  ([Designing Yomi](https://www.sirlin.net/articles/designing-yomi)).
- **Unequal payoffs.** In Yomi the branches pay differently: an attack's combo
  is usually better than a throw's, a block returns cards, a dodge allows one
  counter-attack without a combo. Sirlin wants payoffs that are "extremely
  difficult to compare or even to compute", so that valuation becomes a skill
  ([Designing Yomi](https://www.sirlin.net/articles/designing-yomi)).
- **Counters to counters.** Throw tech escapes a throw; the shimmy walks out of
  throw range to whiff-punish the tech attempt; a tick throw throws after a
  blocked jab ([Infil Throw Tech](https://glossary.infil.net/?t=Throw%20Tech),
  [Shimmy](https://glossary.infil.net/?t=Shimmy),
  [Tick Throw](https://glossary.infil.net/?t=Tick%20Throw)). Throw-invincible
  and fully invincible moves remove one side of the triangle at a cost
  ([Infil Throw Invincible](https://glossary.infil.net/?t=Throw%20Invincible),
  [Invincible](https://glossary.infil.net/?t=Invincible)).
- **Yomi layers.** Sirlin: "there need only be support up to yomi layer 3, as
  yomi layer 4 loops back around to layer 0", illustrated with a Virtua
  Fighter exchange of throw, throw escape, slow strong move and block
  ([Playing to Win, ch. 7](https://www.sirlin.net/ptw-book/7-spies-of-the-mind)).

### The arithmetic of a mixup

A guess between two options is a zero-sum 2×2 game. With no dominant option,
both players mix so that the other is indifferent (the mixed-strategy
equilibrium; [Osborne, ch. 4](https://www.economics.utoronto.ca/osborne/igt/igtChapter4.pdf)).
For attacker options 1, 2 and defender responses 1, 2 with payoffs mᵢⱼ to the
attacker, and D = m₁₁ − m₁₂ − m₂₁ + m₂₂:

- attacker plays option 1 with probability (m₂₂ − m₂₁) / D;
- defender plays response 1 with probability (m₂₂ − m₁₂) / D;
- the attacker's expected reward is (m₁₁·m₂₂ − m₁₂·m₂₁) / D.

For an overhead/low mixup that earns a on a successful overhead, b on a
successful low and 0 when blocked, this gives: overhead with probability
b / (a + b), the defender guarding high with probability a / (a + b), and an
expected reward of ab / (a + b). The larger reward is used less often, and the
mixup is worth less than its smaller branch, at most half its larger one, and
nothing if either branch is worthless. The same method on three options: Ian
Schreiber doubles the payoff of Rock in rock-paper-scissors and finds Rock 1/4,
Paper 1/2, Scissors 1/4,
"unlikely to come up with on your own without doing the math"
([Game Balance Concepts, Level 9](https://gamebalanceconcepts.wordpress.com/2010/09/01/level-9-intransitive-mechanics/)).
These equilibrium numbers describe optimal play against an optimal opponent;
reads and conditioning ([Infil Conditioning](https://glossary.infil.net/?t=Conditioning))
are the departures from them that players exploit.

## Option selects

An option select is one input sequence that yields different actions depending
on what the opponent did, "hidden inputs" that reduce the burden to predict or
react; named examples are the buffered special cancel (only comes out on hit),
delayed throw tech (block and tech at once), safe jumps (attack and block) and
fuzzy guard (block two directions)
([Infil Option Select](https://glossary.infil.net/?t=Option%20Select)). In
guessing-game terms an option select removes a branch: one input covers two
of the opponent's options.

## Hitboxes and hurtboxes

### Shapes and parameters

- **Shapes.** 2D fighters typically use groups of rectangles or circles
  ([Infil Hitbox](https://glossary.infil.net/?t=Hitbox),
  [Hurtbox](https://glossary.infil.net/?t=Hurtbox)). Smash 64 used cuboids;
  Melee onward use spheres and capsules attached to the skeleton's bones
  ([SmashWiki Hitbox](https://www.ssbwiki.com/Hitbox),
  [Hurtbox](https://www.ssbwiki.com/Hurtbox)). Rivals of Aether hitboxes are
  circles, rectangles or rounded rectangles
  ([Rivals hitbox grid](https://rivalsofaether.com/hitbox-grid-indexes/)).
- **Throw hurtboxes** are often separate from strike hurtboxes, so being
  throwable and being hittable are tuned apart
  ([Infil Hurtbox](https://glossary.infil.net/?t=Hurtbox)).
- **Interpolation.** In Smash a hitbox occupies its current position, its
  position one frame earlier and the straight line between them, so fast
  hitboxes cannot pass through a target between frames
  ([SmashWiki Hitbox](https://www.ssbwiki.com/Hitbox)).
- **What a hitbox carries.** Smash: damage, angle, base knockback, knockback
  scaling (default 100), fixed knockback, hitlag and SDI multipliers (default
  1), shield damage, rehit rate, and an ID; when several hitboxes of one attack
  connect on the same frame, the lowest ID wins
  ([SmashWiki Hitbox](https://www.ssbwiki.com/Hitbox)). Rivals adds a priority
  of 1–10 between simultaneous hitboxes, hitbox groups (one hit per group per
  attack), lifetime, base hitpause and hitpause scaling, drift-DI and SDI
  multipliers, an angle flipper and techability
  ([Rivals hitbox grid](https://rivalsofaether.com/hitbox-grid-indexes/)).
  Sweet and sour spots split one move's hitboxes by reward, rewarding precise
  spacing or timing (Marth's tipper, Captain Falcon's knee;
  [SmashWiki Sweet spot](https://www.ssbwiki.com/Sweet_spot_(hitbox))).

### Disjoints, priority and trades

- **Disjoint.** A hitbox with no hurtbox near it, so a whiff leaves nothing to
  hit back; common on swords and on almost every projectile
  ([Infil Disjointed Hitbox](https://glossary.infil.net/?t=Disjointed%20Hitbox),
  [SmashWiki](https://www.ssbwiki.com/Disjointed_hitbox)). In Guilty Gear,
  "slower attacks generally have better disjoints" while fast, far-reaching
  ones keep hurtboxes on the weapon, and the universal upper-body-invulnerable
  6P answers extended attacks systemically
  ([CaptainTechnicality](https://captaintechnicality.wordpress.com/2023/07/13/the-de-evolution-of-hurtboxes-in-fighting-games/)).
- **Priority is geometry.** Players of Street Fighter II believed moves had
  priority values; outcomes come from where hitboxes and hurtboxes overlap,
  and an invincible dragon punch wins because it has no hurtbox
  ([EventHubs, 2017](https://www.eventhubs.com/news/2017/aug/18/people-used-think-fighting-game-move-interactions-were-all-based-priority-system-never-actually-existed/)).
- **Trade and clash.** Both attacks hitting hurtboxes on the same frame is a
  trade; a heavy hit trading with a light one can even lead to a combo. Two
  hitboxes meeting without touching a hurtbox is a clash in games that model
  it, such as Guilty Gear
  ([Infil Trade](https://glossary.infil.net/?t=Trade),
  [Clash](https://glossary.infil.net/?t=Clash)). Smash's clank and rebound
  rules are in [platform fighters](platform-fighters.md#clank-trade-and-grab-priority).

### Hurtboxes that follow the animation

- **Bone-attached volumes.** Smash hurtboxes are capsules and spheres on the
  bones, so they follow every animation, and each one can be normal,
  invincible (hit without damage or knockback) or intangible (cannot be hit)
  per frame. Moves switch parts selectively: Mario's head is intangible during
  his up smash; Ridley's wing, head and arm during his up tilt
  ([SmashWiki Hurtbox](https://www.ssbwiki.com/Hurtbox)).
- **Sprite-derived volumes.** Rivals of Aether gives each attack a per-frame
  hurtbox sprite strip with precise (pixel) collision, while idle, crouch, air
  and hitstun states use rectangles
  ([Rivals workshop: Sprites](https://www.rivalsofaether.com/workshop/sprites/),
  [attack grid](https://rivalsofaether.com/attack-grid-indexes/)).
- **Frame-authored boxes.** Street Fighter 6 tunes hurtboxes per frame range of
  a move, as in the patch entries quoted under footsies.
- **Partial protection.** Low-profile moves shrink the hurtbox under attacks
  aimed at the body; armor absorbs hits without hitstun; invincibility can be
  total or limited to throws or projectiles
  ([Infil Low Profile](https://glossary.infil.net/?t=Low%20Profile),
  [Armor](https://glossary.infil.net/?t=Armor),
  [Projectile Invincible](https://glossary.infil.net/?t=Projectile%20Invincible)).
- **Agreement between visuals and collision.** Hitboxes "try to cover the
  area where the strike is causing impact, so it 'makes sense'", and
  hurtboxes "try to match your character's model pretty closely so things
  don't feel funky"
  ([Infil Hitbox](https://glossary.infil.net/?t=Hitbox),
  [Hurtbox](https://glossary.infil.net/?t=Hurtbox)). Sakurai's Smash for Wii U
  and 3DS internal notes ask to "redo the invincibility frames and animations of
  rolls, spot dodges, and air dodges" where they mismatched, to reduce aerial
  active frames that outlast the animation, and note that "the hitbox on
  neutral air is a bit too big"
  ([Source Gaming translation, 2017](https://sourcegaming.info/2017/06/23/internalnotes/)).
  Sakurai also warns that assigning collision to an animation as-is "doesn't
  often work out too well"
  ([Always Keep Attack Collision in Mind](https://www.youtube.com/watch?v=rwwF_4blK-o),
  2024, description). Hitstop and the victim's switch to a hit pose remove the
  context of the exchange, so correct collisions can look wrong in replay
  ([CaptainTechnicality](https://captaintechnicality.wordpress.com/2023/07/13/the-de-evolution-of-hurtboxes-in-fighting-games/)).

## Character archetypes and trade-offs

- **Archetypes** name a gameplan from a character's best tools: zoners keep the
  opponent out, rushdown characters close in and keep guessing games going,
  grapplers win with throws and command throws but move slowly, all-rounders
  (Street Fighter's shotos) do a bit of everything, puppet characters control a
  second entity, and big bodies are larger targets that suffer from mixups
  ([Infil Archetype](https://glossary.infil.net/?t=Archetype),
  [Zoner](https://glossary.infil.net/?t=Zoner),
  [Rushdown](https://glossary.infil.net/?t=Rushdown),
  [Grappler](https://glossary.infil.net/?t=Grappler),
  [All-Rounder](https://glossary.infil.net/?t=All-Rounder),
  [Puppet Character](https://glossary.infil.net/?t=Puppet%20Character),
  [Big Body](https://glossary.infil.net/?t=Big%20Body)). Platform-fighter
  physical trade-offs (weight, fall speed) are in
  [platform fighters](platform-fighters.md#weight-fall-speed-and-archetypes).
- **Parameters are characterization.** Sakurai: game parameters are "a kind of
  art", and the numbers should convey feelings that make a character memorable
  ([Using Parameters to Establish Characters](https://www.youtube.com/watch?v=zwiS1L6QVY0),
  2024, description).
- **Strengths and weaknesses.** Rounding off both a character's strengths and
  weaknesses "can resolve issues", but "it's hard to say it makes a game more
  fun" ([Amplify Both Strengths and Weaknesses](https://www.youtube.com/watch?v=fc-hOvTBTCc),
  2024, description). "If a character has one strong move, thinking of ways to
  counter that move is what creates strategies. If you just patch the game to
  balance it perfectly, you lose that fun" (Sakurai,
  [Dengeki interview, Source Gaming translation](https://sourcegaming.info/2016/03/31/dengeki2015/)).
- **Viable options and fairness.** Sirlin: a game is balanced "if a reasonably
  large number of options available to the player are viable"; fair if players
  of equal skill have a roughly equal chance with different characters; deep
  if it stays strategically interesting after years of expert study; "the worst
  thing you can have in a competitive multiplayer game is a dominant move"; and
  a particular moment in play "does NOT need to be fair", only the whole game
  ([part 1](https://www.sirlin.net/articles/balancing-multiplayer-games-part-1-definitions),
  [part 2](https://www.sirlin.net/articles/balancing-multiplayer-games-part-2-viable-options),
  [part 3](https://www.sirlin.net/articles/balancing-multiplayer-games-part-3-fairness)).
  Yomi reached "no 7-3 matchups, in a 20 character game with 210 matchups"
  after more than 3.5 years of expert online testing
  ([Game Balance and Yomi](https://www.sirlin.net/articles/game-balance-and-yomi)).
- **Buff or nerf.** Core-A Gaming argues balance changes exist to make the game
  more fun and favours buffs
  ([Why We Should Buff More Than Nerf](https://www.youtube.com/watch?v=bsC8io4w1sY),
  from its description). Slap City's designers buff freely and limit nerfs to
  about one move per character per patch
  ([Slap City design blog](https://slapcity.se/blogs/design)). Project M nerfed
  some moves specifically to break characters' "dependence on repeated use of a
  single move or small set of moves"
  ([SmashWiki Project M](https://www.ssbwiki.com/Project_M)).

## Reasoning with numbers

- **What designers measure.** Frame advantage on hit and block, punish windows
  (minus frames against the opponent's fastest reaching option), reach after
  pushback, startup against reaction time, reward per hit and per mixup branch,
  and the equilibrium value of each guess, all above.
- **How Smash's team judged balance.** Playtesting reports, online battle
  results and opinions found online; Sakurai rejects some proposals because
  "there's no point in making the game more balanced if it decreases the fun
  factor" ([Famitsu column vol. 480, Source Gaming translation](https://sourcegaming.info/2015/06/11/the-act-of-balancing-sakurai-famitsu-column-vol-480/)).
  He also recommends scaling a reward by how good the player's action really
  was, without making outcomes too predictable
  ([How Good Were the Player's Actions?](https://www.youtube.com/watch?v=IGpEp0R1_xY),
  2024, description), and analyses the risk and reward built into the
  Shoryuken input itself ([The Shoryuken Command](https://www.youtube.com/watch?v=zswiCPS5CSM),
  2023, description; general treatment in
  [Risk and Reward](https://www.youtube.com/watch?v=FXqEykD5Ub4), 2022).
- **Limits of calculation.** Sirlin holds that expert intuition beats analysis
  for whole-game balance: "you could do a year of math on that and still be
  more wrong about it than my guess in two seconds"
  ([part 4](https://www.sirlin.net/articles/balancing-multiplayer-games-part-4-intuition)).
  The arithmetic above settles local questions (is this punishable, what is
  this guess worth); matchup-level balance is judged by play.

## Open design questions for the owner

One line each, neutral; the options are those the sources above describe.

- Attack hurtboxes: extend along limbs and weapons before and after the active frames (Street Fighter whiff-punish model), stay on the body, or vary per move?
- Disjoint budget: disjoints free per move, tied to slower startup (Guilty Gear pattern), or none outside projectiles?
- Hurtbox fidelity: per-frame authored volumes, bone-attached capsules that follow the animation (Smash), or per-state shapes?
- Hitbox generosity: hitboxes matched to the drawn strike, or slightly larger than it?
- Counter hits: extra reward for hitting startup frames, or none?
- Knockdowns: some moves give hard knockdowns, or every knockdown leaves wakeup choices?
- Invincible reversals: any fighter with a fully invincible option out of stun or knockdown, and at what punish cost?
- Throw defence: a timed throw tech, a mash escape, or no escape once caught?
- Same-frame strike contact: trade (both hit), clash (both cancel), or a priority rule?
- Option selects: keep those that emerge, or design them out case by case?
- Mixup branches: a minimum reward for the weaker branch of each designed mixup, so that ab / (a + b) stays meaningful, or none?
- Archetypes: assign each fighter an archetype up front, or let it emerge from move design?
- Balance changes: buff-first, symmetric, or a matchup target such as Yomi's "no 7-3"?

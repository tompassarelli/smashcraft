# Tilts and dash attacks: the ground normals per fighter

Every fighter has a jab, a forward tilt, an up tilt, a down tilt and a dash
attack. Each one
has its own frame data, hit volumes, reach and reward, so a player can tell
the fighters apart by their tilts alone. This page covers the reference
distribution, the angling rule and each fighter's design. The numbers come
from the kits in smashcraft:ts/src/game/sim/heroes/ and the original fighters'
tables, and smashcraft:ts/src/game/match/groundNormalContracts.tests.ts pins the relations.
Illidan's normals belong to his own kit work and are not designed here.

Notation follows [the roster](roster.md#timing-and-geometry-notation):
- F/A/R is first active frame, active frames, and recovery after the last
  active frame; the total is F − 1 + A + R.
- Reach is measured from the fighter's centre in H, the reference standing
  height (131.8 units): S 0.55H, M 0.80H, L 1.10H.
- Angles are degrees from the facing direction: 0 is horizontal, 90 straight
  up; over 90 sends the victim behind the attacker.
- Knockback is growth/base in the shared formula
  (smashcraft:ts/src/game/sim/knockback.ts). A hit launches into tumble when
  its knockback reaches 80.

## Reference distribution

Melee is the timing reference. Over its 26 fighters
([Melee attacks](melee/attacks.md), from
smashcraft:references/melee-frame-data/records.jsonl), first active frames run:

| Move | Fastest | Quarter | Median | Three quarters | Slowest |
| --- | ---: | ---: | ---: | ---: | ---: |
| Jab | 2 | 2 | 3 | 5 | 11 |
| Forward tilt | 4 | 5 | 6 | 9 | 16 |
| Up tilt | 4 | 5 | 7 | 9 | 81 (Ganondorf's stomp) |
| Down tilt | 3 | 5 | 7 | 10 | 14 |

Melee's tilts also sort into roles:

- **Up tilt:** an anti-air or juggle. Examples are Fox's (frame 5) and
  Marth's arc, which covers the space behind him. Falcon's and Ganondorf's
  are slow kicks.
- **Down tilt:** either a poke or a launcher.
  - Pokes: Marth's long, thin sweep, and Ness's frame-3 jab of the foot, which
    has almost no knockback and chains into itself.
  - Launchers: Fox's and Falco's pop the victim straight up as combo starters.
  - Edge tool: Falcon's is a semi-spike that sends the victim low and outward.
- **Smashcraft's tilts are slower.** They run about two frames behind
  Melee's, the same offset as the rest of the roster's normals. The spread
  between fighters is what this page sets.

Ultimate's versions of the same moves give similar ranges. Its jabs start on
frames 2 to 5 and its forward tilts on frames 5 to 10, e.g. Mario 2/5/5/5 and
Marth 5/8/6/7 for jab/forward/up/down tilt
([ultimateframedata.com/mario](https://ultimateframedata.com/mario),
[ultimateframedata.com/marth](https://ultimateframedata.com/marth)).

## Angled forward tilts

Smashcraft follows Ultimate first, and Melee where Ultimate is silent
([gameplay design](../gameplay-design.md)).

**Ultimate's rule.** A fighter can angle its forward tilt by holding the
stick diagonally up or down when the tilt is a straight strike: a punch, a
kick, a palm, a thrust or a claw. A swing that already sweeps vertical
ground, such as an overhead cut or a hammer arc, is not angled. A diagonal
input plays the plain tilt, because the swing already covers the space the
angles would add. Up and down tilts are never angled. Sources:
[SmashWiki: Angling](https://www.ssbwiki.com/Angling) and
[SmashWiki: Forward tilt](https://www.ssbwiki.com/Forward_tilt).

**Who can angle.**
- Can angle in Ultimate: Mario, Luigi, Fox, Falco, Captain Falcon, Pikachu,
  Samus, Bowser, Donkey Kong, Mewtwo, Lucario, Ike and Sephiroth.
- Cannot angle in Ultimate: most sword fighters (Marth, Lucina, Roy, Chrom,
  Link, Byleth, Cloud), and also Ryu, Ken, Terry, Sheik, Peach and Mr.
  Game & Watch.
- Melee draws a similar line. Fox, Falco, Falcon, Ganondorf, Samus and Zelda
  have five angles; Mario, Luigi, Donkey Kong, Bowser, Pikachu, Jigglypuff,
  Kirby and Ness have three. Marth and Peach cannot angle.

**Kickers and punchers.** "Kickers angle, punchers don't" does not hold.
Pikachu, Lucario, Mewtwo and Samus angle without kicking. Ryu, Ken, Terry
and Pit kick but cannot angle. The rule is the shape of the strike, not the
limb.

**What an angle changes.**
- Ultimate keeps the frame data and nearly always the damage. A few down
  angles hit slightly harder; Fox is 7/6/7 and Captain Falcon 10/9/10 for
  up/mid/down (SmashWiki character pages).
- The hit volume tilts up or down. An up angle covers a jumping opponent; a
  down angle reaches a crouching or ledge-hanging one.
- The launch angle follows the strike's direction. Melee's Mario and Luigi
  down angle is the extreme case: it has set knockback.

**Smashcraft's version.** An angleable kit gives each angle its own hit
volume and its own launch angle. The timing and damage of all three stay the
same, except where a row below says the down angle hits harder. A
non-angleable kit plays its plain forward tilt for every angle, so a diagonal
input is never wasted or surprising.

## Shared relations

- **Speed.** The jab is each fighter's fastest grounded normal. The forward
  tilt is the slowest tilt, except where a row says otherwise.
- **Distinct timing.** No two fighters share a jab, forward tilt, up tilt or
  down tilt timing (F, A and total), and the contract test enforces this.
- **Reach versus aerials.** A fighter's forward tilt reaches at least as far
  as its forward air. Three exceptions are deliberate, and each one keeps
  that fighter's identity:
  - Lich: his frost fan aerial is his committed long poke.
  - Dreadlord: his aerial approach is his deception.
  - Archer: her fade-back forward air is her spacing tool.
- **Hurt volumes.** Each tilt's hurt volume follows the striking limb from
  late startup into early recovery, and only a weapon past the hand is
  disjoint ([hurtboxes](../hurtboxes.md), #62). Weaponless strikes such as
  kicks, palms and claws are fully hittable.
- **Down tilt roles differ.** Each down tilt takes one role, and each role is
  pinned by a scripted test:

| Role | What it does | Fighters |
| --- | --- | --- |
| Spacing poke | Long, low and thin. On shield, the tip pushes him out of the defender's grab range. | Blademaster |
| Chain poke | Fastest, with almost no knockback. It repeats before the victim can act. | Warden |
| Launcher at high percent | A small pop at low percent; vertical tumble from about 90%. | Mountain King |
| Knockdown | A low sweep that tumbles the victim at 0%. Starts a tech chase. | Forsaken Paladin |
| Pull-in | Drags the victim toward the attacker and onto the ground. Sets up the grab. | Dreadlord |
| Edge poke | Reaches below the stage's lip. Hits a ledge-hanging or recovering fighter. | Shadow Hunter |
| Slow space control | Creeping low frost at long range. Late, but long. | Lich |
| Shared poke | The original table's even 45-degree poke. | Archer |
| Edge semi-spike | Sends a fighter at the front low and outward. | Pit Lord |
| Fixed pop-up | The same small pop at every percent. | Beastmaster |
| Vertical pop-up | Sends the victim straight up at low percent. A combo starter. | Rifleman |

## Per fighter

Each table lists F/A/R, damage, reach, launch angle and knockback. The angled
column is the forward tilt's up and down launch angles, or "no" when the
forward tilt is not angled. "Inspired by" names the Melee or Ultimate move
whose relation the tilt borrows (timing or role); the volumes are original.
Move names belong to the move-names work (#150); normals are named here by
input.

### Blademaster: the spacing sword

His forward tilt is a descending cut that covers head height down to the
feet, so it is not angled; its outer 0.20H is the tipper. His down tilt is
the longest low poke on the roster; on shield its tip leaves him out of the defender's grab range.

| Normal | F/A/R | Damage | Reach | Launch | Angled | Inspired by |
| --- | --- | --- | --- | --- | --- | --- |
| Jab | 3/2/13 | 4 | 0.62H | 50, 55/22 | | Marth jab (fast check) |
| Forward tilt | 7/3/20 | 8 inner, 11 tip | 1.25H | 30, 100/24 tip | no | Marth forward tilt (non-angled arc) |
| Up tilt | 6/5/18 | 7 | 0.85H arc over him | 85, 70/38 | | Marth up tilt (covers behind) |
| Down tilt | 6/2/10 | 5 inner, 8 tip | 1.20H, below 0.15H | 20, 60/18 | | Marth down tilt (long thin poke) |

### Mountain King: the heavy hammer

His forward tilt is a horizontal hammer hook, a straight strike, so it angles:
the up angle meets jumps, and the down angle reaches the lip of the stage. His
down tilt, a boot and axe, only bumps at low percent but tumbles vertically at
high percent.

| Normal | F/A/R | Damage | Reach | Launch | Angled | Inspired by |
| --- | --- | --- | --- | --- | --- | --- |
| Jab | 5/2/16 | 5 | 0.62H | 30, 55/16 | | Bowser jab (slow, heavy) |
| Forward tilt | 10/3/22 | 12 | 0.95H | 30, 100/25 | up 45, down 20 | Donkey Kong forward tilt (angled heavy) |
| Up tilt | 8/4/22 | 10 | 0.85H | 80, 95/24 | | Bowser up tilt |
| Down tilt | 8/3/21 | 10 | 0.75H, below 0.20H | 85, 70/10 | | Falco down tilt (vertical, scaled to kill late) |

### Warden: the fastest blade

Every one of her tilts is the roster's fastest of its kind. Her forward tilt
is a straight crescent thrust and angles. Her down tilt is a 3-frame chain
poke.

| Normal | F/A/R | Damage | Reach | Launch | Angled | Inspired by |
| --- | --- | --- | --- | --- | --- | --- |
| Jab | 2/2/11 | 3 | 0.55H | 70, 40/30 | | Fox jab (frame 2) |
| Forward tilt | 5/3/17 | 8 | 0.95H | 35, 75/18 | up 55, down 20 | Sheik forward tilt (fast, Melee frame 5) |
| Up tilt | 4/4/16 | 6 | 0.80H arc | 90, 60/32 | | Fox up tilt (juggle) |
| Down tilt | 3/2/9 | 3 | 0.80H, below 0.12H | 0, 20/32 | | Ness down tilt (chains into itself) |

### Lich: the slow caster

His close normals are the roster's slowest and shortest. His forward tilt is
a frost palm, which angles. His up tilt is a crown of ice that lingers above
his shoulders for eight frames. His down tilt is the late, long creeping
frost.

| Normal | F/A/R | Damage | Reach | Launch | Angled | Inspired by |
| --- | --- | --- | --- | --- | --- | --- |
| Jab | 6/2/15 | 3 | 0.50H | 30, 55/16 | | Zelda jab (slow) |
| Forward tilt | 9/4/22 | 9 | 1.00H | 30, 80/20 | up 55, down 15 | Mewtwo forward tilt (angled palm) |
| Up tilt | 8/8/20 | 9 | 0.50H wide, up to 1.55H | 90, 95/22 | | Zelda up tilt (long overhead arc) |
| Down tilt | 10/4/19 | 6 | 1.15H, below 0.10H | 30, 70/25 | | Samus down tilt (slow, long) |

### Forsaken Paladin: the defensive hammer

His forward tilt is the roster's longest and slowest tilt: an overhead hammer
arc from above his head to the floor in front, so it is not angled. His down
tilt sweeps the hammer handle along the floor and knocks the victim down.

| Normal | F/A/R | Damage | Reach | Launch | Angled | Inspired by |
| --- | --- | --- | --- | --- | --- | --- |
| Jab | 5/3/15 | 4 | 0.55H | 20, 40/24 | | Ganondorf jab (pushes away) |
| Forward tilt | 11/3/24 | 12 | 1.30H | 35, 100/25 | no | Byleth forward tilt (non-angled weapon arc) |
| Up tilt | 10/4/22 | 11 | 0.85H overhead | 85, 105/28 | | Ganondorf up tilt (slow, strong) |
| Down tilt | 9/3/20 | 8 | 1.00H, below 0.15H | 10, 40/72 | | Melee trip sweeps (knockdown) |

### Dreadlord: the grappler

His forward tilt is a straight claw rake and angles. His up tilt is the wing
arc, which reaches farther behind him than in front. His down tilt drags the
victim in, onto the ground and toward his grab.

| Normal | F/A/R | Damage | Reach | Launch | Angled | Inspired by |
| --- | --- | --- | --- | --- | --- | --- |
| Jab | 4/3/14 | 4 | 0.60H | 40, 50/25 | | Captain Falcon jab (sets up) |
| Forward tilt | 8/3/21 | 12 (10 before #105 pass 4) | 0.95H | 35, 100/22 | up 55, down 20 | Captain Falcon forward tilt (angled) |
| Up tilt | 7/4/20 | 9 | 0.80H, farther behind | 90, 90/25 | | Mewtwo up tilt (arc behind) |
| Down tilt | 6/3/18 | 6 | 0.80H, below 0.15H | toward him, 0, 30/30 | | Ultimate pull-in tilts (Ridley's tail, a reach-in rake) |

### Shadow Hunter: the glaive angles

His forward tilt is a glaive thrust, a straight strike like Ike's and
Sephiroth's, so it angles; the down angle reaches below the stage. His down
tilt is the edge poke: a low glaive whose tip dips under the lip, where a
ledge-hanging fighter's body is.

| Normal | F/A/R | Damage | Reach | Launch | Angled | Inspired by |
| --- | --- | --- | --- | --- | --- | --- |
| Jab | 4/2/12 | 3 | 0.70H | 35, 50/16 | | Glaive-handle check |
| Forward tilt | 9/2/21 | 11 (9 before #105 pass 4) | 1.20H | 35, 75/18 | up 55, down 15 | Ike forward tilt (an angled sword) |
| Up tilt | 7/5/19 | 7 | 0.80H, above | 80, 95/20 | | Glaive twirl overhead |
| Down tilt | 7/2/16 | 7 (5 before #105 pass 4) | 1.15H, tip to −0.25H | 30, 70/22 | | Captain Falcon down tilt (an edge tool) |

### Pit Lord: the super-heavy cleaver

Everything is slow and long. His forward tilt falls from above his horns to
the floor, so it is not angled. His down tilt, Front Hoof, is the edge
semi-spike: it sends a fighter at his front low and outward, below the
horizontal. His dash attack is the roster's strongest.

| Normal | F/A/R | Damage | Reach | Launch | Angled | Inspired by |
| --- | --- | --- | --- | --- | --- | --- |
| Jab | 7/3/19 | 6 | 0.80H | 35, 55/12 | | Slow haft check |
| Forward tilt | 13/4/29 | 14 | 1.40H | 35, 100/22 | no | Ganondorf-weight cleave (non-angled arc) |
| Up tilt | 12/5/27 | 12 | 1.10H arc, up to 1.5H | 85, 95/20 | | Broad overhead arc |
| Down tilt | 10/3/24 | 10 | 0.80H, below 0.20H | −20, 100/22 | | Captain Falcon down tilt (semi-spike) |

### Beastmaster: axe and bear

His forward tilt is a broad axe stroke, which angles (up 50, down 20). His
down tilt pops the victim the same height at every percent (no knockback
growth), so the bear's follow-up holds at any percent. His dash attack heaves
the victim over his shoulder and behind him.

| Normal | F/A/R | Damage | Reach | Launch | Angled | Inspired by |
| --- | --- | --- | --- | --- | --- | --- |
| Jab | 4/2/14 | 4 | 0.55H | 35, 55/12 | | Axe hilt |
| Forward tilt | 10/3/23 | 11 | 1.10H | 35, 100/22 | up 50, down 20 | Broad axe |
| Up tilt | 9/4/23 | 9 | 0.80H, up to 1.3H | 85, 95/20 | | Axe over the shoulder |
| Down tilt | 8/3/22 | 7 | 0.80H, below 0.15H | 80, fixed 45 | | Melee Mario's set-knockback down angle |

### Archer: the original tables

Archer keeps the shared tables' jab and tilts (smashcraft:ts/src/game/sim/moves.ts,
smashcraft:ts/src/game/sim/hitRegions.ts). They are her own now: no other
fighter uses those timings, and the engine's shared-mechanics tests use them as
their reference attack. The shared jab reached as far as her forward tilt, so
it now stops at 120 units (#163); her chain adds an authored low kick. Her forward tilt has an early tip (10 on its first
active frame, 8 after) and angles. Her forward air outreaches her tilts,
because spacing from the air is her plan. Her one new move is the sliding kick.

| Normal | F/A/R | Damage | Reach | Launch | Angled | Inspired by |
| --- | --- | --- | --- | --- | --- | --- |
| Jab | 5/2/15 | 5 | 0.91H | 45, 100/20 | | Original table, shortened (#163) |
| Forward tilt | 6/2/21 | 10 tip early, 8 late, 5–7 inner | 1.10H | 37, 110/24 tip | up 55, down 20 | Fox forward tilt (angled kick) |
| Up tilt | 7/2/21 | 8 | 1.10H | 45, 100/20 | | Original table |
| Down tilt | 6/2/21 | 8 | 1.10H | 45, 100/20 | | Original table |

### Rifleman: the rifle butt

His tilts use the rifle as a club; his jab and forward tilt are rifle-butt
thrusts, and the forward tilt angles. His down tilt keeps Falco's 1.3 ratio
over the old shared down tilt (10 damage) and pops straight up at low percent.

| Normal | F/A/R | Damage | Reach | Launch | Angled | Inspired by |
| --- | --- | --- | --- | --- | --- | --- |
| Jab | 4/3/16 | 4 | 0.80H | 20, 45/18 | | Falco jab (pushes) |
| Forward tilt | 7/3/21 | 10 | 1.25H | 30, 108/22 | up 50, down 15 | Falco forward tilt (angled) |
| Up tilt | 6/3/22 | 8 | 0.85H, above | 90, 80/26 | | Falco up tilt |
| Down tilt | 7/3/22 | 10 | 0.90H, below 0.15H | 80, 45/50 | | Falco down tilt (vertical pop-up) |

## Jab chains

Every fighter's jab is a two- or three-hit chain on repeated presses (#163).
Repeatability is the jab's identity; a tilt never chains.

**Melee's mechanism** (melee:src/melee/ft/kinds/ftCommon/ftCo_Attack1.c):
- A chain step needs a fresh A press, never a held button:
  `ftCo_Attack1_CheckInput` and `checkAttack12`/`checkAttack13` read
  `pressed_buttons`.
- A press is latched (`mv.co.attack1.x0`) while a per-fighter input window
  counts down (`co_attrs.jab_2_input_window` and `jab_3_input_window`,
  melee:src/melee/ft/types.h:793-794). The next jab starts only once the
  animation script's "set jab combo" event allows it (`ftAction_80071AE8`,
  melee:src/melee/ft/ftaction.c:557), so an early press waits.
- With no press, the jab plays out and returns to Wait.
- Rapid jab (`ftCo_Attack100.c`) counts A press and release edges across the
  chain (`x1A54` against `rapid_jab_window`). Its loop ends after one
  animation cycle without an edge, so it needs mashing.
- Melee's jab rows (smashcraft:references/melee-frame-data/records.jsonl,
  start/damage):
  - Fox: 2/4, then 2/4.
  - Marth: 4/6, then 4/6.
  - Captain Falcon: 3/2, 4/3, 5/8.
  - Mario: 2/3, 2/2, 4/5.
  - Link: 6/5, 6/3, 6/6.
  - Kirby, Link, Mewtwo, Sheik and Young Link have rapid jabs.

**Smashcraft's version.**
- A jab step names the frame its window opens (`AuthoredMove.chainsFrom`):
  the frame after its last active frame.
- From then until its last frame, a fresh jab press starts the next step
  (`jabChainStep`, smashcraft:ts/src/game/sim/conditions.ts).
- An earlier press waits in the attack buffer. A press during the jab's
  hitlag is held through it, as Melee latches it.
- The chain's last jab has no window, so a later press starts a new chain.
- Smashcraft has no rapid jab. A loop that needs no recovery could hold a
  victim in place, which the lock-loop rules (#68) forbid.
- The steps are AttackStyle `jab2` and `jab3`, Melee's Attack12 and Attack13.

smashcraft:ts/src/game/match/jabChainContracts.tests.ts pins two relations:
- Each jab reaches less, covers a smaller area and starts no later than the
  fighter's forward tilt.
- Every step of a chain connects on a standing target.

Each chain's name is in the kit data and on the move list. In the table below,
each jab cell gives F/A/R, damage, reach and launch (angle, growth/base).

| Fighter | Chain | Second jab | Third jab |
| --- | --- | --- | --- |
| Archer | Bow and Boot | 4/3/16, 5, 0.83H, 40 95/22 (a low kick) | |
| Rifleman | Rifle Butt | 4/2/18, 5, 0.83H, 30 90/22 | |
| Illidan | Warglaive Flurry | 5/2/16, 4, 0.73H, 70 30/22 | 6/3/20, 6, 0.83H, 40 95/22 |
| Blademaster | Swift Cuts | 3/2/16, 5, 0.65H, 40 90/22 | |
| Mountain King | Tavern Brawl | 6/3/18, 6, 0.67H, 35 95/24 | |
| Warden | Crescent Flurry | 2/2/12, 3, 0.56H, 70 30/26 | 4/3/16, 4, 0.73H, 40 90/22 |
| Lich | Chilling Touch | 6/3/17, 4 ice, 0.55H, 30 85/22 | |
| Forsaken Paladin | Hammer and Haft | 6/3/18, 6, 0.62H, 30 90/26 | |
| Dreadlord | Vampiric Claws | 4/2/14, 3, 0.61H, 60 30/28 | 6/3/20, 6, 0.74H, 35 100/22 |
| Shadow Hunter | Glaive Handle | 4/2/13, 3, 0.72H, 60 30/26 | 6/3/18, 5, 0.84H, 40 90/22 |
| Pit Lord | Haft and Chop | 8/3/22, 7, 0.85H, 40 75/18 | |
| Beastmaster | Twin Axes | 4/2/14, 3, 0.57H, 70 55/12 | 6/3/19, 6, 0.72H, 40 75/18 |

An opener that chains carries less knockback than a lone jab did, so the next
step still reaches the target. The per-fighter tables above list each
opener's launch.

## Sound tiers

A swing's whoosh, its hit sound and its hit spark come in three sizes by move
class, so a jab never sounds like a tilt (#163,
smashcraft:ts/src/game/presentation/moveTiers.ts).

- **Melee** stores a hit-sound kind and a severity (0-2) on every hitbox
  (`HitCapsule.sfx_kind`, `sfx_severity`, melee:src/melee/lb/types.h:46-47).
  - `lbColl_80005BB0` plays `lbColl_803B9880[sfx_kind * 3 + sfx_severity]`
    (melee:src/melee/lb/lbcollision.c:232-249).
  - Shield hits pick one of three sounds by severity
    (melee:src/melee/ft/ftcoll.c:70).
  - The tier is authored per hitbox, not computed from damage.
  - Swing sounds are plain script sound commands with no size rule
    (melee:src/melee/ft/ftaction.c:570-620).
- **Ultimate**'s attack scripts give every hitbox `ATTACK_SOUND_LEVEL_S`,
  `_M` or `_L`.
  - Mario's jabs 1 and 2 are S and his jab 3 is M. His tilts are M and his
    smashes L.
  - Swing sounds are sized too: Ryu's jabs play `se_ryu_swing_punch_m`,
    `se_ryu_swing_kick_s` and `se_ryu_swing_kick_l`.
  - Sources: the game's ACMD scripts as HewDraw Remix carries them
    ([mario ground.rs](https://github.com/HDR-Development/HewDraw-Remix/blob/dev/fighters/mario/src/acmd/ground.rs),
    [tilts.rs](https://github.com/HDR-Development/HewDraw-Remix/blob/dev/fighters/mario/src/acmd/tilts.rs),
    [smashes.rs](https://github.com/HDR-Development/HewDraw-Remix/blob/dev/fighters/mario/src/acmd/smashes.rs),
    [ryu ground.rs](https://github.com/HDR-Development/HewDraw-Remix/blob/dev/fighters/ryu/src/acmd/ground.rs)).
- **Warcraft III** sizes its own weapon sounds the same way.
  UI\SoundInfo\UnitCombatSounds.slk lists light, medium and heavy slice, chop
  and bash sounds against each armor.

**Smashcraft's tiers.**
- Jabs and shots are small, smashes are large, and every other normal is
  medium.
- `TIER_DEPARTURES` names two exceptions: Warden's chain-poke down tilt is
  small, and Pit Lord's Demonic Bulk dash attack is large.
- A hit takes the tier of the attack that landed it. A throw, or a projectile
  without an attack, keeps its launch strength (0-2).

| Tier | Swing (whoosh) | Cut | Other physical hit | Hit volume | Spark |
| --- | --- | --- | --- | --- | --- |
| Small | Pitch 1.5, volume 45 | MetalLightSliceFlesh | WoodLightBashFlesh | 110 | 0.75 |
| Medium | Pitch 1.25, volume 65 | MetalMediumSliceFlesh | WoodMediumBashFlesh | 118 | 1.0 |
| Large | Pitch 1.0, volume 90 | MetalHeavySliceFlesh | WoodHeavyBashFlesh | 127 | 1.25 |

- **Whoosh.** The whoosh is Sound\Interface\BattleNetWooshStereo1, the
  game's only stored whoosh. AnimSounds.slk also names the Demoness whip-swing
  files, but the storage doesn't hold them.
- **Hit volume.** An element hit plays its own sound at its own pitch and at
  the tier's volume. Native capture for #82 picked element sounds out only
  from volume 110, so no tier plays a hit below that.
- **Playback.** The weapon sounds and the whoosh play by path. Each weapon
  sound rotates through the game's three variants.
- **Checked against the game.** smashcraft:tools/presentation/stock-sounds.ts
  checks every path against the installed game and records it in
  smashcraft:ts/src/game/assets/stockSoundInfo.ts.

## Dash attacks

Dash attacks follow the shared relations above. Each fighter's differs in
startup, ending lag, how far it slides during startup and how it fares on
shield. Melee's 25 dash attacks hit from frame 4 to 12 (median 7), with 8 to
38 frames of ending lag (median 21), and are the least safe ground normals on
shield: −45 to −20 on the first active frame ([Melee attacks](melee/attacks.md)).

Every hero's dash attack was a launcher between 45 and 60 degrees from frame
8 to 12. Archer and Rifleman had no dash attack: a dashing jab was a jab.
Each now has one role:

| Fighter | Role | F/A/R | Slide | Damage | Launch | Inspired by |
| --- | --- | --- | --- | --- | --- | --- |
| Warden | Fast, low commitment | 5/3/18 | 0.40H | 7 | 50, 70/24 | Sheik and Fox dash attacks (frames 4–6) |
| Blademaster | Sliding long poke | 9/4/22 | 0.70H | 8 inner, 10 tip | 30, 100/24 | Marth dash attack |
| Mountain King | Launcher, body only | 11/5/26 | 0.60H | 12 | 75, 95/30 | Donkey Kong dash attack |
| Dreadlord | Cross-up | 7/4/24 | 1.00H, passes through | 9 | 60, 90/22, front then back | Ultimate's pass-through dash attacks |
| Shadow Hunter | Multi-hit | 8/9/20 | 0.50H | 3 + 3 + 5 | last hit 45, 100/22 | Kirby's and Luigi's multi-hit dash attacks |
| Forsaken Paladin | Heavy, pushes off shield | 12/3/20 | 0.35H | 12 | 30, 100/26 | Ganondorf dash attack |
| Lich | Hovering low glide | 10/6/22 | 0.80H | 8 | 25, 90/30 | Mewtwo dash attack (slow, lingering) |
| Archer | Sliding kick, pops up | 6/4/20 | 0.75H | 6 (8 before #105 pass 4) | 70, 55/38 | Fox dash attack (into up air) |
| Rifleman | Rifle lunge | 9/3/25 | 0.50H | 11 | 40, 114/22 | Falco dash attack |
| Pit Lord | Kill charge, no armor | 15/6/34 | 0.30H | 16 | 40, 110/26 | Ganondorf and Bowser dash attacks |
| Beastmaster | Heaves the victim behind him | 11/5/28 | 0.50H | 12 | 135, 95/20 | Ultimate's reverse-launch dash attacks |

## Animation

Each tilt plays the stock sequence whose striking limb matches its volume,
retimed so the sequence's strike moment lands on the first active frame
(`aligned` in each hero's clip table). Angled variants choose the sequence
that already swings high or low where the model has one; otherwise they share
the plain clip. The drawn body must stay over its hurt volumes (#97,
smashcraft:ts/test/drawn-size.test.ts). Each sequence is chosen by drawn reach:
the skinned model must reach toward the hit on its active frames, and
smashcraft:ts/test/drawn-reach.test.ts pins every hero's jab, tilts and dash
attack (#156). Check a clip change with `bun wisp view reach --assets DIR`.

**Jab slices (#163).** A jab plays a slice of its sequence rather than the
whole swing (`HeroClip.until`, `jabSlice` in
smashcraft:ts/src/game/sim/heroes/groundNormals.ts):
- The startup plays the sequence from its start to the slice's end, so the
  partial reach lands on the first active frame.
- The active frames hold that pose, and recovery returns to the fighter's
  stance.
- Each slice ends where the drawn silhouette is still short of the forward
  tilt's farthest drawn point. drawn-reach.test.ts checks every chain step
  against the forward tilt's `forward` reach.
- A chain's finisher may take a longer slice than its opener.
- Archer's low kick slices her down tilt's floor sweep.
- Lich's model barely moves before his forward tilt's reach, so his slap is
  the one jab allowed to swing less than 30 units (25-26).

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
| Knockdown | A low sweep that tumbles the victim at 0%. Starts a tech chase. | Uther |
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
| Jab | 5/2/16 | 5 | 0.62H | 30, 80/20 | | Bowser jab (slow, heavy) |
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
| Jab | 6/2/15 | 3 | 0.50H | 30, 75/18 | | Zelda jab (slow) |
| Forward tilt | 9/4/22 | 9 | 1.00H | 30, 80/20 | up 55, down 15 | Mewtwo forward tilt (angled palm) |
| Up tilt | 8/8/20 | 9 | 0.50H wide, up to 1.55H | 90, 95/22 | | Zelda up tilt (long overhead arc) |
| Down tilt | 10/4/19 | 6 | 1.15H, below 0.10H | 30, 70/25 | | Samus down tilt (slow, long) |

### Uther: the defensive hammer

His forward tilt is the roster's longest and slowest tilt: an overhead hammer
arc from above his head to the floor in front, so it is not angled. His down
tilt sweeps the hammer handle along the floor and knocks the victim down.

| Normal | F/A/R | Damage | Reach | Launch | Angled | Inspired by |
| --- | --- | --- | --- | --- | --- | --- |
| Jab | 5/3/15 | 4 | 0.55H | 20, 60/35 | | Ganondorf jab (pushes away) |
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
| Jab | 4/2/12 | 3 | 0.70H | 35, 75/18 | | Glaive-handle check |
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
| Jab | 7/3/19 | 6 | 0.80H | 35, 75/18 | | Slow haft check |
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
| Jab | 4/2/14 | 4 | 0.55H | 35, 75/18 | | Axe hilt |
| Forward tilt | 10/3/23 | 11 | 1.10H | 35, 100/22 | up 50, down 20 | Broad axe |
| Up tilt | 9/4/23 | 9 | 0.80H, up to 1.3H | 85, 95/20 | | Axe over the shoulder |
| Down tilt | 8/3/22 | 7 | 0.80H, below 0.15H | 80, fixed 45 | | Melee Mario's set-knockback down angle |

### Archer: the original tables

Archer keeps the shared tables' jab and tilts (smashcraft:ts/src/game/sim/moves.ts,
smashcraft:ts/src/game/sim/hitRegions.ts). They are her own now: no other
fighter uses those timings, and the engine's shared-mechanics tests use them as
their reference attack. Her forward tilt has an early tip (10 on its first
active frame, 8 after) and angles. Her forward air outreaches her tilts,
because spacing from the air is her plan. Her one new move is the sliding kick.

| Normal | F/A/R | Damage | Reach | Launch | Angled | Inspired by |
| --- | --- | --- | --- | --- | --- | --- |
| Jab | 5/2/15 | 5 | 1.10H | 45, 100/20 | | Original table |
| Forward tilt | 6/2/21 | 10 tip early, 8 late, 5–7 inner | 1.10H | 37, 110/24 tip | up 55, down 20 | Fox forward tilt (angled kick) |
| Up tilt | 7/2/21 | 8 | 1.10H | 45, 100/20 | | Original table |
| Down tilt | 6/2/21 | 8 | 1.10H | 45, 100/20 | | Original table |

### Rifleman: the rifle butt

His tilts use the rifle as a club; his jab and forward tilt are rifle-butt
thrusts, and the forward tilt angles. His down tilt keeps Falco's 1.3 ratio
over the old shared down tilt (10 damage) and pops straight up at low percent.

| Normal | F/A/R | Damage | Reach | Launch | Angled | Inspired by |
| --- | --- | --- | --- | --- | --- | --- |
| Jab | 4/3/16 | 4 | 0.80H | 20, 70/24 | | Falco jab (pushes) |
| Forward tilt | 7/3/21 | 10 | 1.25H | 30, 90/22 | up 50, down 15 | Falco forward tilt (angled) |
| Up tilt | 6/3/22 | 8 | 0.85H, above | 90, 80/26 | | Falco up tilt |
| Down tilt | 7/3/22 | 10 | 0.90H, below 0.15H | 80, 45/50 | | Falco down tilt (vertical pop-up) |

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
| Uther | Heavy, pushes off shield | 12/3/20 | 0.35H | 12 | 30, 100/26 | Ganondorf dash attack |
| Lich | Hovering low glide | 10/6/22 | 0.80H | 8 | 25, 90/30 | Mewtwo dash attack (slow, lingering) |
| Archer | Sliding kick, pops up | 6/4/20 | 0.75H | 6 (8 before #105 pass 4) | 70, 55/38 | Fox dash attack (into up air) |
| Rifleman | Rifle lunge | 9/3/25 | 0.50H | 11 | 40, 95/22 | Falco dash attack |
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

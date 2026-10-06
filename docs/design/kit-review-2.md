# Kit review 2: Lich, Uther, Dreadlord and Shadow Hunter

Owner direction (Tom, 6-7 Oct 2026): Archer's up and down specials and
Illidan's neutral special were dull and were redesigned
([archer-specials.md](archer-specials.md), #113; #116). "Maximum ambition,
best Warcraft III map in existence." This review gives the four later
expansion heroes the same treatment: score every special and the signature
normals, then redesign the specials that create no decision.

The bar is the one Tom accepted for Archer: a second decision after the
press, a visible setup the opponent can see and answer, a cost for the setup,
and a Warcraft III fantasy a player recognises. Fighters keep their roster
roles ([roster.md](roster.md)) and #105 gameplans. Numbers are provisional
authoring values, not measured balance; the #105 balance pass tunes them and
Tom can veto any of them.

Sources: smashcraft:ts/src/game/sim/heroes/ (each kit's `*Specials.ts`) and
the hero special engine, smashcraft:ts/src/game/sim/heroSpecialRules.ts.

## How the moves are scored

Each move gets 1-5 on six axes. **Decision:** does the user choose anything
after the press? **Mixup:** does the opponent face two answers that beat each
other? **Read:** does it reward predicting the opponent? **Risk/reward:** is
the payoff proportional to the commitment? **Counterplay:** can the opponent
see it and answer it with more than holding shield? **Identity:** would a
Warcraft III player recognise the hero? A move averaging under 2.5 is
redesigned; signature normals are scored for context and kept.

## What the best kits do

| Fighter (game) | Move | Lesson for these heroes |
| --- | --- | --- |
| Zelda (Melee, Ultimate) | Din's Fire | A remote explosion the caster places in flight: the read is where, not whether ([SmashWiki](https://www.ssbwiki.com/Din%27s_Fire)). |
| Absa, Mollo (Rivals of Aether) | Cloud, bombs | A second press detonates an object already out: the threat lives on after the cast and the timing is the skill. |
| Hero (Ultimate) | Command Selection: Snooze, Kaclang, Heal | Warcraft-like spell fantasies (sleep, invulnerable steel, heal) work when each costs MP and a punishable cast ([SmashWiki](https://www.ssbwiki.com/Command_Selection)). |
| Jigglypuff (Melee) | Sing | Sleep lasts by percent and is shortened by mashing; the singer's payoff is a choice between a fast hit and Rest ([SmashWiki](https://www.ssbwiki.com/Sing)). |
| Toon Link, Link (Ultimate) | Boomerang | A returning projectile hits on the way back toward the thrower: sandwiches and pulls-in from one press ([SmashWiki](https://www.ssbwiki.com/Boomerang)). |
| Clairen, Etalus (Rivals) | Plasma field, ice | A zone the opponent must route around; the caster's spell slows or shapes movement. |
| Incineroar, Ganondorf (Ultimate) | Alolan Whip, Flame Choke | A command grab is a strong read only when it has a feint or alternative that beats the reaction to it. |
| Marth (Melee), Ultimate's counters | Counter | Defensive specials need a whiff the attacker can punish; a reward that is the defender's own choice reads better than an automatic strike. |
| Kragg (Rivals of Aether) | Rock | A resource the fighter makes can be cashed in two ways: kept as armor or spent as an attack. |
| Mewtwo (Ultimate) | Disable | A stun-like status must be a slow, avoidable, telegraphed projectile whose payoff the user must reach. |

Shared lessons: put the second decision after the press; make every setup
visible (a marker, an aura, an orb in the air); let statuses shape movement
or options rather than freezing the victim; give the victim an action
(mashing, moving, shielding) inside any status; tie Warcraft's passive auras
to a deliberate press.

## Lich (#130)

Warcraft III anchors: **Frost Nova** (a bolt that bursts on its target and
slows everything nearby), **Frost Armor** (cold armor that slows melee
attackers), **Dark Ritual** (sacrifice for mana), **Death and Decay**
(a rotting field).

### Review

| Move | Decision | Mixup | Read | Risk/reward | Counterplay | Identity | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Neutral B, Frost Shard (free straight bolt, no status) | 1 | 1 | 1 | 2 | 3 | 1 | Redesign: a generic free bolt with no Warcraft spell behind it |
| Side B, Frost Nova (marker at 1.5H or 0.9H, burst on f30) | 2 | 3 | 3 | 3 | 4 | 2 | Redesign: good delayed read, but the Warcraft Frost Nova is the bolt; this belongs to Death and Decay |
| Up B, Spectral Ascent (steerable rise, helpless) | 2 | 2 | 1 | 2 | 3 | 2 | Keep (recovery; not in scope) |
| Down B, Frost Armor (one-hit shell, damage still applies) | 1 | 1 | 1 | 2 | 2 | 2 | Redesign: cast it when safe and forget it; no Dark Ritual anywhere |
| Forward smash, Ice Spear (XL stationary spear) | 2 | 2 | 4 | 4 | 3 | 4 | Keep: the run-in punish |
| Back air, Bone Spike | 2 | 2 | 3 | 4 | 3 | 3 | Keep |
| Down tilt, Chilling Touch | 2 | 2 | 2 | 3 | 3 | 3 | Keep: the combo starter |

Lich's identity is "deliberate projectile placement", but nothing he places
changes how the opponent moves, and his mana is spent with no economy.

### Redesign

**Neutral B: Frost Nova (picked).** The Warcraft bolt that bursts.

- Cast: 10 mana, the orb leaves his hand on frame 18, action ends frame 40
  (air form lands with 20 frames of lag). The orb drifts at 0.07H a frame
  for up to 80 frames, radius 0.16H. On a body: 6%, POKE at 35 degrees, and
  **Chill**.
- **Second press: burst.** Neutral B while his orb flies (once the cast
  has ended) is a 14-frame gesture (free) that stops the orb on its frame
  4; 6 frames later it bursts for 3 frames: radius 0.7H, 10%, LAUNCH at 70 degrees, and Chill. The burst
  is a zone: it cannot be reflected, a shield blocks it.
- **Chill** (new status): for 75 frames the chilled fighter's walk, dash,
  run and air drift top speeds are 60%. It never touches jumps, shield,
  DI, dodges or recovery specials. A shield stops it; it does not stack;
  after it ends, 120 frames of immunity.
- **Decisions:** where to burst. An opponent who jumps over the orb is in
  the burst's radius above it; one who waits behind it is outside. Lich
  bursts early to cover a dash-in, late to cover a landing.
- **Counterplay:** the orb is slow and visible; the burst's 6-frame crack is
  a telegraph; shield blocks, a powershield reflects the orb before it is
  burst, and hitting Lich during his 14-frame burst gesture before the orb
  stops leaves it flying unburst. One orb at a time.

**Side B: Death and Decay (picked).** The fixed marker becomes a rotting
field: 25 mana, placed on frame 8 at 1.5H, or 0.9H pressed backward, only
with a clear line, action ends frame 50. The field stands for 90 frames,
radius 0.75H, and strikes twice: from frame 30 the first opponent body or
shield that touches it takes 5%, a low POKE at 80 degrees; from frame 70 a
second strike takes 9%, LAUNCH at 70 degrees. Interrupting Lich before
frame 30 removes the whole field. A chilled opponent leaves the field
slowly: Frost Nova into Death and Decay is the kit's stage control.
Counterplay: walk or jump out; shield a pulse (each pulse is spent on the
first body or shield); a field only ever strikes twice.

**Down B: Frost Armor, cashed in by Dark Ritual (picked).**

- **Frost Armor:** 20 mana, the shell arms on frame 22 for 240 frames and
  takes the reaction off one hit of at most 8% (damage still applies; a grab
  ignores it). The melee striker that spends it is **chilled** (Warcraft's
  Frost Armor slows attackers).
- **Dark Ritual:** down B while the shell is up is a 24-frame ritual: on
  frame 6 the shell shatters into a frost burst around Lich (radius 0.6H,
  5%, POKE at 60 degrees) and he gains 30 mana. Kept, the shell trades one
  hit; spent, it is a close-range escape that pays for the next Frost Nova.
- **Counterplay:** big hits and grabs ignore the shell; the ritual's 5-frame
  startup and 18-frame recovery lose to a shield grab; the striker's chill
  is the cost of attacking an armored Lich, not a stun.

**Rejected: Frost Nova as a held Din's Fire.** Holding B to steer needs a
new held-special input in every controller and replay packet; the second
press gives the same decision with no new input.
**Rejected: Death and Decay as a damage-over-time field.** Ticks without
hitstun reward standing still and reward Lich for hiding; two strikes with a
reaction are visible and leaveable.

## Uther (#131)

Warcraft III anchors: **Holy Light** (heals an ally, or damages the undead),
**Divine Shield** (invulnerability, Uther cannot be harmed), **Devotion
Aura**, **Resurrection**.

### Review

| Move | Decision | Mixup | Read | Risk/reward | Counterplay | Identity | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Neutral B, Holy Bolt (straight or 30 degrees up) | 2 | 1 | 1 | 2 | 3 | 1 | Redesign: generic; Holy Light heals |
| Side B, Crusader Rush (armored 0.9H rush) | 2 | 2 | 3 | 3 | 3 | 3 | Keep: his approach |
| Up B, Ascension (hit on rise) | 1 | 2 | 1 | 2 | 3 | 3 | Keep (recovery) |
| Down B, Divine Guard (intangible f6-9, heals 3%) | 2 | 2 | 4 | 2 | 4 | 2 | Redesign the reward: a correct read gives 3%, then nothing |
| Forward tilt, Hammer Sweep | 2 | 2 | 3 | 4 | 3 | 4 | Keep: his spacing |
| Forward smash, Final Judgment | 2 | 2 | 4 | 4 | 3 | 4 | Keep |
| Up throw, Lift with light | 1 | 2 | 2 | 3 | 3 | 3 | Keep |

### Redesign

**Neutral B: Holy Light (picked).** A returning orb of light, Warcraft's
heal-or-harm spell.

- 10 mana, the orb leaves on frame 20, action ends frame 44 (air form lands
  with 20 frames of lag). It flies out at 0.11H a frame for 26 frames, then
  turns and flies back toward Uther's chest at the same speed; it lives 80
  frames in all, radius 0.17H.
- Outbound it strikes the first opponent: 7%, POKE at 40 degrees. Returning,
  it strikes the first opponent between it and Uther: 5%, pushing that
  opponent toward Uther (a sandwich). If it reaches Uther untouched it
  **heals him 3%**, at most 9% a stock.
- **Decisions:** the opponent must answer the orb twice. Jumping it lets
  it come back as a heal; standing between Uther and the returning orb takes
  the hit; shielding it outbound denies the heal; a powershield reflects it
  straight back (a reflected orb never returns or heals).

**Down B: Divine Shield (picked).** The guard window stays (intangible
frames 6-9, 25 mana, ground only, action ends frame 36, grabs beat it). A
damaging strike or projectile overlapping Uther in the window now **raises
Divine Shield** in place of the 3% heal: 45 frames in which strikes and
projectiles pass through him. He keeps every action; starting an attack, a
special or a grab ends the shield. A correct read becomes a free walk
through the follow-up and the punish of his choice. Counterplay: whiff
the guard (any attack ending before frame 6 or starting after 9), grab him
during the shield (grabs ignore it, as in the guard), or shield and wait out
the 45 frames: his first attack drops it. Kaclang (Hero) is the reference:
invulnerable, but the opponent waits it out.

**Rejected: Devotion Aura as a placed zone that armors Uther.** Strong
identity, but armor zones reward planting and waiting: a #98 camping
pattern. **Rejected: an automatic smite on a successful guard.** That is a
counter special (Illidan's Parry Step); Uther's guard stays a non-strike
reward ([guard specials](../gameplay-design.md#powershield-counter-specials-and-guard-specials)).

## Dreadlord (#132)

Warcraft III anchors: **Carrion Swarm** (a wave of bats), **Sleep** (a long
disable that any damage ends), **Vampiric Aura** (melee lifesteal),
**Inferno**.

### Review

| Move | Decision | Mixup | Read | Risk/reward | Counterplay | Identity | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Neutral B, Carrion Swarm (short slow cloud) | 1 | 2 | 2 | 3 | 3 | 3 | Keep (scored low; next pass) |
| Side B, Night Pounce (approach command grab) | 2 | 2 | 4 | 2 | 4 | 2 | Redesign: one read with no feint; 9% for a 20-mana read; no vampire |
| Up B, Bat Ascension | 2 | 2 | 1 | 2 | 3 | 3 | Keep (recovery) |
| Down B, Sleep Orb (20 frames of sleep, 2%) | 1 | 1 | 2 | 1 | 3 | 2 | Redesign: 20 frames is a flinch; Warcraft's Sleep is long |
| Back air, Wing Backhand | 2 | 2 | 3 | 4 | 3 | 4 | Keep |
| Back throw, Spin and fling | 1 | 1 | 2 | 4 | 2 | 3 | Keep: his grab kill |

### Redesign

**Down B: Sleep (picked).** The orb is unchanged (25 mana, leaves on frame
26, 0.06H a frame, radius 0.18H) but lives 50 frames, and the sleep is now
long and contested:

- A grounded fighter it hits sleeps **70 frames**; an airborne one 24
  frames, so an offstage hit is an edge-guard opening, not a KO.
- The sleeper **mashes out** with the grab and freeze rule
  (smashcraft:ts/src/game/sim/mash.ts): each press or new stick direction
  takes 8 frames off, never waking before frame 24. Any damaging hit wakes
  it; afterwards 240 frames of sleep immunity.
- **Decisions:** Dreadlord chooses the payoff against the sleeper's mashing:
  a fast hit now, a dash-in forward smash, or a charged smash that a fast
  masher escapes. The orb's speed means he usually must close distance.
- **Counterplay:** jump, shield or powershield it (a reflected orb sleeps
  Dreadlord); mash.

**Side B: Vampiric Pounce (picked).** Night Pounce keeps its approach and
command grab, and gains:

- **Feint:** side B again on frames 3-12 of the approach cancels it into a
  backward bat-hop (0.7H back over frames 1-10, action ends frame 18, free).
  The opponent who reacts to the pounce with an attack or a jump whiffs into
  his punish.
- **Vampiric bite:** a caught target's bite heals Dreadlord 4%, at most 12%
  a stock (Vampiric Aura made a deliberate move, roster "No passive
  lifesteal").
- **Counterplay:** the grab still loses to a preemptive attack and a spaced
  retreat; the feint loses to waiting in shield and to a dash attack timed
  at the hop's landing.

**Rejected: lifesteal on every hit.** Passive, forbidden by the roster
contract and invisible. **Rejected: Sleep scaling with percent.** Illidan's
Mana Burn stun (#116) owns the percent-scaled stun; Sleep is distinct by
being long, contested by mashing and ended by any hit.

## Shadow Hunter (#133)

Warcraft III anchors: **Healing Wave** (a bouncing heal), **Hex** (turns a
foe into a critter that cannot attack or cast), **Serpent Ward** (immobile
wards that shoot), **Big Bad Voodoo** (invulnerability around him), the
thrown glaive.

### Review

| Move | Decision | Mixup | Read | Risk/reward | Counterplay | Identity | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Neutral B, Spirit Glaive (straight, no return) | 1 | 1 | 1 | 2 | 3 | 2 | Redesign: a glaive that does not come back |
| Side B, Serpent Ward (fixed fire at 45/105/165) | 3 | 3 | 2 | 3 | 4 | 4 | Keep: placement and recall already decide |
| Up B, Loa Vault | 1 | 1 | 1 | 2 | 3 | 2 | Keep (recovery) |
| Down B, Hex (no specials for 45 frames) | 1 | 1 | 2 | 1 | 3 | 2 | Redesign: the opponent barely notices it |
| Forward tilt, Crescent Chop | 2 | 2 | 3 | 3 | 3 | 3 | Keep |
| Up smash, Loa's Reach | 2 | 2 | 3 | 4 | 3 | 3 | Keep |

### Redesign

**Neutral B: Spirit Glaive returns (picked).** Free, leaves on frame 18,
action ends frame 40. It flies out at 0.12H a frame for 22 frames, then
turns back toward Shadow Hunter's chest; it lives 70 frames, radius 0.15H.
Outbound: 6%, POKE at 35 degrees. Returning: 5%, knocking its target toward
him. Caught, it simply ends. One glaive. **Decisions:** throw past the
opponent and step back so the return pulls them into a ward shot or a
forward tilt; the opponent who jumps the outbound glaive must also clear the
return. **Counterplay:** shield both passes; powershield reflects it straight
back (a reflected glaive never returns); close in while it is out.

**Down B: Hex (picked).** The orb lives 26 frames (was 18). A hexed
fighter, for **50 frames**, cannot attack, grab or use a neutral, side or
down special. Movement, jumps, shield, dodges, DI and up special stay:
Warcraft's critter can still run. The victim **mashes** out with the shared
rule, never before frame 20; 240 frames of immunity afterwards. Shadow
Hunter's window is real (no challenges), the victim's answer is real (run,
shield, mash). Counterplay: jump or shield the orb; powershield reflects it.

**Rejected: Healing Wave on the glaive.** Uther owns the returning heal
(Holy Light); two returning heals would blur both identities.
**Rejected: Big Bad Voodoo on the ward recall.** Invulnerability around a
placed ward is camping; it stays the optional ultimate.

## Shared engine additions

All are fighter state, restored by rollback and checked by tapes:

- **Chill** status (Lich): a condition in its own immunity group that scales
  walk, dash, run and air drift top speeds.
- **Re-press forms:** a special pressed while its own orb flies (Lich's
  burst) or while its shell holds (Dark Ritual) chooses a different form,
  the way Serpent Ward's recall does.
- **Returning projectiles:** Mountain King's shared `returns` rule (#125),
  with an optional return hit and owner heal (Holy Light, Spirit Glaive).
- **Divine Shield:** a guard success grants intangibility that the next
  attack, special or grab ends.
- **Mashable statuses** (Sleep, Hex) and a hex that blocks attacks and grabs.
- **Command-grab heal and approach feint** (Vampiric Pounce).

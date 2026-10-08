# Forsaken Paladin: the Forsaken hammer and the Light

Forsaken Paladin wins by standing his ground, calling an approach and landing a loud,
deliberate hammer blow. His new neutral special lifts an opponent into the
next read; his side special drives the hammer forward and slows a retreat.
Consecration lets him contest a landing while his slow feet and committed
swings leave room for a jump, shield or whiff punish.

This is the #216 rework after Tom's 0.0.90 playtest. All new numbers below are
original, provisional Smashcraft tuning. Smash references supply identities
and trade-offs, not copied hitboxes, animation or implementation.

## Forsaken revision, 8 October

This design precedes the revised gameplay implementation. The fighter uses the
actual Forsaken Paladin model from installed Warcraft **3.0.1.24342**,
Units/Creeps/HeroForsakenPaladin/HeroForsakenPaladin. It has 28 sequences and
a different 143-node rig; the Human Paladin clipping fix does not establish
Forsaken clip quality. Rebuild his poses on this chosen model and inspect
both facings at startup, contact and recovery.

[Blizzard’s final 3.0.1 notes](https://us.forums.blizzard.com/en/warcraft3/t/warcraft-iii-reforged-forsaken-kingdom-patch-notes/38400/4)
set Righteous Fury to 90 mana and 40% attack/movement slow; Consecration to
10-second duration/cooldown, 15/20/25 damage and 15/25/35 healing, organic
ground targets only; Sacred Aura to 15/20/25% resistance; Cleansing Fire
keeps non-dispellable effects and correctly stacks its damage buff. The
installed AbilityData has Righteous Fury damage 90/135/180, while the notes
say 90/135/185. Use the matching 40% slow, not the disputed top-rank damage.
Ability IDs are ANcp, AHcr, AHpa and AHcl respectively.

The source identities become these original, provisional Smashcraft moves:

| Input | Reward and risk | Contract | Sources |
| --- | --- | --- | --- |
| Neutral: **Cleansing Hammer** | Raise the hammer and bonk upward; exposed startup and long recovery punish a miss. At contact time cleanse only Forsaken Paladin’s poison or movement slow. | 10 mana; hammer f14–16; end f38; 10.4 damage, 80°, growth 70/base 42. Cleanse at f14 even on a miss. Air drift and 18 landing frames. | HotS Hammer of Justice and Forsaken Cleansing Fire’s dispel; Dedede’s weight and Ike’s single-stroke commitment. |
| Side: **Righteous Fury** | Lead a short charge with the hammer. A body hit slows a retreat; shield blocks the slow and leaves a punish. | 25 mana; travel 0.75H on f15–20; end f49; 11.2 damage, 40°, growth 100/base 25. Movement slowed 40% for 75 frames, then 120 frames immunity. Ground armor absorbs one hit up to 5 damage on f15–18; stops at bodies. Air has no armor, one use per airtime, 20 landing frames and helpless finish. | Forsaken Righteous Fury and its final 3.0.1 slow; Ike’s armored commitment. Shared attack speeds remain unchanged. |
| Up: **Ascension** | Raise and follow the hammer, steer toward the ledge, then fall helplessly with exposed sides. | 15 mana; rise 2.9H over f8–28; stop f29; 0.2H forward plus 1.6H steering. Hammer f10–15 deals 6.4 damage at 80°. Free form has no hit and reaches at least 240 units on either axis under the [#252 recovery measure](../gameplay-design.md#recovery-and-edgeguarding); the paid route remains in the heavy band. Jump spent, one use per airtime. | Paladin resurrection and HotS Hammer of Justice; Ike’s weapon-led Aether without its descent. |
| Down: **Consecration** | Plant the hammer and defend a small holy patch. Jump or retreat to leave it. | Ground only; 20 mana; end f42; pool on f16, 70 units ahead at height 6, radius 60. Life 120 frames; 1.6 damage at most every 45 frames, growth 30/base 30, near-vertical launch. One patch; 150 frames between casts; no growth or healing. | Forsaken Consecration’s ground-only periodic damage, compressed from 10 seconds; Dedede’s placed threat and committed recovery. |

Cleansing Hammer and Righteous Fury make the hammer central; Ascension
carries it into a third special. Consecration does not follow Forsaken Paladin, grow or
hit airborne opponents. Cleansing Hammer removes poison/chill only, leaving
silence, sleep, stun and carries alone. **Sacred Aura** retains the existing
three-block reward: the next non-throw launch is 20% weaker, adapting the
source’s middle-rank resistance to the launch system. Shared EX costs 25 extra
mana for its existing six-frame one-hit armor. There are no ultimates.

The CPU approaches into 50–150 hammer spacing, charges from 170–270, lays
Consecration near a grounded opponent, shields/dodges threats and recovers
with Ascension. Its four primary spacing tools remain forward tilt (6),
neutral special (30), side special (31) and down tilt (8), the original
gameplan's four keys. Consecration is a supporting patch with a 150-frame
cooldown: the computer uses it without making it a fifth primary attack.
The damage multiplier (0.80 since #249; originally 0.85), three extra hammer hitlag
frames, volume 127 heavy bash and readable contact/white-body flash remain.
The new model needs its own flash and contact review. The old 47.6875% field
is historical.

## Sources

- [Warcraft III Paladin](https://classic.battle.net/war3/human/units/paladin.shtml)
  supplies the warhammer, Holy Light, Divine Shield and Devotion Aura.
- [Blizzard's Uther](https://heroes-site-production-eks-prod-apne1-01.heroesofthestorm.blizzard.com/en-us/heroes/uther/)
  supplies Hammer of Justice's interruption, Holy Radiance's line of light,
  Divine Storm's close burst and Eternal Devotion's protection.
- [Nintendo's King Dedede](https://www.smashbros.com/wii/en_us/characters/kingdedede.html)
  supplies the hammer's weight and the risk of a committed strike. Forsaken Paladin does
  not borrow Jet Hammer's charge or self-damage.
- [Nintendo's Ike](https://www.smashbros.com/wii/en_us/characters/ike.html)
  supplies single-stroke strength, brief armor and a weapon-led rising recovery.
- [Nintendo's Lucario](https://www.smashbros.com/wii/en_us/characters/hidden06.html)
  supplies Force Palm's close/ranged distinction and a defensive read that can
  be baited. Forsaken Paladin has no command grab or damage-dependent power.

## The rest of his moves

Existing frame data and normal geometry stay in the fighter's move tables.
A 0.80 multiplier scales all Forsaken Paladin damage after passive bonuses, including
normal attacks, throws and specials. Hitlag still uses the original damage;
the extra three hammer frames remain. The special rows above show final damage.
These rows document their identities and reference relationships;
they are not requests to copy Smash hitboxes or change another fighter.

| Move | Warcraft/HotS identity | Smash reference and role |
| --- | --- | --- |
| Hammer and Haft, both jabs | Paladin's hammer, then its haft | Dedede's short weapon checks; quick close interruption |
| Hammer Sweep, all forward tilt angles | Paladin overhead warhammer | Ike's deliberate single stroke; long spacing arc |
| Guiding Light, up tilt | Hammer of Justice lifting the weapon | Ike's overhead weapon control; start a juggle |
| Low Judgment, down tilt | Paladin's low hammer sweep | Dedede's low reach; call grounded movement |
| Shoulder of Justice, dash attack | Paladin advancing with his hammer | Ike's committed advancing blow; punish a retreat |
| Final Judgment, forward smash | Hammer of Justice made emphatic | Dedede's hammer head reward; strongest close punish |
| Beacon Strike, up smash | HotS Divine Storm's upward holy burst | Ike's tall weapon commitment; punish above |
| Consecrated Sweep, down smash | Divine Storm controlling nearby space | Dedede's heavy surrounding coverage; read a side |
| Hammer Guard, neutral air | Paladin's hammer held around him | Dedede's broad weapon space; contest a cross-up |
| Holy Hammer, forward air | Hammer of Justice in the air | Ike's long single aerial blow; spacing finisher |
| Rearward Boot, back air | Armored Paladin using his boot | Heavyweight close kick; fast exposed rear answer |
| Radiant Lift, up air | Hammer raised in the Light | Ike's overhead weapon; juggle follow-up |
| Falling Judgment, down air | Paladin hammer driven downward | Dedede's committed downward weight; narrow spike |
| Grab and pummel | Paladin's free hand and hammer hilt | Heavyweight short grab; close read, local hilt tap |
| Forward throw | Paladin's palm of judgment | Heavyweight forward throw; gain stage |
| Back throw | Paladin's armored shoulder turn | Heavyweight turn and toss; punish facing the edge |
| Up throw | Warcraft shaft of resurrection light | Weapon-heavyweight lift; short juggle starter |
| Down throw | Hammer pressed beside the opponent | Heavyweight ground throw; chase the escape |
| Get-up and ledge attack | Paladin clearing room with his hammer | Dedede's weight; defend recovery to standing |
| Sacred Aura | Forsaken Sacred Aura, middle-rank 20% resistance | Heavyweight endurance; three blocked hits soften the next launch |

## Weight, sound and pose

Direct hammer strikes with at least 8 damage before the balance multiplier add **three frames of hitlag**
to attacker and victim, including shield contacts. Boot, jab, throw and
Consecration keep their existing stop. The additional stop changes no hitstun or
launch formula. It holds the visible hammer contact pose and the victim's
reaction, and lets the shared heavy-hit glow read.

Hammer contacts use the heavy Warcraft bash at volume 127, alongside the holy
contact spark for specials. That is louder than the ordinary medium hit at
118. The active-region effect follows the authored hammer region through the
shared contact display; Holy Bolt's classic gold-white burst identifies holy
power without hiding the fighter. Effects and sound use the existing event
serials and do not replay on rollback.

The actual Forsaken model supplies the body and rig. Its stock sword is
replaced with the classic Paladin's hammer faces on the Forsaken weapon joint.
Its new rig and all 28 stock clips are inspected before binding or authoring
each action. Both facings must keep the hammer attached and the body clear
at contact.

## Place in the roster

Forsaken Paladin keeps weight 1.10×, ground mobility 0.92× and air speed 0.88 units/frame.
His reach is useful but his commitment and weak chase are exploitable.

| Opponent | What makes Forsaken Paladin different |
| --- | --- |
| Archer | Forsaken Paladin earns his strongest result by approaching into hammer range; his light is a commitment, not constant arrows. |
| Rifleman | Forsaken Paladin carries no bear or trap; direct hammer reads replace projectile flinches and freezing setups. |
| Illidan | Forsaken Paladin plants for individual hits and guards; he has no fast rush branches or jump-cancelled shine. |
| Blademaster | Forsaken Paladin trades stealth and blade strings for blunt launches and a defensive read. |
| Mountain King | Forsaken Paladin keeps the hammer in his hand; no returning thrown hammer, chargeable ground ring or Hammerfall. |
| Warden | Forsaken Paladin has no teleport or poison setup; he contests the opponent in front of him. |
| Lich | His small brief patch has no delayed burst; the hammer is the main threat. |
| Dreadlord | Forsaken Paladin must win a direct hit; no command-grab bite, sleep or life-steal approach. |
| Shadow Hunter | Forsaken Paladin has no ward or polymorph; his defensive read sets up a chosen hammer punish. |
| Pit Lord | Forsaken Paladin's narrow hammer head and short holy patch replace a giant body, spit and broad cleaves. |
| Beastmaster | Forsaken Paladin has no companion or summoned crossfire; the decisive contact is his own weapon. |
| Lich King | His patch never grows or spends souls; a direct slow sets up hammer reads. |
| Thrall | Held hammer and short holy patch instead of lightning and spirit crossfire. |
| Jaina | Close weapon contact instead of aimed spell rain. |
| Sylvanas | A hammer slow instead of ranged silence or possession. |
| Cairne | A narrow hammer head and small patch instead of wide totem/stomp. |
| Chen | Single committed hits instead of stance branches and haze/flame. |
| Peon | No burrow, building or resource summon. |
| Tinker | Direct weapon contact instead of factory or transformation. |
| Kael’thas | Held hammer instead of aimed Flame Strike or siphon. |

## Play-style profile

Tom-tunable draft (8 Oct; smashcraft:docs/design/balance.md, "Play-style profiles"). A heavy hammer spaced around a short, fixed holy patch.

The computer runs in with Hammer Sweep or a grab. Beyond Hammer Sweep's reach,
it uses Righteous Fury to catch a retreating target; an approaching target comes
into hammer range first. At close range the charge competes with the hammer
attacks. This keeps the slow as a read instead of the default approach (#275).

```balance-profile
fighter: forsaken-paladin
archetype: bait-and-punish
aerials: nair 10-40, fair 15-45, bair 15-45, uair 5-30, dair 0-25
air-share: 15-45
approach: 40-70
ranged: 0-20
specials: neutral 1-10, side 2-12, up 0-8, down 2-12
```

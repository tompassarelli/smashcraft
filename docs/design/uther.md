# Uther: the Forsaken hammer and the Light

Uther wins by standing his ground, calling an approach and landing a loud,
deliberate hammer blow. His new neutral special lifts an opponent into the
next read; his side special drives the hammer forward and sends holy light
beyond its head. Protection buys him a chance to take space. It does not win
the exchange for him.

This is the #216 rework after Tom's 0.0.90 playtest. All new numbers below are
original, provisional Smashcraft tuning. Source games supply identities and
trade-offs, never copied hitboxes, animation or implementation.

## Forsaken revision, 8 October

This design precedes the revised gameplay implementation. Uther uses the
actual Forsaken Paladin model from installed Warcraft **3.0.1.24342**,
Units/Creeps/HeroForsakenPaladin/HeroForsakenPaladin. It has 28 sequences and
a different 143-node rig; the Human Paladin clipping fix does not establish
Forsaken clip quality. Rebuild Uther poses on this chosen model and inspect
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
| Neutral: **Cleansing Hammer** | Raise the hammer and bonk upward; exposed startup and long recovery punish a miss. At contact time cleanse only Uther’s poison or movement slow. | 10 mana, f14–16, end f38, 11.05 damage, 80°, growth70/base42. Cleanse at f14 even on a miss; no heal, buff or removal of hard control. Air drift and 18 landing frames. | HotS Hammer of Justice and Forsaken Cleansing Fire’s dispel; Dedede’s weight and Ike’s one-stroke commitment. |
| Side: **Righteous Fury** | Lead a short charge with the hammer. A body hit slows a retreat; shield blocks the slow and leaves a punish. | 25 mana, travel0.75H on f15–20, end f49, 11.9 damage,40°,growth100/base25. Body hit slows movement40% for75frames, then120 immunity. Ground one-hit armor up to5damage f15–18, stops at bodies; air no armor, once per airtime,20 landing and helpless. No wave. | Forsaken Righteous Fury and its final3.0.1 slow; Ike’s armored commitment. Shared attack speeds remain unchanged. |
| Up: **Ascension** | Raise and follow the hammer, steer toward the ledge, then fall helplessly with exposed sides. |15mana, rise2.9H overf8–28, stopf29,0.2H forward plus1.6H steering. Hammerf10–15 deals6.8damage at80°. Free form rises2.0H without a hit. Jump spent, once per airtime. | Paladin resurrection and HotS Hammer of Justice; Ike’s weapon-led Aether without its descent. |
| Down: **Consecration** | Plant the hammer and defend a small holy patch. Jump or retreat to leave it. | Ground only,20mana,endf42,poolf16 at70ahead,z6,radius60. Life120frames;1.7damage at most every45frames,growth30/base30,near-vertical launch. One patch,150frames between casts, no growth/heal. | Forsaken Consecration’s ground-only periodic damage, compressed from10seconds; Dedede’s placed threat and committed recovery. |

Cleansing Hammer and Righteous Fury make the hammer central; Ascension
carries it into a third special. Consecration does not follow Uther, grow or
hit airborne opponents. Cleansing Hammer removes poison/chill only, leaving
silence, sleep, stun and carries alone. **Sacred Aura** retains the existing
three-block reward: the next non-throw launch is20% weaker, adapting the
source’s middle-rank resistance to the launch system. Shared EX costs25extra
mana for its existing six-frame one-hit armor. There are no ultimates.

The CPU approaches into50–150 hammer spacing, charges from170–270, lays
Consecration near a grounded opponent, shields/dodges threats and recovers
with Ascension. The original0.85damage multiplier, extra3hammer hitlag frames,
volume127 heavy bash and readable contact/white-body flash remain. The new
model needs its own flash and contact review. The old47.6875% field is historical.

## Sources

- [Warcraft III Paladin](https://classic.battle.net/war3/human/units/paladin.shtml)
  supplies the warhammer, Holy Light, Divine Shield and Devotion Aura.
- [Blizzard's Uther](https://heroes-site-production-eks-prod-apne1-01.heroesofthestorm.blizzard.com/en-us/heroes/uther/)
  supplies Hammer of Justice's interruption, Righteous Fury's line of light,
  Divine Storm's close burst and Eternal Devotion's protection.
- [Nintendo's King Dedede](https://www.smashbros.com/wii/en_us/characters/kingdedede.html)
  supplies the hammer's weight and the risk of a committed strike. Uther does
  not borrow Jet Hammer's charge or self-damage.
- [Nintendo's Ike](https://www.smashbros.com/wii/en_us/characters/ike.html)
  supplies single-stroke strength, brief armor and a weapon-led rising recovery.
- [Nintendo's Lucario](https://www.smashbros.com/wii/en_us/characters/hidden06.html)
  supplies Force Palm's close/ranged distinction and a defensive read that can
  be baited. Uther has no command grab or damage-dependent power.

## The rest of his moves

Existing frame data and normal geometry stay in the fighter's move tables.
A 0.85 multiplier scales all Uther damage after passive bonuses, including
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
| Sacred Aura | Forsaken Sacred Aura, middle-rank20% resistance | Heavyweight endurance; three blocked hits soften the next launch |

## Weight, sound and pose

Direct hammer strikes with at least 8 damage before the balance multiplier add **three frames of hitlag**
to attacker and victim, including shield contacts. Boot, jab, throw and light
wave keep their existing stop. The additional stop changes no hitstun or
launch formula. It holds the visible hammer contact pose and the victim's
reaction, and lets the shared heavy-hit glow read.

Hammer contacts use the heavy Warcraft bash at volume 127, alongside the holy
contact spark for specials. That is louder than the ordinary medium hit at
118. The active-region effect follows the authored hammer region through the
shared contact display; Holy Bolt's classic gold-white burst identifies holy
power without hiding the fighter. Effects and sound use the existing event
serials and do not replay on rollback.

The actual Forsaken model supplies the hammer and body. Its new rig and all
28 stock clips are inspected before binding or authoring each action. Both
facings must keep the weapon attached and the body clear at contact.

## Place in the roster

Uther keeps weight 1.10×, ground mobility 0.92× and air speed 0.88 units/frame.
His reach is useful but his commitment and weak chase are exploitable.

| Opponent | What makes Uther different |
| --- | --- |
| Archer | Uther earns his strongest result by approaching into hammer range; his light is a commitment, not constant arrows. |
| Rifleman | Uther carries no bear or trap; direct hammer reads replace projectile flinches and freezing setups. |
| Illidan | Uther plants for individual hits and guards; he has no fast rush branches or jump-cancelled shine. |
| Blademaster | Uther trades stealth and blade strings for blunt launches and a defensive read. |
| Mountain King | Uther keeps the hammer in his hand; no returning thrown hammer, chargeable ground ring or Hammerfall. |
| Warden | Uther has no teleport or poison setup; he contests the opponent in front of him. |
| Lich | His small brief patch has no delayed burst; the hammer is the main threat. |
| Dreadlord | Uther must win a direct hit; no command-grab bite, sleep or life-steal approach. |
| Shadow Hunter | Uther has no ward or polymorph; his defensive read sets up a chosen hammer punish. |
| Pit Lord | Uther's narrow hammer head and short holy patch replace a giant body, spit and broad cleaves. |
| Beastmaster | Uther has no companion or summoned crossfire; the decisive contact is his own weapon. |
| Lich King | His patch never grows or spends souls; a direct slow sets up hammer reads. |

| Thrall | Held hammer and short holy patch instead of lightning and spirit crossfire. |
| Jaina | Close weapon contact instead of aimed spell rain. |
| Sylvanas | A hammer slow instead of ranged silence or possession. |
| Cairne | A narrow hammer head and small patch instead of wide totem/stomp. |
| Chen | Single committed hits instead of stance branches and haze/flame. |
| Peon | No burrow, building or resource summon. |
| Tinker | Direct weapon contact instead of factory or transformation. |
| Kael’thas | Held hammer instead of aimed Flame Strike or siphon. |

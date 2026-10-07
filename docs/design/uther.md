# Uther: the hammer and the Light

Uther wins by standing his ground, calling an approach and landing a loud,
deliberate hammer blow. His new neutral special lifts an opponent into the
next read; his side special drives the hammer forward and sends holy light
beyond its head. Protection buys him a chance to take space. It does not win
the exchange for him.

This is the #216 rework after Tom's 0.0.90 playtest. All new numbers below are
original, provisional Smashcraft tuning. Source games supply identities and
trade-offs, never copied hitboxes, animation or implementation.

## Sources

- [Warcraft III Paladin](https://classic.battle.net/war3/human/units/paladin.shtml)
  supplies the warhammer, Holy Light, Divine Shield and Devotion Aura.
- [Blizzard's Uther](https://heroes-site-production-eks-prod-apne1-01.heroesofthestorm.blizzard.com/en-us/heroes/uther/)
  supplies Hammer of Justice's interruption, Holy Radiance's line of light,
  Divine Storm's close burst and Eternal Devotion's protection.
- [Nintendo's King Dedede](https://www.smashbros.com/wii/en_us/characters/kingdedede.html)
  supplies the hammer's weight and the risk of a committed strike. Uther does
  not borrow Jet Hammer's charge or self-damage.
- [Nintendo's Ike](https://www.smashbros.com/wii/en_us/characters/ike.html)
  supplies single-stroke strength, brief armor and a weapon-led rising recovery.
- [Nintendo's Lucario](https://www.smashbros.com/wii/en_us/characters/hidden06.html)
  supplies Force Palm's close/ranged distinction and a defensive read that can
  be baited. Uther has no command grab or damage-dependent power.

## Specials

Frames in this table use the kit's one-based convention: f1 is the entry tick;
end fN allows another action on fN+1. Every strike hits each opponent once.

| Input | Decision, reward and risk | Authored contract | Sources |
| --- | --- | --- | --- |
| Neutral: **Hammer of Justice** | Plant, raise the hammer, then bonk the opponent upward. A closer, faster launcher than a smash; shield or step out and punish its recovery. | 10 mana; hammer f14–16; end f38; 13 damage, 80° launch, growth 70/base 42; reaches 140 units forward. Air form keeps drift, 18 landing frames. No armor, invulnerability, cooldown or cancel. | HotS Hammer of Justice; Dedede's weight with Ike's single decisive hit. |
| Side: **Holy Radiance** | Commit forward with the hammer. The close hit is the reward; light continues beyond the hammer to contest someone retreating. Jump over the line or shield the lunge and punish the stop. | 20 mana; travel 0.75H over f15–20; hammer f15–20; end f49. Hammer 14 damage at 40°, growth 100/base 25. One light wave on f21 starts 150 units ahead, speed 0.11H/frame, 24-frame life, 18 radius; 6 damage at 40°, growth 80/base 16. Ground armor absorbs one ≤5-damage hit on f15–18; stops at bodies. Air has no armor, once per airtime, 20 landing frames and helpless finish. | HotS Holy Radiance, channelled through the Warcraft warhammer; Lucario Force Palm's strong close hit and weaker reach, Ike's short armor. |
| Up: **Ascension** | Lift the hammer and follow it upward; spend the jump and accept a helpless fall. Challenge its exposed sides or catch the landing. | 15 mana; rises 1.9H and travels 0.45H, f8–29; hammer f10–15, 8 damage at 80°. Below 15 mana, free recovery rises 1.3H without a hit. One use per airtime; helpless. | Warcraft resurrection/light and HotS Hammer of Justice; Ike's weapon-led Aether, without its descent. |
| Down: **Divine Shield** | Read a strike, then reposition for a hammer punish. The shield ends when Uther attacks; an opponent can wait or grab. | Ground only, 25 mana; intangible/guard f6–9; end f36. A strike overlapping the guard grants 45 frames of protection, ended by attack, special or grab. No healing, damage, automatic counter or air cast. | Warcraft/HotS Divine Shield; Lucario's Double Team read, with player-chosen retaliation. |

H is the shared 140-unit design height. The light wave begins beyond the direct
hammer rather than overlapping its head. It is reflectable and limited to one
live wave. Ordinary shield damage uses actual damage; the stronger side strike
pays 29 frames after its final active frame. Neutral pays 22. No special gains
a shield-damage multiplier.

Hammer of Justice is a launcher, not a fixed stun: ordinary DI, SDI, hitstun,
air dodge and tech rules apply. Follow with an up air, chase a landing or wait
for the defensive option. It has no scripted second hit or guaranteed loop.
Low Judgment and the existing up throw remain other starters.

## The rest of his moves

Existing frame data, normal geometry and throw outcomes stay in the fighter's
move tables. These rows document their identities and reference relationships;
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
| Devotion Aura | Warcraft Devotion Aura, HotS armor | Heavyweight endurance; three blocked hits soften the next launch |
| Guardian of the Light | HotS Eternal Devotion and Warcraft Divine Shield | Ike's power/protection emphasis; existing finite offensive window |

## Weight, sound and pose

Direct hammer strikes dealing at least 8 damage add **three frames of hitlag**
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

Hammer of Justice uses Paladin Attack-2: raised hammer, descending head,
planted follow-through. Holy Radiance uses Attack-1: wind back, forward sweep,
recover behind the advancing foot. Ascension retains Spell's raised hammer;
Divine Shield retains the channel stance. Align the first active frame with
the existing measured strike moment. Classic Paladin art remains the model.

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
| Lich | Uther carries his threat on the hammer instead of placing frost/decay zones. |
| Dreadlord | Uther must win a direct hit; no command-grab bite, sleep or life-steal approach. |
| Shadow Hunter | Uther has no ward or polymorph; his defensive read sets up a chosen hammer punish. |
| Pit Lord | Uther's narrow hammer head and light wave replace a giant body, spit and broad cleaves. |
| Beastmaster | Uther has no companion or summoned crossfire; the decisive contact is his own weapon. |
| Lich King | Uther has no soul-spending or persistent ground corruption; short protection supports immediate hammer reads. |

The computer approaches for hammer spacing, uses Radiance outside that range,
guards predicted strikes and saves Ascension for recovery. Coverage records
each of the four special inputs separately. Balance uses the original seeded
Wren Expert field; Tom's playtest decides whether the bonks are fun.

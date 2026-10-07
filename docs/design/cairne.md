# Cairne Bloodhoof: the mountain that moves

Cairne is the true super-heavyweight. His totem controls a large patch of
ground, his weight lets him survive a poor exchange, and an earned burst of
Endurance Aura helps him reach his next read. His enormous body, slow whiffs
and exposed recovery give opponents clear ways to beat him. All move values,
hit regions and animation are original, provisional Smashcraft choices.

## References and body

The [Warcraft Tauren Chieftain](https://liquipedia.net/warcraft/Tauren_Chieftain)
supplies Shockwave, War Stomp, Endurance Aura and Reincarnation.
[Blizzard's original unit guide](https://classic.battle.net/war3/orc/units/taurenchieftain.shtml)
describes their original roles: a line attack, a surrounding stomp, movement
and attack support, and delayed revival. Those identities become readable
platform-fighter decisions rather than Warcraft's long disables.

[King K. Rool in Ultimate](https://www.ssbwiki.com/King_K._Rool_(SSBU)#Stats)
is the named body counterpart: weight **133**, run speed **1.485**, air speed
**0.945**. The implementation divides weight by the roster's reference 75,
run speed by Archer's 2.2 and uses the air speed directly as the hero's air
multiplier. Width **1.75×** and height **1.45×** are original body scales,
larger than Pit Lord's 1.65/1.35; shield scale is 1.45. Jumps, gravity and
shared defensive actions retain the roster's common rules.

[Bowser](https://www.ssbwiki.com/Bowser_(SSBU)) supplies the heavyweight
trade-off: decisive close strikes balanced by a large target and punishable
commitment. [Ike's Eruption](https://www.ssbwiki.com/Eruption) informs
Shockwave's planted ground strike and recovery; Cairne releases one finite
wave without charge or self-damage. [Donkey Kong's Hand Slap](https://www.ssbwiki.com/Hand_Slap)
informs War Stomp's low surrounding launch; it is one committed stomp rather
than a repeatable stun. No external code, hitbox tables or animation is reused.

## Full kit

Frames are one-based: f1 is entry. F/A/R are first active frame, number of
active frames and recovery frames. L is authored aerial landing lag; the
shared landing rule halves it. H is the 132-unit reference height. Totem
wood beyond Cairne's hands is disjoint; hands, shoulders, horns and hooves
carry hurt volumes. A positive contact window hits each opponent once.

Every Warcraft link below names the identity being adapted, and every Smash
link names a relationship, not copied frame data or geometry.

| Move | Original contract and decision | Warcraft source | Smash reference |
| --- | --- | --- | --- |
| Jab 1, Haft Check | 7/3/18; 5 damage; short haft check. | [Chieftain's totem][wc] | [Bowser close jab][bowser] |
| Jab 2, Totem Butt | 9/3/23; 8 damage; fresh press finishes the two-hit chain. | [Totem][wc] | [K. Rool's finite jab sequence][krool] |
| Forward tilt, all angles | 14/4/29; 13 damage; totem sweeps from high to low, reaches 170. | [Totem][wc] | [Bowser's deliberate forward tilt][bowser] |
| Up tilt | 13/5/27; 12 damage; raised totem launches at 85 degrees. | [Totem][wc] | [K. Rool's overhead control][krool] |
| Down tilt | 11/3/25; 10 damage; low shaft lifts at 70 degrees. | [Totem][wc] | [K. Rool's low ground coverage][krool] |
| Dash attack | 16/5/33; 15 damage; exposed shoulder drives forward 32 units. | [Endurance Aura][wc] | [K. Rool's committed body charge][krool] |
| Forward smash | 28/4/42; head 25, shaft 19 damage; 190 reach and long punish window. | [Totem/War Stomp][wc] | [Bowser's hard read][bowser] |
| Up smash | 25/5/39; 23 damage; narrow overhead pillar, weak lateral coverage. | [Totem][wc] | [K. Rool's vertical commitment][krool] |
| Down smash | 23/7/40; 19 damage; front then rear ground sweep. | [War Stomp][wc] | [Bowser's two-sided punish][bowser] |
| Neutral air | 12/7/29/L22; 13 damage; totem circles front then back. | [Totem][wc] | [Bowser's surrounding aerial][bowser] |
| Forward air | 20/4/36/L26; 19 damage; descending totem wall, outward launch. | [Totem][wc] | [Bowser's forward wall][bowser] |
| Back air | 15/4/30/L22; 16 damage; rearward totem strike. | [Totem][wc] | [K. Rool's committed rear attack][krool] |
| Up air | 12/4/28/L20; 13 damage; narrow horn rise; horns are hittable. | [Tauren body][wc] | [Bowser's overhead head strike][bowser] |
| Down air | 21/5/38/L28; 18 damage; totem downward, meteor in air and 55-degree launch on ground. | [War Stomp/totem][wc] | [K. Rool's deliberate downward strike][krool] |
| Grab | 11/3/31; short free-hand reach; shared shield grab and escape. | [Tauren strength][wc] | [Bowser's close grab][bowser] |
| Pummel | Shared contact f60, end f68; 3 damage; at most one pummel, escapable by mashing. | [Totem haft][wc] | [Heavyweight local pummel][bowser] |
| Forward throw | Contact f19, end f45; 11 damage at 35 degrees; stage control. | [Tauren strength][wc] | [Bowser's outward toss][bowser] |
| Back throw | Contact f23, end f54; 13 damage at 40 degrees backward; edge read. | [Tauren strength][wc] | [K. Rool's powerful back throw][krool] |
| Up throw | Contact f21, end f32; 10 damage near vertical; juggle starter. | [Totem lift][wc] | [Heavyweight upward throw][bowser] |
| Down throw | Contact f24, end f51; 9 damage at 25 degrees; tech chase, no bury. | [War Stomp][wc] | [K. Rool's grounded throw read][krool] |
| Get-up and ledge attack | Shared recovery timings; totem clears room in the strike direction. | [Totem][wc] | [Heavyweight recovery attack][bowser] |

## Specials, passive and ultimate

| Input | Original contract, reward and counterplay | Warcraft source | Smash reference |
| --- | --- | --- | --- |
| Neutral: **Shockwave** | 15 mana; wave f24, end f58. One reflectable wave, 10 damage, radius 20, speed 13/frame and life 38. It starts 72 units ahead at height 24. Jump above it or shield and close during recovery. Air form has 24 landing frames and no stall. | [Shockwave][wc] | [Eruption's planted ground attack][eruption] |
| Side: **War Stomp** | 20 mana; advance 66 units over f12–17, stomp f20–23, end f57. Front/rear low strike, 13 damage at 80 degrees, growth 70/base 42. No stun, armor or shield bonus. Air form has 26 landing frames and no ground shockwave beyond its authored low region. | [War Stomp][wc] | [Hand Slap's low surrounding launcher][slap] |
| Up: **Spirit Lift** | 15 mana; rise 1.75H and move 0.55H over f11–32; totem f11–16 for 9 damage at 80 degrees. Free form rises 1.2H/moves 0.35H with no hit. One use per airtime, spends aerial jump, ends helpless. Sides and landing remain exposed. | [Ancestral spirit of Reincarnation][wc] | [Bowser's finite recovery commitment][bowser] |
| Down: **Reincarnation** | Ground only, 25 mana; guard and intangibility f6–9, end f46. Correctly reading a damaging contact heals 12 damage, capped at 24 per stock. Whiff, wait or grab beats it. It restores no stock, does not move Cairne and cannot rescue a KO. | [Reincarnation][wc] | [K. Rool's baitable defensive read][krool] |
| Passive: **Endurance Aura** | Two distinct landed melee attacks within 180 frames grant 120 frames of 10% faster ground movement. No attack-frame or aerial-speed change; stocks/rematches clear it. The large body still has to approach. | [Endurance Aura][wc] | [K. Rool's ground/air mobility trade-off][krool] |
| Ultimate: **Ancestral Reincarnation** | Designed for the roster's future ultimate mode: one grounded 60-frame ritual at 100+ damage heals 35 once per match; taking a hit interrupts and spends it. No invulnerability or stock revival. Like today's hero ultimates, named metadata only while the shared ultimate action is disabled. | [Reincarnation][wc] | [Bowser's survival traded against commitment][bowser] |

War Stomp, up tilt and up throw start follow-ups. They use ordinary DI, SDI,
hitstun and tech rules, with no scripted second hit, bury, capture or stun.
The defender can change the landing and Cairne must choose a chase. Stronger
hits retain longer recovery; no move adds shield damage beyond its damage.
All state uses the existing passive, guard, projectile and special records,
including stock/rematch reset and replay copies.

## Place in the roster and presentation

Compared with Archer and Rifleman, Cairne gives up repeated ranged pressure
for one low wave and direct hits. Compared with Illidan, Blademaster and
Warden, he gives up burst mobility and evasive branches for survival. Compared
with Mountain King and Uther, he is larger, slower and has broader totem reach.
Compared with Lich and Shadow Hunter, he has no placed control zone. Compared
with Dreadlord, he has no capture or sleep. Compared with Pit Lord, he is
heavier and taller, with a low straight wave and launcher rather than an arc
projectile and armored charge. Compared with Beastmaster, he fights with one
body. Compared with the Lich King, he has no soul resource or persistent pool.

Use the base-game Tauren Chieftain model and command portrait, stock Warcraft
impact sounds and Shockwave/War Stomp effects. His totem remains attached;
the gesture plants his feet, moves the whole shoulder and follows through.
Map or author the complete hero pose table, including both sides of throws,
recovery, and nine pain poses. The computer seeks totem spacing, sends a wave
at distant ground approaches, stomps close targets, reads incoming attacks
with Reincarnation and saves Spirit Lift for returning to the ledge.

[wc]: https://liquipedia.net/warcraft/Tauren_Chieftain
[bowser]: https://www.ssbwiki.com/Bowser_(SSBU)
[krool]: https://www.ssbwiki.com/King_K._Rool_(SSBU)
[eruption]: https://www.ssbwiki.com/Eruption
[slap]: https://www.ssbwiki.com/Hand_Slap

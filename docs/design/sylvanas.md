# Sylvanas Windrunner: the Dark Ranger

Sylvanas makes an opponent choose between advancing through a black arrow,
jumping into her bow, or shielding where Life Drain can catch them. Silence
temporarily removes offensive specials while leaving movement, normals,
defense and recovery available. She wins through spacing and a read, with
short melee reach and punishable casts when that read misses.

This is the original #224 kit. Numbers are provisional Smashcraft tuning;
references supply character identity and decision structure, not copied
hitboxes, animations or code. Frames below count entry as frame 1, with
inclusive active windows. H is the shared 132-unit design height.

## Research and body

[Liquipedia's Dark Ranger](https://liquipedia.net/warcraft/Dark_Ranger) and
[Blizzard's Dark Ranger](https://classic.battle.net/war3/neutral/darkranger.shtml)
identify Black Arrow, Silence, Life Drain and Charm. Black Arrow turns a
victim's death into a minion in Warcraft; here it instead builds a readable
bow-to-melee reward. Life Drain is a vulnerable commitment with a healing
reward. Silence restricts casting, not the victim's controls as a whole.
[Blizzard's Banshee](https://classic.battle.net/war3/undead/units/banshee.shtml)
supplies the spirit and Possession identity.

The named physical counterpart is
[Ultimate Pit](https://www.ssbwiki.com/Pit_(SSBU)): weight **96**, run **1.828**
Smash units/frame and maximum air speed **0.935**. Smashcraft uses six world
units per Smash unit: run 10.968 and air 5.61. Hero body multipliers are
96/75 weight, 1.828/2.2 run and 0.935 air. Width 0.90 and height 1.00 are
original visual choices. The shared jump, gravity and dodge rules remain.
This gives her moderate survival, limited aerial pursuit and a retreat that
needs room; it does not give her Pit's extra jumps.

[Pit](https://www.ssbwiki.com/Palutena_Bow) and
[Link](https://www.ssbwiki.com/Bow_and_Arrows) supply the arrow's commitment
and line-of-fire decision. Sylvanas shoots one straight arrow, aimed up at
release when the stick is raised, without homing or post-release steering.
[Palutena's Explosive Flame](https://www.ssbwiki.com/Explosive_Flame) supplies
the idea of occupying a chosen range and making the opponent leave it.
[Mewtwo's Disable](https://www.ssbwiki.com/Disable) supplies a short-range
status read; Sylvanas's Silence never stuns or reverses controls.

## Normals and throws

Each row's Warcraft source is the linked Dark Ranger's bow, arrow, life
magic or banshee identity. Named techniques below are authoring descriptions;
the game's common move list continues to call normals jab, tilt and aerial.
The three jab presses are short bow checks, never three full arrow shots.
Every attack hits a target once. Forward-tilt angles are separate authored
bow positions. Aerial landing lag is halved automatically by the common rule.

| Action | First/active/recovery; landing | Damage, launch and reach | Warcraft source | Smash relationship |
| --- | --- | --- | --- | --- |
| Jab 1 / 2 / 3 | 4/2/13, 5/2/14, 6/2/17 | 3/3/5; 35°/45°/55°; 54/59/66 | [Dark Ranger bow][ranger] | [Pit bow checks][pit], a close interrupt |
| Forward tilt, level/up/down | 9/3/20 | 8; 40°; 112, angled to 80/46/18 height | [Dark Ranger bow][ranger] | [Pit forward tilt][pit], spacing with the bow's tip |
| Up tilt | 8/4/19 | 7; 85°; overhead to 140 | [Banshee's lift][banshee] | [Palutena up tilt][palutena], catch a landing |
| Down tilt | 7/3/18 | 6; 75°; 92 | [Dark Ranger bow][ranger] | [Pit down tilt][pit], a low launcher |
| Dash attack | 10/3/23 | 9; 50°; 110 | [Dark Ranger advancing bow][ranger] | [Link dash attack][link], committed approach |
| Forward smash | 17/3/30 | 15; 40°; 142 | [Black Arrow drawn point-blank][ranger] | [Link forward smash][link], deliberate finishing commitment |
| Up smash | 15/4/29 | 13; 90°; overhead to 170 | [Banshee's rising power][banshee] | [Palutena up smash][palutena], narrow vertical control |
| Down smash | 14/6/28 | 12; 25°; 108 front then rear | [Dark Ranger bow sweep][ranger] | [Pit down smash][pit], cover two sides sequentially |
| Neutral air | 6/5/18; 12 | 7; 50°; 88 front then rear | [Dark Ranger bow][ranger] | [Pit neutral air][pit], surrounding weapon coverage |
| Forward air | 10/3/23; 16 | 10; 40°; 120 | [Dark Ranger bow][ranger] | [Pit forward air][pit], forward spacing |
| Back air | 8/3/22; 12 | 11; 35° backward; 110 | [Dark Ranger retreating bow][ranger] | [Pit back air][pit], stronger rearward spacing |
| Up air | 8/4/20; 12 | 8; 85°; overhead to 126 | [Banshee lift][banshee] | [Palutena up air][palutena], chase upward |
| Down air | 12/4/28; 20 | 11; spike in air, 55° on ground; 90 below | [Dark Ranger downward bow][ranger] | [Link down air][link], a risky downward commitment |
| Grab | 7/2/23 | Hand reaches 60; no damage | [Life Drain reach][ranger] | [Palutena grab][palutena], punish a held shield |
| Pummel | Shared 60-frame contact, one per hold | 3; no launch | [Life Drain][ranger] | [Palutena pummel][palutena], visible commitment |
| Forward throw | contact 13, total 33 | 7; 40°, growth 100/base 24 | [Charm's dismissal][ranger] | [Pit forward throw][pit], send to the edge |
| Back throw | contact 16, total 37 | 8; 40° backward, growth 100/base 24 | [Possession's turn][banshee] | [Palutena back throw][palutena], reverse position |
| Up throw | contact 14, total 24 | 6; 90°, growth 55/base 45 | [Banshee lift][banshee] | [Pit up throw][pit], start a juggle |
| Down throw | contact 18, total 39 | 6; 25°, growth 40/base 75 | [Life Drain's release][ranger] | [Palutena down throw][palutena], begin a tech chase |
| Get-up / ledge attack | Shared roster actions | Shared grounded release; bow sweep | [Dark Ranger bow][ranger] | [Pit floor/ledge attacks][pit], earn room to stand |

All ordinary hitlag, shielding and launch formulas apply. Normals have no
armor, intangibility, mana cost or cancel beyond shared jab and smash rules.
Smashes charge at most 45 frames for at most 1.25× damage. A bow is a
disjoint; the reaching arm and kicking leg remain hittable. Up/down tilt and
up throw create follow-ups that still use DI, SDI, air dodge and techs; there
is no scripted follow-up or command-grab loop through throw hitstun.

## Specials, passive and ultimate

| Input | Contract and player decision | Warcraft source | Smash reference |
| --- | --- | --- | --- |
| Neutral: **Black Arrow** | 8 mana, fires f16, end f40. One reflectable arrow, speed 17, life 36, radius 10; 6 damage, 35°, growth 70/base 16. Starts 44 ahead and 60 high; up aim adds 5 upward speed. Limit one live arrow. Air landing lag 16. Jump over, shield or reflect it; her recovery gives time to advance. | [Black Arrow][ranger] | [Pit][pitbow] / [Link][linkbow], aim and commitment |
| Side: **Silence** | 20 mana; f18–20 spectral strike reaches 155, end f48. 4 damage, 60°, growth 45/base 20. Body contact silences for 90 frames, then grants 180 frames of silence immunity. Shields stop it. Movement, normals, grabs, defense and up-special remain available. Air landing lag 20. | [Silence][ranger] | [Disable][disable], bait a short-range status cast; [Palutena control][flame] |
| Up: **Banshee Flight** | 15 mana; f8–31 rises 2H and live-stick drifts up to 0.9H. No hitbox or intangibility. Once per airtime, spends aerial jump, ends helpless. Under 15 mana: free 1.4H rise and 0.45H drift. Challenge the exposed ascent or punish landing. | [Banshee spirit][banshee] | [Pit Power of Flight][flight], vulnerable aimed recovery |
| Down: **Life Drain** | Ground only, 20 mana; command grab f16–18, reach 80; whiff ends f52. Holds 16 frames, releases for 9 damage at 50°, growth 90/base 24, then 28 recovery. Heals 3 damage, capped at 9 per stock. Shield loses, jump/dodge or an outside hit wins. | [Life Drain][ranger] | [Mewtwo Confusion][confusion], deliberate close catch |
| Passive: **Black Quiver** | Each unblocked Black Arrow banks one charge, up to two for 240 frames. The next melee contact spends all charges for +2 damage each; a shield spends them without the bonus. Stock loss clears them. | [Black Arrow's death magic][ranger] | [Palutena's zoning into normals][palutena], projectile reward requires approaching |
| Ultimate: **Charm** | Designed ultimate: briefly command a spectral enemy echo to fire at the nearest foe. It remains disabled with every other roster ultimate; there is no new ultimate input or enabled action. | [Charm][ranger] and [Possession][banshee] | [Palutena's Black Hole Laser][blackhole], a committed control payoff |

Silence's status is the existing special-blocking status, not a freeze. Life
Drain uses the existing command-grab break and throw-immunity rules. Mana,
charges, hit registries, healing cap, status immunity and projectile state are
all ordinary snapshotted fighter state; rematch and stock loss clear them.

## Roster role and presentation

Archer has fast arrows and a trap; Sylvanas must land an arrow and move in to
cash it out. Rifleman threatens a faster straight line; Sylvanas threatens
the opponent's special choice. Illidan and Blademaster chase with mobility;
she retreats and reads. Mountain King and Uther have stronger close trades;
she keeps them outside Life Drain's whiff range. Warden relocates; Sylvanas
has a visible, hittable flight. Lich slows movement; Silence leaves it free.
Dreadlord heals from an advancing catch; Sylvanas stands still for hers.
Shadow Hunter and Beastmaster place allies; Sylvanas has no persistent body.
Pit Lord wins broad collisions; her bow uses narrower deliberate lines.
Lich King banks souls for specials; Black Quiver spends on a normal.

Use the stock Warcraft III Sylvanas Dark Ranger model and command portrait,
stock dark-arrow and banshee effects, and stock model sound cues. The bow
draws for Black Arrow, the free hand pushes out for Silence, both shoulders
open for flight and the free arm reaches then pulls for Life Drain. Normal
clips show the actual bow direction at contact. Rolls tuck, throws separate
holder and captive, and damage has nine articulated height/intensity poses.
Private derived models and pooled clips stay in the private input store.

The bot keeps 110–190 units, fires arrows outside melee, uses Silence from
its near range, reads shield with Life Drain and saves flight for returning.
The issue owns the move contracts, bot coverage, unchanged 40–60% field
measurement and Tom's fun check.

[ranger]: https://liquipedia.net/warcraft/Dark_Ranger
[banshee]: https://classic.battle.net/war3/undead/units/banshee.shtml
[pit]: https://www.ssbwiki.com/Pit_(SSBU)
[palutena]: https://www.ssbwiki.com/Palutena_(SSBU)
[link]: https://www.ssbwiki.com/Link_(SSBU)
[pitbow]: https://www.ssbwiki.com/Palutena_Bow
[linkbow]: https://www.ssbwiki.com/Bow_and_Arrows
[disable]: https://www.ssbwiki.com/Disable
[flame]: https://www.ssbwiki.com/Explosive_Flame
[flight]: https://www.ssbwiki.com/Power_of_Flight
[confusion]: https://www.ssbwiki.com/Confusion
[blackhole]: https://www.ssbwiki.com/Black_Hole_Laser

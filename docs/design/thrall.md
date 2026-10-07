# Thrall, the Far Seer

Thrall is a heavy ground-control brawler. Doomhammer threatens the space just
outside a jab, lightning checks a retreat, and two spirit wolves make the
opponent jump into his hammer. Earthquake catches a grounded approach but
leaves time to jump or punish its recovery. Values below are original,
provisional Smashcraft values, not copied hitboxes or animation.

## Sources and body

[Wowpedia's Thrall](https://wowpedia.fandom.com/wiki/Thrall) and
[Doomhammer](https://wowpedia.fandom.com/wiki/Doomhammer) establish the warrior,
shaman and hammer. The [Far Seer](https://liquipedia.net/warcraft/Far_Seer)
supplies Chain Lightning, Feral Spirit, Far Sight and Earthquake; Blizzard's
[Far Seer unit page](https://classic.battle.net/war3/orc/units/farseer.shtml)
is the original ability reference. Only these ability identities and numerical
facts are reused; no outside implementation, prose or animation is copied.

The body counterpart is [Ultimate King Dedede](https://www.ssbwiki.com/King_Dedede_(SSBU)):
weight 127, run speed 1.496, air speed 0.735. Smashcraft applies weight
127/75 and run 1.496/2.2 to its reference table, and raises air speed to the
shared 0.75 floor, with the same world-unit conversion as other fighters.
His authored mounted silhouette is
1.25 times the reference width and 1.15 times its height. He retains the
shared one aerial jump, gravity and dodge windows. Unlike Dedede, he has no
extra jumps or armored recovery.

Compared with the present roster, Thrall trades Archer/Rifleman's sustained
shooting and Illidan's rush speed for mass; has less sword reach than
Blademaster, Warden and Lich King; uses a travelling wolf attack rather than
Beastmaster's controllable animals; lacks Uther's guard, Dreadlord's healing,
Lich's chill, Shadow Hunter's disable, Pit Lord's cleave and Mountain King's
armored charge. His short air drift makes offstage decisions expensive.

## Hammer kit

Every hammer move draws on [Doomhammer](https://wowpedia.fandom.com/wiki/Doomhammer).
The [Dedede move list](https://www.ssbwiki.com/King_Dedede_(SSBU)#Moveset)
is the relation reference: short jab versus long hammer swing, committed
smash versus safer tilt, and differently directed aerials. Numbers and strike
paths are original. Frames count entry as 1; `first / active / recovery`
describes the three phases. Landing figures are the automatic final lag.

| Input | Gesture and decision | Frames | Damage; direction | Landing |
| --- | --- | --- | --- | --- |
| Jab, jab 2 | Hammer butt then short hook; close escape, not a ranged poke | 5/2/14; 7/3/18 | 4; 45°, then 6; 40° | — |
| Forward tilt, angled up/down | Waist-height hammer hook; aim over or under a shield | 10/3/21 | 10; 35°/55°/20° | — |
| Up tilt | Lift hammer over the rider; starts a juggle | 8/4/20 | 8; 85° | — |
| Down tilt | Wolf's low paw swipe; tech-chase starter | 8/3/19 | 7; 70° | — |
| Dash attack | Wolf shoulder with rider braced; exposed body travels 65 units | 11/4/25 | 10; 55° | — |
| Forward smash | Planted Doomhammer hook; strongest close punish | 20/3/34 | 18; 40° | — |
| Up smash | Hammer crown sweep; catches a landing | 17/4/29 | 15; 85° | — |
| Down smash | Wolf swipes front then back; covers a roll with commitment | 16/6/30 | 13; 25° outward | — |
| Neutral air | Compact hammer/body turn; stops a close approach | 8/5/20 | 8; 50° | 14 |
| Forward air | Hammer across the front; spacing and edge guard | 13/3/25 | 12; 45° | 18 |
| Back air | Reverse hammer hook; heavier rear finisher | 11/3/25 | 13; 35° backward | 17 |
| Up air | Hammer held high; follows up tilt or up throw | 8/4/20 | 9; 85° | 13 |
| Down air | Wolf's forward paw presses down; meteor only in air | 14/4/28 | 13; down, grounded 55° | 20 |
| Grab / pummel | Reach from saddle and one hammer-butt check | 8/2/24 | 0 / shared 3 | — |
| Forward throw | Shove into hammer | contact14/end34 | 8; 35° | — |
| Back throw | Turn and toss over the saddle | contact18/end40 | 10; 40° backward | — |
| Up throw | Lift with lightning spark | contact15/end28 | 7; 90° | — |
| Down throw | Pin then release with a ground shove | contact19/end42 | 6; 25° | — |

The throws use Dedede's four directional roles as the Smash reference and
Thrall's gladiator training as the Warcraft reference. Up throw starts a
juggle; down throw starts a tech chase. Neither promises a guaranteed chain.
The shared grab escape, throw immunity and hitstun inputs remain active.
The single shared pummel deals 3 damage at frame 60 and ends at frame 68.
Get-up and ledge attacks use the same hammer sweep vocabulary and shared
action rules. Only weapon reach is disjoint; shoulder and limb attacks expose
matching hurt volumes. Smashes charge up to 45 frames for at most 1.25× damage.

The rider folds forward for grounded jabs and forward tilt. Measured active
hammer bounds are x33–54/z49–96 for jab, x37–61/z51–97 for jab 2 and
x75–109/z59–95 for forward tilt. The short jab stays inside the longer tilt.
Other measured hammer centres at contact are approximately (39,133) for
forward smash, (-2,189) for up tilt, (47,128) for forward air and
(-40,127) for back air, in world units at stock scale. Head radii are 22–25.
Dash attack places its shoulder/head capsule from (24,45) to (65,60), radius28:
the drawn shoulder spans x24–31/z51–86 and the head x51–84/z42–81.
The head remains vulnerable during the rush, with the root and feet planted.
Grounded low attacks and down air use the wolf's visible paw, spanning x52–96
at z20–34 with radius 20–24, rather than claiming the rider's hammer touches
the floor. Their Warcraft source is Feral Spirit and their Smash reference
is [Duck Hunt's animal strikes](https://www.ssbwiki.com/Duck_Hunt_(SSBU)#Moveset).
Earthquake's low region is a spell pulse cast from the saddle. The wolf's
body and attacking paws have exposed hurt volumes. This makes the hammer
shorter than the initial design and the low paw his longer grounded poke.

## Specials, passive and ultimate

| Input | Warcraft source / Smash reference | Authored rule and counterplay |
| --- | --- | --- |
| Neutral: Chain Lightning | [Far Seer](https://liquipedia.net/warcraft/Far_Seer) / [Pikachu's Thunder Jolt](https://www.ssbwiki.com/Thunder_Jolt) | A forward electrical cast travels from the hammer at frame14, 12 damage, 40° launch, end44, cost10. The longer recovery keeps a close blocked cast punishable after the damage increase. Reflect or jump the chest-height bolt; it is a spacing tool rather than a stun lock. Air landing lag18. |
| Side: Feral Spirit | [Far Seer](https://liquipedia.net/warcraft/Far_Seer) / [Duck Hunt's dog](https://www.ssbwiki.com/Duck_Hunt_(SSBU)) | Two spectral wolves leave at frames16 and24, run low for 28 frames, each 4 damage/55°, cost18, end44, cooldown90. The second wolf makes a delayed jump or shield decision; each can hit only once. Summons can be blocked or parried but do not reflect. Air wolves descend and air landing lag20 applies. |
| Up: Far Sight | [Far Seer](https://liquipedia.net/warcraft/Far_Seer) / [Duck Jump](https://www.ssbwiki.com/Duck_Jump) | Spirit sight points a safe way upward: after8 frames, rise2.25H with up to1.5H steering over24 frames, end40, cost12, no hitbox or armor. At low mana rise1.4H free. Both forms meet the shared recovery-distance band. Uses the aerial jump and ends helpless; the broad body can be intercepted. This movement is an original adaptation of a vision spell. |
| Down: Earthquake | [Far Seer](https://liquipedia.net/warcraft/Far_Seer) / [Donkey Kong's Hand Slap](https://www.ssbwiki.com/Hand_Slap) | A low spell pulse hits both sides at frames18–21, 11 damage/75°, end50, cost20, cooldown90. Ground only, 135-unit reach; jump clears it. No extra shield damage, armor or repeating hold. |
| Passive: Windfury | [Doomhammer](https://wowpedia.fandom.com/wiki/Doomhammer) / [Dedede's hammer](https://www.ssbwiki.com/King_Dedede_(SSBU)) | Two direct hammer contacts within180 frames prepare the third: +50% damage, capped at6. A shield spends the prepared bonus. The shared deterministic critical-hit counter supplies this mechanic; no random roll or action lock. |
| Ultimate: Elemental Fury | [Far Seer's Earthquake](https://liquipedia.net/warcraft/Far_Seer) / [Pikachu's Volt Tackle](https://www.ssbwiki.com/Volt_Tackle) | Designed ultimate, matching today's hero template: a storm-assisted Earthquake that sends a broad final lightning wave. The current roster stores ultimate names/descriptions; its activation system is not yet implemented. |

The computer holds midrange with lightning and wolves, approaches with down
tilt or grab, uses Earthquake against grounded proximity, juggles with up tilt
and up air, and saves Far Sight for return to the ledge. Every special is
listed in the gameplan and counted by the existing eight-seed coverage.

## Presentation

Use the classic base-game `units\\orc\\Thrall\\Thrall.mdl`, its command icon,
stock spirit wolves, Far Seer lightning and earthquake effects, and shared
Warcraft impact sounds. Thrall remains on the wolf with Doomhammer attached.
Far Sight has no stock target model, so its rising spirit cue uses the
base-game Shaman's Purge glow around the body.
Author deliberate preparation/contact/recovery poses, both facing directions,
the shared recovery actions, paired grabs and nine pain poses. All extracted
and authored Warcraft model data remains in the private build-input store.

# Chen Stormstout

Chen is a close-range drunken brawler: a broad body, short hand checks, a
staff for commitments, and a flask that makes a fire approach dangerous.
His first draft uses **Ultimate Ryu's weight 103, run speed 1.6 and air speed
1.12** ([SmashWiki](https://www.ssbwiki.com/Ryu_%28SSBU%29#Stats)).
The engine converts run and air units through `melee`; body multipliers are
103/75, 1.6/2.2 and 1.12. His original silhouette is 1.18 wide and 1.04 tall.
Jump, gravity, dodge and ledge rules remain the roster's common rules.

## Sources and decisions

[Wowpedia's Warcraft III Pandaren Brewmaster](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29)
provides Breath of Fire, Drunken Haze, Drunken Brawler and Storm, Earth and
Fire. Haze slows the approach into the fire cone. It keeps Warcraft's
movement slow through the shared chill rules: 75 frames at 60% walk, run and
air-drift speed, followed by 120 frames of immunity. The opponent keeps attack,
jump, shield and dodge control. No outside code or animation is reused.

The Smash references establish decisions rather than copied hitboxes:
[Bowser's Fire Breath](https://www.ssbwiki.com/Fire_Breath) establishes a
close fire wall that can be jumped over;
[Ryu](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) and
[Ken](https://www.ssbwiki.com/Ken_%28SSBU%29#Moveset) establish short checks,
planted kicks, uppercuts and footwork;
[Swap](https://www.ssbwiki.com/Swap) establishes giving up one option to take
another. Chen's Threefold Stance begins as Earth and can become a Fire palm
or Storm step with a fresh press. These are brief forms within one action, not three extra
fighters. His ultimate retains the full three-spirit fantasy, following the
roster's existing rule that ultimates are named designs and currently off.

Every number below is original, provisional tuning. Frames count the entry
as 1. `F/A/R/L` means first active frame, active frames, recovery frames and
final automatic landing lag. Aerials already include automatic lag reduction;
there is no extra timing input. Each ordinary strike hits once per target.

## Full kit

Every Warcraft reference in this table points to the Brewmaster source above;
Drunken Brawler is the source for original staff, hand and foot gestures.

| Input | Action and decision | F/A/R/L; damage | Warcraft source | Smash reference |
|---|---|---|---|---|
| Jab 1 / 2 / 3 | Palm, short staff butt, belly check; fresh presses continue | 4/2/11/0, 3.75%; 5/2/13/0, 3.75%; 7/3/18/0, 6.25% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu jab](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Forward tilt / angled up / down | Planted staff thrust at chest, shoulder or knee | 9/3/21/0; 11.25% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu forward tilt](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Up tilt | Close elbow lifts a jumper | 7/4/20/0; 8.75% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ken up tilt](https://www.ssbwiki.com/Ken_%28SSBU%29#Moveset) |
| Down tilt | Low heel sweep starts a juggle | 7/3/20/0; 7.5% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu down tilt](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Dash attack | Belly-first stumble; punish the long exit | 10/5/27/0; 12.5% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ken dash attack](https://www.ssbwiki.com/Ken_%28SSBU%29#Moveset) |
| Forward smash | Two-handed staff sweep, 118-unit reach | 19/4/34/0; 22.5% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu forward smash](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Up smash | Rising barrel shoulder | 15/4/31/0; 20% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ken up smash](https://www.ssbwiki.com/Ken_%28SSBU%29#Moveset) |
| Down smash | Low staff sweep front then back; one hit total | 15/6/32/0; 17.5% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu down smash](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Neutral air | Open knee and belly cover both sides | 7/5/22/14; 10% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu neutral air](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Forward air | Extended front kick | 11/4/27/17; 15% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu forward air](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Back air | Heel behind the barrel | 8/3/23/14; 13.75% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ken back air](https://www.ssbwiki.com/Ken_%28SSBU%29#Moveset) |
| Up air | Staff lifted above the hat | 7/4/22/14; 10% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu up air](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Down air | Downward boot; grounded targets bounce upward | 14/4/30/21; 15% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu down air](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Grab / shield grab | Free hand reaches 64 units; misses recover | 7/2/24/0 | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu grab](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Pummel | Short knee, one fresh press | Shared pummel timing; 3% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ken pummel](https://www.ssbwiki.com/Ken_%28SSBU%29#Moveset) |
| Forward / back throw | Shoulder toss / turn-and-toss | Contact 12/16, total 33/39; 10/11.25% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu throws](https://www.ssbwiki.com/Ryu_%28SSBU%29#Moveset) |
| Up / down throw | Staff lift / barrel slam into tech chase | Contact 14/18, total 25/42; 8.75/7.5% | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ken throws](https://www.ssbwiki.com/Ken_%28SSBU%29#Moveset) |
| Neutral special | Breath of Fire: finite short cone, one hit, jump over or whiff-punish | Active 12–22, end 42; 12.5%, cost 10 | [Breath of Fire](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Fire Breath](https://www.ssbwiki.com/Fire_Breath) |
| Side special | Drunken Haze: arcing flask, 3.75% and 75 frames at 60% movement speed; shield stops it | Spawn 14, end 38; cost 12 | [Drunken Haze](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu Hadoken spacing](https://www.ssbwiki.com/Hadoken) |
| Up special | Storm Rise: rising staff spin with steering, then helpless fall | Rise 8–29, end 40; 10%, cost 15 | [Storm, Earth and Fire](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ken Shoryuken](https://www.ssbwiki.com/Shoryuken) |
| Down special | Earth stance absorbs one light hit; fresh Attack becomes Fire palm, fresh Special becomes Storm step | Armor 5–16, end 33; cost 10. Fire active 8–11, end 32, 13.75%. Storm travels 5–12, end 28, 8.75% | [Storm, Earth and Fire](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Swap](https://www.ssbwiki.com/Swap) |
| Passive | Drunken Brawler: after three connected melee attacks in 180 frames, the next gains 50% damage, capped at +6; shield spends it | Deterministic counter; stock resets | [Drunken Brawler](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Ryu close pressure](https://www.ssbwiki.com/Ryu_%28SSBU%29) |
| Ultimate | Storm, Earth and Fire: three spirits divide defense, movement and striking roles; currently off like roster ultimates | Design only while ultimates are disabled | [Storm, Earth and Fire](https://wowpedia.fandom.com/wiki/Pandaren_Brewmaster_%28Warcraft_III%29) | [Swap](https://www.ssbwiki.com/Swap) |

## Risk, recovery and computer

Chen's normals are short: his 118-unit staff smash is a commitment, not a
neutral wall. Broad body and 1.6 run speed make projectile approaches costly.
Fire has 20 exit frames; Haze has 24 frames after release. Neither gains
extra shield damage. Ground and air fire/haze use the same strikes, with
20 landing frames in the air. Storm Rise moves 2.1 reference heights up and
at most 1.0 sideways; the free form reaches 1.45 up and 0.7 sideways without
a hit. Both consume the aerial jump and finish helpless. Edgeguards can
cover its predictable late rise; leaving a ledge without jumping retains the
ordinary aerial jump.

Down tilt and up throw start juggles; down throw starts a tech chase. No
follow-up is promised as guaranteed. DI, shield, jump and tech choices remain
ordinary simulation inputs. Throws use the common hold, release, escape and
one-pummel rules.

The CPU favors running into short checks and jumping with kicks, uses Haze
occasionally while approaching, checks with tilt/fire, uses
Earth against an expected strike, branches its stance when a strike reaches,
and reserves Storm Rise for recovery. Stock loss and rematch clear the
shared mana, passive, projectiles and special state.

Relative to today's roster: Archer and Rifleman outrange him; Illidan and
Warden outrun him; Blademaster has a longer weapon; Mountain King wins single
heavy commitments; Lich controls farther away; Forsaken Paladin holds longer defensive
space; Dreadlord has better air pursuit; Shadow Hunter establishes safer
ranged pressure; Pit Lord reaches farther with slower swings; Beastmaster
has independent bodies; Lich King controls zones and banks souls. Chen trades
those tools for fast short checks, staff finishers and a branching defensive
stance.

Presentation uses the installed Warcraft III Pandaren Brewmaster model,
icon, sounds and fire/cloud effects. Original staff, kick, stumble, paired
throw and reaction clips are authored over that private stock input. No
proprietary model or texture enters Git.

## Play-style profile

Tom-tunable draft (8 Oct; smashcraft:docs/design/balance.md, "Play-style profiles"). Staff footwork and reads around heavy commitments.

```balance-profile
fighter: chen-stormstout
archetype: bait-and-punish
aerials: nair 10-40, fair 15-45, bair 15-45, uair 5-30, dair 0-25
air-share: 15-45
approach: 40-70
ranged: 0-20
specials: neutral 2-12, side 2-12, up 0-8, down 2-12
```

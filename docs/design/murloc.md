# Murloc

The Murloc is the roster's smallest fighter: a quick rushdown
creep who slips under strikes, nets an opponent who tries to run, and slides
in on the belly. He pays for his small target with early knockouts and short reach. All geometry, damage and timings below are original
provisional Smashcraft values. Smash references explain roles and trade-offs,
not copied hitboxes. Murky (Heroes of the Storm) was checked as the alias
named on #262; he is the same creature, not a second fighter, and the kit
takes its abilities from the Warcraft III murloc creeps.

## Research and body

Warcraft III's [murloc creeps](https://wowpedia.fandom.com/wiki/Murloc_(Warcraft_III))
supply the kit: the Tiderunner's claw attacks for the normals, the
[Murloc Huntsman's Ensnare](https://wowpedia.fandom.com/wiki/Ensnare) for the
neutral special, and the [Murloc Plaguebearer's Disease Cloud](https://wowpedia.fandom.com/wiki/Disease_Cloud)
for the down special. Tidal Rush and Tide Spout turn the murloc's swimming
into a belly slide and a water spout. Presentation is the stock classic
Tiderunner, `units\creeps\Murloc\Murloc.mdl` (unit `nmrl`, model scale 1.0),
its command icon `BTNMurloc` and its own `Murloc` unit sounds; the stock
Ensnare and Plague Cloud models draw the specials. No downloaded art or
recordings are needed.

The stock model has nine sequences: two stands, a ready stand (Stand -3), a
walk, Attack - 1 (claw swipe), Attack Spell (a thrown arm), Death and two
decays. Like Beastmaster's, moves share clips by motion.

The body counterpart is [Squirtle in Ultimate](https://www.ssbwiki.com/Squirtle_(SSBU)):
a light character, small enough to duck many highs, with a
belly-slide side special ([Withdraw](https://www.ssbwiki.com/Withdraw)) and
a water recovery ([Waterfall](https://www.ssbwiki.com/Waterfall)). The values
are original:

| Weight | Run | Air | Width | Height |
| --- | --- | --- | --- | --- |
| 0.94 | 1.12 | 1.06 | 0.90 | 0.72 |

He is among the lighter fighters (Lich 0.85, Warden 0.88, Shadow Hunter 0.94). Height 0.72 puts his
hurt capsule's top at 77 units against the drawn Stand's 76: the shortest
body in the cast (Rifleman 87, Peon 89). Shared gravity, jumps and dodge
timing stay the roster's.

## Full kit

Frames count entry as 1. Columns are first active / active duration / recovery;
aerial landing is the authored landing lag (aerials land with half of it).
Reach is world units from his centre. Every contact is one hit per target
and action. Ordinary contacts also feed his passive.

| Input | Gesture and role | Frames; damage; reach | Warcraft source | Smash reference |
|---|---|---|---|---|
| Jab 1 → 2 | Claw poke, then a second swipe | 3/2/11, 2% → 5/2/15, 4%; 48 → 54 | [Tiderunner claws][wc] | [Squirtle jab][sq] |
| Forward tilt / angled | Low reaching claw; spacing poke | 6/3/19; 8%; 76 | [Tiderunner claws][wc] | [Squirtle forward tilt][sq] |
| Up tilt | Overhead swipe; juggle starter | 5/4/18; 7%; height 102 | [Tiderunner claws][wc] | [Squirtle up tilt][sq] |
| Down tilt | Floor claw; low launcher | 5/3/16; 6%; 70 | [Tiderunner claws][wc] | [Squirtle down tilt][sq] |
| Dash attack | Belly-flop with a 48-unit slide | 7/5/26; 9%; 76 | [murloc swim][wc] | [Squirtle dash attack][sq] |
| Forward smash | Two-claw lunge; finisher | 14/3/36; 16%; 98 | [Tiderunner claws][wc] | [Squirtle forward smash][sq] |
| Up smash | Hop and overhead slash | 11/4/34; 15%; height 128 | [Tiderunner claws][wc] | [Squirtle up smash][sq] |
| Down smash | Spinning sweep both sides | 12/4/34; 13%; ±86 | [Tiderunner claws][wc] | [Squirtle down smash][sq] |
| Neutral air | Tucked spin; close escape | 5/6/20, land 12; 8%; ±48 | [murloc swim][wc] | [Squirtle neutral air][sq] |
| Forward air | Claw rake ahead | 7/3/24, land 14; 10%; 80 | [Tiderunner claws][wc] | [Squirtle forward air][sq] |
| Back air | Fin kick behind; strongest aerial | 8/3/24, land 14; 12%; −84 | [murloc swim][wc] | [Squirtle back air][sq] |
| Up air | Overhead flip; juggle | 6/4/20, land 12; 9%; height 108 | [Tiderunner claws][wc] | [Squirtle up air][sq] |
| Down air | Stomping dive; air spike, ground lift | 12/3/28, land 18; 11%; −58 | [murloc swim][wc] | [Squirtle down air][sq] |
| Grab / pummel | Short claw grab; shared pummel timing, 2% | Grab 7/2/24, reach 52 | [Tiderunner claws][wc] | [Squirtle grab][sq] |
| Forward throw | Shove; spacing | release 12, recover 20; 7%, 40° | [Tiderunner claws][wc] | [Squirtle forward throw][sq] |
| Back throw | Roll behind; edge position | release 14, recover 22; 9%, 40° back | [murloc swim][wc] | [Squirtle back throw][sq] |
| Up throw | Head toss; juggle | release 12, recover 14; 6%, 90° | [Tiderunner claws][wc] | [Squirtle up throw][sq] |
| Down throw | Belly-press; tech chase | release 16, recover 22; 5%, 25° | [murloc swim][wc] | [Squirtle down throw][sq] |
| Get-up / ledge attack | Low sweep / forward claw | shared action timings; 6% / 6% | [Tiderunner claws][wc] | [Squirtle floor/ledge attacks][sq] |

Launch classes: 70/18 for pokes, 90/22 for launchers, 105/26 for finishers
(forward smash 112/26, back air 110/26),
90/22 for the spike, 55/50 for up throw and 40/75 for down throw. Smashes
charge for at most 45 frames to 1.25 damage. Shared grab escape, pummel limit,
DI/SDI, techs and shield rules apply. No guaranteed repeat-grab or net loop
is designed: Ensnare's slow lowers top speeds only, so the victim keeps every
action, shield, jump and dodge.

## Specials, passive and ultimate

| Input | Decision and counterplay | Original values | Warcraft / Smash reference |
|---|---|---|---|
| Neutral: Ensnare | Throw a net in a shallow arc that slows the first fighter it reaches, so a retreating opponent can be run down. Shield it, jump it, or punish the throw at close range. | 10 mana; spawns f12 at x32/z40, 8/frame with a slight drop, life 40, radius 18; 4%; slows like Chill (top speeds only); one live net; action ends f36; air landing 18 | [Ensnare][ensnare], [Water Gun](https://www.ssbwiki.com/Water_Gun) |
| Side: Tidal Rush | Belly-slide forward through a gap; it stops at a raised shield, which punishes it. | 10 mana; slides f8–22 at 11/frame, about 165 units; 8% contact f8–22; ends f32; air landing 20 | [murloc swim][wc], [Withdraw][withdraw] |
| Up: Tide Spout | A water spout carries him up while the stick steers; then a helpless fall. | 15 mana; rises f6–25 at 17/frame, about 340 units, steered 6/frame; 5% contact f6–14; free version 12.5/frame, about 250 units; spends aerial jump, once per airtime, helpless | [murloc swim][wc], [Waterfall][waterfall] |
| Down: Disease Cloud | Leave a small plague cloud at his feet that poisons grounded foes who stand in it; jumping over it or waiting it out clears it. | 15 mana; ground only; appears f14 at x40, radius 50, lasts 150 frames, pulses every 50 for 2%; each pulse poisons for three 1% ticks over 180 frames; 150-frame cooldown; ends f38 | [Disease Cloud][cloud], Plaguebearer |
| Passive: Scavenger | Ordinary attacks that reach a body take 2 mana from it. Shields stop it; an empty enemy gives none. | 2 per ordinary body contact; shared 100-mana cap | [murloc creeps][wc] |
| Ultimate: Mrgllgll Swarm | A tide of murlocs rushes across the stage. | Designed only: ultimates remain off under the current match rules | [murloc creeps][wc] |

Recovery: Tide Spout reaches the ledge from below and beside it after the
double jump, spends the remaining aerial jump and ends helpless. Walking off a
ledge keeps the aerial jump. His recovery is short and his body is light, so
edge-guards on the spout's path and early kills are his weakness. The computer
jumps first and steers the spout to the ledge.

## Home stage

Tomb of Sargeras (stage 7, smashcraft:docs/design/home-stages.md): TFT's
"Terror of the Tides" puts murlocs and the naga's mur'gul thralls on the
Broken Isles' shores around the tomb, and the stage's shallow tide floor and
waterfall are a murloc's coast. He shares it with the Warden. No new stage or
asset is needed.

## Position in the roster

The Murloc is the cast's small rushdown. Archer, Rifleman, Kael'thas and Lich
win from range; he closes with dash, Tidal Rush and nets their retreat.
Blademaster and Warden also rush but with longer weapons; he trades reach for
the smallest hurt body and the fastest normals. Mountain King, Forsaken
Paladin, Pit Lord, Thrall and Cairne survive trades and out-reach him; he wins
by starting combos and losing nothing on a whiff. Peon and Shadow Hunter fight
around placed objects; his Disease Cloud only denies a patch of floor. He
dies early, has a short recovery and cannot shield-pressure:
Tidal Rush stops at a shield and is punished.

Launchers: down tilt and up tilt pop opponents for up air and forward air;
down throw starts a tech chase toward Tidal Rush or a dash attack. Ensnare's
slow and Disease Cloud's poison are pressure tools, not combo loops.

The computer runs in and pokes with tilts, throws Ensnare at a retreating or
far opponent, uses Tidal Rush to close a medium gap,
drops Disease Cloud when an opponent is close on the ground or on his ledge,
and recovers with Tide Spout after its double jump.

[wc]: https://wowpedia.fandom.com/wiki/Murloc_(Warcraft_III)
[ensnare]: https://wowpedia.fandom.com/wiki/Ensnare
[cloud]: https://wowpedia.fandom.com/wiki/Disease_Cloud
[sq]: https://www.ssbwiki.com/Squirtle_(SSBU)#Moveset
[withdraw]: https://www.ssbwiki.com/Withdraw
[waterfall]: https://www.ssbwiki.com/Waterfall

## Play-style profile

Tom-tunable draft (8 Oct; smashcraft:docs/design/balance.md, "Play-style profiles"). A small, light rushdown who closes with dash attacks, slides and nets.

```balance-profile
fighter: murloc
archetype: rushdown
aerials: nair 15-40, fair 15-40, bair 10-35, uair 10-35, dair 0-20
air-share: 25-55
approach: 55-85
ranged: 0-20
specials: neutral 3-15, side 3-15, up 0-8, down 2-12
```

## Balance record

First seeded Wren Expert field (e5709fe6, 400 a pair against all 21
fighters): 27%. Tidal Rush was a fifth of his moves and was punished on
shields, and his weight lost stocks early. One tuning pass: weight 0.80 to
0.94, one more damage on every tilt, smash and aerial, forward smash growth
105 to 112 and back air 105 to 110, Tidal Rush ends on f32 instead of f40,
and the computer no longer approaches with it.
After (dc96043e, same field and seeds): 46% over 8568 matches; balance score
23.7 to 9.7, with the profile misses (back air 40%, up air 5%, Ensnare 19%,
Tidal Rush 20%) left for later tuning.

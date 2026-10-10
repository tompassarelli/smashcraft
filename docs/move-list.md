# Move list

Generated from the fighters' kit data by `bun scripts/moveList.ts` (from
smashcraft:ts/); edit the names there, never here. Specials and
ultimates have official names, and so does each jab chain; the other
normals are named by their input (forward tilt, forward air, down smash,
pummel, up throw). A normal's
"inspired by" note is a design reference, not a name. An ultimate is
Attack + Special together at a full bar (docs/design/ultimates.md), unless
the match's Ultimates rule is off. Ground movement is in Melee units a frame,
inside Melee's roster spread (smashcraft:docs/gameplay-design.md,
"Ground states and the stick map").

## Rifleman

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Blaster | A fast shot that makes its target flinch. |
| Side special | Summon Bear | Call a bear that fights beside him until it is beaten. |
| Up special | Recoil Shot (Second Shot) | Fire away from where you want to fly; press again for a second shot and a new direction. |
| Down special | Frost Trap | Set a trap that freezes the first opponent to step on it; mash to break free. |
| Jab, repeated | Rifle Butt | A push of the barrel, then the stock driven in on a second jab. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Aimed Shot | Kneel and aim: a red line shows the shot, then one bullet crosses the stage. Jump or shield it. |

Ground movement: walk 1.40, initial dash 1.90, run 1.50; run from dash frame 14.

## Illidan

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Mana Burn | A slow orb that burns mana and stuns; the emptier it leaves the target, the longer the stun. On a full meter, its EX is Eye Blast. |
| Side special | Fel Rush (Vengeful Retreat, Chaos Strike, Aerial Chaos Strike) | Dash through anyone in your path; press special to flip back out, or attack to slash. |
| Up special | Wing Ascent (Glide, Wing Slash) | Rise on his wings; jump near the top to glide, attack in the glide to slash. |
| Down special | Immolate (Flame Crash) | A burst of flame around him that a jump can cancel; in the air, plunge down in a Flame Crash. |
| Jab, repeated | Warglaive Flurry | Three quick glaive cuts on repeated jabs; the third launches. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Metamorphosis | Fel fire burns around him as he becomes a demon: a burst launches nearby foes, then he moves faster for 8 seconds. |

Ground movement: walk 1.55, initial dash 1.90, run 1.85; run from dash frame 14.

Normals, inspired by:

- Down smash: Flames of Azzinoth, from the Black Temple encounter
- Forward smash: Fel Lunge, from the Demon Hunter's Fel Rush
- Forward tilt: Shear, from the Black Temple encounter
- Forward air: His twin warglaives crossing

## Blademaster

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Wind Cutter | A short blade wave. |
| Side special | Wind Walk (Backstab, Step Out) | Fade and walk through bodies; attack to Backstab on either side, special to step out. |
| Up special | Rising Whirlwind | Hold a direction as he gathers, then a slashing dash that way and a helpless fall. |
| Down special | Mirror Image (Image Swap) | Step back and leave an image; press again to swap to it with a slash. One hit breaks it. |
| Jab, repeated | Swift Cuts | Two quick cuts close to his body on repeated jabs. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Bladestorm | A steerable whirlwind of cuts ending in a strong slash, then he is dizzy. Shield, jump above it or outrun it. |

Ground movement: walk 1.60, initial dash 1.98, run 2.29; run from dash frame 14.

## Mountain King

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Storm Bolt | A hammer that flies out and back, hitting toward him on the return; press again to call it back. |
| Side special | Storm Rush | A shoulder charge that stops dead at a body or shield. |
| Up special | Thunder Leap (Hammerfall) | Hold a direction as he crouches, then a hammer leap that way; press special at the top to plunge down as Hammerfall. |
| Down special | Thunder Clap (Small Clap) | Raise the hammer and slam: early for a small clap, late for a ring with shockwaves. Shield drops the charge. |
| Jab, repeated | Tavern Brawl | A short punch, then a heavy hook on a second jab. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Avatar | He turns to stone with a stomp: heavier for 10 seconds. Hit him while he changes. |

Ground movement: walk 1.41, initial dash 1.67, run 1.94; run from dash frame 14.

## Warden

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Shadow Strike | A slow dagger that marks and poisons its target. |
| Side special | Shadow Pursuit (Pursuit Lunge) | Appear behind a marked opponent and slash; with no mark nearby, a dashing Pursuit Lunge. |
| Up special | Blink | Teleport in any of eight directions; the landing spot is open to a punish. |
| Down special | Fan of Knives | Throw knives outward in a wide burst, marking and poisoning everyone hit. |
| Jab, repeated | Crescent Flurry | Three quick cuts of her crescent blade on repeated jabs. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Vengeance | The Avatar of Vengeance rises behind her and throws four ghostly glaives. Break it or dodge the glaives. |

Ground movement: walk 1.60, initial dash 2.00, run 2.30; run from dash frame 14.

## Lich

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Frost Nova | A slow orb that chills; press again to burst it where it is. |
| Side special | Death and Decay | A rotting field ahead that strikes twice, small then strong; walk or jump out. |
| Up special | Spectral Ascent | A steerable rise, then a helpless fall. |
| Down special | Frost Armor (Dark Ritual) | A shell that takes the knockback of one light hit and chills the attacker; press again for Dark Ritual: shatter it for mana. |
| Jab, repeated | Chilling Touch | A slap, then a freezing palm on a second jab. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Frost Wyrm | A frost wyrm sweeps across at jump height. Stay low or shield it. |

Ground movement: walk 1.44, initial dash 1.71, run 1.98; run from dash frame 14.

## Forsaken Paladin

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Cleansing Hammer | Bonk upward with the hammer; its holy impact cleanses your poison and movement slow. |
| Side special | Righteous Fury | Charge hammer-first. A body hit briefly slows movement; a blocked charge leaves you exposed. |
| Up special | Ascension | A rising hammer strike you steer, then a helpless fall. |
| Down special | Consecration | Plant the hammer to bless a small patch of ground. It pulses beneath grounded foes; jumping clears it. |
| Jab, repeated | Hammer and Haft | A hammer check, then a shove of the haft on a second jab. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Light's Hammer | A golden circle marks where the Light's hammer will fall, then blesses the ground twice. Leave the circle. |

Ground movement: walk 1.47, initial dash 1.75, run 2.02; run from dash frame 14.

## Dreadlord

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Carrion Swarm | A short, slow cloud of bats. |
| Side special | Vampiric Pounce | Corkscrew forward with trailing bats; bite and heal on a catch, recover on a miss. |
| Up special | Bat Ascension | A steerable rise on bat wings, then a helpless fall. |
| Down special | Sleep | A slow orb that puts a grounded target to sleep until it mashes out or is hit. |
| Jab, repeated | Vampiric Claws | Two claw rakes and a wing strike on repeated jabs. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Inferno | An Infernal crashes onto a burning mark ahead. Leave the mark. |

Ground movement: walk 1.60, initial dash 1.99, run 2.29; run from dash frame 14.

## Shadow Hunter

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Spirit Glaive | A glaive that flies out and back, pulling its target toward him on the return. |
| Side special | Serpent Ward | Place a ward that fires on its own; press again to recall it. |
| Up special | Loa Vault | Hold a direction as the spirits gather, then a vault that way and a helpless fall. |
| Down special | Hex | A short orb that stops its target attacking, grabbing or casting until it mashes out. |
| Jab, repeated | Glaive Handle | Two jabs of the glaive handle, then a cut of its blade, on repeated jabs. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Big Bad Voodoo | He dances untouchable inside a voodoo ring that pulses, then erupts. Leave the ring. |

Ground movement: walk 1.60, initial dash 1.98, run 2.29; run from dash frame 14.

## Pit Lord

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Howl of Terror | A close roar pushes enemies away on both sides; a shield stops it. |
| Side special | Ruin Charge | A slow charge whose armor shrugs off one light hit; it stops at a shield. |
| Up special | Abyssal Leap | A slow arcing leap you steer, with a hoof strike, then a helpless fall. |
| Down special | Rain of Fire | Three waves of fire fall ahead; rush underneath or tilt your shield up. |
| Jab, repeated | Haft and Chop | A haft check, then a short cleaver chop on a second jab. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Doom | A clawed grab that ignores shields brands the victim with Doom, burning on after the throw. Jump or roll away. |

Ground movement: walk 1.28, initial dash 1.52, run 1.76; run from dash frame 16.

## Beastmaster

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Wild Axes | Throw two axes; move to guide their return through the enemy. |
| Side special | Summon Bear (Stampede) | Call Bear, then press again for its lunge and a Stampede. |
| Up special | Summon Hawk (Hawk Lift, Hawk Dive) | Call Hawk, then command a dive. In the air, Hawk carries him up. |
| Down special | Summon Quilbeast (Quill Volley) | Set a Quilbeast firing position; press again for a three-quill volley. |
| Jab, repeated | Twin Axes | Both axe hilts, then a shoulder that shoves, on repeated jabs. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Stampede | His pack stampedes past: a low quilbeast, a bear, then a high hawk. Jump, shield, then stay low. |

Ground movement: walk 1.55, initial dash 1.84, run 2.13; run from dash frame 14.

## Lich King

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Howling Blast | A wide frost gust that travels toward the foe. |
| Side special | Val'kyr Shadowguard | A Val'kyr seizes the first foe she reaches and carries them toward the edge; mash to break free. |
| Up special | Ascension of the Damned | An ice column lifts him in a frost vortex, then a helpless fall. |
| Down special | Defile | Plant Frostmourne to spread a shadow pool; hurting a grounded foe grows it and flashes the edge. Jump out; recasts must wait. |
| Jab, repeated | Pommel and Rake | A gauntlet check, a rake of the blade, then a Frostmourne thrust on repeated jabs. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Animate Dead | Runes mark the ground under the nearest foe; the dead claw up there a moment later. Step off the mark. |

Ground movement: walk 1.34, initial dash 1.60, run 1.85; run from dash frame 14.

Normals, inspired by:

- Jab: Ike's jab (a heavy sword's quick check)
- Up smash: Remorseless Winter (Icecrown Citadel)
- Down smash: Quake (Icecrown Citadel's transition)
- Forward smash: Frostmourne's overhead strike (Warcraft III cinematic)
- Forward tilt: Byleth's forward tilt (a non-angled weapon arc)
- Up tilt: Marth's up tilt (an arc that covers behind)
- Down tilt: Two-sided sweeps (Ganondorf's and Ike's down smashes, at tilt speed)
- Dash attack: Arthas's charge at Stratholme
- Down throw: Harvest Soul (Icecrown Citadel)

## Thrall

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Chain Lightning | Cast a quick lightning bolt to cover the hammer's approach. |
| Side special | Feral Spirit | Send two spirit wolves running low, one after the other. |
| Up special | Far Sight | Let the spirits guide a rising leap; steer toward the ledge, then fall helpless. |
| Down special | Earthquake | Slam the ground on both sides to launch nearby foes; a jump clears it. |
| Jab, repeated | Doomhammer | Check with the handle, then press again for a short hammer hook. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Earthquake | Tremors run along the ground both ways. Jump them or stand on a platform. |

Ground movement: walk 1.09, initial dash 1.29, run 1.50; run from dash frame 16.

## Jaina Proudmoore

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Frostbolt | A straight frost bolt; jump it or shield it. |
| Side special | Blizzard | Ice falls twice on the marked patch ahead; leave it before the first strike. |
| Up special | Blink | Aim a teleport, then fall helpless. |
| Down special | Summon Water Elemental | Summon a fragile ally that fires four water bolts. Press again to recall it. |
| Jab, repeated | Staff Check | Two short staff strikes to create space. |
| Edge-guard tool | Forward air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Glacial Ray | A ray of frost sweeps down from high ahead of her to the floor. Get behind her or shield. |

Ground movement: walk 0.80, initial dash 1.00, run 1.10; run from dash frame 14.

## Sylvanas Windrunner

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Black Arrow | A dark arrow that charges her next bow strike. Hold up to fire upward. |
| Side special | Silence | A short curse that stops offensive specials. Movement, attacks and recovery still work. |
| Up special | Banshee Flight | Rise as a spirit, steering toward the stage, then fall helpless. |
| Down special | Life Drain | Catch a nearby foe through their shield and drain a little life. A missed reach leaves her open. |
| Jab, repeated | Bow Check | Three close checks of the bow on repeated jabs. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Charm | A slow banshee spirit; a foe it reaches has left and right swapped for 3 seconds. |

Ground movement: walk 1.33, initial dash 1.58, run 1.83; run from dash frame 14.

## Cairne Bloodhoof

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Shockwave | Plant the totem and send one low wave along the ground. |
| Side special | War Stomp | Step forward and stomp both sides, lifting nearby foes for a follow-up. |
| Up special | Spirit Lift | Rise behind the totem, then fall helplessly with exposed sides. |
| Down special | Reincarnation | Read an incoming strike to heal 12 damage, up to 24 per stock. A wait or grab beats it. |
| Jab, repeated | Haft and Totem | Check with the haft, then press again for the totem's short finishing blow. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Reincarnation | He waits with the ancestors: a strike that would hit him raises a spirit pillar instead. Don't strike; grab or wait. |

Ground movement: walk 1.08, initial dash 1.28, run 1.49; run from dash frame 16.

## Chen Stormstout

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Breath of Fire | Breathe a short cone of flame; a jump clears it. |
| Side special | Drunken Haze | Lob a flask that briefly slows an enemy's movement. |
| Up special | Storm Rise | Rise with a spinning staff, steer toward safety, then fall helplessly. |
| Down special | Threefold Stance (Earth Stance, Fire Palm, Storm Step) | Brace as Earth; press Attack for Fire Palm or Special for Storm Step. |
| Jab, repeated | Staggering Three | A palm, a staff butt and a belly check on repeated jabs. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Storm, Earth and Fire | He splits into Earth, Storm and Fire, which strike around him one after another. |

Ground movement: walk 1.16, initial dash 1.38, run 1.60; run from dash frame 14.

## Peon

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Lumber Toss | Toss a slow bundle of lumber to clear some working room. |
| Side special | Burrow (Pack Up) | Build a fragile burrow that fires spears; press again to pack it up. |
| Up special | Worksite Launch | Vault toward the stage, then fall helpless. |
| Down special | Repair | Duck behind the tools; a correctly timed hit repairs a little damage. |
| Jab, repeated | Work Work | A quick haft tap followed by a short axe chop. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Timber! | He chops at a big tree until it falls forward across the stage. Stand behind him or hit him while he chops. |

Ground movement: walk 1.16, initial dash 1.38, run 1.60; run from dash frame 14.

## Goblin Tinker

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Cluster Rockets | Three rockets cover the approach and charge the next claw hit. |
| Side special | Pocket Factory | Build a breakable factory that sends out Clockwerk Goblins; press again to recall it. |
| Up special | Rocket Boots | Blast off, burn upward and steer left or right, then fall helplessly. |
| Down special | Robo-Goblin | Transform for an armored hammer-tank charge; grabs and heavy hits beat the armor. |
| Jab, repeated | Claw-Pack | Two short claw taps and a wrench shove. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Robo-Goblin Overdrive | His Robo-Goblin waddles ahead and explodes. Walk away or shield the blast. |

Ground movement: walk 1.25, initial dash 1.49, run 1.73; run from dash frame 14.

## Kael'thas Sunstrider

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Flamestrike | A fire bolt that drifts toward the enemy and bursts into a pillar of flame on contact. Shield or reflect it. |
| Side special | Drain Mana | A short tether that grabs through shields and drinks the victim's meter. Jump or dodge it. |
| Up special | Phoenix | Charge in swirling flame, then fly as a phoenix the way you aim; up or down bends the flight. Helpless after. |
| Down special | Banish | A close curse: the victim turns ethereal, slowed and unable to attack, and takes more damage from Kael's spells. |
| Jab, repeated | Verdant Touch | A palm check, then a sphere shove on a second tap. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Gravity Lapse | Arcane orbs ring him, then everyone inside is lifted straight up. Leave the ring. |

Ground movement: walk 1.60, initial dash 1.95, run 2.26; run from dash frame 14.

## Murloc

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Ensnare | Throw a net that slows the first enemy it reaches. Shield it or jump it. |
| Side special | Tidal Rush | Belly-slide forward into a hit. A raised shield stops the slide. |
| Up special | Tide Spout | Ride a water spout upward and steer it, then fall helpless. |
| Down special | Disease Cloud | Leave a small plague cloud that poisons enemies standing in it; jumping clears it. |
| Jab, repeated | Claw Flurry | A quick claw poke, then a second swipe on another tap. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Mrglglgl Stampede | He blows a conch and a swarm of murlocs pours across the ground. Jump over it or shield. |

Ground movement: walk 1.60, initial dash 2.00, run 2.30; run from dash frame 14.

## Grom Hellscream

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Warsong Cry | Roar in their face and launch them upward. Rush after them. |
| Side special | Gorehowl Rush | Charge axe-first. A shield stops the rush; a miss leaves you open. |
| Up special | Blood Leap | Haul Gorehowl upward as you leap, then fall helpless. |
| Down special | Mannoroth's Bane | Commit to a furious two-handed execution chop. |
| Jab, repeated | Warsong Greeting | Check them with the hilt, then chop on a second tap. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Blood of Mannoroth | Demon blood drives a charge that catches the first foe, through a shield, for three Gorehowl chops. Jump it. |

Ground movement: walk 1.60, initial dash 1.98, run 2.29; run from dash frame 14.

## Kobold

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Wick Flick | Flick candle flame forward. Jump or shield it, then punish the recovery. |
| Side special | Panic Dig | Scurry forward behind the pick. A raised shield stops the charge. |
| Up special | Candle Escape | Spring upward in a panic, steer, then fall helpless. |
| Down special | Mine! | Protect the candle with a two-sided ankle sweep. Jump over the pick. |
| Jab, repeated | Pick Pick! | Two nervous mining-pick taps. You no take candle! |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | You No Take Candle! | He digs in and burrows toward the foe, then bursts up under them. Watch the dirt. |

Ground movement: walk 1.60, initial dash 1.99, run 2.30; run from dash frame 14.

## Malfurion Stormrage

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Entangling Roots | Mark the ground ahead. Jump or shield before the roots close. |
| Side special | Stag Charge | Bound forward with branching antlers. A shield stops the charge. |
| Up special | Dream Ascent | Rise through the canopy, then fall helpless. |
| Down special | Force of Nature | Plant a fragile treant that throws four branches. Press again to recall it. |
| Jab, repeated | Gardening Lesson | Two dismissive staff taps: mind the flowers. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Wisps of Hyjal | A slow wall of wisps drifts forward and detonates on whoever it reaches. |

Ground movement: walk 1.31, initial dash 1.55, run 1.80; run from dash frame 14.

## Medivh

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Arcane Omen | Send a slow omen ahead. Shield it or jump over it. |
| Side special | Vanishing Act | Blink forward and strike. Your arrival is open to a punish. |
| Up special | Raven Flight | Aim and become a raven. Fall helpless after the flight. |
| Down special | Last Word | Blink back and burst outward. Bait an impatient chase. |
| Jab, repeated | Impatient Prophecy | Two pointed staff taps for those who will not listen. |
| Edge-guard tool | Down air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | The Dark Portal | A dark portal opens ahead, drawing foes in, then erupts. Walk away before it bursts. |

Ground movement: walk 1.57, initial dash 1.86, run 2.16; run from dash frame 14.

## Anub'arak

| Input | Name | What it does |
| --- | --- | --- |
| Neutral special | Impale | Drive a line of spines along the floor. Jump the line or block the stamp. |
| Side special | Burrow Hunt | Scuttle beneath the floor and erupt. Follow the mound and punish the emergence. |
| Up special | Crypt Eruption | Choose a direction and launch the crown, then fall helpless. |
| Down special | Carrion Beetle | Plant a fragile nest that sends beetles along the ground. Press again to recall it. |
| Jab, repeated | Royal Rebuke | The king dismisses prey with one tusk, then the other. |
| Edge-guard tool | Forward air | Read offstage, it kills this fighter's own predictable recovery at 40% (recorded in edgeGuard.tests.ts). |
| Ultimate | Locust Swarm | A slow cloud of beetles drifts ahead, stinging anyone standing in it. Jump or shield. |

Ground movement: walk 1.31, initial dash 1.56, run 1.80; run from dash frame 16.

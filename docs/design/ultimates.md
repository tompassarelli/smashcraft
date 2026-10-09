# Ultimates

Tom, 9 October 2026 (#382): every Warcraft III hero has an ultimate, so every
Smashcraft fighter gets one. It is a real move bought with the full super bar,
never a cutscene. A match rule turns ultimates off. All frame, damage and
launch values below are original, provisional Smashcraft tuning.

## Why supers work and Final Smashes failed

- **Street Fighter III / IV:** the super bar fills from your own attacks and
  from damage taken. EX specials and supers draw on the same bar, so every
  stock of meter is a spend-now-or-save choice. A super is an ordinary move
  with frame data: blockable, punishable, and its startup is known.
- **Street Fighter 6:** splits Drive (EX, parries, rushes) from the Super Art
  bar. Smashcraft keeps one bar: the spend-or-save choice is the point.
- **Smash Ultimate Final Smash meter:** fills over time, its cinematic hits
  cannot be answered, and it hands out comebacks; tournaments switch it off.
  Smash Balls are random. Rivals of Aether has no supers at all.

Smashcraft takes the Street Fighter half and refuses the Smash half.

## Rules

| Rule | Value |
| --- | --- |
| Cost | The whole bar (100 points). EX specials cost one 33/33/34 segment (docs/design/mana.md). |
| Gain | Unchanged: own hits and damage taken. Nothing random or idle. |
| Input | Attack + Special together (hold Attack, press Special; controller A + X), any direction, from any state a special could start. Below a full bar, or with ultimates off, the ordinary special starts instead. |
| Flash | At most 4 frames of white fighter flash and the ready sound. No camera cut, no freeze of the opponent. |
| Telegraph | Every ultimate shows its area, line or target before its first active frame. Startup is at least 16 frames. |
| Counterplay | Each can be shielded or dodged on its startup frames, or escaped by movement, and leaves the user punishable on a whiff. |
| Payoff | Strong, never a guaranteed stock: none kills from 0%. |
| Off rule | "Ultimates off" removes the input; the match rule is part of replay state. |
| Effects | Each ultimate's models count as one effect group under #380's budget: gone within 12 frames after its last active frame. |

### Source order

1. **Tier 1:** a reimagined version of the hero's Warcraft III ultimate,
   adapted to a fighting-game move (not a literal port).
2. **Tier 2:** if that cannot work, a famous ability of the character as a
   World of Warcraft raid boss or in an iconic encounter.
3. **Unit:** fighters that are not Warcraft III heroes (Rifleman, Peon,
   Murloc, Kobold) take the most obvious lore idea.

### Variety

Beams (Rifleman, Jaina), transformations (Illidan, Mountain King), rushes
(Blademaster, Grom, Kobold), self-centred areas (Shadow Hunter, Kael'thas,
Anub'arak, Chen), placed or targeted areas (Dreadlord, Forsaken Paladin,
Lich King, Medivh), sweeps and summons (Murloc, Lich, Beastmaster, Warden,
Thrall, Peon, Tinker, Malfurion), a status projectile (Sylvanas), a counter
(Cairne) and command throws (Pit Lord, Grom's catch). Ground sweeps are
answered by jumping, the high Frost Wyrm by staying low.

## Per fighter

Frames count from the input frame (frame 1 is the first frame after it).
"Total" is the whole commitment; launch is angle, base and growth.

| Fighter | Ultimate · source (tier) | Telegraph | Attack | Counterplay | Why it fits | Stock assets |
| --- | --- | --- | --- | --- | --- | --- |
| Rifleman | **Aimed Shot** · WoW Hunter's Aimed Shot on a dwarven long rifle (unit) | Kneels and shoulders the rifle, f1–35; a red aiming line shows height and direction across the stage | f36 one piercing bullet at chest height, 60 a frame, radius 26, the full stage; 24%, 30°, base 40, growth 95. Total 70 | Jump or roll over the line, shield it (heavy shield damage); he cannot turn and is locked until f70 | The patient marksman's payoff for a stage of spacing | Rifleman kneel/attack clips, rifle muzzle and BoltImpact |
| Illidan | **Metamorphosis** · Warcraft III Demon Hunter ultimate (tier 1) | Wings flare and fel fire climbs him, f1–30; hittable throughout | f31 fel shockwave, radius 160 both sides, 12%, 70°, base 45, growth 80; then 8 s of demon form: 25% faster movement, 1.3× weight. Total 50 | Hit him during the 30-frame change, shield the burst, keep away for 8 s; no added damage | His defining moment; distinct from Eye Blast, his EX (#379) | Illidan model with the Metamorphosis effect, fel flames, green tint |
| Blademaster | **Bladestorm** · Warcraft III Blademaster ultimate (tier 1) | Plants his feet as wind gathers, f1–14 | f15–74 a steerable spin (drift 5 a frame), radius 110: a 2.5% hit every 10 frames, then f75 a 9% finish at 45°, base 50, growth 95. Total 104, dizzy at the end | Shield holds (light chip), jump above its 140-unit top, outrun it; punish the 30-frame dizzy | The duel's whirlwind, a real cost to commit | Blademaster spin clip, small tornado |
| Mountain King | **Avatar** · Warcraft III Mountain King ultimate (tier 1) | Raises the hammer, stone crackles over him, f1–32 | f33 a landing stomp, radius 180 both sides, 10%, 75°; then 10 s of stone: 1.5× weight and fall speed, stone tint | Hit him in the change, grab him (no armour), stay away for 10 s | The stout dwarf turned to stone | Avatar spell effect, Thunderclap ring |
| Warden | **Vengeance** · Warcraft III Warden ultimate, Avatar of Vengeance (tier 1) | Raises her blade; the Avatar rises behind her, f1–24 | The Avatar stands for 90 frames (30 durability) and throws four spectral glaives straight ahead at f24/39/54/69, 18 a frame, 7% each, 40°. She is free at f40 | Break the Avatar, jump or shield the glaives; punish her through f40 | The jailer's ghostly enforcer | Avatar of Vengeance / Spirit of Vengeance units, glaive missile |
| Lich | **Frost Wyrm** · Sapphiron, Kel'Thuzad's frost wyrm in Naxxramas (tier 2: Death and Decay, his WC3 ultimate, is already his side special) | Lifts his arms; a wyrm cry and a frost line overhead, f1–30 | f31 a frost wyrm sweeps across from behind him, 28 a frame at jump height (centre 200, radius 60); 16%, 60°, chills | Stay grounded under it, shield it; he is locked until f60 | The undead sky over Naxxramas; the high mirror of Murloc's low swarm | Frost Wyrm unit, FreezingBreath |
| Forsaken Paladin | **Light's Hammer** · WoW Paladin's Light's Hammer (tier 2: Resurrection raises only allies) | Hammer raised to the sky; a golden circle marks 220 ahead, f1–28 | f40 the hammer lands there, radius 110: 18%, 75°, base 45, growth 90; consecrated pulses at f52 and f64 hit grounded foes for 4% | Leave the circle, shield, jump the pulses; punish him through f70 | Holy ground is his whole plan | HolyBolt, Resurrect and Consecration effects |
| Dreadlord | **Inferno** · Warcraft III Dreadlord ultimate (tier 1) | Points; a burning mark 260 ahead, f1–20 | f40 an Infernal crashes onto the mark, radius 120: 16%, 80°; it stands 150 frames swiping (9%, 40 durability) | Leave the mark, shield the crash, beat or avoid the Infernal | The classic summon of a demon lord | Infernal unit and birth, fire impact |
| Shadow Hunter | **Big Bad Voodoo** · Warcraft III Shadow Hunter ultimate (tier 1) | Plants a voodoo totem and dances; a ring of radius 200 lights, f1–12 | f13–90 he is untouchable but rooted; the ring pulses 3% at f30/50/70 and erupts 12% at f90, 80° | Leave the ring, shield the pulses and eruption; punish f91–120 | Dancing, invulnerable trickster | Big Bad Voodoo aura, serpent ward fire |
| Pit Lord | **Doom** · Warcraft III Pit Lord ultimate (tier 1) | Clawed hand reaches back, green glyph flashes, f1–18 | f19–22 command grab, reach 120, beats shield; holds 30 frames, 10% then flings at 45°; Doom burns 12% over 3 s | Jump, roll or hit him first; a whiff ends at f60 | The doom-bringer's curse, close and brutal | Doom target effect, Doom Guard sound |
| Beastmaster | **Stampede** · Warcraft III Beastmaster ultimate (tier 1) | Raises his axes and roars; dust behind him, f1–24 | His pack charges past: Quilbeast low (f25), Bear mid (f40), Hawk high (f55), 22 a frame across the stage, 9% each | Each at a different height: jump the Quilbeast, shield the Bear, stay low under the Hawk; shield all three | His own three pets, as a stampede | Quilbeast, bear and hawk units, Stampede missile dust |
| Lich King | **Animate Dead** · Warcraft III Death Knight (Arthas) ultimate (tier 1) | Frostmourne raised; runes glow under the nearest foe, f1–30 | f40 the dead claw up from the marked spot, radius 90: 20%, 85° | Step off the mark, shield; punish him through f64 | Arthas raising the fallen beneath you | AnimateDead target, skeleton hands |
| Thrall | **Earthquake** · Warcraft III Far Seer ultimate (tier 1) | Raises the Doomhammer; cracks run both ways, f1–26 | f27 two ground tremors run outward both ways, 16 a frame for 50 frames, grounded foes only; 15%, 70° | Jump, stand on a platform, shield; punish him through f60 | The shaman shaking the world | Earthquake target and caster effects |
| Jaina | **Glacial Ray** · Jaina in the Battle of Dazar'alor (tier 2: Mass Teleport cannot be a strike) | Staff charges; a frost line at 45° above her, f1–24 | f25–54 a beam, 600 long, sweeps from 45° up to the floor ahead: three 5% chilling hits, then 10% at 30° | Get behind or inside her, shield; punish f55–80 | Her admiral-era fury in one sweep | BreathOfFrost, frost bolt, Blizzard target |
| Sylvanas | **Charm** · Warcraft III Dark Ranger ultimate (tier 1) | Draws a violet spectral arrow, f1–20 | f21 a slow banshee spirit, 10 a frame for 90 frames: 8%, then 3 s of Charm: the victim's left and right are swapped | Jump or shield the slow spirit; a charmed player still acts; punish her through f40 | Her mind games, without taking control away | Banshee missile, Possession effects |
| Cairne | **Reincarnation** · Warcraft III Tauren Chieftain ultimate (tier 1, reimagined: it triggers on death in WC3) | Totem driven down, ancestral light rises, f1–6 | f7–50 any strike that would hit him instead triggers a spirit pillar, radius 140: 18%, 70° | Do not strike: wait, grab, or zone; punish a whiff through f75 | The old chief who will not stay down | Reincarnation target, ancestral spirit |
| Chen | **Storm, Earth and Fire** · Warcraft III Brewmaster ultimate (tier 1) | He splits; three spirits appear, f1–20 | Earth stomps both sides (f21, radius 120, 8%), Storm strikes 220 ahead (f33, 7%), Fire breathes behind (f45, 9%) | Each spirit hits once in its own place and time: read the order, shield, or roll through | His three-way split as one combination | Storm, Earth and Fire Pandaren effects, Breath of Fire |
| Peon | **Timber!** · orc peons chopping trees (unit) | A big tree sprouts beside him; he chops three times, f1–36 | f37–48 the tree falls forward, 420 long, from upright to flat: 20%, 40°, base 45 | Stand behind him or past the treetop, shield, or hit him while he chops | Work work, and finally work complete | Ashenvale tree, lumber target art |
| Goblin Tinker | **Robo-Goblin Overdrive** · Warcraft III Tinker ultimate (tier 1, reimagined: Robo-Goblin is his down special) | He hops out; the robot waddles forward beeping, f1–20 | The robot walks 6 a frame for 60 frames, then explodes, radius 150: 22%, 55°; touching it explodes it early | Walk away, shield the blast, or punish Tinker through f50 | Goblin engineering that is almost a weapon | Robo-Goblin unit, goblin land mine explosion |
| Kael'thas | **Gravity Lapse** · Kael'thas in Tempest Keep and Magisters' Terrace (tier 2: Phoenix is his EX, #381) | Arcane orbs orbit him; a violet ring of radius 260, f1–28 | f29 everyone in the ring is lifted straight up: 14%, 90°, base 60, growth 85 | Leave the ring, shield; punish him through f60 | The prince's raid-boss signature | Mass Teleport and Cyclone effects |
| Murloc | **Mrglglgl Stampede** · Tom's decision (unit) | Blows a conch, "MRGLGLGLGL!", water splashes where the swarm enters, f1–20 | A dozen small murlocs pour across at ground level in about 40 frames: low multi-hit carry, launch at the end | Jump or be airborne, shield (heavy damage); off-stage is safe; Murloc is committed until the wave ends | Legible, funny, characterful | Murloc variants at small scale, splashes |
| Grom | **Blood of Mannoroth** · Grom drinking the demon blood in Warcraft III's campaign (tier 2: he has no hero ultimate) | Eyes blaze red; a roar, f1–16 | f17–40 a charge, 22 a frame; the first foe reached is caught (beats shield): three Gorehowl chops, 22% total, flung at 40° | Jump over, roll through, or hit him first; a whiff skids to f70 | Reckless commitment, all or nothing | Bloodlust effects, red tint |
| Anub'arak | **Locust Swarm** · Warcraft III Crypt Lord ultimate (tier 1) | Carapace opens; locusts boil out, f1–16 | f17–106 a cloud of radius 150 around him (he walks at 4 a frame): 2% every 12 frames, 6% burst at f106 | Outrun it, shield; punish him through f126 | The crypt king's swarm | Locust units, carrion swarm |
| Malfurion | **Wisps of Hyjal** · Malfurion's wisps detonating at Mount Hyjal, Warcraft III's finale (tier 2: Tranquility only heals) | Wisps gather around him, f1–28 | f29 a slow wall of wisps drifts forward 7 a frame for 120 frames: 20%, 50° on contact | Shield, jump over, get behind; punish him through f50 | The archdruid's quiet, inevitable answer | Wisp units, Tranquility |
| Medivh | **The Dark Portal** · Medivh opening the Dark Portal (tier 2: no hero ultimate) | A green portal opens 240 ahead, f1–24 | f25–60 it draws nearby foes in (1% every 6 frames, radius 220); f64 it erupts, radius 130: 18%, 60° | Walk out against the pull, shield, escape before f64 | The prophet's doom-laden punchline | Dark Portal target effect |
| Kobold | **You No Take Candle!** · kobold miners guarding their candle (unit) | Dives into the dirt, f1–14 | A dirt mound burrows toward the foe, 14 a frame, steerable, up to f54; f55 he erupts upward: 16%, 85° | Watch the mound, shield or jump as it stops; punish his 30-frame landing | Frantic, small and funny | Kobold, dirt spawn, candle flame |

## Implementation contract

- One ultimate per fighter, authored as hero special data (sim/ultimates.ts)
  and run by the same engine as specials, so it is deterministic and in
  snapshots through the special state.
- Each passes a recorded counterplay scenario: shieldable or dodgeable on its
  startup, punishable on a whiff, and no KO from 0%.
- Computer fighters press it at full bar when its authored range covers the
  target; Rookie never does.

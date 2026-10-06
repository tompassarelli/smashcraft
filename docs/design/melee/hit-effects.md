# Melee's hit and movement event language

What Melee shows and plays on each event, read from the decompilation
(melee:src/melee/, revision 0296f009f) for Smashcraft's own presentation with
Warcraft III assets. Only the mapping is recorded here: event, effect and sound
IDs, element, strength and timing. Melee's art and audio are never extracted or
shipped. Effect IDs are `efSync_Spawn` IDs; sound IDs are sound-bank indexes as
passed to `ft_PlaySFX`/`lbAudioAx_80024184`. `PlCo+0xNNN` names a field of the
common fighter data whose value lives in the private PlCo.dat.

## Hit sparks by element

A hitbox carries an element (5 bits) and a hit-sound kind (5 bits) and severity
(3 bits) in its spawn command (`spawn_hitbox_4`, melee:src/melee/lb/types.h).
On a hit, `hit_effect_ids[element]` (melee:src/melee/ft/ftcoll.c) picks the
spark, and `spawnHitEffect` spawns it at the contact point:

| Element | Effect | Notes |
| --- | --- | --- |
| Normal (0), Ground (9), Cape (10) | 1000 or 1011 | 1011 once knockback ≥ PlCo+0x3F0; severity ≥ 1 adds 1007 with chance 1 in PlCo+0x3F4 (fighters whose hit-spark variant is 0) |
| Fire (1) | 1002 | |
| Electric (2) | 1001 | also sets the victim's hitlag shake multiplier (below) |
| Slash (3) | 1004 | |
| Coin (4) | 1145 | |
| Ice (5) | 1005 | spawned with the victim's facing |
| Dark (13) | 1046 | |
| Nap, Sleep, Catch, Inert, Disable, Screw Attack, Lipstick | none | |

Strength therefore scales the normal spark only, in two steps (knockback
threshold, severity extra); other elements spawn one fixed effect.

## Hit sounds by kind and severity

`lbColl_80005BB0` plays `lbColl_803B9880[kind * 3 + severity]`
(melee:src/melee/lb/lbcollision.c); severity 0, 1, 2 is weak, medium, strong.
`0x83D60` is the no-sound ID.

| Kind | Weak | Medium | Strong |
| --- | --- | --- | --- |
| 0 | none | none | none |
| 1 | 91 | 90 | 89 |
| 2 | 88 | 87 | 86 |
| 3 | 111 | 112 | 113 |
| 4 | 84 | 84 | 84 |
| 5 | 90 | 89 | 223 |
| 6 | 225 | 225 | 225 |
| 7 | 98 | 99 | 100 |
| 8 | 101 | 102 | 103 |
| 9 | 280091 | 280091 | 280091 |
| 10 | 241 | 241 | 241 |
| 11 | 94 | 93 | 92 |
| 12 | 220079 | 220082 | 220085 |
| 13 | none | none | 525 (own voice channel) |

The decompilation does not name the kinds. A hit on a fighter that is
intangible, invincible or not hurtable plays `{141, 142, 143}[severity]`
instead (`ftColl_803C0C40`). Two slash hitboxes clashing play a random one of
107, 108, 109 (`ftColl_803C0C4C`); any other clash plays 106 (`0x6A`).

## Hitlag shake

During hitlag the victim vibrates with a per-fighter multiplier
`x1960_vibrateMult`, 1.0 by default (melee:src/melee/ft/fighter.c). An electric
hit sets it to PlCo+0x1A4 (melee:src/melee/ft/ftcoll.c, end of
`ftColl_8007A06C`); it returns to 1.0 when hitlag ends.

## Footsteps and landings

Walk and run animations step through a footstep command
(`ftAction_80072CD8`, melee:src/melee/ft/ftaction.c). It looks up the floor
line's material (`ft_80084A80` → `mpLib_80056A1C`,
melee:src/melee/mp/mplib.c) for a step sound and a step effect; a material
without its own sound falls back to the command's own sound event. The
landing command (`ftAction_80072E4C`) does the same through the material's
landing entry (`mpLib_80056A8C`) and plays sound 70 (`0x46`) where the
material has none. Each material entry (`mpLib_803BF248_t_x4`) holds a
friction scale, four step sounds, four landing sounds and four further sounds
with their effect IDs; for example one material's steps are 0x161 with
further sounds 0x36–0x39, another's 0x14F with landings 0x20E.

## Fighter command opcodes

Subaction commands dispatch on `opcode - 10`: 10 spawns an effect (ID, bone,
offset, range), 11 a hitbox, 15 and 16 clear one or all hitboxes, 17 plays a
sound (behaviour 0–6 picks the voice channel), 18 plays a random smash-charge
sound from the fighter's table.

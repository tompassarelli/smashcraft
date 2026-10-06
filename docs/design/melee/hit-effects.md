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

## Common values, colour and vibration

Privately read NTSC 1.02 PlCo.dat (SHA-1
`c904de0c4c5eb3ef65211a75d8bd70ca5b0f9f41`); the original file remains outside
repositories. The normal strong-spark threshold is **180 knockback**, and
both severity-extra random denominators are **4**. Electric vibration's
multiplier is **1.5**. The model-shift duration is
`1.2999999523162842 × hitlag + 0`, converted to an integer
(melee:src/melee/ft/kinds/ftCommon/ftCo_DamageFall.c).

The shift tables have separate airborne, grounded and electric shapes. Their
numerical offsets in Melee units are: airborne `(0,-3), (0,-1.5), (0,3),
(0,1.5)`; grounded `(-3,0), (-1.5,0), (3,0), (1.5,0)`, rotated along the
floor normal; electric `(0,-0.6600000262260437), (0.5,0.1599999964237213),
(0,5), (0.1599999964237213,0), (0,0)`. Facing mirrors x. The state initializer
excludes Cape, Disable, Nap, Sleep and DamageIce.

Damage selects colour-script 4 for ordinary/slash, 11 + reaction tier for
fire, 15 + tier for electric, 31 + tier for ice and 35 + tier for dark
(melee:src/melee/ft/kinds/ftCommon/ftCo_Damage.c). Script 4 blends white RGBA
`255,255,255,170` toward `255,255,255,20`; ice script 31 blends
`0,0,255,128` toward `255,255,255,128`. Fire's script repeat counts are
4/8/16, blending `255,240,120,170` toward `220,110,30,150`. Electric blends
`0,0,148,90` toward `255,255,255,70`, with an inner repeat of 2 and outer
repeats of 4/8/12. Those are colour programs, including shared
subroutines and effect commands, rather than one constant tint or the
fighter's stock colour. These selected numerical facts do not reproduce the
original programs, textures, models or sound banks.

## Shield, recovery, ledge and KO events

| Event | Effect IDs | Sound IDs and timing | Source |
| --- | --- | --- | --- |
| Shield appears / contact | 1047 shield; 1052 at contact; 1049 shield reaction | appearance 110; contact uses the shield reaction, not the ordinary element spark | melee:src/melee/ft/kinds/ftCommon/ftCo_Guard.c; melee:src/melee/ft/ftcoll.c |
| Electric shield contact | Same 1052 contact / 1049 reaction | element is retained on shield contact; the common shield-contact spark does not switch to 1001 | same |
| Powershield contact | 27, colour-script 118 | 104 | melee:src/melee/ft/ftcoll.c |
| Floor tumble impact / missed tech | 1031, replaceable by floor material | 9/10/11/12 by speed × weight, thresholds 180 and 140; the decompiled middle two comparisons both use 140, so 11 is unreachable in this routine; camera quake | melee:src/melee/ft/kinds/ftCommon/ftCo_DownBound.c |
| Floor tech, in place or roll | 1053; colour-script 120; action script may also emit 1011 | 3 plus fighter recovery voice at its sound-table offset 0x24, at entry | melee:src/melee/ft/kinds/ftCommon/ftCo_Passive.c; ftCo_PassiveStand.c |
| Wall / ceiling tech | 1053 at contact, colour-script 120 | 3 plus recovery voice; delayed wall-jump branch uses 8 | melee:src/melee/ft/kinds/ftCommon/ftCo_PassiveWall.c; ftCo_PassiveCeil.c |
| Ledge catch | 1052 at the actual ledge lip | 4 plus fighter ledge voice at sound-table offset 0x28 | melee:src/melee/ft/ftcliffcommon.c |
| Side/bottom/top blast KO | 1067 or 1068, player-coloured | left 136, right 137, top/bottom 97; fighter death voices at offsets 0x4 and 0x8, large quake | melee:src/melee/ft/ft_0D31.c |
| Star KO end | 1069 | 131 when the body vanishes | same |
| Screen KO | 1087 camera impact | fighter voice and delayed death sequencing; distinct from the blast-line spark | melee:src/melee/ft/ft_0D4D.c |

## Movement and grab action timelines

Selected Fox, Falco and Captain Falcon NTSC 1.02 action commands were read
privately with the command widths and field meanings from
melee:src/melee/ft/ftaction.c and melee:src/melee/lb/types.h. Values below are
encoded animation-frame positions; action speed can change their game-frame
position. Loop/goto/subroutine controls are not expanded into a full match.
They describe event vocabulary, not Smashcraft's fighter frame data.

| Event | Selected facts |
| --- | --- |
| Walk | Fox's slow walk floor-footstep command 54 at frames 10/35, middle 4/20, fast 7/22. Each animation loops; walking is not a fixed global sound clock. |
| Run | Fox/Falco footstep command 54 at 3/13; run dust 1022 at 8/20. Captain Falcon's dust is at 10/20. |
| Dash | Selected three fighters emit sound 0 at frame 0 and dust 1023 at 4; common Dash entry also plays 280. Dash is a distinct start cue, not a run footstep. |
| Braking | Selected three emit sound 5 and skid effect 1025 at frame 0; common RunBrake also plays 281. |
| Ground jump | Common takeoff sound 282 plus fighter jump voice (offset 0x10). Fox/Falco animation sound 74 at 0 and effect 1026 at 2; Captain Falcon both at 2. |
| Aerial jump | Common sound 283; selected Fox/Falco sound 74 and effect 1027 at 0; Captain Falcon at 2. |
| Landing | Selected normal and aerial landings use material landing command 55 at frame 0; fallback sound 70. |
| Grab | Selected catches emit 1024 at 0 and sound 527 on the active catch (Fox/Falco standing 6, dash 11; Captain Falcon dash 10). Catch element itself produces no ordinary hit spark. |
| Pummel | Fox CatchAttack contact at frame 4: normal element, sound kind 1, severity 0, therefore sound 91. The spark comes from contact, not an extra generic pummel spawn command. |
| Throw | Fox forward at 11 and back at 9 emit 1300, 1011, 1021; up at 8 emits 1300; down at 16 emits 1030, 1300 and sound 9. Throw damage installs its element, contact position and launch separately. |
| Ledge recovery | Fox quick climb: dust 1022 and sound 401 at 27, sound 401 at 29. Quick attack: effect 1011 at 18, sound 165 and effect 1021 at 25. Quick roll: 1031 at 30. Ledge-jump's second phase emits 1023 at 0. These vary by fighter and slow/quick action. |
| Knockdown follow-through | Selected normal bounce plays sound 13 at 22. Get-up/roll commands add dust 1024/1025/1031; those are distinct from the initial common floor impact. |

## Smashcraft's Warcraft presentation

The mapping lives in smashcraft:ts/src/game/presentation/hitPresentation.ts.
Every model and sound is a stock Warcraft asset; this mapping imports no
Melee asset. Effects use the existing pooled handles; audio consumes confirmed
frames and never runs from a rollback replay. Tint and vibration change only
the presented body. The bounded, authored choices below are Smashcraft's style,
not claims that Warcraft renders Melee's artwork or exact animation programs.

| Event | Warcraft effect | Stock sound label |
| --- | --- | --- |
| Ordinary hit / pummel | Stampede missile impact | StampedeHit; pummel uses higher, quieter Defend |
| Fire hit | Incinerate / Fire Lord explosion | Fireball |
| Electric hit / electric shield | Bolt impact | LightningBolt |
| Slash hit | Cleave target | RelentlessCleave |
| Ice / freeze begins | Frost Nova target | FrostNova |
| Shield / powershield | Defend caster | Defend, powershield higher |
| Missed floor/wall/ceiling tech | War Stomp impact and dust | Warstomp |
| Successful tech | Dispel Magic target | DispelMagic |
| Grab | Defend flash | EntanglingRoots |
| Throw release | Blink target | BlinkTarget |
| Ledge catch / recovery | Dispel Magic / Blink | quiet BlinkTarget |
| Ground jump / aerial jump | dust / Blink | quiet BlinkTarget |
| Walk / run / dash / ordinary landing | Impale target dust | DeepFootstep / DeepFootstep2; distinct volume and pitch |
| Blast KO / star close / respawn | Thunder Clap / Dispel Magic / Resurrection | ThunderClap for KO; original fighter death cues remain |

Inspection command in developer builds: `-dev quick`, then `-dev effects N`.
The numbered cases are declared in
smashcraft:ts/src/game/shell/hitPresentationCases.ts; the command changes only
presentation. It gives native capture an exact event list, while the matching
headless test checks the effect pose, sound dispatch, and rejection of repeat
or older confirmed frames. A fresh map start is required after changing the
pool's model families; hot reload keeps existing handles and their models.

Stock sound names were resolved from Warcraft's AnimSounds.slk. The stock model
sequences were inspected too: War Stomp, Bolt, Thunder Clap and Resurrection
use Stand; the remaining mapped models use Birth. These names are Warcraft
metadata, not inferred spell-display names.

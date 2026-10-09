# Move sound table

Generated from smashcraft:ts/src/game/presentation/moveSounds.ts by
`bun scripts/soundTable.ts` (from smashcraft:ts/); edit the table there, never here.
The model and its reasons are in [sound.md](sound.md). Names are Warcraft III sound
labels (AnimSounds, AbilitySounds, UnitCombatSounds) or file names; `A / B` is
alternatives a serial picks among, `A + B` layers. A whiff plays the perform column
alone. Voice plays on two of three uses. A normal's fire, electric, ice, dark, holy,
poison or arcane hit also layers that element's sound. Normals sharing every sound share a row.

## Rifleman

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab, Third jab | BattleNetWooshStereo1 | WoodLightBashFlesh | WoodHeavyBashFlesh + FlakCannonHit | WoodLightBashMetal |  |
| Shot | RiflemanAttack1 | GyrocopterAttack | GyrocopterAttack + FlakCannonHit | WoodLightBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | WoodHeavyBashFlesh | WoodHeavyBashFlesh + FlakCannonHit | WoodHeavyBashMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack, Dash attack | BattleNetWooshStereo1 | WoodMediumBashFlesh | WoodHeavyBashFlesh + FlakCannonHit | WoodMediumBashMetal |  |
| Neutral special: Blaster | RiflemanAttack1 | GyrocopterAttack | GyrocopterAttack + FlakCannonHit | WoodMediumBashMetal |  |
| Side special: Summon Bear | DruidOfTheClawMorph | StampedeHit | StampedeHit + FlakCannonHit | WoodMediumBashMetal |  |
| Up special: Recoil Shot | RiflemanAttack1 | GyrocopterAttack | GyrocopterAttack + FlakCannonHit | WoodMediumBashMetal |  |
| Down special: Frost Trap | WardBirth | FrostNova | FrostNova + FlakCannonHit | WoodMediumBashMetal |  |

## Illidan

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab, Third jab | BattleNetWooshStereo1 | MetalLightSliceFlesh | MetalHeavySliceFlesh + DemonHunterMissileHit | MetalLightSliceMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalHeavySliceFlesh | MetalHeavySliceFlesh + DemonHunterMissileHit | MetalHeavySliceMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack, Dash attack | BattleNetWooshStereo1 | MetalMediumSliceFlesh | MetalHeavySliceFlesh + DemonHunterMissileHit | MetalMediumSliceMetal |  |
| Neutral special: Mana Burn | DemonHunterMissileLaunch | ManaBurn | ManaBurn + DemonHunterMissileHit | MetalMediumSliceMetal |  |
| Side special: Fel Rush | DestroyerMissileLaunch | MetalHeavySliceFlesh | MetalHeavySliceFlesh + DemonHunterMissileHit | MetalMediumSliceMetal |  |
| Up special: Wing Ascent | GargoyleMissileLaunch | MetalMediumSliceFlesh | MetalMediumSliceFlesh + DemonHunterMissileHit | MetalMediumSliceMetal |  |
| Down special: Immolate | FireballLaunch | Fireball | Fireball + DemonHunterMissileHit | MetalMediumSliceMetal |  |

## Blademaster

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | MetalLightSliceFlesh | MetalHeavySliceFlesh + CriticalStrike | MetalLightSliceMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 + HeroBladeMasterAttack1 / HeroBladeMasterAttack2 | MetalHeavySliceFlesh | MetalHeavySliceFlesh + CriticalStrike | MetalHeavySliceMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 + HeroBladeMasterAttack1 / HeroBladeMasterAttack2 | MetalMediumSliceFlesh | MetalHeavySliceFlesh + CriticalStrike | MetalMediumSliceMetal |  |
| Neutral special: Wind Cutter | DemonHunterMissileLaunch | MetalMediumSliceFlesh | MetalMediumSliceFlesh + CriticalStrike | MetalMediumSliceMetal |  |
| Side special: Wind Walk | WindWalk | CriticalStrike | CriticalStrike + CriticalStrike | MetalMediumSliceMetal |  |
| Up special: Rising Whirlwind | Whirlwind | MetalMediumSliceFlesh | MetalMediumSliceFlesh + CriticalStrike | MetalMediumSliceMetal |  |
| Down special: Mirror Image | MirrorImage | MetalMediumSliceFlesh | MetalMediumSliceFlesh + CriticalStrike | MetalMediumSliceMetal |  |

## Mountain King

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | WoodMediumBashFlesh | MetalHeavyBashFlesh + StormBolt | WoodMediumBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 + HeroMountainKingAttack1 | MetalHeavyBashFlesh | MetalHeavyBashFlesh + StormBolt | MetalHeavyBashMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 + HeroMountainKingAttack1 | MetalMediumBashFlesh | MetalHeavyBashFlesh + StormBolt | MetalMediumBashMetal |  |
| Neutral special: Storm Bolt | StormBoltLaunch | StormBolt | StormBolt + StormBolt | MetalMediumBashMetal |  |
| Side special: Storm Rush | BattleRoar | MetalHeavyBashFlesh | MetalHeavyBashFlesh + StormBolt | MetalMediumBashMetal |  |
| Up special: Thunder Leap | HeroMountainKingAttack1 | ThunderClap | ThunderClap + StormBolt | MetalMediumBashMetal |  |
| Down special: Thunder Clap | Taunt | ThunderClap | ThunderClap + StormBolt | MetalMediumBashMetal |  |

## Warden

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Down tilt, Second jab, Third jab | BattleNetWooshStereo1 | MetalLightSliceFlesh | MetalHeavySliceFlesh + FanOfKnivesHit | MetalLightSliceMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalHeavySliceFlesh | MetalHeavySliceFlesh + FanOfKnivesHit | MetalHeavySliceMetal | WardenAttack |
| Forward tilt, Up tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | MetalMediumSliceFlesh | MetalHeavySliceFlesh + FanOfKnivesHit | MetalMediumSliceMetal |  |
| Neutral special: Shadow Strike | ShadowStrikeMissileBirth | ShadowStrikeBirth | ShadowStrikeBirth + FanOfKnivesHit | MetalMediumSliceMetal |  |
| Side special: Shadow Pursuit | BlinkCaster | MetalHeavySliceFlesh | MetalHeavySliceFlesh + FanOfKnivesHit | MetalMediumSliceMetal |  |
| Up special: Blink | BlinkTarget | MetalLightSliceFlesh | MetalLightSliceFlesh + FanOfKnivesHit | MetalMediumSliceMetal |  |
| Down special: Fan of Knives | FanOfKnives | FanOfKnivesHit | FanOfKnivesHit + FanOfKnivesHit | MetalMediumSliceMetal |  |

## Lich

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | WoodLightBashFlesh | WoodHeavyBashFlesh + LichMissile | WoodLightBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | WoodHeavyBashFlesh | WoodHeavyBashFlesh + LichMissile | WoodHeavyBashMetal | HeroLichAttack1 |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | WoodMediumBashFlesh | WoodHeavyBashFlesh + LichMissile | WoodMediumBashMetal |  |
| Neutral special: Frost Nova | ZigguratFrostMissileLaunch | FrostNova | FrostNova + LichMissile | WoodMediumBashMetal |  |
| Side special: Death and Decay | DeathAndDecayTarget | DeathCoil | DeathCoil + LichMissile | WoodMediumBashMetal |  |
| Up special: Spectral Ascent | BansheeMissileLaunch | LichMissile | LichMissile + LichMissile | WoodMediumBashMetal |  |
| Down special: Frost Armor | FrostArmor | FrostBoltHit | FrostBoltHit + LichMissile | WoodMediumBashMetal |  |

## Forsaken Paladin

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | WoodLightBashFlesh | WoodHeavyBashFlesh + HolyBolt | WoodLightBashMetal |  |
| Up smash, Down smash, Forward smash, Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Up air, Down air, Dash attack | BattleNetWooshStereo1 + HeroPaladinAttack1 / HeroPaladinAttack2 | WoodHeavyBashFlesh | WoodHeavyBashFlesh + HolyBolt | WoodHeavyBashMetal |  |
| Back air | BattleNetWooshStereo1 + HeroPaladinAttack1 / HeroPaladinAttack2 | WoodMediumBashFlesh | WoodHeavyBashFlesh + HolyBolt | WoodMediumBashMetal |  |
| Neutral special: Cleansing Hammer | DispelMagic | WoodHeavyBashFlesh | WoodHeavyBashFlesh + HolyBolt | WoodMediumBashMetal |  |
| Side special: Righteous Fury | DivineShield | WoodHeavyBashFlesh | WoodHeavyBashFlesh + HolyBolt | WoodMediumBashMetal |  |
| Up special: Ascension | InnerFire | WoodMediumBashFlesh | WoodMediumBashFlesh + HolyBolt | WoodMediumBashMetal |  |
| Down special: Consecration | Heal | HolyBolt | HolyBolt + HolyBolt | WoodMediumBashMetal |  |

## Dreadlord

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab, Third jab | BattleNetWooshStereo1 | MetalLightSliceFlesh | MetalMediumChopFlesh + BansheeMissileHit | MetalLightSliceMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalMediumChopFlesh | MetalMediumChopFlesh + BansheeMissileHit | MetalMediumChopMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | MetalLightChopFlesh | MetalMediumChopFlesh + BansheeMissileHit | MetalLightChopMetal |  |
| Neutral special: Carrion Swarm | CarrionSwarmLaunch | CarrionSwarmDamage | CarrionSwarmDamage + BansheeMissileHit | MetalLightChopMetal |  |
| Side special: Vampiric Pounce | BansheeMissileLaunch | DeathPactTarget | DeathPactTarget + BansheeMissileHit | MetalLightChopMetal |  |
| Up special: Bat Ascension | GargoyleMissileLaunch | MetalLightChopFlesh | MetalLightChopFlesh + BansheeMissileHit | MetalLightChopMetal |  |
| Down special: Sleep | Sleep | CreepSleep | CreepSleep + BansheeMissileHit | MetalLightChopMetal |  |

## Shadow Hunter

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab, Third jab | BattleNetWooshStereo1 | MetalLightChopFlesh | MetalHeavyChopFlesh + HunterMissileHit | MetalLightChopMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalHeavyChopFlesh | MetalHeavyChopFlesh + HunterMissileHit | MetalHeavyChopMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | MetalMediumChopFlesh | MetalHeavyChopFlesh + HunterMissileHit | MetalMediumChopMetal |  |
| Neutral special: Spirit Glaive | ShadowHunterMissileLaunch | ShadowHunterMissileHit | ShadowHunterMissileHit + HunterMissileHit | MetalMediumChopMetal |  |
| Side special: Serpent Ward | WardBirth | PoisonArrowHit | PoisonArrowHit + HunterMissileHit | MetalMediumChopMetal |  |
| Up special: Loa Vault | VoodooBirth | MetalMediumChopFlesh | MetalMediumChopFlesh + HunterMissileHit | MetalMediumChopMetal |  |
| Down special: Hex | WitchDoctorMissileLaunch | Polymorph | Polymorph + HunterMissileHit | MetalMediumChopMetal |  |

## Pit Lord

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | MetalLightChopFlesh | MetalHeavyChopFlesh + InfernalAttack2 | MetalLightChopMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 + PitLordAttack1 / PitLordAttack2 / PitLordAttack3 | MetalHeavyChopFlesh | MetalHeavyChopFlesh + InfernalAttack2 | MetalHeavyChopMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air | BattleNetWooshStereo1 + PitLordAttack1 / PitLordAttack2 / PitLordAttack3 | MetalMediumChopFlesh | MetalHeavyChopFlesh + InfernalAttack2 | MetalMediumChopMetal |  |
| Dash attack | BattleNetWooshStereo1 + PitLordAttackSlam1 | RockHeavyBashFlesh | RockHeavyBashFlesh + InfernalAttack2 | MetalHeavyChopMetal |  |
| Neutral special: Howl of Terror | HowlOfTerror | CrushingWaveDamage | CrushingWaveDamage + InfernalAttack2 | MetalMediumChopMetal |  |
| Side special: Ruin Charge | BalrogAttack1 | RockHeavyBashFlesh | RockHeavyBashFlesh + InfernalAttack2 | MetalMediumChopMetal |  |
| Up special: Abyssal Leap | PitLordAttackSlam1 | InfernalBirth | InfernalBirth + InfernalAttack2 | MetalMediumChopMetal |  |
| Down special: Rain of Fire | RainOfFireWave | Fireball | Fireball + InfernalAttack2 | MetalMediumChopMetal |  |

## Beastmaster

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab, Third jab | BattleNetWooshStereo1 | MetalLightChopFlesh | MetalHeavyChopFlesh + AxeMissileHit | MetalLightChopMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalHeavyChopFlesh | MetalHeavyChopFlesh + AxeMissileHit | MetalHeavyChopMetal | BeastmasterAttack |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | MetalMediumChopFlesh | MetalHeavyChopFlesh + AxeMissileHit | MetalMediumChopMetal |  |
| Neutral special: Wild Axes | AxeMissileLaunch | AxeMissileHit | AxeMissileHit + AxeMissileHit | MetalMediumChopMetal |  |
| Side special: Summon Bear | DruidOfTheClawMorph | StampedeHit | StampedeHit + AxeMissileHit | MetalMediumChopMetal |  |
| Up special: Summon Hawk | HarpyMissileLaunch | HarpyMissileHit | HarpyMissileHit + AxeMissileHit | MetalMediumChopMetal |  |
| Down special: Summon Quilbeast | BristleBackMissileLaunch | BristleBackMissileHit | BristleBackMissileHit + AxeMissileHit | MetalMediumChopMetal |  |

## Lich King

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab, Third jab | BattleNetWooshStereo1 | MetalLightSliceFlesh | MetalHeavySliceFlesh + FrostWyrmAttack1 | MetalLightSliceMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 + HeroDeathKnightAttack1 | MetalHeavySliceFlesh | MetalHeavySliceFlesh + FrostWyrmAttack1 | MetalHeavySliceMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 + HeroDeathKnightAttack1 | MetalMediumSliceFlesh | MetalHeavySliceFlesh + FrostWyrmAttack1 | MetalMediumSliceMetal |  |
| Neutral special: Howling Blast | BreathOfFrost | FrostNova | FrostNova + FrostWyrmAttack1 | MetalMediumSliceMetal |  |
| Side special: Val'kyr Shadowguard | PossessionMissileLaunch | PossessionMissileHit | PossessionMissileHit + FrostWyrmAttack1 | MetalMediumSliceMetal |  |
| Up special: Ascension of the Damned | FrostArmor | FrostBoltHit | FrostBoltHit + FrostWyrmAttack1 | MetalMediumSliceMetal |  |
| Down special: Defile | DeathAndDecayTarget | DeathCoil | DeathCoil + FrostWyrmAttack1 | MetalMediumSliceMetal |  |

## Thrall

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | WoodMediumBashFlesh | MetalHeavyBashFlesh + StormBolt | WoodMediumBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalHeavyBashFlesh | MetalHeavyBashFlesh + StormBolt | MetalHeavyBashMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack | BattleNetWooshStereo1 | MetalMediumBashFlesh | MetalHeavyBashFlesh + StormBolt | MetalMediumBashMetal |  |
| Neutral special: Chain Lightning | HeroFarSeerAttack1 | LightningBolt | LightningBolt + StormBolt | MetalMediumBashMetal |  |
| Side special: Feral Spirit | FeralSpiritTarget | MetalMediumChopFlesh | MetalMediumChopFlesh + StormBolt | MetalMediumBashMetal |  |
| Up special: Far Sight | RevealMap | MetalMediumBashFlesh | MetalMediumBashFlesh + StormBolt | MetalMediumBashMetal |  |
| Down special: Earthquake | Earthquake | Warstomp | Warstomp + StormBolt | MetalMediumBashMetal |  |

## Jaina Proudmoore

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | WoodLightBashFlesh | WoodHeavyBashFlesh + FrostBoltHit | WoodLightBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | WoodHeavyBashFlesh | WoodHeavyBashFlesh + FrostBoltHit | WoodHeavyBashMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | WoodMediumBashFlesh | WoodHeavyBashFlesh + FrostBoltHit | WoodMediumBashMetal |  |
| Neutral special: Frostbolt | FrostBoltLaunch | FrostBoltHit | FrostBoltHit + FrostBoltHit | WoodMediumBashMetal |  |
| Side special: Blizzard | FrostArrowLaunch | FrostNova | FrostNova + FrostBoltHit | WoodMediumBashMetal |  |
| Up special: Blink | BlinkCaster | BlinkTarget | BlinkTarget + FrostBoltHit | WoodMediumBashMetal |  |
| Down special: Summon Water Elemental | WaterElementalBirth | WaterElementalMissile | WaterElementalMissile + FrostBoltHit | WoodMediumBashMetal |  |

## Sylvanas Windrunner

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab, Third jab | BattleNetWooshStereo1 | WoodLightBashFlesh | WoodHeavyBashFlesh + BlackArrowHit | WoodLightBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | WoodHeavyBashFlesh | WoodHeavyBashFlesh + BlackArrowHit | WoodHeavyBashMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | WoodMediumBashFlesh | WoodHeavyBashFlesh + BlackArrowHit | WoodMediumBashMetal |  |
| Neutral special: Black Arrow | ArrowLaunch | BlackArrowHit | BlackArrowHit + BlackArrowHit | WoodMediumBashMetal |  |
| Side special: Silence | Silence | Curse | Curse + BlackArrowHit | WoodMediumBashMetal |  |
| Up special: Banshee Flight | BansheeMissileLaunch | BansheeMissileHit | BansheeMissileHit + BlackArrowHit | WoodMediumBashMetal |  |
| Down special: Life Drain | DarkRitual | DeathCoil | DeathCoil + BlackArrowHit | WoodMediumBashMetal |  |

## Cairne Bloodhoof

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | WoodMediumBashFlesh | RockHeavyBashFlesh + Pulverize | WoodMediumBashMetal |  |
| Up smash, Down smash, Forward smash, Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 + HeroTaurenChieftainAttack1 / HeroTaurenChieftainAttack2 | RockHeavyBashFlesh | RockHeavyBashFlesh + Pulverize | RockHeavyBashMetal |  |
| Neutral special: Shockwave | ShockWave | RockHeavyBashFlesh | RockHeavyBashFlesh + Pulverize | RockHeavyBashMetal |  |
| Side special: War Stomp | HeroTaurenChieftainAttack2 | Warstomp | Warstomp + Pulverize | RockHeavyBashMetal |  |
| Up special: Spirit Lift | AncestralSpirit | WoodMediumBashFlesh | WoodMediumBashFlesh + Pulverize | RockHeavyBashMetal |  |
| Down special: Reincarnation | Reincarnation | Pulverize | Pulverize + Pulverize | RockHeavyBashMetal |  |

## Chen Stormstout

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab, Third jab | BattleNetWooshStereo1 | WoodLightBashFlesh | WoodHeavyBashFlesh + Pulverize | WoodLightBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | WoodHeavyBashFlesh | WoodHeavyBashFlesh + Pulverize | WoodHeavyBashMetal | BrewmasterAttack1 / BrewmasterAttack2 |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | WoodMediumBashFlesh | WoodHeavyBashFlesh + Pulverize | WoodMediumBashMetal |  |
| Neutral special: Breath of Fire | BreathOfFire | Fireball | Fireball + Pulverize | WoodMediumBashMetal |  |
| Side special: Drunken Haze | StrongDrinkMissile | StrongDrink | StrongDrink + Pulverize | WoodMediumBashMetal |  |
| Up special: Storm Rise | CycloneBirth | WoodMediumBashFlesh | WoodMediumBashFlesh + Pulverize | WoodMediumBashMetal |  |
| Down special: Threefold Stance | Taunt | Fireball | Fireball + Pulverize | WoodMediumBashMetal |  |

## Peon

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | MetalLightChopFlesh | MetalHeavyChopFlesh + AxeMediumChopWood | MetalLightChopMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalHeavyChopFlesh | MetalHeavyChopFlesh + AxeMediumChopWood | MetalHeavyChopMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | MetalMediumChopFlesh | MetalHeavyChopFlesh + AxeMediumChopWood | MetalMediumChopMetal |  |
| Neutral special: Lumber Toss | AxeMissileLaunch | AxeMediumChopWood | AxeMediumChopWood + AxeMediumChopWood | MetalMediumChopMetal |  |
| Side special: Burrow | WardBirth | WyvernSpearMissile | WyvernSpearMissile + AxeMediumChopWood | MetalMediumChopMetal |  |
| Up special: Worksite Launch | CatapultAttack1 | WoodMediumBashFlesh | WoodMediumBashFlesh + AxeMediumChopWood | MetalMediumChopMetal |  |
| Down special: Repair | Repair | AxeMediumChopWood | AxeMediumChopWood + AxeMediumChopWood | MetalMediumChopMetal |  |

## Goblin Tinker

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab, Third jab | BattleNetWooshStereo1 | WoodMediumBashFlesh | MetalHeavyBashFlesh + GyrocopterAttack | WoodMediumBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalHeavyBashFlesh | MetalHeavyBashFlesh + GyrocopterAttack | MetalHeavyBashMetal | GoblinAlchemistAttack |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | MetalMediumBashFlesh | MetalHeavyBashFlesh + GyrocopterAttack | MetalMediumBashMetal |  |
| Neutral special: Cluster Rockets | ClusterRocketsLaunch | ClusterRocketsImpact | ClusterRocketsImpact + GyrocopterAttack | MetalMediumBashMetal |  |
| Side special: Pocket Factory | PocketFactoryBirth | GoblinSapperExplode | GoblinSapperExplode + GyrocopterAttack | MetalMediumBashMetal |  |
| Up special: Rocket Boots | MortarTeamAttack2 | MetalMediumBashFlesh | MetalMediumBashFlesh + GyrocopterAttack | MetalMediumBashMetal |  |
| Down special: Robo-Goblin | HeroTinkerMorph | SteamTankAttack | SteamTankAttack + GyrocopterAttack | MetalMediumBashMetal |  |

## Kael'thas Sunstrider

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | WoodLightBashFlesh | WoodHeavyBashFlesh + HeroFlameLordMissileImpact | WoodLightBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | WoodHeavyBashFlesh | WoodHeavyBashFlesh + HeroFlameLordMissileImpact | WoodHeavyBashMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack | BattleNetWooshStereo1 | WoodMediumBashFlesh | WoodHeavyBashFlesh + HeroFlameLordMissileImpact | WoodMediumBashMetal |  |
| Neutral special: Flame Strike | FireballLaunch | FlameStrike | FlameStrike + HeroFlameLordMissileImpact | WoodMediumBashMetal |  |
| Side special: Siphon Mana | SiphonManaCaster | ManaBurn | ManaBurn + HeroFlameLordMissileImpact | WoodMediumBashMetal |  |
| Up special: Phoenix Flight | PhoenixMissileLaunch | Fireball | Fireball + HeroFlameLordMissileImpact | WoodMediumBashMetal |  |
| Down special: Banish | BanishCaster | Feedback | Feedback + HeroFlameLordMissileImpact | WoodMediumBashMetal |  |

## Murloc

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | MetalLightSliceFlesh | MetalMediumChopFlesh + CrushingWaveDamage | MetalLightSliceMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalMediumChopFlesh | MetalMediumChopFlesh + CrushingWaveDamage | MetalMediumChopMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack | BattleNetWooshStereo1 | MetalLightChopFlesh | MetalMediumChopFlesh + CrushingWaveDamage | MetalLightChopMetal |  |
| Neutral special: Ensnare | EnsnareMissile | Ensnare | Ensnare + CrushingWaveDamage | MetalLightChopMetal |  |
| Side special: Tidal Rush | BigWaterStep | CrushingWaveDamage | CrushingWaveDamage + CrushingWaveDamage | MetalLightChopMetal |  |
| Up special: Tide Spout | CrushingWave | WaterElementalMissile | WaterElementalMissile + CrushingWaveDamage | MetalLightChopMetal |  |
| Down special: Disease Cloud | Parasite | PoisonArrowHit | PoisonArrowHit + CrushingWaveDamage | MetalLightChopMetal |  |

## Grom Hellscream

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | MetalLightChopFlesh | MetalHeavyChopFlesh + CriticalStrike | MetalLightChopMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalHeavyChopFlesh | MetalHeavyChopFlesh + CriticalStrike | MetalHeavyChopMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack | BattleNetWooshStereo1 | MetalMediumChopFlesh | MetalHeavyChopFlesh + CriticalStrike | MetalMediumChopMetal |  |
| Neutral special: Warsong Cry | BattleRoar | MetalMediumChopFlesh | MetalMediumChopFlesh + CriticalStrike | MetalMediumChopMetal |  |
| Side special: Gorehowl Rush | Whirlwind | MetalHeavyChopFlesh | MetalHeavyChopFlesh + CriticalStrike | MetalMediumChopMetal |  |
| Up special: Blood Leap | Bloodlust | MetalMediumChopFlesh | MetalMediumChopFlesh + CriticalStrike | MetalMediumChopMetal |  |
| Down special: Mannoroth's Bane | UnholyFrenzy | MetalHeavyChopFlesh | MetalHeavyChopFlesh + CriticalStrike | MetalMediumChopMetal |  |

## Kobold

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | MetalLightChopFlesh | MetalHeavyChopFlesh + GoblinLandMineDeath | MetalLightChopMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalHeavyChopFlesh | MetalHeavyChopFlesh + GoblinLandMineDeath | MetalHeavyChopMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack | BattleNetWooshStereo1 | MetalMediumChopFlesh | MetalHeavyChopFlesh + GoblinLandMineDeath | MetalMediumChopMetal |  |
| Neutral special: Wick Flick | SearingArrowLaunch | SearingArrowHit | SearingArrowHit + GoblinLandMineDeath | MetalMediumChopMetal |  |
| Side special: Panic Dig | Burrow | MetalLightChopFlesh | MetalLightChopFlesh + GoblinLandMineDeath | MetalMediumChopMetal |  |
| Up special: Candle Escape | VolcanoMissileLaunch | WoodLightBashFlesh | WoodLightBashFlesh + GoblinLandMineDeath | MetalMediumChopMetal |  |
| Down special: Mine! | WardBirth | GoblinLandMineDeath | GoblinLandMineDeath + GoblinLandMineDeath | MetalMediumChopMetal |  |

## Malfurion Stormrage

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | WoodLightBashFlesh | WoodHeavyBashFlesh + KeeperOfTheGroveMissileHit | WoodLightBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | WoodHeavyBashFlesh | WoodHeavyBashFlesh + KeeperOfTheGroveMissileHit | WoodHeavyBashMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Neutral air, Forward air, Back air, Up air, Down air, Dash attack | BattleNetWooshStereo1 | WoodMediumBashFlesh | WoodHeavyBashFlesh + KeeperOfTheGroveMissileHit | WoodMediumBashMetal |  |
| Neutral special: Entangling Roots | KeeperOfTheGroveMissileLaunch | EntanglingRoots | EntanglingRoots + KeeperOfTheGroveMissileHit | WoodMediumBashMetal |  |
| Side special: Stag Charge | BattleRoar | StampedeHit | StampedeHit + KeeperOfTheGroveMissileHit | WoodMediumBashMetal |  |
| Up special: Dream Ascent | DruidOfTheTalonMorph | DruidOfTheTalonMissileHit | DruidOfTheTalonMissileHit + KeeperOfTheGroveMissileHit | WoodMediumBashMetal |  |
| Down special: Force of Nature | ForceOfNatureBirth | WoodHeavyBashFlesh | WoodHeavyBashFlesh + KeeperOfTheGroveMissileHit | WoodMediumBashMetal |  |

## Medivh

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | WoodLightBashFlesh | WoodHeavyBashFlesh + ManaFlareMissile | WoodLightBashMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | WoodHeavyBashFlesh | WoodHeavyBashFlesh + ManaFlareMissile | WoodHeavyBashMetal |  |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack | BattleNetWooshStereo1 | WoodMediumBashFlesh | WoodHeavyBashFlesh + ManaFlareMissile | WoodMediumBashMetal |  |
| Neutral special: Arcane Omen | SorceressMissileLaunch | SorceressMissileHit | SorceressMissileHit + ManaFlareMissile | WoodMediumBashMetal |  |
| Side special: Vanishing Act | BlinkCaster | Feedback | Feedback + ManaFlareMissile | WoodMediumBashMetal |  |
| Up special: Raven Flight | DruidOfTheTalonMorph | DruidOfTheTalonMissileHit | DruidOfTheTalonMissileHit + ManaFlareMissile | WoodMediumBashMetal |  |
| Down special: Last Word | SpellStealMissileLaunch | SpellStealTarget | SpellStealTarget + ManaFlareMissile | WoodMediumBashMetal |  |

## Anub'arak

| Move | Perform | Weak hit | Strong hit | Shield hit | Voice |
| --- | --- | --- | --- | --- | --- |
| Jab, Second jab | BattleNetWooshStereo1 | MetalLightSliceFlesh | MetalMediumChopFlesh + ImpaleHit | MetalLightSliceMetal |  |
| Up smash, Down smash, Forward smash | BattleNetWooshStereo1 | MetalMediumChopFlesh | MetalMediumChopFlesh + ImpaleHit | MetalMediumChopMetal | CryptLordAttack1 / CryptLordAttack2 |
| Forward tilt, Up tilt, Down tilt, Forward tilt (up), Forward tilt (down), Get-up attack, Neutral air, Forward air, Back air, Up air, Down air, Ledge attack, Dash attack | BattleNetWooshStereo1 | MetalLightChopFlesh | MetalMediumChopFlesh + ImpaleHit | MetalLightChopMetal |  |
| Neutral special: Impale | Impale | ImpaleHit | ImpaleHit + ImpaleHit | MetalLightChopMetal |  |
| Side special: Burrow Hunt | Burrow | ImpaleLand | ImpaleLand + ImpaleHit | MetalLightChopMetal |  |
| Up special: Crypt Eruption | ImpaleLand | RockHeavyBashFlesh | RockHeavyBashFlesh + ImpaleHit | MetalLightChopMetal |  |
| Down special: Carrion Beetle | ScarabBirth | CryptFiendMissileHit | CryptFiendMissileHit + ImpaleHit | MetalLightChopMetal |  |

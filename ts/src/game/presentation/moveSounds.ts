// Variants and pitch come from hit and attack serials, never a random source, so every client and replay sounds alike.
import { at } from "wisp/src/runtime/lookup";
import { imod } from "wisp/src/sim/intMath";
import { AttackStyle, Character, SpecialAction } from "../sim/codes";
import { HitElement } from "../sim/hitRegions";
import { isSmashAttack } from "../sim/moves";
import { VERIFIED_STOCK_SOUND_LABELS } from "../assets/stockSoundInfo";
import { elementLook } from "./elementLooks";
import { warcryVoice } from "./matchAudio";
import { SWING_SOUND, SoundTier, TIER_HIT_VOLUME, TIER_SWING_PITCH, TIER_SWING_VOLUME, moveTier } from "./moveTiers";

export const SPECIAL_MOVE = 100;
export const SPECIAL_SLOT_NAMES = ["Neutral special", "Side special", "Up special", "Down special"] as const;

export const Weapon = { blade: 0, axe: 1, hammer: 2, blunt: 3, claw: 4, rock: 5 } as const;
export type Weapon = (typeof Weapon)[keyof typeof Weapon];

const FLESH: readonly (readonly string[])[] = [
  ["MetalLightSliceFlesh", "MetalMediumSliceFlesh", "MetalHeavySliceFlesh"],
  ["MetalLightChopFlesh", "MetalMediumChopFlesh", "MetalHeavyChopFlesh"],
  ["WoodMediumBashFlesh", "MetalMediumBashFlesh", "MetalHeavyBashFlesh"],
  ["WoodLightBashFlesh", "WoodMediumBashFlesh", "WoodHeavyBashFlesh"],
  ["MetalLightSliceFlesh", "MetalLightChopFlesh", "MetalMediumChopFlesh"],
  ["WoodMediumBashFlesh", "RockHeavyBashFlesh", "RockHeavyBashFlesh"],
];
const METAL: readonly (readonly string[])[] = [
  ["MetalLightSliceMetal", "MetalMediumSliceMetal", "MetalHeavySliceMetal"],
  ["MetalLightChopMetal", "MetalMediumChopMetal", "MetalHeavyChopMetal"],
  ["WoodMediumBashMetal", "MetalMediumBashMetal", "MetalHeavyBashMetal"],
  ["WoodLightBashMetal", "WoodMediumBashMetal", "WoodHeavyBashMetal"],
  ["MetalLightSliceMetal", "MetalLightChopMetal", "MetalMediumChopMetal"],
  ["WoodMediumBashMetal", "RockHeavyBashMetal", "RockHeavyBashMetal"],
];

interface SpecialSound {
  readonly perform: string;
  readonly hit: string;
  readonly voice?: boolean | undefined;
}

interface FighterSound {
  readonly weapon: Weapon;
  readonly swing?: readonly string[] | undefined;
  readonly effort?: readonly string[] | undefined;
  readonly strong: string;
  readonly specials: readonly [SpecialSound, SpecialSound, SpecialSound, SpecialSound];
  readonly normals?: { readonly [style: number]: { readonly perform?: string; readonly hit?: string } | undefined } | undefined;
}

const s = (perform: string, hit: string, voice?: boolean): SpecialSound => ({ perform, hit, voice });

export const FIGHTER_SOUNDS: { readonly [character: number]: FighterSound | undefined } = {
  [Character.rifleman]: {
    weapon: Weapon.blunt, strong: "FlakCannonHit",
    specials: [s("RiflemanAttack1", "GyrocopterAttack"), s("DruidOfTheClawMorph", "StampedeHit"), s("RiflemanAttack1", "GyrocopterAttack", true), s("WardBirth", "FrostNova")],
    normals: { [AttackStyle.shot]: { perform: "RiflemanAttack1", hit: "GyrocopterAttack" } },
  },
  [Character.demonHunter]: {
    weapon: Weapon.blade, strong: "DemonHunterMissileHit",
    specials: [s("DemonHunterMissileLaunch", "ManaBurn"), s("DestroyerMissileLaunch", "MetalHeavySliceFlesh", true), s("GargoyleMissileLaunch", "MetalMediumSliceFlesh"), s("FireballLaunch", "Fireball")],
  },
  [Character.blademaster]: {
    weapon: Weapon.blade, swing: ["HeroBladeMasterAttack1", "HeroBladeMasterAttack2"], strong: "CriticalStrike",
    specials: [s("DemonHunterMissileLaunch", "MetalMediumSliceFlesh"), s("WindWalk", "CriticalStrike"), s("Whirlwind", "MetalMediumSliceFlesh", true), s("MirrorImage", "MetalMediumSliceFlesh")],
  },
  [Character.mountainKing]: {
    weapon: Weapon.hammer, swing: ["HeroMountainKingAttack1"], strong: "StormBolt",
    specials: [s("StormBoltLaunch", "StormBolt"), s("BattleRoar", "MetalHeavyBashFlesh"), s("HeroMountainKingAttack1", "ThunderClap", true), s("Taunt", "ThunderClap")],
  },
  [Character.warden]: {
    weapon: Weapon.blade, effort: ["WardenAttack"], strong: "FanOfKnivesHit",
    specials: [s("ShadowStrikeMissileBirth", "ShadowStrikeBirth"), s("BlinkCaster", "MetalHeavySliceFlesh", true), s("BlinkTarget", "MetalLightSliceFlesh"), s("FanOfKnives", "FanOfKnivesHit")],
  },
  [Character.lich]: {
    weapon: Weapon.blunt, effort: ["HeroLichAttack1"], strong: "LichMissile",
    specials: [s("ZigguratFrostMissileLaunch", "FrostNova"), s("DeathAndDecayTarget", "DeathCoil", true), s("BansheeMissileLaunch", "LichMissile"), s("FrostArmor", "FrostBoltHit")],
  },
  [Character.forsakenPaladin]: {
    weapon: Weapon.blunt, swing: ["HeroPaladinAttack1", "HeroPaladinAttack2"], strong: "HolyBolt",
    specials: [s("DispelMagic", "WoodHeavyBashFlesh"), s("DivineShield", "WoodHeavyBashFlesh", true), s("InnerFire", "WoodMediumBashFlesh"), s("Heal", "HolyBolt")],
  },
  [Character.dreadlord]: {
    weapon: Weapon.claw, strong: "BansheeMissileHit",
    specials: [s("CarrionSwarmLaunch", "CarrionSwarmDamage"), s("BansheeMissileLaunch", "DeathPactTarget", true), s("GargoyleMissileLaunch", "MetalLightChopFlesh"), s("Sleep", "CreepSleep")],
  },
  [Character.shadowHunter]: {
    weapon: Weapon.axe, strong: "HunterMissileHit",
    specials: [s("ShadowHunterMissileLaunch", "ShadowHunterMissileHit"), s("WardBirth", "PoisonArrowHit"), s("VoodooBirth", "MetalMediumChopFlesh", true), s("WitchDoctorMissileLaunch", "Polymorph")],
  },
  [Character.pitLord]: {
    weapon: Weapon.axe, swing: ["PitLordAttack1", "PitLordAttack2", "PitLordAttack3"], strong: "InfernalAttack2",
    specials: [s("HowlOfTerror", "CrushingWaveDamage", true), s("BalrogAttack1", "RockHeavyBashFlesh"), s("PitLordAttackSlam1", "InfernalBirth"), s("RainOfFireWave", "Fireball")],
    normals: { [AttackStyle.dashAttack]: { perform: "PitLordAttackSlam1", hit: "RockHeavyBashFlesh" } },
  },
  [Character.beastmaster]: {
    weapon: Weapon.axe, effort: ["BeastmasterAttack"], strong: "AxeMissileHit",
    specials: [s("AxeMissileLaunch", "AxeMissileHit"), s("DruidOfTheClawMorph", "StampedeHit", true), s("HarpyMissileLaunch", "HarpyMissileHit"), s("BristleBackMissileLaunch", "BristleBackMissileHit")],
  },
  [Character.lichKing]: {
    weapon: Weapon.blade, swing: ["HeroDeathKnightAttack1"], strong: "FrostWyrmAttack1",
    specials: [s("BreathOfFrost", "FrostNova"), s("PossessionMissileLaunch", "PossessionMissileHit", true), s("FrostArmor", "FrostBoltHit"), s("DeathAndDecayTarget", "DeathCoil")],
  },
  [Character.thrall]: {
    weapon: Weapon.hammer, strong: "StormBolt",
    specials: [s("HeroFarSeerAttack1", "LightningBolt"), s("FeralSpiritTarget", "MetalMediumChopFlesh"), s("RevealMap", "MetalMediumBashFlesh"), s("Earthquake", "Warstomp", true)],
  },
  [Character.jaina]: {
    weapon: Weapon.blunt, strong: "FrostBoltHit",
    specials: [s("FrostBoltLaunch", "FrostBoltHit"), s("FrostArrowLaunch", "FrostNova", true), s("BlinkCaster", "BlinkTarget"), s("WaterElementalBirth", "WaterElementalMissile")],
  },
  [Character.sylvanas]: {
    weapon: Weapon.blunt, strong: "BlackArrowHit",
    specials: [s("ArrowLaunch", "BlackArrowHit", true), s("Silence", "Curse"), s("BansheeMissileLaunch", "BansheeMissileHit"), s("DarkRitual", "DeathCoil")],
  },
  [Character.cairne]: {
    weapon: Weapon.rock, swing: ["HeroTaurenChieftainAttack1", "HeroTaurenChieftainAttack2"], strong: "Pulverize",
    specials: [s("ShockWave", "RockHeavyBashFlesh"), s("HeroTaurenChieftainAttack2", "Warstomp", true), s("AncestralSpirit", "WoodMediumBashFlesh"), s("Reincarnation", "Pulverize")],
  },
  [Character.chen]: {
    weapon: Weapon.blunt, effort: ["BrewmasterAttack1", "BrewmasterAttack2"], strong: "Pulverize",
    specials: [s("BreathOfFire", "Fireball", true), s("StrongDrinkMissile", "StrongDrink"), s("CycloneBirth", "WoodMediumBashFlesh"), s("Taunt", "Fireball")],
  },
  [Character.peon]: {
    weapon: Weapon.axe, strong: "AxeMediumChopWood",
    specials: [s("AxeMissileLaunch", "AxeMediumChopWood"), s("WardBirth", "WyvernSpearMissile"), s("CatapultAttack1", "WoodMediumBashFlesh", true), s("Repair", "AxeMediumChopWood")],
  },
  [Character.tinker]: {
    weapon: Weapon.hammer, effort: ["GoblinAlchemistAttack"], strong: "GyrocopterAttack",
    specials: [s("ClusterRocketsLaunch", "ClusterRocketsImpact"), s("PocketFactoryBirth", "GoblinSapperExplode"), s("MortarTeamAttack2", "MetalMediumBashFlesh"), s("HeroTinkerMorph", "SteamTankAttack", true)],
  },
  [Character.kaelthas]: {
    weapon: Weapon.blunt, strong: "HeroFlameLordMissileImpact",
    specials: [s("FireballLaunch", "FlameStrike"), s("SiphonManaCaster", "ManaBurn"), s("PhoenixMissileLaunch", "Fireball", true), s("BanishCaster", "Feedback")],
  },
  [Character.murloc]: {
    weapon: Weapon.claw, strong: "CrushingWaveDamage",
    specials: [s("EnsnareMissile", "Ensnare"), s("BigWaterStep", "CrushingWaveDamage", true), s("CrushingWave", "WaterElementalMissile"), s("Parasite", "PoisonArrowHit")],
  },
  [Character.grom]: {
    weapon: Weapon.axe, strong: "CriticalStrike",
    specials: [s("BattleRoar", "MetalMediumChopFlesh", true), s("Whirlwind", "MetalHeavyChopFlesh"), s("Bloodlust", "MetalMediumChopFlesh"), s("UnholyFrenzy", "MetalHeavyChopFlesh")],
  },
  [Character.anubarak]: {
    weapon: Weapon.claw, effort: ["CryptLordAttack1", "CryptLordAttack2"], strong: "ImpaleHit",
    specials: [s("Impale", "ImpaleHit", true), s("Burrow", "ImpaleLand"), s("ImpaleLand", "RockHeavyBashFlesh"), s("ScarabBirth", "CryptFiendMissileHit")],
  },
  [Character.malfurion]: {
    weapon: Weapon.blunt, strong: "KeeperOfTheGroveMissileHit",
    specials: [s("KeeperOfTheGroveMissileLaunch", "EntanglingRoots"), s("BattleRoar", "StampedeHit"), s("DruidOfTheTalonMorph", "DruidOfTheTalonMissileHit"), s("ForceOfNatureBirth", "WoodHeavyBashFlesh", true)],
  },
  [Character.medivh]: {
    weapon: Weapon.blunt, strong: "ManaFlareMissile",
    specials: [s("SorceressMissileLaunch", "SorceressMissileHit"), s("BlinkCaster", "Feedback"), s("DruidOfTheTalonMorph", "DruidOfTheTalonMissileHit"), s("SpellStealMissileLaunch", "SpellStealTarget", true)],
  },
  [Character.kobold]: {
    weapon: Weapon.axe, strong: "GoblinLandMineDeath",
    specials: [s("SearingArrowLaunch", "SearingArrowHit", true), s("Burrow", "MetalLightChopFlesh"), s("VolcanoMissileLaunch", "WoodLightBashFlesh"), s("WardBirth", "GoblinLandMineDeath")],
  },
};

export interface SoundLayer {
  readonly sounds: readonly string[];
  readonly volume: number;
  readonly pitch: number;
}

export interface MoveSound {
  readonly perform: readonly SoundLayer[];
  readonly hit: readonly SoundLayer[];
  readonly strong: readonly SoundLayer[];
  readonly shield: readonly SoundLayer[];
  readonly voice: SoundLayer | undefined;
}

const VOICE_TAKES = 3;
const VOICE_VOLUME = 100;
const PERFORM_VOLUME = 110;
const MODEL_SWING_VOLUME: readonly number[] = [0, 80, 100];
const SWEETENER_VOLUME = 100;
const SHIELD_VOLUME = 100;
const PITCH_STEPS: readonly number[] = [0.96875, 0.984375, 1.0, 1.015625, 1.03125];

const layer = (sounds: readonly string[], volume: number, pitch = 1.0): SoundLayer => ({ sounds, volume, pitch });

export const specialMove = (slot: number): number => SPECIAL_MOVE + slot;
export const isSpecialMove = (move: number): boolean => move >= SPECIAL_MOVE;
const isNormalMove = (move: number): move is AttackStyle => move < SPECIAL_MOVE;

export function specialSlot(action: SpecialAction): number {
  switch (action) {
    case SpecialAction.heroNeutral: case SpecialAction.riflemanBlaster: case SpecialAction.demonHunterManaBurn: return 0;
    case SpecialAction.heroSide: case SpecialAction.riflemanBear: case SpecialAction.demonHunterFelRush: return 1;
    case SpecialAction.heroUp: case SpecialAction.riflemanRecovery: case SpecialAction.demonHunterWingAscent: return 2;
    case SpecialAction.heroDown: case SpecialAction.riflemanTrap: case SpecialAction.demonHunterImmolate: return 3;
    default: return -1;
  }
}

function resolve(character: Character, move: number): MoveSound | undefined {
  const fighter = FIGHTER_SOUNDS[character];
  if (fighter === undefined) return undefined;
  const { weapon } = fighter;
  if (!isNormalMove(move)) {
    const special = fighter.specials[move - SPECIAL_MOVE];
    if (special === undefined) return undefined;
    return {
      perform: [layer([special.perform], PERFORM_VOLUME)],
      hit: [layer([special.hit], at(TIER_HIT_VOLUME, SoundTier.medium))],
      strong: [layer([special.hit], at(TIER_HIT_VOLUME, SoundTier.large)), layer([fighter.strong], SWEETENER_VOLUME)],
      shield: [layer([at(at(METAL, weapon), SoundTier.medium)], SHIELD_VOLUME)],
      voice: special.voice === true ? layer([warcryVoice(character)], VOICE_VOLUME) : undefined,
    };
  }
  const style = move;
  const tier = moveTier(character, style);
  const own = fighter.normals?.[style];
  const perform = style === AttackStyle.shot ? [] : [layer([SWING_SOUND], at(TIER_SWING_VOLUME, tier), at(TIER_SWING_PITCH, tier))];
  if (own?.perform !== undefined) perform.push(layer([own.perform], PERFORM_VOLUME));
  else if (fighter.swing !== undefined && tier !== SoundTier.small) perform.push(layer(fighter.swing, at(MODEL_SWING_VOLUME, tier)));
  const body = own?.hit ?? at(at(FLESH, weapon), tier);
  return {
    perform,
    hit: [layer([body], at(TIER_HIT_VOLUME, tier))],
    strong: [layer([own?.hit ?? at(at(FLESH, weapon), SoundTier.large)], at(TIER_HIT_VOLUME, SoundTier.large)), layer([fighter.strong], SWEETENER_VOLUME)],
    shield: [layer([at(at(METAL, weapon), tier)], SHIELD_VOLUME)],
    voice: fighter.effort !== undefined && isSmashAttack(style) ? layer(fighter.effort, VOICE_VOLUME) : undefined,
  };
}

const resolved: { [key: number]: MoveSound | false | undefined } = {};

export function moveSound(character: Character, move: number): MoveSound | undefined {
  const key = character * 1000 + move;
  let row = resolved[key];
  if (row === undefined) {
    row = resolve(character, move) ?? false;
    resolved[key] = row;
  }
  return row === false ? undefined : row;
}

export function soundFiles(sound: string): readonly string[] {
  return sound.includes("\\") ? [sound] : VERIFIED_STOCK_SOUND_LABELS[sound] ?? [];
}

export type MoveSoundSink = (file: string, volume: number, pitch: number) => void;

function playLayer(sound: SoundLayer, serial: number, salt: number, sink: MoveSoundSink): void {
  const label = at(sound.sounds, imod(serial, sound.sounds.length));
  const files = soundFiles(label);
  if (files.length === 0) return;
  const file = at(files, imod(serial + salt, files.length));
  sink(file, sound.volume, sound.pitch * at(PITCH_STEPS, imod(serial * 3 + salt, PITCH_STEPS.length)));
}

function playLayers(layers: readonly SoundLayer[], serial: number, sink: MoveSoundSink): void {
  for (let index = 0; index < layers.length; index++) playLayer(at(layers, index), serial, index, sink);
}

export function playPerform(character: Character, move: number, serial: number, sink: MoveSoundSink): void {
  const row = moveSound(character, move);
  if (row === undefined) return;
  playLayers(row.perform, serial, sink);
  if (row.voice !== undefined && imod(serial, VOICE_TAKES) !== 0) playLayer(row.voice, serial, 0, sink);
}

export function playHit(character: Character, move: number, strong: boolean, element: HitElement, serial: number, sink: MoveSoundSink): void {
  const row = moveSound(character, move);
  if (row === undefined) return;
  playLayers(strong ? row.strong : row.hit, serial, sink);
  const sweetener = elementLook(element).sound;
  if (sweetener !== undefined && !isSpecialMove(move)) playLayer(layer([sweetener], SWEETENER_VOLUME), serial, 0, sink);
}

export function playShieldHit(character: Character, move: number, serial: number, sink: MoveSoundSink): void {
  const row = moveSound(character, move);
  if (row !== undefined) playLayers(row.shield, serial, sink);
}

export function moveSoundLabels(characters: readonly Character[]): string[] {
  const labels: string[] = [];
  const add = (sound: string) => { if (!labels.includes(sound)) labels.push(sound); };
  for (const character of characters) {
    for (let style = 0; style <= AttackStyle.jab3; style++) {
      const row = moveSound(character, style);
      if (row === undefined) continue;
      for (const each of [...row.perform, ...row.hit, ...row.strong, ...row.shield, ...(row.voice === undefined ? [] : [row.voice])]) each.sounds.forEach(add);
    }
    for (let slot = 0; slot < 4; slot++) {
      const row = moveSound(character, specialMove(slot));
      if (row === undefined) continue;
      for (const each of [...row.perform, ...row.hit, ...row.strong, ...row.shield, ...(row.voice === undefined ? [] : [row.voice])]) each.sounds.forEach(add);
    }
  }
  return labels;
}

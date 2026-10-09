








import { at } from "wisp/src/runtime/lookup";
import { imod } from "wisp/src/sim/intMath";
import { AttackStyle, Character } from "../sim/codes";
import { HitElement } from "../sim/hitRegions";
import { isJab, isSmashAttack } from "../sim/moves";

export const SoundTier = { small: 0, medium: 1, large: 2 } as const;
export type SoundTier = (typeof SoundTier)[keyof typeof SoundTier];


interface TierDeparture {
  readonly character: Character;
  readonly style: AttackStyle;
  readonly tier: SoundTier;
  readonly why: string;
}

export const TIER_DEPARTURES: readonly TierDeparture[] = [
  ...[AttackStyle.forwardTilt, AttackStyle.forwardTiltUp, AttackStyle.forwardTiltDown, AttackStyle.upTilt, AttackStyle.downTilt,
    AttackStyle.dashAttack, AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.upAir, AttackStyle.downAir].map((style) => ({
    character: Character.forsakenPaladin, style, tier: SoundTier.large, why: "Forsaken Paladin's committed hammer blows use the heavy bash (#216)",
  })),
  { character: Character.warden, style: AttackStyle.downTilt, tier: SoundTier.small, why: "her chain poke repeats like a jab (Ness's foot jab)" },
  { character: Character.pitLord, style: AttackStyle.dashAttack, tier: SoundTier.large, why: "Demonic Bulk, the roster's strongest dash attack, hits like a smash" },
];


export function classTier(style: AttackStyle): SoundTier {
  if (isJab(style) || style === AttackStyle.shot) return SoundTier.small;
  return isSmashAttack(style) ? SoundTier.large : SoundTier.medium;
}

export function moveTier(character: Character, style: AttackStyle): SoundTier {
  for (const departure of TIER_DEPARTURES) if (departure.character === character && departure.style === style) return departure.tier;
  return classTier(style);
}

const COMBAT = "Sound\\Units\\Combat\\";

const SLICE: readonly (readonly string[])[] = ["Light", "Medium", "Heavy"].map((weight) => [1, 2, 3].map((n) => `${COMBAT}Metal${weight}SliceFlesh${n}.flac`));
const BASH: readonly (readonly string[])[] = ["Light", "Medium", "Heavy"].map((weight) => [1, 2, 3].map((n) => `${COMBAT}Wood${weight}BashFlesh${n}.flac`));

export const SWING_SOUND = "Sound\\Interface\\BattleNetWooshStereo1.flac";


export function tierSoundPaths(): string[] {
  return [...SLICE.flat(), ...BASH.flat(), SWING_SOUND];
}


export function tierHitPath(element: HitElement, tier: number, variant: number): string | undefined {
  if (element !== HitElement.normal && element !== HitElement.slash && !(element === HitElement.holy && tier === SoundTier.large)) return undefined;
  const files = at(element === HitElement.slash ? SLICE : BASH, tier);
  return at(files, imod(variant, files.length));
}






export const TIER_HIT_VOLUME: readonly number[] = [110, 118, 127];

export const TIER_SWING_VOLUME: readonly number[] = [45, 65, 90];
export const TIER_SWING_PITCH: readonly number[] = [1.5, 1.25, 1.0];

export const TIER_SPARK_SCALE: readonly number[] = [0.75, 1.0, 1.25];

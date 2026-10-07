// Small, medium and large: how big a move sounds and sparks (#163,
// smashcraft:docs/design/tilts.md, "Sound tiers"). Melee gives every hitbox
// one of three hit-sound severities (melee:src/melee/lb/lbcollision.c plays
// lbColl_803B9880[sfx_kind * 3 + sfx_severity]); Ultimate's scripts give each
// attack ATTACK_SOUND_LEVEL_S, _M or _L and size its swing sounds the same
// way. Smashcraft sets the tier by move class (jab small, tilt medium, smash
// large) so a jab never sounds like a tilt. Warcraft's own weapon sounds come
// in light, medium and heavy, and every path here is checked against the game
// by tools/presentation/stock-sounds.ts. Presentation only: no outcome reads it.
import { at } from "wisp/src/runtime/lookup";
import { imod } from "wisp/src/sim/intMath";
import { AttackStyle, Character } from "../sim/codes";
import { HitElement } from "../sim/hitRegions";
import { isJab, isSmashAttack } from "../sim/moves";

export const SoundTier = { small: 0, medium: 1, large: 2 } as const;
export type SoundTier = (typeof SoundTier)[keyof typeof SoundTier];

/** A move whose tier differs from its class, and why. */
interface TierDeparture {
  readonly character: Character;
  readonly style: AttackStyle;
  readonly tier: SoundTier;
  readonly why: string;
}

export const TIER_DEPARTURES: readonly TierDeparture[] = [
  { character: Character.warden, style: AttackStyle.downTilt, tier: SoundTier.small, why: "her chain poke repeats like a jab (Ness's foot jab)" },
  { character: Character.pitLord, style: AttackStyle.dashAttack, tier: SoundTier.large, why: "Demonic Bulk, the roster's strongest dash attack, hits like a smash" },
];

/** A move's class tier: jabs and shots small, smashes large, everything else medium. */
export function classTier(style: AttackStyle): SoundTier {
  if (isJab(style) || style === AttackStyle.shot) return SoundTier.small;
  return isSmashAttack(style) ? SoundTier.large : SoundTier.medium;
}

export function moveTier(character: Character, style: AttackStyle): SoundTier {
  for (const departure of TIER_DEPARTURES) if (departure.character === character && departure.style === style) return departure.tier;
  return classTier(style);
}

const COMBAT = "Sound\\Units\\Combat\\";
/** By tier, each with the game's own variants: a cut lands as a slice, anything else as a bash. */
const SLICE: readonly (readonly string[])[] = ["Light", "Medium", "Heavy"].map((weight) => [1, 2, 3].map((n) => `${COMBAT}Metal${weight}SliceFlesh${n}.flac`));
const BASH: readonly (readonly string[])[] = ["Light", "Medium", "Heavy"].map((weight) => [1, 2, 3].map((n) => `${COMBAT}Wood${weight}BashFlesh${n}.flac`));
/** The whoosh of a swing, pitched up for a small one and down for a large one. */
export const SWING_SOUND = "Sound\\Interface\\BattleNetWooshStereo1.flac";

/** Every sound file a tier plays, for the stock-asset check and preloading. */
export function tierSoundPaths(): string[] {
  return [...SLICE.flat(), ...BASH.flat(), SWING_SOUND];
}

/** A tiered hit's own sound file, varied by its hit serial; elemental hits keep their element's label. */
export function tierHitPath(element: HitElement, tier: number, variant: number): string | undefined {
  if (element !== HitElement.normal && element !== HitElement.slash) return undefined;
  const files = at(element === HitElement.slash ? SLICE : BASH, tier);
  return at(files, imod(variant, files.length));
}

/**
 * A hit's volume (0-127) by tier. Native capture (#82) picked element sounds
 * out only from 110 at their own pitch, so the tier never lowers or repitches a
 * hit: the weapon sound's weight carries it.
 */
export const TIER_HIT_VOLUME: readonly number[] = [110, 118, 127];
/** A swing's volume and pitch by tier. */
export const TIER_SWING_VOLUME: readonly number[] = [45, 65, 90];
export const TIER_SWING_PITCH: readonly number[] = [1.5, 1.25, 1.0];
/** The hit spark's scale. */
export const TIER_SPARK_SCALE: readonly number[] = [0.75, 1.0, 1.25];

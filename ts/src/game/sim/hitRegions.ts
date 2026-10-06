// Authored hit regions: provisional facing-relative reach envelopes for each
// action, with the hit each one deals. Lower region indices win overlaps.
// Window zero means no authored contact; increasing positive windows
// explicitly permit a later hit of the same target.
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character } from "./codes";
import type { FighterMoves, StrikeCapsule } from "./heroMoves";
import { DIAGONAL_UNIT, ORDINARY_HIT_BASE_KNOCKBACK, ORDINARY_HIT_GROWTH_PERCENT } from "./knockback";
import {
  DOWN_ATTACK_BASE_KNOCKBACK,
  DOWN_ATTACK_DAMAGE,
  attackDamage,
  attackReach,
  attackStartupFrames,
  characterAttackActiveFrames,
  isSmashAttack,
  smashDamageMultiplier,
} from "./moves";

/** What a contact does: damage, launch growth and base, launch direction (facing-relative) and effect. */
export const HitElement = { normal: 0, fire: 1, electric: 2, slash: 3, ice: 5 } as const;
export type HitElement = (typeof HitElement)[keyof typeof HitElement];

export interface HitEffect {
  damage: number;
  growth: number;
  base: number;
  launchX: number;
  launchZ: number;
  electric: boolean;
  /** Presentation element; electric retains its existing hitlag rule. */
  element?: HitElement | undefined;
}

export interface HitRegion {
  strike?: StrikeCapsule | undefined;
  groundedEffect?: Readonly<HitEffect> | undefined;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  readonly effect: HitEffect;
  window: number;
}

export function emptyHitEffect(): HitEffect {
  return { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false };
}

export function emptyHitRegion(): HitRegion {
  return { minX: 0.0, maxX: 0.0, minZ: 0.0, maxZ: 0.0, effect: emptyHitEffect(), window: 0 };
}

export function copyHitEffect(target: HitEffect, source: Readonly<HitEffect>): void {
  target.damage = source.damage;
  target.growth = source.growth;
  target.base = source.base;
  target.launchX = source.launchX;
  target.launchZ = source.launchZ;
  target.electric = source.electric;
  target.element = source.element;
}

export function copyHitRegion(target: HitRegion, source: Readonly<HitRegion>): void {
  target.strike = source.strike;
  target.groundedEffect = source.groundedEffect;
  target.minX = source.minX;
  target.maxX = source.maxX;
  target.minZ = source.minZ;
  target.maxZ = source.maxZ;
  copyHitEffect(target.effect, source.effect);
  target.window = source.window;
}

export const NO_HIT_REGION: Readonly<HitRegion> = emptyHitRegion();

/** A table row: bounds, then damage, growth, base and launch direction of a single-window contact. */
function region(
  minX: number, maxX: number, minZ: number, maxZ: number,
  damage: number, growth: number, base: number, launchX: number, launchZ: number, window = 1,
): Readonly<HitRegion> {
  return { minX, maxX, minZ, maxZ, effect: { damage, growth, base, launchX, launchZ, electric: false }, window };
}

// Character 2 has an explicit region for each shared ground and aerial action.
// Numeric windows are single-contact and provisional; animation assets must
// bind their matching action IDs before roster exposure. Smash damage is
// before charge.
const DEMON_HUNTER_REGIONS: { readonly [style: number]: Readonly<HitRegion> } = {
  [AttackStyle.jab]: region(0.0, 92.0, -55.0, 105.0, 5.0, 100.0, 18.0, DIAGONAL_UNIT, DIAGONAL_UNIT),
  [AttackStyle.upSmash]: region(-105.0, 105.0, -30.0, 195.0, 15.0, 100.0, 28.0, DIAGONAL_UNIT, DIAGONAL_UNIT),
  [AttackStyle.downSmash]: region(-105.0, 105.0, -195.0, 45.0, 15.0, 100.0, 28.0, DIAGONAL_UNIT, DIAGONAL_UNIT),
  [AttackStyle.forwardSmash]: region(25.0, 195.0, -75.0, 105.0, 15.0, 100.0, 28.0, DIAGONAL_UNIT, DIAGONAL_UNIT),
  [AttackStyle.demonHunterDashAttack]: region(0.0, 150.0, -70.0, 115.0, 9.0, 95.0, 20.0, 0.9200000166893005, 0.38999998569488525),
  [AttackStyle.forwardTilt]: region(0.0, 135.0, -80.0, 95.0, 8.0, 95.0, 18.0, 0.9399999976158142, 0.3400000035762787),
  [AttackStyle.upTilt]: region(0.0, 125.0, -30.0, 185.0, 8.0, 105.0, 18.0, 0.25, 0.968245804309845),
  [AttackStyle.downTilt]: region(-115.0, 115.0, -145.0, 40.0, 7.0, 90.0, 16.0, DIAGONAL_UNIT, 0.30000001192092896),
  [AttackStyle.forwardTiltUp]: region(0.0, 135.0, -30.0, 145.0, 8.0, 100.0, 18.0, 0.8799999952316284, 0.47999998927116394),
  [AttackStyle.forwardTiltDown]: region(0.0, 135.0, -145.0, 5.0, 8.0, 100.0, 18.0, 0.8799999952316284, -0.47999998927116394),
  [AttackStyle.neutralAir]: region(-115.0, 115.0, -45.0, 100.0, 7.0, 95.0, 16.0, DIAGONAL_UNIT, DIAGONAL_UNIT),
  [AttackStyle.forwardAir]: region(0.0, 175.0, -55.0, 115.0, 8.0, 100.0, 18.0, 0.9399999976158142, 0.3400000035762787),
  [AttackStyle.backAir]: region(-175.0, 0.0, -55.0, 115.0, 8.0, 100.0, 18.0, -0.9399999976158142, 0.3400000035762787),
  [AttackStyle.upAir]: region(-115.0, 115.0, 10.0, 205.0, 8.0, 105.0, 19.0, 0.2199999988079071, 0.9750000238418579),
  [AttackStyle.downAir]: region(-105.0, 105.0, -190.0, -10.0, 9.0, 100.0, 20.0, 0.1599999964237213, -0.9869999885559082),
};

const ordinary = (minX: number, maxX: number, minZ: number, maxZ: number, damage: number, launchX = DIAGONAL_UNIT) =>
  region(minX, maxX, minZ, maxZ, damage, ORDINARY_HIT_GROWTH_PERCENT, ORDINARY_HIT_BASE_KNOCKBACK, launchX, DIAGONAL_UNIT);

/** Reach envelope of the actions without a region of their own; smash damage is before charge. */
function reachRegion(style: AttackStyle): Readonly<HitRegion> {
  const verticalOffset = style === AttackStyle.forwardTiltUp ? 65.0 : style === AttackStyle.forwardTiltDown ? -65.0 : 0.0;
  return ordinary(0.0, attackReach(style), f32(verticalOffset - 130), f32(verticalOffset + 130), attackDamage(style));
}

const REACH_REGIONS: { readonly [style: number]: Readonly<HitRegion> } = {
  [AttackStyle.jab]: reachRegion(AttackStyle.jab),
  [AttackStyle.upSmash]: reachRegion(AttackStyle.upSmash),
  [AttackStyle.downSmash]: reachRegion(AttackStyle.downSmash),
  [AttackStyle.forwardSmash]: reachRegion(AttackStyle.forwardSmash),
  [AttackStyle.grab]: reachRegion(AttackStyle.grab),
  [AttackStyle.upTilt]: reachRegion(AttackStyle.upTilt),
  [AttackStyle.downTilt]: reachRegion(AttackStyle.downTilt),
  [AttackStyle.forwardTiltUp]: reachRegion(AttackStyle.forwardTiltUp),
  [AttackStyle.forwardTiltDown]: reachRegion(AttackStyle.forwardTiltDown),
  [AttackStyle.demonHunterDashAttack]: reachRegion(AttackStyle.demonHunterDashAttack),
};

const FORWARD_TILT_TIP_EARLY = region(90.0, 145.0, -130.0, 130.0, 10.0, 110.0, 24.0, 0.800000011920929, 0.6000000238418579);
const FORWARD_TILT_TIP_LATE = region(90.0, 145.0, -130.0, 130.0, 8.0, 90.0, 18.0, 0.800000011920929, 0.6000000238418579);
const FORWARD_TILT_INNER_EARLY = region(0.0, 110.0, -130.0, 130.0, 7.0, 80.0, 16.0, DIAGONAL_UNIT, DIAGONAL_UNIT);
const FORWARD_TILT_INNER_LATE = region(0.0, 110.0, -130.0, 130.0, 5.0, 70.0, 12.0, DIAGONAL_UNIT, DIAGONAL_UNIT);
const LEDGE_ATTACK = ordinary(0.0, 140.0, -90.0, 90.0, attackDamage(AttackStyle.ledgeAttack));
const GETUP_ATTACK = region(
  -attackReach(AttackStyle.getupAttack), attackReach(AttackStyle.getupAttack), -130.0, 130.0,
  DOWN_ATTACK_DAMAGE, ORDINARY_HIT_GROWTH_PERCENT, DOWN_ATTACK_BASE_KNOCKBACK, DIAGONAL_UNIT, DIAGONAL_UNIT,
);
const NEUTRAL_AIR = ordinary(-90.0, 90.0, -65.0, 90.0, attackDamage(AttackStyle.neutralAir));
const NEUTRAL_AIR_LINGERING = ordinary(-90.0, 90.0, -65.0, 90.0, 5.0);
const FORWARD_AIR = ordinary(0.0, 165.0, -65.0, 100.0, attackDamage(AttackStyle.forwardAir));
const BACK_AIR = ordinary(-155.0, 0.0, -65.0, 100.0, attackDamage(AttackStyle.backAir), -DIAGONAL_UNIT);
const BACK_AIR_LINGERING = ordinary(-155.0, 0.0, -65.0, 100.0, 5.0, -DIAGONAL_UNIT);
const UP_AIR = region(-105.0, 105.0, 20.0, 190.0, 4.0, 60.0, 14.0, 0.25, 0.968245804309845);
const UP_AIR_FINISHER = region(-105.0, 105.0, 20.0, 190.0, 8.0, 110.0, 24.0, 0.25, 0.968245804309845, 2);
const downAir = (minX: number, maxX: number, damage: number) =>
  region(minX, maxX, -180.0, -10.0, damage, ORDINARY_HIT_GROWTH_PERCENT, ORDINARY_HIT_BASE_KNOCKBACK, 0.25, -0.968245804309845);
const ARCHER_DOWN_AIR_DIVE = downAir(-55.0, 55.0, attackDamage(AttackStyle.downAir));
const ARCHER_DOWN_AIR_LATE = downAir(-55.0, 55.0, 6.0);
const DOWN_AIR = downAir(-95.0, 95.0, attackDamage(AttackStyle.downAir));
// Melee's Falco down tilt hits 1.3 times Fox's on the same frames (13% and
// 10%, smashcraft:references/melee-frame-data/); Rifleman's keeps that ratio
// over the shared down tilt's 8.
const RIFLEMAN_DOWN_TILT = ordinary(0.0, attackReach(AttackStyle.downTilt), -130.0, 130.0, 10.0);

export function authoredHitRegionCount(style: AttackStyle | undefined, moves?: FighterMoves): number {
  const authored = style === undefined ? undefined : moves?.normals[style];
  if (authored !== undefined) return authored.regions.length;
  return style === AttackStyle.forwardTilt ? 2 : 1;
}

function activeRegion(character: Character, style: AttackStyle, frame: number, index: number): Readonly<HitRegion> {
  const startup = attackStartupFrames(style);
  // Grab and recovery attacks use the shared contact rules below.
  if (character === Character.demonHunter && style !== AttackStyle.grab && style !== AttackStyle.getupAttack && style !== AttackStyle.ledgeAttack) {
    return DEMON_HUNTER_REGIONS[style] ?? NO_HIT_REGION;
  }
  switch (style) {
    case AttackStyle.forwardTilt: {
      const early = frame === startup;
      if (index === 0) return early ? FORWARD_TILT_TIP_EARLY : FORWARD_TILT_TIP_LATE;
      return early ? FORWARD_TILT_INNER_EARLY : FORWARD_TILT_INNER_LATE;
    }
    case AttackStyle.ledgeAttack:
      return LEDGE_ATTACK;
    case AttackStyle.getupAttack:
      return GETUP_ATTACK;
    case AttackStyle.neutralAir:
      return frame >= 7 ? NEUTRAL_AIR_LINGERING : NEUTRAL_AIR;
    case AttackStyle.forwardAir:
      return FORWARD_AIR;
    case AttackStyle.backAir:
      return frame >= 7 ? BACK_AIR_LINGERING : BACK_AIR;
    case AttackStyle.upAir:
      return frame === startup + 2 ? UP_AIR_FINISHER : UP_AIR;
    case AttackStyle.downAir:
      if (character === Character.archer) return frame < startup + 3 ? ARCHER_DOWN_AIR_DIVE : ARCHER_DOWN_AIR_LATE;
      return DOWN_AIR;
    case AttackStyle.downTilt:
      return character === Character.rifleman ? RIFLEMAN_DOWN_TILT : REACH_REGIONS[style] ?? NO_HIT_REGION;
    default:
      return REACH_REGIONS[style] ?? NO_HIT_REGION;
  }
}

/**
 * Writes the region an action presents on an attack frame into out and returns
 * it; NO_HIT_REGION's values outside the active frames. Smash damage scales
 * with charge.
 */
export function authoredHitRegion(out: HitRegion, character: Character, style: AttackStyle | undefined, frame: number, chargeFrames: number, index: number, moves?: FighterMoves): HitRegion {
  const authored = style === undefined ? undefined : moves?.normals[style];
  if (authored !== undefined) {
    const region = authored.regions[index];
    copyHitRegion(out, region !== undefined && frame >= region.firstFrame && frame <= region.lastFrame ? region.hit : NO_HIT_REGION);
    if (isSmashAttack(style)) out.effect.damage = f32(out.effect.damage * smashDamageMultiplier(chargeFrames, moves));
    return out;
  }
  if (style === undefined || style === AttackStyle.shot) {
    copyHitRegion(out, NO_HIT_REGION);
    return out;
  }
  const startup = attackStartupFrames(style);
  if (frame < startup || frame >= startup + characterAttackActiveFrames(character, style)) {
    copyHitRegion(out, NO_HIT_REGION);
    return out;
  }
  copyHitRegion(out, activeRegion(character, style, frame, index));
  if (character === Character.demonHunter && style !== AttackStyle.grab) out.effect.element = HitElement.slash;
  if (isSmashAttack(style)) out.effect.damage = f32(out.effect.damage * smashDamageMultiplier(chargeFrames));
  return out;
}

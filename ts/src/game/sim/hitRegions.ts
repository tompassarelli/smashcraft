import { downSmashHit } from "./downMoveValues";
// Authored hit regions: provisional facing-relative reach envelopes for each
// action, with the hit each one deals. Lower region indices win overlaps.
// Window zero means no authored contact; increasing positive windows
// explicitly permit a later hit of the same target.
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, HitElement } from "./codes";
import type { FighterMoves, StrikeCapsule } from "./heroMoves";
import { DIAGONAL_UNIT, ORDINARY_HIT_BASE_KNOCKBACK, ORDINARY_HIT_GROWTH_PERCENT } from "./knockback";
import {
  DEMON_HUNTER_FORWARD_SMASH_ACTIVE,
  DOWN_ATTACK_BASE_KNOCKBACK,
  DOWN_ATTACK_DAMAGE,
  EYE_BLAST_CHARGE_FRAMES,
  attackDamage,
  attackReach,
  attackStartupFrames,
  characterAttackActiveFrames,
  isSmashAttack,
  smashDamageMultiplier,
} from "./moves";

export { HitElement };

/** What a contact does: damage, launch growth and base, launch direction (facing-relative) and effect. */

export interface HitEffect {
  damage: number;
  growth: number;
  base: number;
  launchX: number;
  launchZ: number;
  electric: boolean;
  /** Presentation element; electric retains its existing hitlag rule. */
  element?: HitElement | undefined;
  /**
   * Mana the hit drains from the body it reaches (Illidan's kit,
   * smashcraft:docs/design/illidan.md); a shield stops it, and mana floors at 0.
   */
  manaDrain?: number | undefined;
  /** Mana transferred from a body to the attacker, capped by what the target holds. */
  manaSteal?: number | undefined;
  /** A link hit (#152): an airborne target struck directly also takes the attacker's own velocity, so it travels with the attacker to the next hit. */
  carry?: boolean | undefined;
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
  target.manaDrain = source.manaDrain;
  target.manaSteal = source.manaSteal;
  target.carry = source.carry;
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
  [AttackStyle.jab2]: region(0.0, 96.0, -50.0, 100.0, 4.0, 30.0, 22.0, 0.3420201539993286, 0.9396926164627075),
  [AttackStyle.jab3]: region(0.0, 110.0, -50.0, 110.0, 6.0, 95.0, 22.0, 0.7660444378852844, 0.6427876353263855),
  [AttackStyle.upSmash]: region(-105.0, 105.0, -30.0, 195.0, 15.0, 100.0, 20.0, DIAGONAL_UNIT, DIAGONAL_UNIT),
  [AttackStyle.downSmash]: region(-105.0, 105.0, -195.0, 45.0, 15.0, 100.0, 20.0, DIAGONAL_UNIT, DIAGONAL_UNIT),
  [AttackStyle.forwardSmash]: region(25.0, 195.0, -75.0, 105.0, 9.0, 85.0, 20.0, DIAGONAL_UNIT, DIAGONAL_UNIT),
  [AttackStyle.demonHunterDashAttack]: region(0.0, 150.0, -70.0, 115.0, 9.0, 95.0, 20.0, 0.9200000166893005, 0.38999998569488525),
  // Shear (#147): the tank-buster as the mana cutter, 9% at a low 25 degrees.
  [AttackStyle.forwardTilt]: region(0.0, 135.0, -80.0, 95.0, 9.0, 80.0, 20.0, 0.9063078165054321, 0.4226182699203491),
  [AttackStyle.upTilt]: region(0.0, 125.0, -30.0, 185.0, 8.0, 105.0, 18.0, 0.25, 0.968245804309845),
  [AttackStyle.downTilt]: region(-115.0, 115.0, -145.0, 40.0, 7.0, 90.0, 16.0, DIAGONAL_UNIT, 0.30000001192092896),
  [AttackStyle.forwardTiltUp]: region(0.0, 135.0, -30.0, 145.0, 9.0, 80.0, 20.0, 0.8799999952316284, 0.47999998927116394),
  [AttackStyle.forwardTiltDown]: region(0.0, 135.0, -145.0, 5.0, 9.0, 80.0, 20.0, 0.8799999952316284, -0.47999998927116394),
  [AttackStyle.neutralAir]: region(-115.0, 115.0, -45.0, 100.0, 7.0, 95.0, 16.0, DIAGONAL_UNIT, DIAGONAL_UNIT),
  [AttackStyle.forwardAir]: region(0.0, 175.0, -55.0, 115.0, 6.0, 85.0, 18.0, 0.9399999976158142, 0.3400000035762787),
  [AttackStyle.backAir]: region(-175.0, 0.0, -55.0, 115.0, 6.0, 85.0, 18.0, -0.9399999976158142, 0.3400000035762787),
  [AttackStyle.upAir]: region(-115.0, 115.0, 10.0, 205.0, 8.0, 105.0, 19.0, 0.2199999988079071, 0.9750000238418579),
  [AttackStyle.downAir]: region(-105.0, 105.0, -190.0, -10.0, 9.0, 100.0, 20.0, 0.1599999964237213, -0.9869999885559082),
};

// Illidan's raid-boss normals (#147, smashcraft:docs/design/illidan.md), by
// active frame (0 is the first): the twin-glaive forward air's link and
// launcher, Flames of Azzinoth's glaives then fire, and Eye Blast's beam.
const FORWARD_AIR_LINK = region(0.0, 175.0, -55.0, 115.0, 2.0, 10.0, 30.0, -0.258819043636322, 0.9659258127212524);
const FORWARD_AIR_LAUNCH = region(0.0, 150.0, -40.0, 110.0, 3.0, 85.0, 18.0, 0.7660444378852844, 0.6427876353263855, 2);
const AZZINOTH_GLAIVES = { ...region(-190.0, 190.0, -60.0, 60.0, 14.0, 95.0, 22.0, 0.258819043636322, 0.9659258127212524), effect: downSmashHit(region(-190.0, 190.0, -60.0, 60.0, 14.0, 95.0, 22.0, 0.258819043636322, 0.9659258127212524).effect) };
// The fire burns only a fighter the glaives missed: one contact window for both.
const AZZINOTH_FLAMES = { ...region(-190.0, 190.0, -30.0, 170.0, 3.0, 20.0, 30.0, 0.08715574443340302, 0.9961947202682495), effect: downSmashHit(region(-190.0, 190.0, -30.0, 170.0, 3.0, 20.0, 30.0, 0.08715574443340302, 0.9961947202682495).effect) };
/** Eye Blast's beam sweeps out along the floor: 195 on its first active frame, 50 further each frame. */
function eyeBlastBeam(): readonly Readonly<HitRegion>[] {
  const beam: Readonly<HitRegion>[] = [];
  for (let frame = 0; frame < DEMON_HUNTER_FORWARD_SMASH_ACTIVE; frame++) {
    beam.push(region(25.0, 195.0 + frame * 50.0, -60.0, 45.0, 10.0, 90.0, 24.0, 0.8660253882408142, 0.5));
  }
  return beam;
}
const EYE_BLAST_BEAM = eyeBlastBeam();

/** Illidan's region on an active frame: the raid-boss normals vary by frame and charge, the rest are one row. */
function demonHunterRegion(style: AttackStyle, activeFrame: number, chargeFrames: number): Readonly<HitRegion> {
  switch (style) {
    case AttackStyle.forwardAir:
      return activeFrame <= 1 ? FORWARD_AIR_LINK : activeFrame >= 4 ? FORWARD_AIR_LAUNCH : NO_HIT_REGION;
    case AttackStyle.downSmash:
      return activeFrame <= 2 ? AZZINOTH_GLAIVES : AZZINOTH_FLAMES;
    case AttackStyle.forwardSmash:
      if (chargeFrames >= EYE_BLAST_CHARGE_FRAMES) return EYE_BLAST_BEAM[activeFrame] ?? NO_HIT_REGION;
      return activeFrame <= 2 ? DEMON_HUNTER_REGIONS[style] ?? NO_HIT_REGION : NO_HIT_REGION;
    default:
      return DEMON_HUNTER_REGIONS[style] ?? NO_HIT_REGION;
  }
}

const ordinary = (minX: number, maxX: number, minZ: number, maxZ: number, damage: number, launchX = DIAGONAL_UNIT) =>
  region(minX, maxX, minZ, maxZ, damage, ORDINARY_HIT_GROWTH_PERCENT, ORDINARY_HIT_BASE_KNOCKBACK, launchX, DIAGONAL_UNIT);

/** Reach envelope of the actions without a region of their own; smash damage is before charge. */
function reachRegion(style: AttackStyle): Readonly<HitRegion> {
  const verticalOffset = style === AttackStyle.forwardTiltUp ? 65.0 : style === AttackStyle.forwardTiltDown ? -65.0 : 0.0;
  const [minZ, maxZ] = [f32(verticalOffset - 130), f32(verticalOffset + 130)];
  // An angled forward tilt launches along its angle (smashcraft:docs/design/tilts.md): 55 degrees up, 20 down.
  if (style === AttackStyle.downSmash) {
    const row = ordinary(0.0, attackReach(style), minZ, maxZ, attackDamage(style));
    return { ...row, effect: downSmashHit(row.effect) };
  }
  if (style === AttackStyle.forwardTiltUp) return region(0.0, attackReach(style), minZ, maxZ, attackDamage(style), ORDINARY_HIT_GROWTH_PERCENT, ORDINARY_HIT_BASE_KNOCKBACK, 0.5735764503479004, 0.8191520571708679);
  if (style === AttackStyle.forwardTiltDown) return region(0.0, attackReach(style), minZ, maxZ, attackDamage(style), ORDINARY_HIT_GROWTH_PERCENT, ORDINARY_HIT_BASE_KNOCKBACK, 0.9396926164627075, 0.3420201539993286);
  return ordinary(0.0, attackReach(style), minZ, maxZ, attackDamage(style));
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
// Archer's up smash keeps the shared reach and damage with 80 growth: her kill power is her weak side (#279).
const SHARED_UP_SMASH = reachRegion(AttackStyle.upSmash);
const ARCHER_UP_SMASH: Readonly<HitRegion> = { ...SHARED_UP_SMASH, effect: { ...SHARED_UP_SMASH.effect, growth: 80.0 } };

export function authoredHitRegionCount(style: AttackStyle | undefined, moves?: FighterMoves): number {
  const authored = style === undefined ? undefined : moves?.normals[style];
  if (authored !== undefined) return authored.regions.length;
  return style === AttackStyle.forwardTilt ? 2 : 1;
}

function activeRegion(character: Character, style: AttackStyle, frame: number, index: number, chargeFrames: number): Readonly<HitRegion> {
  const startup = attackStartupFrames(style);
  // Grab and recovery attacks use the shared contact rules below.
  if (character === Character.demonHunter && style !== AttackStyle.grab && style !== AttackStyle.getupAttack && style !== AttackStyle.ledgeAttack) {
    return demonHunterRegion(style, frame - startup, chargeFrames);
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
    case AttackStyle.upSmash:
      return character === Character.archer ? ARCHER_UP_SMASH : REACH_REGIONS[style] ?? NO_HIT_REGION;
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
  copyHitRegion(out, activeRegion(character, style, frame, index, chargeFrames));
  if (character === Character.demonHunter && style !== AttackStyle.grab) out.effect.element = HitElement.slash;
  if (isSmashAttack(style)) out.effect.damage = f32(out.effect.damage * smashDamageMultiplier(chargeFrames));
  return out;
}

// Temporary until MeleeContactGeometry lands: the capsule tests and authored
// capsules of smashcraft:wurst/MeleeContactGeometry.wurst that hit selection
// uses. Capsules are written into caller-owned records so selection allocates
// nothing; adapt the callers to that port's API and delete this file.
import { max, min } from "../../runtime/wurst";
import { f32 } from "../../sim/f32";
import { AttackStyle, Character } from "./codes";

const ATTACK_CAPSULE_RADIUS = 10.0;

/** A segment swept by a radius, in local simulation units. */
export interface MeleeCapsule {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  radius: number;
}

export function emptyCapsule(): MeleeCapsule {
  return { x1: 0.0, z1: 0.0, x2: 0.0, z2: 0.0, radius: 0.0 };
}

function pointSegmentDistanceSquared(px: number, pz: number, segment: Readonly<MeleeCapsule>): number {
  const dx = f32(segment.x2 - segment.x1);
  const dz = f32(segment.z2 - segment.z1);
  const lengthSquared = f32(f32(dx * dx) + f32(dz * dz));
  if (lengthSquared <= 1.0000000116860974e-7) {
    const pointOffsetX = f32(px - segment.x1);
    const pointOffsetZ = f32(pz - segment.z1);
    return f32(f32(pointOffsetX * pointOffsetX) + f32(pointOffsetZ * pointOffsetZ));
  }
  const along = f32(f32(f32(px - segment.x1) * dx) + f32(f32(pz - segment.z1) * dz));
  const projection = max(0.0, min(1.0, f32(along / lengthSquared)));
  const closestOffsetX = f32(px - f32(segment.x1 + f32(projection * dx)));
  const closestOffsetZ = f32(pz - f32(segment.z1 + f32(projection * dz)));
  return f32(f32(closestOffsetX * closestOffsetX) + f32(closestOffsetZ * closestOffsetZ));
}

function orientation(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): number {
  return f32(f32(f32(bx - ax) * f32(cz - az)) - f32(f32(bz - az) * f32(cx - ax)));
}

function between(a: number, b: number, value: number): boolean {
  return value >= min(a, b) && value <= max(a, b);
}

function segmentsIntersect(a: Readonly<MeleeCapsule>, b: Readonly<MeleeCapsule>): boolean {
  const abC = orientation(a.x1, a.z1, a.x2, a.z2, b.x1, b.z1);
  const abD = orientation(a.x1, a.z1, a.x2, a.z2, b.x2, b.z2);
  const cdA = orientation(b.x1, b.z1, b.x2, b.z2, a.x1, a.z1);
  const cdB = orientation(b.x1, b.z1, b.x2, b.z2, a.x2, a.z2);
  if (((abC < 0 && abD > 0) || (abC > 0 && abD < 0)) && ((cdA < 0 && cdB > 0) || (cdA > 0 && cdB < 0))) return true;
  if (abC === 0 && between(a.x1, a.x2, b.x1) && between(a.z1, a.z2, b.z1)) return true;
  if (abD === 0 && between(a.x1, a.x2, b.x2) && between(a.z1, a.z2, b.z2)) return true;
  if (cdA === 0 && between(b.x1, b.x2, a.x1) && between(b.z1, b.z2, a.z1)) return true;
  return cdB === 0 && between(b.x1, b.x2, a.x2) && between(b.z1, b.z2, a.z2);
}

/** For non-intersecting segments the minimum distance is at an endpoint projected onto the other segment. */
export function meleeCapsulesIntersect(a: Readonly<MeleeCapsule>, b: Readonly<MeleeCapsule>): boolean {
  const radius = f32(a.radius + b.radius);
  if (segmentsIntersect(a, b)) return true;
  const distanceSquared = min(
    min(pointSegmentDistanceSquared(a.x1, a.z1, b), pointSegmentDistanceSquared(a.x2, a.z2, b)),
    min(pointSegmentDistanceSquared(b.x1, b.z1, a), pointSegmentDistanceSquared(b.x2, b.z2, a)),
  );
  return distanceSquared <= f32(radius * radius);
}

/** Places a local capsule at an origin, mirroring X for a fighter facing left. */
export function mirrorMeleeCapsule(capsule: MeleeCapsule, originX: number, originZ: number, facing: number): void {
  const direction = facing < 0 ? -1.0 : 1.0;
  capsule.x1 = f32(originX + f32(direction * capsule.x1));
  capsule.z1 = f32(originZ + capsule.z1);
  capsule.x2 = f32(originX + f32(direction * capsule.x2));
  capsule.z2 = f32(originZ + capsule.z2);
}

function copyCapsule(capsule: MeleeCapsule, from: Readonly<MeleeCapsule>): void {
  capsule.x1 = from.x1;
  capsule.z1 = from.z1;
  capsule.x2 = from.x2;
  capsule.z2 = from.z2;
  capsule.radius = from.radius;
}

/**
 * Writes the provisional strike path of an action into capsule. Move identity
 * determines the strike direction; a tall eligibility envelope does not make a
 * jab a vertical strike.
 */
export function authoredAttackCapsule(capsule: MeleeCapsule, style: AttackStyle | undefined, minX: number, maxX: number, minZ: number, maxZ: number): void {
  switch (style) {
    case AttackStyle.jab:
      capsule.x1 = 0.0;
      capsule.z1 = 45.0;
      capsule.x2 = 70.0;
      capsule.z2 = 45.0;
      capsule.radius = 10.0;
      return;
    case AttackStyle.upAir:
      capsule.x1 = 0.0;
      capsule.z1 = 70.0;
      capsule.x2 = 0.0;
      capsule.z2 = f32(maxZ - 30);
      capsule.radius = 40.0;
      return;
    case AttackStyle.downAir:
      capsule.x1 = 0.0;
      capsule.z1 = minZ;
      capsule.x2 = 0.0;
      capsule.z2 = -75.0;
      capsule.radius = 40.0;
      return;
    case AttackStyle.upSmash:
    case AttackStyle.upTilt:
      capsule.x1 = 0.0;
      capsule.z1 = 20.0;
      capsule.x2 = f32(maxX - 30);
      capsule.z2 = f32(maxZ - 30);
      capsule.radius = 30.0;
      return;
    case AttackStyle.forwardTiltUp:
    case AttackStyle.forwardTiltDown:
      capsule.x1 = minX;
      capsule.z1 = 45.0;
      capsule.x2 = f32(maxX - 34);
      capsule.z2 = style === AttackStyle.forwardTiltUp ? 175.0 : -85.0;
      capsule.radius = 10.0;
      return;
    case AttackStyle.downSmash:
    case AttackStyle.downTilt:
      capsule.x1 = minX < 0 ? f32(minX + 25) : minX;
      capsule.z1 = 0.0;
      capsule.x2 = f32(maxX - 25);
      capsule.z2 = 0.0;
      capsule.radius = 25.0;
      return;
    default:
      capsule.x1 = minX < 0 ? f32(minX + 34) : minX;
      capsule.z1 = 45.0;
      capsule.x2 = maxX > 0 ? max(minX, f32(maxX - 34)) : maxX;
      capsule.z2 = 45.0;
      capsule.radius = ATTACK_CAPSULE_RADIUS;
  }
}

/**
 * Coarse, pose-independent hurt capsules tuned for Smashcraft's actor
 * presentation scale. These do not claim Melee hurtbox or animation parity.
 */
const HURT_CAPSULES: { readonly [character in Character]: Readonly<MeleeCapsule> } = {
  [Character.archer]: { x1: 0.0, z1: 4.0, x2: 0.0, z2: 88.0, radius: 24.0 },
  [Character.rifleman]: { x1: 0.0, z1: 4.0, x2: 0.0, z2: 96.0, radius: 26.0 },
  [Character.demonHunter]: { x1: 0.0, z1: 4.0, x2: 0.0, z2: 102.0, radius: 25.0 },
};

export function authoredFighterHurtCapsule(capsule: MeleeCapsule, character: Character): void {
  copyCapsule(capsule, HURT_CAPSULES[character]);
}

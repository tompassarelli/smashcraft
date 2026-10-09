



import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { heroBody } from "../sim/heroes/heroBodies";
import { Character } from "../sim/codes";


export interface Capsule {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  radius: number;
}


interface Reach {
  readonly strike?: Readonly<Capsule> | undefined;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export function emptyCapsule(): Capsule {
  return { x1: 0.0, z1: 0.0, x2: 0.0, z2: 0.0, radius: 0.0 };
}

function pointSegmentDistanceSquared(px: number, pz: number, segment: Readonly<Capsule>): number {
  const { x1, z1, x2, z2 } = segment;
  const dx = f32(x2 - x1);
  const dz = f32(z2 - z1);
  const lengthSquared = f32(f32(dx * dx) + f32(dz * dz));
  const offsetX = f32(px - x1);
  const offsetZ = f32(pz - z1);
  if (lengthSquared <= 1.0000000116860974e-7) return f32(f32(offsetX * offsetX) + f32(offsetZ * offsetZ));
  const projection = Math.max(0.0, Math.min(1.0, f32(f32(f32(offsetX * dx) + f32(offsetZ * dz)) / lengthSquared)));
  const closestX = f32(px - f32(x1 + f32(projection * dx)));
  const closestZ = f32(pz - f32(z1 + f32(projection * dz)));
  return f32(f32(closestX * closestX) + f32(closestZ * closestZ));
}


function orientation(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): number {
  return f32(f32(f32(bx - ax) * f32(cz - az)) - f32(f32(bz - az) * f32(cx - ax)));
}

const between = (a: number, b: number, value: number) => value >= Math.min(a, b) && value <= Math.max(a, b);
const straddles = (first: number, second: number) => (first < 0 && second > 0) || (first > 0 && second < 0);


export function segmentBoxesOverlap(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): boolean {
  return Math.max(ax, bx) >= Math.min(cx, dx) && Math.max(cx, dx) >= Math.min(ax, bx)
    && Math.max(az, bz) >= Math.min(cz, dz) && Math.max(cz, dz) >= Math.min(az, bz);
}

function segmentsIntersect(a: Readonly<Capsule>, b: Readonly<Capsule>): boolean {
  const abC = orientation(a.x1, a.z1, a.x2, a.z2, b.x1, b.z1);
  const abD = orientation(a.x1, a.z1, a.x2, a.z2, b.x2, b.z2);
  const cdA = orientation(b.x1, b.z1, b.x2, b.z2, a.x1, a.z1);
  const cdB = orientation(b.x1, b.z1, b.x2, b.z2, a.x2, a.z2);
  if (straddles(abC, abD) && straddles(cdA, cdB)) return true;

  return (abC === 0 && between(a.x1, a.x2, b.x1) && between(a.z1, a.z2, b.z1))
    || (abD === 0 && between(a.x1, a.x2, b.x2) && between(a.z1, a.z2, b.z2))
    || (cdA === 0 && between(b.x1, b.x2, a.x1) && between(b.z1, b.z2, a.z1))
    || (cdB === 0 && between(b.x1, b.x2, a.x2) && between(b.z1, b.z2, a.z2));
}









const ROUGH_ALLOWANCE = 0.000244140625;

const ROUGH_LIMIT = 1048576.0;

const magnitude = (value: number) => (value < 0 ? -value : value);


function roughOrientation(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): number {
  // Multiplying by 1.0 keeps wrapping Lua integers out of these products.
  const p = (bx - ax) * 1.0 * (cz - az);
  const q = (bz - az) * 1.0 * (cx - ax);
  const allowance = (magnitude(p) + magnitude(q)) * ROUGH_ALLOWANCE;
  const difference = p - q;
  return difference > allowance ? 1 : difference < -allowance ? -1 : 0;
}


function roughDistanceSquared(px: number, pz: number, segment: Readonly<Capsule>): number {
  const { x1, z1, x2, z2 } = segment;
  const dx = (x2 - x1) * 1.0;
  const dz = (z2 - z1) * 1.0;
  const lengthSquared = dx * dx + dz * dz;
  const offsetX = (px - x1) * 1.0;
  const offsetZ = (pz - z1) * 1.0;
  if (lengthSquared <= 1.0000000116860974e-7) return offsetX * offsetX + offsetZ * offsetZ;
  const projection = Math.max(0.0, Math.min(1.0, (offsetX * dx + offsetZ * dz) / lengthSquared));
  const closestX = px - (x1 + projection * dx);
  const closestZ = pz - (z1 + projection * dz);
  return closestX * closestX + closestZ * closestZ;
}


function coordinateScale(a: Readonly<Capsule>, b: Readonly<Capsule>): number {
  return Math.max(
    Math.max(Math.max(magnitude(a.x1), magnitude(a.z1)), Math.max(magnitude(a.x2), magnitude(a.z2))),
    Math.max(Math.max(magnitude(b.x1), magnitude(b.z1)), Math.max(magnitude(b.x2), magnitude(b.z2))),
  );
}

export function capsulesIntersect(a: Readonly<Capsule>, b: Readonly<Capsule>): boolean {
  const radius = f32(a.radius + b.radius);
  const scale = coordinateScale(a, b);

  if (scale < ROUGH_LIMIT) {
    const abC = roughOrientation(a.x1, a.z1, a.x2, a.z2, b.x1, b.z1);
    const abD = roughOrientation(a.x1, a.z1, a.x2, a.z2, b.x2, b.z2);
    const cdA = roughOrientation(b.x1, b.z1, b.x2, b.z2, a.x1, a.z1);
    const cdB = roughOrientation(b.x1, b.z1, b.x2, b.z2, a.x2, a.z2);

    const crossing = abC !== 0 && abD !== 0 && cdA !== 0 && cdB !== 0 ? abC !== abD && cdA !== cdB : segmentsIntersect(a, b);
    if (crossing) return true;
    const limit = f32(radius * radius);
    const nearest = Math.min(
      Math.min(roughDistanceSquared(a.x1, a.z1, b), roughDistanceSquared(a.x2, a.z2, b)),
      Math.min(roughDistanceSquared(b.x1, b.z1, a), roughDistanceSquared(b.x2, b.z2, a)),
    );
    const allowance = (scale + 16.0) * (scale + 16.0) * ROUGH_ALLOWANCE;
    if (nearest > limit + allowance) return false;
    if (nearest < limit - allowance) return true;
  } else if (segmentsIntersect(a, b)) return true;

  const distanceSquared = Math.min(
    Math.min(pointSegmentDistanceSquared(a.x1, a.z1, b), pointSegmentDistanceSquared(a.x2, a.z2, b)),
    Math.min(pointSegmentDistanceSquared(b.x1, b.z1, a), pointSegmentDistanceSquared(b.x2, b.z2, a)),
  );
  return distanceSquared <= f32(radius * radius);
}


export function placeCapsule(target: Capsule, local: Readonly<Capsule>, originX: number, originZ: number, facing: number): Capsule {
  const direction = facing < 0 ? -1.0 : 1.0;
  target.x1 = f32(originX + f32(direction * local.x1));
  target.z1 = f32(originZ + local.z1);
  target.x2 = f32(originX + f32(direction * local.x2));
  target.z2 = f32(originZ + local.z2);
  target.radius = local.radius;
  return target;
}






export function attackCapsule(target: Capsule, style: number | undefined, reach: Reach): Capsule {
  const authored = reach.strike;
  if (authored !== undefined) {
    target.x1 = authored.x1;
    target.z1 = authored.z1;
    target.x2 = authored.x2;
    target.z2 = authored.z2;
    target.radius = authored.radius;
    return target;
  }
  const { minX, maxX, minZ, maxZ } = reach;
  if (style === 0) {
    target.x1 = 0.0;
    target.z1 = 45.0;
    target.x2 = 70.0;
    target.z2 = 45.0;
    target.radius = 10.0;
  } else if (style === 15) {
    target.x1 = 0.0;
    target.z1 = 70.0;
    target.x2 = 0.0;
    target.z2 = f32(maxZ - 30.0);
    target.radius = 40.0;
  } else if (style === 16) {
    target.x1 = 0.0;
    target.z1 = minZ;
    target.x2 = 0.0;
    target.z2 = -75.0;
    target.radius = 40.0;
  } else if (style === 2 || style === 7) {
    target.x1 = 0.0;
    target.z1 = 20.0;
    target.x2 = f32(maxX - 30.0);
    target.z2 = f32(maxZ - 30.0);
    target.radius = 30.0;
  } else if (style === 9 || style === 10) {
    target.x1 = minX;
    target.z1 = 45.0;
    target.x2 = f32(maxX - 34.0);
    target.z2 = style === 9 ? 175.0 : -85.0;
    target.radius = 10.0;
  } else if (style === 3 || style === 8) {
    target.x1 = minX < 0 ? f32(minX + 25.0) : minX;
    target.z1 = 0.0;
    target.x2 = f32(maxX - 25.0);
    target.z2 = 0.0;
    target.radius = 25.0;
  } else {
    target.x1 = minX < 0 ? f32(minX + 34.0) : minX;
    target.z1 = 45.0;
    target.x2 = maxX > 0 ? Math.max(minX, f32(maxX - 34.0)) : maxX;
    target.z2 = 45.0;
    target.radius = 10.0;
  }
  return target;
}





const REFERENCE_HURT_CAPSULE: Readonly<Capsule> = { x1: 0.0, z1: 4.0, x2: 0.0, z2: 88.0, radius: 24.0 };
const ORIGINAL_HURT_CAPSULES: Readonly<Record<number, Readonly<Capsule>>> = {
  1:
  { x1: 0.0, z1: 4.0, x2: 0.0, z2: 61.0, radius: 26.0 },
  2: { x1: 0.0, z1: 4.0, x2: 0.0, z2: 133.75, radius: 25.0 },
};

function scaledHurtCapsule(character: number): Readonly<Capsule> | undefined {
  const scale = heroBody(character);
  if (scale === undefined) return undefined;
  const reference = REFERENCE_HURT_CAPSULE;
  const radius = f32(reference.radius * scale.width);
  const height = f32(f32(f32(reference.z2 - reference.z1) + f32(2.0 * reference.radius)) * scale.height);
  return { x1: 0.0, z1: reference.z1, x2: 0.0, z2: f32(reference.z1 + f32(height - f32(2.0 * radius))), radius };
}


const HURT_CAPSULES: Readonly<Record<number, Readonly<Capsule>>> = (() => {
  const capsules: Record<number, Readonly<Capsule>> = { ...ORIGINAL_HURT_CAPSULES };
  for (const character of Object.values(Character)) {
    const scaled = scaledHurtCapsule(character);
    if (scaled === undefined) continue;
    capsules[character] = scaled;
  }
  return capsules;
})();


export function hurtCapsule(character: number): Readonly<Capsule> {
  return HURT_CAPSULES[character] ?? REFERENCE_HURT_CAPSULE;
}

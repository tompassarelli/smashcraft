// Multi-hit aerials and drills (#152, smashcraft:docs/design/aerials.md).
// Every hit but the last is a link: zero growth, so its launch is its base
// knockback at any percent and weight, and its hitstun outlasts the gap to
// the next hit. Each hit takes the next contact window so it may strike a
// target the earlier hits already struck.
import { f32 } from "wisp/src/sim/f32";
import { HitElement } from "../codes";
import { type AuthoredMove, type MoveRegion, type StrikeCapsule, heroRegion } from "../heroMoves";
import type { HitEffect } from "../hitRegions";

/**
 * A link hit: the same launch at every percent, facing-relative direction
 * (x, z) of unit length, and an airborne target also takes the attacker's own
 * velocity (Ultimate's autolink angles do the same), so it stays with the attacker.
 */
function linkHit(damage: number, base: number, x: number, z: number, element: HitElement = HitElement.slash): Readonly<HitEffect> {
  return { damage, growth: 0.0, base, launchX: f32(x), launchZ: f32(z), electric: false, element, carry: true };
}

/** Facing-relative unit directions by angle in degrees (0 forward, 90 up, 270 down), as authored constants. */
const DIRECTION = {
  0: { x: 1.0, z: 0.0 },
  20: { x: f32(0.939692621), z: f32(0.342020143) },
  45: { x: f32(0.707106781), z: f32(0.707106781) },
  50: { x: f32(0.642787610), z: f32(0.766044443) },
  70: { x: f32(0.342020143), z: f32(0.939692621) },
  80: { x: f32(0.173648178), z: f32(0.984807753) },
  85: { x: f32(0.087155743), z: f32(0.996194698) },
  90: { x: 0.0, z: 1.0 },
  95: { x: f32(-0.087155743), z: f32(0.996194698) },
  100: { x: f32(-0.173648178), z: f32(0.984807753) },
  160: { x: f32(-0.939692621), z: f32(0.342020143) },
  200: { x: f32(-0.939692621), z: f32(-0.342020143) },
  225: { x: f32(-0.707106781), z: f32(-0.707106781) },
  250: { x: f32(-0.342020143), z: f32(-0.939692621) },
  270: { x: 0.0, z: -1.0 },
  290: { x: f32(0.342020143), z: f32(-0.939692621) },
  315: { x: f32(0.707106781), z: f32(-0.707106781) },
  340: { x: f32(0.939692621), z: f32(-0.342020143) },
} as const;
type Degrees = keyof typeof DIRECTION;

/** A link hit launched along an authored angle. */
export function linkAt(damage: number, base: number, degrees: Degrees, element: HitElement = HitElement.slash): Readonly<HitEffect> {
  const d = DIRECTION[degrees];
  return linkHit(damage, base, d.x, d.z, element);
}

/** One hit of a multi-hit: frames counted from one like the roster brief, and the capsules it strikes with, each with its effect; earlier entries win overlaps. */
interface MultiHitStep {
  readonly first: number;
  readonly last: number;
  readonly strikes: readonly Strike[];
}

/** A capsule, its effect, and optionally the effect it has on a grounded target. */
export type Strike = readonly [StrikeCapsule, Readonly<HitEffect>, (Readonly<HitEffect> | undefined)?];

/** Regions for a sequence of hits; hit k (from zero) uses contact window k + 1. */
export function multiHit(steps: readonly MultiHitStep[]): readonly MoveRegion[] {
  const regions: MoveRegion[] = [];
  steps.forEach((step, index) => {
    for (const [strike, effect, grounded] of step.strikes) regions.push(heroRegion(step.first, step.last, strike, effect, grounded, index + 1));
  });
  return regions;
}

/** A drill hit's launches by band: the centre and the two flanks. */
interface DrillEffects {
  readonly centre: Readonly<HitEffect>;
  readonly front: Readonly<HitEffect>;
  readonly back: Readonly<HitEffect>;
}

/**
 * A drill's hit below the body, from topZ down to bottomZ and halfWidth to
 * each side: a centre band, then the front and back flanks, each with its own
 * launch, so a target off-centre is pulled, dragged or carried as its flank says.
 */
export function drillStrikes(topZ: number, bottomZ: number, halfWidth: number, air: DrillEffects, ground?: DrillEffects): readonly Strike[] {
  const radius = f32(f32(topZ - bottomZ) * 0.5);
  const z = f32(bottomZ + radius);
  const inner = f32(halfWidth * f32(0.3));
  const outer = f32(halfWidth - radius);
  const band = (x1: number, x2: number): StrikeCapsule => ({ x1, z1: z, x2, z2: z, radius });
  return [
    [band(-inner, inner), air.centre, ground?.centre],
    [band(inner, outer), air.front, ground?.front],
    [band(-inner, -outer), air.back, ground?.back],
  ];
}

/** Whether any of the move's hits strikes in a later contact window: a multi-hit, whose hits may leave gaps in its active frames. */
export function isMultiHit(move: AuthoredMove | undefined): boolean {
  return move?.regions.some(region => region.hit.window > 1) === true;
}

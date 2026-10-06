import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction, HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT, heroHurtPose, heroMove, heroRegion, type AuthoredMove, type FighterMoves, type MoveRegion, type StrikeCapsule } from "../heroMoves";
import type { HitEffect } from "../hitRegions";
import { type FighterHurtboxes, type HurtPart, hurtPart } from "../hurtboxes";
import { drillStrikes, linkAt, multiHit } from "./multiHit";

// smashcraft:docs/design/roster.md supplies F/A/R/L, damage and outer reach.
// These narrow paths are original, provisional weapon and limb geometry.
const S = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
const M = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
const L = f32(HERO_REFERENCE_HEIGHT * f32(1.10));
const BLADE_RADIUS = 7.0;

// Provisional coefficients in the existing formula, not measured displacement
// bands or a promise that LINK permits a guaranteed follow-up.
const CLASS = {
  LINK: { growth: 55.0, base: 12.0 },
  POKE: { growth: 75.0, base: 18.0 },
  LAUNCH: { growth: 95.0, base: 20.0 },
  EDGE: { growth: 100.0, base: 22.0 },
  KILL: { growth: 110.0, base: 26.0 },
  SPIKE: { growth: 100.0, base: 22.0 },
  // Throw roles (#107): an up throw's guaranteed short juggle and a down throw's tech chase.
  JUGGLE: { growth: 55.0, base: 50.0 },
  CHASE: { growth: 40.0, base: 75.0 },
} as const;
const ANGLE = {
  25: { x: f32(0.906307787), z: f32(0.422618262) },
  35: { x: f32(0.819152044), z: f32(0.573576436) },
  40: { x: f32(0.766044443), z: f32(0.642787610) },
  50: { x: f32(0.642787610), z: f32(0.766044443) },
  55: { x: f32(0.573576436), z: f32(0.819152044) },
  70: { x: f32(0.342020143), z: f32(0.939692621) },
  85: { x: f32(0.087155743), z: f32(0.996194698) },
  90: { x: 0.0, z: 1.0 },
  270: { x: 0.0, z: -1.0 },
} as const;

export function hit(damage: number, kind: keyof typeof CLASS, angle: keyof typeof ANGLE, facing = 1.0, element: HitElement = HitElement.slash): Readonly<HitEffect> {
  const strength = CLASS[kind];
  const direction = ANGLE[angle];
  return { damage, growth: strength.growth, base: strength.base, launchX: f32(direction.x * facing), launchZ: direction.z, electric: false, element };
}

function capsule(x1: number, z1: number, x2: number, z2: number, radius = BLADE_RADIUS): StrikeCapsule {
  return { x1, z1, x2, z2, radius };
}

function path(first: number, strikes: readonly StrikeCapsule[], effect: Readonly<HitEffect>, groundedEffect?: Readonly<HitEffect>): readonly MoveRegion[] {
  return strikes.map((strike, index) => heroRegion(first + index, first + index, strike, effect, groundedEffect));
}

function chop(first: number, heights: readonly number[], reach: number, effect: Readonly<HitEffect>): readonly MoveRegion[] {
  return path(first, heights.map(z => capsule(20.0, 45.0, f32(reach - BLADE_RADIUS), z)), effect);
}

// Glaive drill (down air, #152): a spinning glaive under him that carries a
// target sideways while he drifts forward, then throws it toward the ledge;
// an edge-guard and positioning drill rather than a combo starter.
// smashcraft:docs/design/aerials.md.
const GLAIVE_SPINS = [9, 12, 15, 18] as const;
const GLAIVE_THROW = 21;
const GLAIVE_REACH = f32(M - BLADE_RADIUS);
// The fling tumbles at every percent, so holding down cannot keep the target on the floor.
const GLAIVE_FLING: Readonly<HitEffect> = { ...hit(4.0, "EDGE", 25), base: 65.0 };
const GLAIVE = drillStrikes(-4.0, -80.0, GLAIVE_REACH,
  { centre: linkAt(2.0, 25.0, 20), front: linkAt(2.0, 15.0, 20), back: linkAt(2.0, 35.0, 20) },
  { centre: linkAt(2.0, 25.0, 340), front: linkAt(2.0, 15.0, 340), back: linkAt(2.0, 35.0, 340) });
const GLAIVE_DRILL: AuthoredMove = {
  ...heroMove(9, GLAIVE_THROW + 1 - 9 + 1, 15, 14, multiHit([
    ...GLAIVE_SPINS.map(first => ({ first, last: first + 1, strikes: GLAIVE })),
    { first: GLAIVE_THROW, last: GLAIVE_THROW + 1, strikes: drillStrikes(-4.0, -80.0, GLAIVE_REACH,
      { centre: GLAIVE_FLING, front: GLAIVE_FLING, back: GLAIVE_FLING }) },
  ])),
  // A slow fall that drifts forward with the carried target.
  fall: [{ firstFrame: 8, lastFrame: GLAIVE_THROW, speedZ: -3.0, speedX: 4.0 }],
};

// Body: the reference capsule scaled by the roster's 0.92 width and 1.08
// height. Limbs reach toward each strike from late startup through early
// recovery, fitted to the classic model's skinned clips (hands reach about
// 80 units forward in Attack and above 170 in Spell); the glaive past the
// hand is the move's disjoint. Heel Hook's arm stays exposed along its path.
const BODY_RADIUS = f32(24.0 * f32(0.92));
const BODY_TOP = f32(f32(4.0 + f32(HERO_REFERENCE_HEIGHT * f32(1.08))) - f32(2.0 * BODY_RADIUS));
const BODY = hurtPart(0.0, 4.0, 0.0, BODY_TOP, BODY_RADIUS);
const LIMB_RADIUS = 9.0;
const limb = (x1: number, z1: number, x2: number, z2: number, radius = LIMB_RADIUS): readonly HurtPart[] => [BODY, hurtPart(x1, z1, x2, z2, radius)];
/** The limb pose from two frames before the first active frame through two after the last. */
const reaching = (first: number, active: number, parts: readonly HurtPart[]) => [heroHurtPose(first - 2, first + active + 1, parts)];
const FORWARD_ARM = limb(10.0, 62.0, 58.0, 55.0);
const RAISED_ARMS = limb(0.0, 95.0, 5.0, 140.0);
const HALF_HOOK = limb(-12.0, 40.0, -45.0, 41.0, 11.0);

const SHADOW_HUNTER_BODY: FighterHurtboxes = {
  stand: [BODY],
  attacks: {
    [AttackStyle.jab]: reaching(5, 2, limb(10.0, 58.0, 45.0, 52.0)),
    [AttackStyle.forwardTilt]: reaching(9, 3, FORWARD_ARM),
    [AttackStyle.forwardTiltUp]: reaching(9, 3, limb(10.0, 66.0, 55.0, 80.0)),
    [AttackStyle.forwardTiltDown]: reaching(9, 3, limb(10.0, 55.0, 55.0, 35.0)),
    [AttackStyle.upTilt]: reaching(8, 4, RAISED_ARMS),
    [AttackStyle.downTilt]: reaching(7, 3, limb(10.0, 30.0, 50.0, 15.0)),
    [AttackStyle.dashAttack]: reaching(10, 4, FORWARD_ARM),
    [AttackStyle.forwardSmash]: reaching(19, 3, limb(10.0, 80.0, 70.0, 90.0)),
    [AttackStyle.upSmash]: reaching(17, 4, RAISED_ARMS),
    [AttackStyle.neutralAir]: [
      heroHurtPose(5, 9, limb(10.0, 60.0, 50.0, 55.0)),
      heroHurtPose(10, 13, limb(-10.0, 60.0, -50.0, 55.0)),
    ],
    [AttackStyle.forwardAir]: reaching(10, 3, FORWARD_ARM),
    // The hook ramps out and back through a half-extended arm: no body change moves an extent past 60.
    [AttackStyle.backAir]: [
      heroHurtPose(5, 7, HALF_HOOK),
      heroHurtPose(8, 12, limb(-12.0, 40.0, -f32(M - 24.0), 42.0, 11.0)),
      heroHurtPose(13, 15, HALF_HOOK),
    ],
    [AttackStyle.upAir]: reaching(7, 3, RAISED_ARMS),
    [AttackStyle.downAir]: reaching(9, 14, limb(2.0, 30.0, 2.0, -20.0)),
    [AttackStyle.grab]: reaching(8, 2, limb(10.0, 45.0, f32(S - 10.0), 42.0)),
  },
};

export const SHADOW_HUNTER_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: 1.25,
  maxPummels: 2,
  hurtboxes: SHADOW_HUNTER_BODY,
  normals: {
    [AttackStyle.jab]: heroMove(5, 2, 14, 0, path(5, [
      capsule(16.0, 42.0, f32(S - 9.0), 42.0, 9.0),
      capsule(18.0, 44.0, f32(S - 9.0), 44.0, 9.0),
    ], hit(3.0, "POKE", 35, 1.0, HitElement.normal))),
    [AttackStyle.forwardTilt]: heroMove(9, 3, 21, 0, chop(9, [65.0, 45.0, 25.0], L, hit(9.0, "POKE", 35))),
    [AttackStyle.forwardTiltUp]: heroMove(9, 3, 21, 0, chop(9, [105.0, 125.0, 145.0], L, hit(9.0, "POKE", 35))),
    [AttackStyle.forwardTiltDown]: heroMove(9, 3, 21, 0, chop(9, [-15.0, -35.0, -55.0], L, hit(9.0, "POKE", 35))),
    [AttackStyle.upTilt]: heroMove(8, 4, 21, 0, path(8, [
      capsule(20.0, 50.0, 45.0, 85.0),
      capsule(12.0, 52.0, 20.0, f32(M - BLADE_RADIUS)),
      capsule(0.0, 52.0, 0.0, f32(M - BLADE_RADIUS)),
      capsule(-12.0, 52.0, -25.0, 90.0),
    ], hit(8.0, "LAUNCH", 85))),
    [AttackStyle.downTilt]: heroMove(7, 3, 19, 0, path(7, [
      capsule(18.0, 12.0, f32(M - BLADE_RADIUS), 16.0),
      capsule(18.0, 10.0, f32(M - BLADE_RADIUS), 8.0),
      capsule(18.0, 8.0, f32(M - BLADE_RADIUS), 0.0),
    ], hit(6.0, "LINK", 70))),
    [AttackStyle.dashAttack]: heroMove(10, 4, 27, 0, chop(10, [70.0, 50.0, 30.0, 12.0], M, hit(10.0, "LAUNCH", 50)), 24.0),
    [AttackStyle.forwardSmash]: heroMove(19, 3, 34, 0, chop(19, [85.0, 45.0, 5.0], L, hit(18.0, "KILL", 40))),
    [AttackStyle.upSmash]: heroMove(17, 4, 31, 0, path(17, [
      capsule(10.0, 36.0, 18.0, f32(L - BLADE_RADIUS)),
      capsule(5.0, 36.0, 9.0, f32(L - BLADE_RADIUS)),
      capsule(0.0, 36.0, 0.0, f32(L - BLADE_RADIUS)),
      capsule(-5.0, 36.0, -9.0, f32(L - BLADE_RADIUS)),
    ], hit(15.0, "KILL", 90, 1.0, HitElement.normal))),
    [AttackStyle.downSmash]: heroMove(16, 5, 33, 0, [
      ...path(16, [
        capsule(20.0, 10.0, f32(M - 10.0), 22.0, 10.0),
        capsule(20.0, 10.0, f32(M - 10.0), 10.0, 10.0),
        capsule(20.0, 10.0, f32(M - 10.0), 0.0, 10.0),
      ], hit(13.0, "EDGE", 25, 1.0, HitElement.normal)),
      ...path(19, [
        capsule(-20.0, 10.0, -f32(M - 10.0), 22.0, 10.0),
        capsule(-20.0, 10.0, -f32(M - 10.0), 0.0, 10.0),
      ], hit(13.0, "EDGE", 25, -1.0, HitElement.normal)),
    ]),
    [AttackStyle.neutralAir]: heroMove(7, 5, 21, 13, [
      ...path(7, [
        capsule(18.0, 32.0, f32(M - BLADE_RADIUS), 32.0),
        capsule(12.0, 50.0, 60.0, 85.0),
        capsule(0.0, 52.0, 0.0, f32(M - BLADE_RADIUS)),
      ], hit(8.0, "POKE", 50)),
      ...path(10, [
        capsule(-12.0, 50.0, -60.0, 85.0),
        capsule(-18.0, 32.0, -f32(M - BLADE_RADIUS), 32.0),
      ], hit(8.0, "POKE", 50, -1.0)),
    ]),
    [AttackStyle.forwardAir]: heroMove(10, 3, 25, 15, chop(10, [65.0, 45.0, 25.0], L, hit(11.0, "EDGE", 40))),
    // Heel Hook is an attached limb, so SHADOW_HUNTER_BODY exposes it along this path.
    [AttackStyle.backAir]: heroMove(8, 3, 23, 13, path(8, [
      capsule(-12.0, 24.0, -f32(M - 12.0), 30.0, 12.0),
      capsule(-12.0, 28.0, -f32(M - 12.0), 42.0, 12.0),
      capsule(-12.0, 30.0, -f32(M - 12.0), 54.0, 12.0),
    ], hit(10.0, "EDGE", 35, -1.0, HitElement.normal))),
    [AttackStyle.upAir]: heroMove(7, 3, 21, 12, path(7, [
      capsule(8.0, 50.0, 18.0, f32(M - BLADE_RADIUS)),
      capsule(0.0, 50.0, 0.0, f32(M - BLADE_RADIUS)),
      capsule(-8.0, 50.0, -18.0, f32(M - BLADE_RADIUS)),
    ], hit(8.0, "LAUNCH", 85))),
    [AttackStyle.downAir]: GLAIVE_DRILL,
    [AttackStyle.grab]: heroMove(8, 2, 24, 0, [heroRegion(8, 9,
      capsule(18.0, 42.0, f32(S - 10.0), 42.0, 10.0),
      { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false })]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 3.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } },
    [GrabAction.throwForward]: { contactFrame: 12, totalFrames: 32, effect: hit(7.0, "EDGE", 35, 1.0, HitElement.normal) },
    [GrabAction.throwBack]: { contactFrame: 16, totalFrames: 40, effect: hit(8.0, "EDGE", 40, -1.0, HitElement.normal) },
    [GrabAction.throwUp]: { contactFrame: 14, totalFrames: 22, effect: hit(6.0, "JUGGLE", 85, 1.0, HitElement.normal) },
    [GrabAction.throwDown]: { contactFrame: 17, totalFrames: 40, effect: hit(5.0, "CHASE", 70, 1.0, HitElement.normal) },
  },
};

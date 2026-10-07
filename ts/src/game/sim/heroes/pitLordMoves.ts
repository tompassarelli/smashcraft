import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction, HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT, jabStep, heroHurtPose, heroMove, heroRegion, type FighterMoves, type MoveRegion, type StrikeCapsule } from "../heroMoves";
import type { HitEffect } from "../hitRegions";
import { type FighterHurtboxes, type HurtPart, hurtPart } from "../hurtboxes";

// smashcraft:docs/design/roster.md "Pit Lord" supplies F/A/R/L, damage and
// outer reach. The cleaver paths, hoof, horn and tail geometry are original
// and provisional: long reach, the slowest startups on the roster.
export const S = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
export const M = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
export const L = f32(HERO_REFERENCE_HEIGHT * f32(1.10));
export const XL = f32(HERO_REFERENCE_HEIGHT * f32(1.40));
const BLADE_RADIUS = 10.0;

// Provisional coefficients in the existing formula, shared with the other
// kits, not measured displacement bands. Weight 1.28 does the rest.
const CLASS = {
  LINK: { growth: 55.0, base: 12.0 },
  POKE: { growth: 75.0, base: 18.0 },
  LAUNCH: { growth: 95.0, base: 20.0 },
  EDGE: { growth: 95.0, base: 22.0 },
  KILL: { growth: 100.0, base: 24.0 },
  SPIKE: { growth: 100.0, base: 22.0 },
  // Throw roles (#107): an up throw's guaranteed short juggle and a down throw's tech chase.
  JUGGLE: { growth: 55.0, base: 50.0 },
  CHASE: { growth: 40.0, base: 75.0 },
} as const;
const ANGLE = {
  25: { x: f32(0.906307787), z: f32(0.422618262) },
  35: { x: f32(0.819152044), z: f32(0.573576436) },
  40: { x: f32(0.766044443), z: f32(0.642787610) },
  45: { x: f32(0.707106781), z: f32(0.707106781) },
  50: { x: f32(0.642787610), z: f32(0.766044443) },
  55: { x: f32(0.573576436), z: f32(0.819152044) },
  65: { x: f32(0.422618262), z: f32(0.906307787) },
  80: { x: f32(0.173648178), z: f32(0.984807753) },
  85: { x: f32(0.087155743), z: f32(0.996194698) },
  270: { x: 0.0, z: -1.0 },
  // Low and outward, below the horizontal: Front Hoof's semi-spike.
  340: { x: f32(0.939692621), z: f32(-0.342020143) },
} as const;

export function hit(damage: number, kind: keyof typeof CLASS, angle: keyof typeof ANGLE, facing = 1.0, element: HitElement = HitElement.slash): Readonly<HitEffect> {
  const strength = CLASS[kind];
  const direction = ANGLE[angle];
  return { damage, growth: strength.growth, base: strength.base, launchX: f32(direction.x * facing), launchZ: direction.z, electric: false, element };
}

export function capsule(x1: number, z1: number, x2: number, z2: number, radius = BLADE_RADIUS): StrikeCapsule {
  return { x1, z1, x2, z2, radius };
}

function path(first: number, strikes: readonly StrikeCapsule[], effect: Readonly<HitEffect>, groundedEffect?: Readonly<HitEffect>): readonly MoveRegion[] {
  return strikes.map((strike, index) => heroRegion(first + index, first + index, strike, effect, groundedEffect));
}

/** A cleaver swing: the blade from the haft outward to `reach`, one height per active frame. */
function cleave(first: number, heights: readonly number[], reach: number, effect: Readonly<HitEffect>): readonly MoveRegion[] {
  return path(first, heights.map(z => capsule(40.0, 70.0, f32(reach - BLADE_RADIUS), z)), effect);
}

// Body: the reference capsule scaled by the roster's 1.65 width and 1.35
// height, the largest target on the roster. The hands reach toward each
// cleaver swing, the hooves and horns are body and the tail lengthens with
// Tail Lash; the cleaver past the hands is the only disjoint.
const BODY_RADIUS = f32(24.0 * f32(1.65));
const BODY_TOP = f32(f32(4.0 + f32(HERO_REFERENCE_HEIGHT * f32(1.35))) - f32(2.0 * BODY_RADIUS));
const BODY = hurtPart(0.0, 4.0, 0.0, BODY_TOP, BODY_RADIUS);
const LIMB_RADIUS = 12.0;
const limb = (x1: number, z1: number, x2: number, z2: number, radius = LIMB_RADIUS): readonly HurtPart[] => [BODY, hurtPart(x1, z1, x2, z2, radius)];
/** The limb pose from two frames before the first active frame through two after the last. */
const reaching = (first: number, active: number, parts: readonly HurtPart[]) => [heroHurtPose(first - 2, first + active + 1, parts)];
const FORWARD_ARMS = limb(20.0, 80.0, 75.0, 72.0);
const RAISED_ARMS = limb(10.0, 120.0, 20.0, 175.0);
const HOOF = limb(20.0, 30.0, 80.0, 18.0, 14.0);
const HALF_TAIL = limb(-30.0, 40.0, -70.0, 36.0, 13.0);
const HALF_HOOVES = limb(0.0, 30.0, 3.0, -20.0, 16.0);

const PIT_LORD_BODY: FighterHurtboxes = {
  stand: [BODY],
  attacks: {
    [AttackStyle.jab]: reaching(7, 3, limb(20.0, 70.0, 60.0, 65.0)),
    [AttackStyle.jab2]: reaching(8, 3, limb(20.0, 80.0, 62.0, 66.0)),
    [AttackStyle.forwardTilt]: reaching(13, 4, FORWARD_ARMS),
    [AttackStyle.forwardTiltUp]: reaching(13, 4, FORWARD_ARMS),
    [AttackStyle.forwardTiltDown]: reaching(13, 4, FORWARD_ARMS),
    [AttackStyle.upTilt]: reaching(12, 5, RAISED_ARMS),
    [AttackStyle.downTilt]: reaching(10, 3, HOOF),
    [AttackStyle.dashAttack]: reaching(15, 6, limb(20.0, 50.0, 62.0, 60.0, 20.0)),
    [AttackStyle.forwardSmash]: reaching(27, 4, limb(20.0, 100.0, 85.0, 95.0)),
    [AttackStyle.upSmash]: reaching(24, 5, RAISED_ARMS),
    [AttackStyle.downSmash]: [
      heroHurtPose(20, 24, HOOF),
      heroHurtPose(25, 30, limb(-20.0, 30.0, -80.0, 18.0, 14.0)),
    ],
    [AttackStyle.neutralAir]: [
      heroHurtPose(10, 15, limb(20.0, 75.0, 70.0, 70.0)),
      heroHurtPose(16, 20, limb(-20.0, 75.0, -70.0, 70.0)),
    ],
    [AttackStyle.forwardAir]: reaching(19, 4, limb(20.0, 100.0, 80.0, 80.0)),
    // Tail Lash: the tail ramps out to the strike's base and back; it is body, not a disjoint.
    [AttackStyle.backAir]: [
      heroHurtPose(10, 13, HALF_TAIL),
      heroHurtPose(14, 17, limb(-30.0, 40.0, -f32(L - 30.0), 30.0, 13.0)),
      heroHurtPose(18, 20, HALF_TAIL),
    ],
    [AttackStyle.upAir]: reaching(11, 4, limb(0.0, 120.0, 10.0, f32(M + 70.0), 16.0)),
    // The hooves stamp down through a half-extended pose each way, so no frame jumps the body more than 60.
    [AttackStyle.downAir]: [
      heroHurtPose(16, 19, HALF_HOOVES),
      heroHurtPose(20, 25, limb(0.0, 30.0, 5.0, -62.0, 16.0)),
      heroHurtPose(26, 28, HALF_HOOVES),
    ],
    [AttackStyle.grab]: reaching(10, 3, limb(20.0, 60.0, 85.0, 58.0)),
  },
};

const NO_LAUNCH = { growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

const CLEAVING_SWEEP = heroMove(13, 4, 35, 0, cleave(13, [150.0, 100.0, 50.0, 10.0], XL, hit(12.0, "EDGE", 35)));

export const PIT_LORD_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: 1.25,
  maxPummels: 2,
  hurtboxes: PIT_LORD_BODY,
  normals: {
    // Haft Check: a slow close jab, not a long-range wall.
    [AttackStyle.jab]: jabStep(heroMove(7, 3, 19, 0, path(7, [
      capsule(30.0, 64.0, f32(M - 12.0), 64.0, 12.0),
      capsule(30.0, 60.0, f32(M - 12.0), 58.0, 12.0),
      capsule(30.0, 56.0, f32(M - 16.0), 52.0, 12.0),
    ], hit(6.0, "LINK", 35, 1.0, HitElement.normal)))),
    // Cleaver Chop: the chain's close finisher.
    [AttackStyle.jab2]: heroMove(8, 3, 22, 0, path(8, [
      capsule(30.0, 90.0, f32(M - 4.0), 70.0),
      capsule(30.0, 70.0, f32(M - 4.0), 50.0),
      capsule(30.0, 56.0, f32(M - 8.0), 36.0),
    ], hit(7.0, "POKE", 40))),
    // Cleaving Sweep: the main space claim; only the blade is disjoint. It falls
    // from over his horns to the floor, so every stick angle plays it
    // (smashcraft:docs/design/tilts.md, Ultimate's angling rule).
    [AttackStyle.forwardTilt]: CLEAVING_SWEEP,
    [AttackStyle.forwardTiltUp]: CLEAVING_SWEEP,
    [AttackStyle.forwardTiltDown]: CLEAVING_SWEEP,
    // Horn and Cleaver: a broad overhead arc whose low front is weak.
    [AttackStyle.upTilt]: heroMove(12, 5, 27, 0, path(12, [
      capsule(50.0, 110.0, 100.0, 150.0),
      capsule(30.0, 120.0, 50.0, f32(L + 40.0)),
      capsule(0.0, 120.0, 0.0, f32(L + 50.0)),
      capsule(-30.0, 120.0, -50.0, f32(L + 40.0)),
      capsule(-50.0, 110.0, -100.0, 150.0),
    ], hit(12.0, "LAUNCH", 85))),
    [AttackStyle.downTilt]: heroMove(10, 3, 24, 0, path(10, [
      capsule(30.0, 22.0, f32(M - 14.0), 14.0, 14.0),
      capsule(30.0, 18.0, f32(M - 14.0), 8.0, 14.0),
      capsule(30.0, 14.0, f32(M - 14.0), 4.0, 14.0),
    // Front Hoof: a semi-spike that sends a fighter at the edge low and outward.
    ], hit(10.0, "EDGE", 340, 1.0, HitElement.normal))),
    // Demonic Bulk: a body charge with no armor, the roster's strongest dash attack.
    [AttackStyle.dashAttack]: heroMove(15, 6, 34, 0, path(15, [
      capsule(20.0, 60.0, f32(L - 30.0), 60.0, 30.0),
      capsule(20.0, 60.0, f32(L - 30.0), 58.0, 30.0),
      capsule(20.0, 58.0, f32(L - 30.0), 56.0, 30.0),
      capsule(20.0, 56.0, f32(L - 32.0), 54.0, 28.0),
      capsule(20.0, 54.0, f32(L - 34.0), 52.0, 26.0),
      capsule(20.0, 52.0, f32(L - 36.0), 50.0, 24.0),
    ], hit(16.0, "KILL", 40, 1.0, HitElement.normal)), 40.0),
    // Annihilating Cleave: the cleaver's head is the sweetspot; the inner blade is listed first only after it.
    [AttackStyle.forwardSmash]: heroMove(27, 4, 43, 0, [
      ...[150.0, 100.0, 50.0, 10.0].map((z, index) => heroRegion(27 + index, 27 + index,
        capsule(f32(XL - 55.0), z, f32(XL - 14.0), f32(z - 10.0), 14.0), hit(25.0, "KILL", 40))),
      ...cleave(27, [150.0, 100.0, 50.0, 10.0], f32(XL - 50.0), hit(19.0, "KILL", 40)),
    ]),
    // Abyssal Lift: a tall, slow anti-air.
    [AttackStyle.upSmash]: heroMove(24, 5, 39, 0, path(24, [
      capsule(40.0, 90.0, 70.0, f32(XL - 10.0)),
      capsule(20.0, 100.0, 30.0, f32(XL + 20.0)),
      capsule(0.0, 100.0, 0.0, f32(XL + 30.0)),
      capsule(-20.0, 100.0, -30.0, f32(XL + 20.0)),
      capsule(-40.0, 90.0, -70.0, f32(XL - 10.0)),
    ], hit(22.0, "KILL", 85))),
    // Rear and Front Stomp: front f22-24, rear f26-28, one hit per target for the whole action.
    [AttackStyle.downSmash]: heroMove(22, 7, 41, 0, [
      ...path(22, [
        capsule(30.0, 14.0, f32(L - 14.0), 14.0, 14.0),
        capsule(30.0, 10.0, f32(L - 14.0), 10.0, 14.0),
        capsule(30.0, 8.0, f32(L - 14.0), 6.0, 14.0),
      ], hit(19.0, "EDGE", 25, 1.0, HitElement.normal)),
      ...path(26, [
        capsule(-30.0, 14.0, -f32(L - 14.0), 14.0, 14.0),
        capsule(-30.0, 10.0, -f32(L - 14.0), 10.0, 14.0),
        capsule(-30.0, 8.0, -f32(L - 14.0), 6.0, 14.0),
      ], hit(19.0, "EDGE", 25, -1.0, HitElement.normal)),
    ]),
    // Hellish Turn: the cleaver comes round the huge torso, front then back.
    [AttackStyle.neutralAir]: heroMove(12, 7, 29, 20, [
      ...path(12, [
        capsule(30.0, 60.0, f32(L - BLADE_RADIUS), 70.0),
        capsule(30.0, 90.0, f32(L - 20.0), 120.0),
        capsule(20.0, 110.0, 30.0, f32(L + 30.0)),
        capsule(0.0, 110.0, -20.0, f32(L + 30.0)),
      ], hit(13.0, "POKE", 50)),
      ...path(16, [
        capsule(-30.0, 90.0, -f32(L - 20.0), 120.0),
        capsule(-30.0, 60.0, -f32(L - BLADE_RADIUS), 70.0),
        capsule(-30.0, 40.0, -f32(L - BLADE_RADIUS), 30.0),
      ], hit(13.0, "POKE", 50, -1.0)),
    ]),
    // Falling Cleaver: a large slow arc, no meteor.
    [AttackStyle.forwardAir]: heroMove(19, 4, 36, 25, cleave(19, [130.0, 90.0, 50.0, 15.0], XL, hit(19.0, "KILL", 40))),
    // Tail Lash: the tail is body, so PIT_LORD_BODY extends it along this path.
    [AttackStyle.backAir]: heroMove(14, 4, 31, 20, path(14, [
      capsule(-30.0, 30.0, -f32(L - 14.0), 24.0, 14.0),
      capsule(-30.0, 34.0, -f32(L - 14.0), 34.0, 14.0),
      capsule(-30.0, 38.0, -f32(L - 14.0), 46.0, 14.0),
      capsule(-30.0, 40.0, -f32(L - 14.0), 56.0, 14.0),
    ], hit(15.0, "EDGE", 35, -1.0, HitElement.normal))),
    // Horn Thrust: a narrow overhead body attack; the horns are hittable.
    [AttackStyle.upAir]: heroMove(11, 4, 28, 18, path(11, [
      capsule(10.0, 130.0, 14.0, f32(M + 70.0), 18.0),
      capsule(5.0, 130.0, 7.0, f32(M + 75.0), 18.0),
      capsule(0.0, 130.0, 0.0, f32(M + 75.0), 18.0),
      capsule(-5.0, 130.0, -7.0, f32(M + 70.0), 18.0),
    ], hit(12.0, "LAUNCH", 85, 1.0, HitElement.normal))),
    // Four Hooves: a spike against an airborne target, 55 degrees against a grounded one; no shockwave.
    [AttackStyle.downAir]: heroMove(20, 5, 38, 28, path(20, [
      capsule(-20.0, 10.0, -20.0, -62.0, 18.0),
      capsule(-10.0, 10.0, -10.0, -62.0, 18.0),
      capsule(0.0, 10.0, 0.0, -62.0, 18.0),
      capsule(10.0, 10.0, 10.0, -62.0, 18.0),
      capsule(20.0, 10.0, 20.0, -62.0, 18.0),
    ], hit(18.0, "SPIKE", 270, 1.0, HitElement.normal), hit(18.0, "SPIKE", 55, 1.0, HitElement.normal))),
    // 10/3/32, one frame earlier than the brief's 11/3/31 with the same total, so it still catches a jump out of shield early in its ascent (#107).
    [AttackStyle.grab]: heroMove(10, 3, 32, 0, [heroRegion(10, 12,
      capsule(30.0, 58.0, f32(M - 12.0), 56.0, 12.0),
      { damage: 0.0, ...NO_LAUNCH })]),
  },
  throws: {
    // Horn jab: the shared 3 percent despite his size.
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 3.0, ...NO_LAUNCH } },
    [GrabAction.throwForward]: { contactFrame: 17, totalFrames: 44, effect: hit(11.0, "EDGE", 35, 1.0, HitElement.normal) },
    [GrabAction.throwBack]: { contactFrame: 22, totalFrames: 54, effect: hit(12.0, "KILL", 40, -1.0, HitElement.normal) },
    [GrabAction.throwUp]: { contactFrame: 20, totalFrames: 30, effect: hit(10.0, "JUGGLE", 85, 1.0, HitElement.normal) },
    [GrabAction.throwDown]: { contactFrame: 23, totalFrames: 50, effect: hit(8.0, "CHASE", 65, 1.0, HitElement.normal) },
  },
};

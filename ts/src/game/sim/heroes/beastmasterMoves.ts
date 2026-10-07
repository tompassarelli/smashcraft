import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../codes";
import { hurtCapsule } from "../../physics/contactGeometry";
import { HERO_REFERENCE_HEIGHT, jabStep, heroHurtPose, heroMove, heroRegion, type FighterMoves, type MoveRegion, type StrikeCapsule } from "../heroMoves";
import type { HitEffect } from "../hitRegions";
import { type FighterHurtboxes, type HurtPart, hurtPart } from "../hurtboxes";

// smashcraft:docs/design/roster.md "Beastmaster" supplies F/A/R/L, damage and
// outer reach. The axe paths and limb geometry are original and provisional.
export const S = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
export const M = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
export const L = f32(HERO_REFERENCE_HEIGHT * f32(1.10));
const AXE_RADIUS = 9.0;

// Provisional coefficients in the existing formula, shared with the other kits.
const CLASS = {
  LINK: { growth: 58.29999923706055, base: 12.0 },
  POKE: { growth: 79.5, base: 18.0 },
  LAUNCH: { growth: 111.29999542236328, base: 20.0 },
  EDGE: { growth: 116.5999984741211, base: 22.0 },
  KILL: { growth: 127.19999694824219, base: 26.0 },
  SPIKE: { growth: 106.0, base: 22.0 },
  // Throw roles (#107): an up throw's guaranteed short juggle and a down throw's tech chase.
  JUGGLE: { growth: 58.29999923706055, base: 50.0 },
  CHASE: { growth: 42.39999771118164, base: 75.0 },
} as const;
const ANGLE = {
  25: { x: f32(0.906307787), z: f32(0.422618262) },
  35: { x: f32(0.819152044), z: f32(0.573576436) },
  40: { x: f32(0.766044443), z: f32(0.642787610) },
  45: { x: f32(0.707106781), z: f32(0.707106781) },
  50: { x: f32(0.642787610), z: f32(0.766044443) },
  55: { x: f32(0.573576436), z: f32(0.819152044) },
  65: { x: f32(0.422618262), z: f32(0.906307787) },
  70: { x: f32(0.342020143), z: f32(0.939692621) },
  80: { x: f32(0.173648178), z: f32(0.984807753) },
  85: { x: f32(0.087155743), z: f32(0.996194698) },
  20: { x: f32(0.939692621), z: f32(0.342020143) },
  270: { x: 0.0, z: -1.0 },
} as const;

export function hit(damage: number, kind: keyof typeof CLASS, angle: keyof typeof ANGLE, facing = 1.0, element: HitElement = HitElement.slash): Readonly<HitEffect> {
  const strength = CLASS[kind];
  const direction = ANGLE[angle];
  return { damage, growth: strength.growth, base: strength.base, launchX: f32(direction.x * facing), launchZ: direction.z, electric: false, element };
}

export function capsule(x1: number, z1: number, x2: number, z2: number, radius = AXE_RADIUS): StrikeCapsule {
  return { x1, z1, x2, z2, radius };
}

function path(first: number, strikes: readonly StrikeCapsule[], effect: Readonly<HitEffect>, groundedEffect?: Readonly<HitEffect>): readonly MoveRegion[] {
  return strikes.map((strike, index) => heroRegion(first + index, first + index, strike, effect, groundedEffect));
}

/** An axe swing: the head from the hand out to `reach`, one height per active frame. */
function chop(first: number, heights: readonly number[], reach: number, effect: Readonly<HitEffect>): readonly MoveRegion[] {
  return path(first, heights.map(z => capsule(24.0, 55.0, f32(reach - AXE_RADIUS), z)), effect);
}

// Body: his standing hurt capsule (the roster's width and height). Arms reach toward each axe swing; Hunter's Boot is an exposed leg
// and Hunter's Shoulder strikes with the body. The axe heads are disjoint.
const BODY_RADIUS = hurtCapsule(Character.beastmaster).radius;
const BODY_TOP = hurtCapsule(Character.beastmaster).z2;
const BODY = hurtPart(0.0, 4.0, 0.0, BODY_TOP, BODY_RADIUS);
const LIMB_RADIUS = 10.0;
const limb = (x1: number, z1: number, x2: number, z2: number, radius = LIMB_RADIUS): readonly HurtPart[] => [BODY, hurtPart(x1, z1, x2, z2, radius)];
/** The limb pose from two frames before the first active frame through two after the last. */
const reaching = (first: number, active: number, parts: readonly HurtPart[]) => [heroHurtPose(first - 2, first + active + 1, parts)];
const FORWARD_ARM = limb(12.0, 65.0, 62.0, 58.0);
const RAISED_ARMS = limb(5.0, 100.0, 10.0, 150.0);
const HALF_BOOT = limb(-12.0, 34.0, -45.0, 34.0, 11.0);

const BEASTMASTER_BODY: FighterHurtboxes = {
  stand: [BODY],
  attacks: {
    [AttackStyle.jab]: reaching(4, 2, limb(12.0, 60.0, 48.0, 56.0)),
    [AttackStyle.jab2]: reaching(4, 2, limb(12.0, 60.0, 50.0, 58.0)),
    [AttackStyle.jab3]: reaching(6, 3, limb(10.0, 50.0, 46.0, 50.0, 16.0)),
    [AttackStyle.forwardTilt]: reaching(10, 3, FORWARD_ARM),
    [AttackStyle.forwardTiltUp]: reaching(10, 3, limb(12.0, 70.0, 58.0, 88.0)),
    [AttackStyle.forwardTiltDown]: reaching(10, 3, limb(12.0, 58.0, 58.0, 38.0)),
    [AttackStyle.upTilt]: reaching(9, 4, RAISED_ARMS),
    [AttackStyle.downTilt]: reaching(8, 3, limb(12.0, 35.0, 52.0, 18.0)),
    [AttackStyle.dashAttack]: reaching(11, 5, limb(10.0, 50.0, 48.0, 62.0, 18.0)),
    [AttackStyle.forwardSmash]: reaching(21, 4, limb(12.0, 85.0, 70.0, 80.0)),
    [AttackStyle.upSmash]: reaching(18, 5, RAISED_ARMS),
    [AttackStyle.downSmash]: [
      heroHurtPose(15, 19, limb(12.0, 40.0, 60.0, 20.0)),
      heroHurtPose(20, 24, limb(-12.0, 40.0, -60.0, 20.0)),
    ],
    [AttackStyle.neutralAir]: [
      heroHurtPose(6, 10, limb(12.0, 62.0, 55.0, 58.0)),
      heroHurtPose(11, 15, limb(-12.0, 62.0, -55.0, 58.0)),
    ],
    [AttackStyle.forwardAir]: reaching(13, 4, limb(12.0, 85.0, 65.0, 70.0)),
    // Hunter's Boot: the leg ramps out to the kick's base and back; it is body, not a disjoint.
    [AttackStyle.backAir]: [
      heroHurtPose(5, 8, HALF_BOOT),
      heroHurtPose(9, 13, limb(-12.0, 34.0, -f32(M - 24.0), 36.0, 11.0)),
      heroHurtPose(14, 16, HALF_BOOT),
    ],
    [AttackStyle.upAir]: reaching(8, 4, RAISED_ARMS),
    [AttackStyle.downAir]: reaching(16, 4, limb(5.0, 40.0, 5.0, -10.0)),
    [AttackStyle.grab]: reaching(8, 2, limb(12.0, 55.0, f32(S - 8.0), 52.0)),
  },
};

const NO_LAUNCH = { growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

export const BEASTMASTER_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: 1.25,
  maxPummels: 2,
  hurtboxes: BEASTMASTER_BODY,
  normals: {
    // Axe Hilt: a short hit.
    [AttackStyle.jab]: jabStep(heroMove(4, 2, 14, 0, path(4, [
      capsule(18.0, 58.0, f32(S - 9.0), 56.0, 9.0),
      capsule(18.0, 56.0, f32(S - 9.0), 52.0, 9.0),
    ], hit(4.239999771118164, "LINK", 35, 1.0, HitElement.normal)))),
    // The other axe's hilt, then a shoulder that shoves.
    [AttackStyle.jab2]: jabStep(heroMove(4, 2, 14, 0, path(4, [
      capsule(18.0, 60.0, f32(S - 6.0), 58.0, 9.0),
      capsule(18.0, 58.0, f32(S - 6.0), 54.0, 9.0),
    ], hit(3.179999828338623, "LINK", 70, 1.0, HitElement.normal)))),
    [AttackStyle.jab3]: heroMove(6, 3, 19, 0, path(6, [
      capsule(10.0, 40.0, f32(S + 6.0), 50.0, 14.0),
      capsule(10.0, 40.0, f32(S + 8.0), 48.0, 14.0),
      capsule(10.0, 40.0, f32(S + 4.0), 46.0, 14.0),
    ], hit(6.359999656677246, "POKE", 40, 1.0, HitElement.normal))),
    // Broad Axe: the axe head is the disjoint.
    [AttackStyle.forwardTilt]: heroMove(10, 3, 23, 0, chop(10, [75.0, 50.0, 28.0], L, hit(11.65999984741211, "EDGE", 35))),
    [AttackStyle.forwardTiltUp]: heroMove(10, 3, 23, 0, chop(10, [115.0, 135.0, 150.0], L, hit(11.65999984741211, "EDGE", 50))),
    [AttackStyle.forwardTiltDown]: heroMove(10, 3, 23, 0, chop(10, [10.0, -10.0, -30.0], L, hit(11.65999984741211, "EDGE", 20))),
    // Antler Lift: the axe rises above the shoulder.
    [AttackStyle.upTilt]: heroMove(9, 4, 23, 0, path(9, [
      capsule(25.0, 70.0, 55.0, 105.0),
      capsule(15.0, 80.0, 22.0, f32(M + 40.0)),
      capsule(0.0, 80.0, 0.0, f32(M + 45.0)),
      capsule(-15.0, 80.0, -28.0, f32(M + 35.0)),
    ], hit(9.539999961853027, "LAUNCH", 85))),
    // Low Chop: a short axe sweep at the shins that pops the victim the same
    // height at every percent (no growth), so the bear's follow-up holds.
    [AttackStyle.downTilt]: heroMove(8, 3, 22, 0, path(8, [
      capsule(20.0, 16.0, f32(M - AXE_RADIUS), 14.0),
      capsule(20.0, 12.0, f32(M - AXE_RADIUS), 8.0),
      capsule(20.0, 10.0, f32(M - AXE_RADIUS), 4.0),
    ], { ...hit(7.419999599456787, "LINK", 80), growth: 0.0, base: 45.0 })),
    // Hunter's Shoulder: the body advances 0.5H behind the shoulder and heaves
    // the victim over it, launching it behind him: the chase turns toward his bear.
    [AttackStyle.dashAttack]: heroMove(11, 5, 28, 0, path(11, [
      capsule(10.0, 55.0, f32(M - 22.0), 60.0, 22.0),
      capsule(10.0, 55.0, f32(M - 22.0), 58.0, 22.0),
      capsule(10.0, 54.0, f32(M - 22.0), 56.0, 22.0),
      capsule(10.0, 52.0, f32(M - 24.0), 54.0, 20.0),
      capsule(10.0, 50.0, f32(M - 26.0), 52.0, 18.0),
    ], hit(12.719999313354492, "LAUNCH", 45, -1.0, HitElement.normal)), f32(HERO_REFERENCE_HEIGHT * f32(0.5))),
    // Twin Axe Hew: both axes strike as one action.
    [AttackStyle.forwardSmash]: heroMove(21, 4, 36, 0, chop(21, [120.0, 85.0, 50.0, 20.0], L, hit(21.19999885559082, "KILL", 40))),
    // Hunting Horns: twin upward arcs.
    [AttackStyle.upSmash]: heroMove(18, 5, 33, 0, path(18, [
      capsule(30.0, 80.0, 55.0, f32(L - 10.0)),
      capsule(15.0, 85.0, 22.0, f32(L + 20.0)),
      capsule(0.0, 85.0, 0.0, f32(L + 25.0)),
      capsule(-15.0, 85.0, -22.0, f32(L + 20.0)),
      capsule(-30.0, 80.0, -55.0, f32(L - 10.0)),
    ], hit(18.01999855041504, "KILL", 85))),
    // Clearing Sweep: front, then back.
    [AttackStyle.downSmash]: heroMove(17, 6, 34, 0, [
      ...path(17, [
        capsule(22.0, 18.0, f32(L - AXE_RADIUS), 20.0),
        capsule(22.0, 12.0, f32(L - AXE_RADIUS), 10.0),
        capsule(22.0, 10.0, f32(L - AXE_RADIUS), 2.0),
      ], hit(15.899999618530273, "EDGE", 25)),
      ...path(20, [
        capsule(-22.0, 18.0, -f32(L - AXE_RADIUS), 20.0),
        capsule(-22.0, 12.0, -f32(L - AXE_RADIUS), 10.0),
        capsule(-22.0, 10.0, -f32(L - AXE_RADIUS), 2.0),
      ], hit(15.899999618530273, "EDGE", 25, -1.0)),
    ]),
    // Axe Circle: one hit around the torso.
    [AttackStyle.neutralAir]: heroMove(8, 6, 23, 15, [
      ...path(8, [
        capsule(20.0, 40.0, f32(M - AXE_RADIUS), 40.0),
        capsule(15.0, 60.0, 65.0, 95.0),
        capsule(0.0, 65.0, 0.0, f32(M + 20.0)),
      ], hit(10.59999942779541, "POKE", 50)),
      ...path(11, [
        capsule(-15.0, 60.0, -65.0, 95.0),
        capsule(-20.0, 40.0, -f32(M - AXE_RADIUS), 40.0),
        capsule(-15.0, 20.0, -60.0, 0.0),
      ], hit(10.59999942779541, "POKE", 50, -1.0)),
    ]),
    // Overhand Chop: a slow weapon arc.
    [AttackStyle.forwardAir]: heroMove(13, 4, 28, 18, chop(13, [110.0, 75.0, 40.0, 10.0], L, hit(14.839999198913574, "KILL", 40))),
    // Hunter's Boot: an exposed leg, so BEASTMASTER_BODY extends it along this path.
    [AttackStyle.backAir]: heroMove(9, 3, 24, 14, path(9, [
      capsule(-12.0, 28.0, -f32(M - 12.0), 30.0, 12.0),
      capsule(-12.0, 32.0, -f32(M - 12.0), 40.0, 12.0),
      capsule(-12.0, 34.0, -f32(M - 12.0), 50.0, 12.0),
    ], hit(11.65999984741211, "EDGE", 35, -1.0, HitElement.normal))),
    // Axe Lift: narrow, above.
    [AttackStyle.upAir]: heroMove(8, 4, 23, 14, path(8, [
      capsule(8.0, 80.0, 14.0, f32(M + 45.0)),
      capsule(0.0, 80.0, 0.0, f32(M + 50.0)),
      capsule(-8.0, 80.0, -14.0, f32(M + 45.0)),
      capsule(-12.0, 75.0, -30.0, f32(M + 30.0)),
    ], hit(9.539999961853027, "LAUNCH", 85))),
    // Downward Hew: a spike against an airborne target, 55 degrees against a grounded one; no forced descent.
    [AttackStyle.downAir]: heroMove(16, 4, 32, 22, path(16, [
      capsule(10.0, 10.0, 20.0, -f32(M - 30.0)),
      capsule(5.0, 10.0, 10.0, -f32(M - 25.0)),
      capsule(0.0, 10.0, 0.0, -f32(M - 25.0)),
      capsule(-5.0, 10.0, -10.0, -f32(M - 30.0)),
    ], hit(13.779999732971191, "SPIKE", 270), hit(13.779999732971191, "SPIKE", 55))),
    [AttackStyle.grab]: heroMove(8, 2, 25, 0, [heroRegion(8, 9,
      capsule(18.0, 52.0, f32(f32(HERO_REFERENCE_HEIGHT * f32(0.60)) - 10.0), 50.0, 10.0),
      { damage: 0.0, ...NO_LAUNCH })]),
  },
  throws: {
    // Axe-hilt strike: the shared 3 percent.
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 3.179999828338623, ...NO_LAUNCH } },
    [GrabAction.throwForward]: { contactFrame: 13, totalFrames: 35, effect: hit(8.479999542236328, "EDGE", 35, 1.0, HitElement.normal) },
    [GrabAction.throwBack]: { contactFrame: 17, totalFrames: 43, effect: hit(9.539999961853027, "EDGE", 40, -1.0, HitElement.normal) },
    [GrabAction.throwUp]: { contactFrame: 15, totalFrames: 24, effect: hit(7.419999599456787, "JUGGLE", 85, 1.0, HitElement.normal) },
    [GrabAction.throwDown]: { contactFrame: 19, totalFrames: 44, effect: hit(6.359999656677246, "CHASE", 25, 1.0, HitElement.normal) },
  },
};

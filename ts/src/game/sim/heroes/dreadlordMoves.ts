import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction } from "../codes";
import { HERO_REFERENCE_HEIGHT, heroMove, heroRegion, type FighterMoves, type MoveRegion, type StrikeCapsule } from "../heroMoves";
import { HitElement, type HitEffect } from "../hitRegions";

// smashcraft:docs/design/roster.md supplies timing, damage and outer reach.
// These original limb paths require matching exposed hurt volumes in poses.
const S = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
const M = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
const L = f32(HERO_REFERENCE_HEIGHT * f32(1.10));
const GRAB = f32(HERO_REFERENCE_HEIGHT * f32(0.65));
const CLAW_RADIUS = 10.0;
const WING_RADIUS = 12.0;

// Provisional hypotheses in the existing knockback formula, not measured
// displacement bands or guaranteed follow-ups.
const CLASS = {
  LINK: { growth: 55.0, base: 12.0 },
  POKE: { growth: 75.0, base: 18.0 },
  LAUNCH: { growth: 95.0, base: 20.0 },
  EDGE: { growth: 100.0, base: 22.0 },
  KILL: { growth: 110.0, base: 26.0 },
  SPIKE: { growth: 100.0, base: 22.0 },
} as const;
const DIRECTION = {
  25: { x: f32(0.906307787), z: f32(0.422618262) },
  35: { x: f32(0.819152044), z: f32(0.573576436) },
  40: { x: f32(0.766044443), z: f32(0.642787610) },
  50: { x: f32(0.642787610), z: f32(0.766044443) },
  55: { x: f32(0.573576436), z: f32(0.819152044) },
  65: { x: f32(0.422618262), z: f32(0.906307787) },
  70: { x: f32(0.342020143), z: f32(0.939692621) },
  85: { x: f32(0.087155743), z: f32(0.996194698) },
  270: { x: 0.0, z: -1.0 },
} as const;

function hit(damage: number, kind: keyof typeof CLASS, angle: keyof typeof DIRECTION, facing = 1.0): Readonly<HitEffect> {
  const tuning = CLASS[kind];
  const direction = DIRECTION[angle];
  return { damage, growth: tuning.growth, base: tuning.base, launchX: f32(direction.x * facing), launchZ: direction.z, electric: false, element: HitElement.slash };
}

function capsule(x1: number, z1: number, x2: number, z2: number, radius = CLAW_RADIUS): StrikeCapsule {
  return { x1, z1, x2, z2, radius };
}

/** One narrow limb position per active tick; all contacts share one window. */
function path(first: number, strikes: readonly StrikeCapsule[], effect: Readonly<HitEffect>, groundedEffect?: Readonly<HitEffect>): readonly MoveRegion[] {
  return strikes.map((strike, index) => heroRegion(first + index, first + index, strike, effect, groundedEffect));
}

function rake(first: number, heights: readonly number[], reach: number, effect: Readonly<HitEffect>, facing = 1.0): readonly MoveRegion[] {
  return path(first, heights.map(height => capsule(f32(18.0 * facing), 46.0, f32(f32(reach - CLAW_RADIUS) * facing), height)), effect);
}

function wingSweep(first: number, facing: number): readonly MoveRegion[] {
  return path(first, [
    capsule(f32(16.0 * facing), 24.0, f32(f32(L - WING_RADIUS) * facing), 22.0, WING_RADIUS),
    capsule(f32(16.0 * facing), 20.0, f32(f32(L - WING_RADIUS) * facing), 12.0, WING_RADIUS),
    capsule(f32(16.0 * facing), 16.0, f32(f32(L - WING_RADIUS) * facing), 2.0, WING_RADIUS),
  ], hit(14.0, "EDGE", 25, facing));
}

const NO_LAUNCH = { growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

export const DREADLORD_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: 1.25,
  maxPummels: 2,
  normals: {
    [AttackStyle.jab]: heroMove(5, 2, 15, 0, rake(5, [46.0, 40.0], S, hit(4.0, "POKE", 35))),
    [AttackStyle.forwardTilt]: heroMove(9, 3, 22, 0, rake(9, [62.0, 46.0, 30.0], M, hit(10.0, "EDGE", 35))),
    [AttackStyle.forwardTiltUp]: heroMove(9, 3, 22, 0, rake(9, [95.0, 82.0, 70.0], M, hit(10.0, "EDGE", 35))),
    [AttackStyle.forwardTiltDown]: heroMove(9, 3, 22, 0, rake(9, [20.0, 8.0, -4.0], M, hit(10.0, "EDGE", 35))),
    [AttackStyle.upTilt]: heroMove(8, 4, 22, 0, path(8, [
      capsule(18.0, 60.0, 68.0, 78.0, WING_RADIUS),
      capsule(12.0, 68.0, 35.0, f32(M - WING_RADIUS), WING_RADIUS),
      capsule(0.0, 70.0, -10.0, f32(M - WING_RADIUS), WING_RADIUS),
      capsule(-12.0, 65.0, -55.0, 85.0, WING_RADIUS),
    ], hit(9.0, "LAUNCH", 85))),
    [AttackStyle.downTilt]: heroMove(7, 3, 20, 0, path(7, [
      capsule(16.0, 16.0, f32(M - CLAW_RADIUS), 16.0),
      capsule(16.0, 12.0, f32(M - CLAW_RADIUS), 8.0),
      capsule(16.0, 8.0, f32(M - CLAW_RADIUS), 0.0),
    ], hit(6.0, "LINK", 70))),
    [AttackStyle.dashAttack]: heroMove(10, 5, 27, 0, path(10, [
      capsule(12.0, 42.0, f32(M - 14.0), 50.0, 14.0),
      capsule(12.0, 42.0, f32(M - 14.0), 46.0, 14.0),
      capsule(12.0, 42.0, f32(M - 14.0), 42.0, 14.0),
      capsule(12.0, 42.0, f32(M - 14.0), 38.0, 14.0),
      capsule(12.0, 42.0, f32(M - 14.0), 34.0, 14.0),
    ], hit(11.0, "LAUNCH", 50)), f32(HERO_REFERENCE_HEIGHT * 0.5)),
    [AttackStyle.forwardSmash]: heroMove(18, 4, 34, 0, [
      ...rake(18, [70.0, 58.0, 46.0, 34.0], L, hit(18.0, "KILL", 40)),
      ...rake(18, [22.0, 34.0, 46.0, 58.0], L, hit(18.0, "KILL", 40)),
    ]),
    [AttackStyle.upSmash]: heroMove(16, 5, 31, 0, path(16, [
      capsule(20.0, 58.0, 70.0, 95.0, WING_RADIUS),
      capsule(12.0, 68.0, 38.0, 125.0, WING_RADIUS),
      capsule(0.0, 75.0, 0.0, f32(L - WING_RADIUS), WING_RADIUS),
      capsule(-12.0, 68.0, -38.0, 125.0, WING_RADIUS),
      capsule(-20.0, 58.0, -70.0, 95.0, WING_RADIUS),
    ], hit(16.0, "KILL", 85))),
    [AttackStyle.downSmash]: heroMove(15, 6, 32, 0, [...wingSweep(15, 1.0), ...wingSweep(18, -1.0)]),
    [AttackStyle.neutralAir]: heroMove(7, 6, 22, 14, [
      ...path(7, [
        capsule(16.0, 30.0, f32(M - WING_RADIUS), 30.0, WING_RADIUS),
        capsule(12.0, 48.0, 68.0, 80.0, WING_RADIUS),
        capsule(0.0, 65.0, 18.0, f32(M - WING_RADIUS), WING_RADIUS),
      ], hit(9.0, "POKE", 50)),
      ...path(10, [
        capsule(-12.0, 52.0, -68.0, 80.0, WING_RADIUS),
        capsule(-16.0, 32.0, -f32(M - WING_RADIUS), 32.0, WING_RADIUS),
        capsule(-10.0, 18.0, -70.0, 8.0, WING_RADIUS),
      ], hit(9.0, "POKE", 50, -1.0)),
    ]),
    [AttackStyle.forwardAir]: heroMove(10, 4, 24, 15, rake(10, [64.0, 52.0, 40.0, 28.0], L, hit(12.0, "EDGE", 40))),
    [AttackStyle.backAir]: heroMove(9, 4, 25, 15, path(9, [
      capsule(-16.0, 54.0, -f32(L - WING_RADIUS), 68.0, WING_RADIUS),
      capsule(-16.0, 46.0, -f32(L - WING_RADIUS), 52.0, WING_RADIUS),
      capsule(-16.0, 38.0, -f32(L - WING_RADIUS), 36.0, WING_RADIUS),
      capsule(-16.0, 30.0, -f32(L - WING_RADIUS), 20.0, WING_RADIUS),
    ], hit(13.0, "KILL", 35, -1.0))),
    [AttackStyle.upAir]: heroMove(7, 3, 21, 12, path(7, [
      capsule(0.0, 68.0, 8.0, f32(M - 12.0), 12.0),
      capsule(0.0, 68.0, 0.0, f32(M - 12.0), 12.0),
      capsule(0.0, 68.0, -8.0, f32(M - 12.0), 12.0),
    ], hit(8.0, "LAUNCH", 85))),
    [AttackStyle.downAir]: heroMove(14, 4, 29, 20, path(14, [
      capsule(12.0, 0.0, 12.0, -f32(M - CLAW_RADIUS)),
      capsule(8.0, 0.0, 8.0, -f32(M - CLAW_RADIUS)),
      capsule(4.0, 0.0, 4.0, -f32(M - CLAW_RADIUS)),
      capsule(0.0, 0.0, 0.0, -f32(M - CLAW_RADIUS)),
    ], hit(12.0, "SPIKE", 270), hit(12.0, "SPIKE", 55))),
    [AttackStyle.grab]: heroMove(7, 3, 26, 0, path(7, [
      capsule(14.0, 35.0, f32(GRAB - 12.0), 40.0, 12.0),
      capsule(14.0, 35.0, f32(GRAB - 12.0), 35.0, 12.0),
      capsule(14.0, 35.0, f32(GRAB - 12.0), 30.0, 12.0),
    ], { damage: 0.0, ...NO_LAUNCH })),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 1.0, ...NO_LAUNCH } },
    [GrabAction.throwForward]: { contactFrame: 12, totalFrames: 32, effect: hit(8.0, "EDGE", 35) },
    [GrabAction.throwBack]: { contactFrame: 18, totalFrames: 43, effect: hit(10.0, "KILL", 40, -1.0) },
    [GrabAction.throwUp]: { contactFrame: 15, totalFrames: 36, effect: hit(7.0, "LAUNCH", 85) },
    [GrabAction.throwDown]: { contactFrame: 19, totalFrames: 44, effect: hit(6.0, "LINK", 65) },
  },
};

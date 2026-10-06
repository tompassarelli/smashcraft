import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction } from "../codes";
import { HERO_REFERENCE_HEIGHT, heroMove, heroRegion, type FighterMoves, type MoveRegion, type StrikeCapsule } from "../heroMoves";
import { HitElement, type HitEffect } from "../hitRegions";

// smashcraft:docs/design/roster.md counts reach from the fighter center.
const S = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
const M = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
const L = f32(HERO_REFERENCE_HEIGHT * f32(1.10));
const GRAB = f32(HERO_REFERENCE_HEIGHT * f32(0.48));
const BLADE_RADIUS = 6.0;

// Provisional class coefficients in the existing knockback formula. The
// roster's displacement bands remain calibration targets, not observations.
const CLASS = {
  LINK: { growth: 55.0, base: 12.0 },
  POKE: { growth: 75.0, base: 18.0 },
  LAUNCH: { growth: 95.0, base: 20.0 },
  EDGE: { growth: 100.0, base: 22.0 },
  KILL: { growth: 110.0, base: 26.0 },
  SPIKE: { growth: 100.0, base: 22.0 },
} as const;
const ANGLES = {
  25: { x: f32(0.906307787), z: f32(0.422618262) },
  35: { x: f32(0.819152044), z: f32(0.573576436) },
  40: { x: f32(0.766044443), z: f32(0.642787610) },
  50: { x: f32(0.642787610), z: f32(0.766044443) },
  55: { x: f32(0.573576436), z: f32(0.819152044) },
  60: { x: 0.5, z: f32(0.866025404) },
  70: { x: f32(0.342020143), z: f32(0.939692621) },
  85: { x: f32(0.087155743), z: f32(0.996194698) },
  90: { x: 0.0, z: 1.0 },
  270: { x: 0.0, z: -1.0 },
} as const;

function hit(damage: number, kind: keyof typeof CLASS, angle: keyof typeof ANGLES, facing = 1.0): Readonly<HitEffect> {
  const strength = CLASS[kind];
  const direction = ANGLES[angle];
  return { damage, growth: strength.growth, base: strength.base, launchX: f32(direction.x * facing), launchZ: direction.z, electric: false, element: HitElement.slash };
}

const blade = (x1: number, z1: number, x2: number, z2: number, radius = BLADE_RADIUS): StrikeCapsule => ({ x1, z1, x2, z2, radius });
function path(first: number, strikes: readonly StrikeCapsule[], effect: Readonly<HitEffect>, groundedEffect?: Readonly<HitEffect>): readonly MoveRegion[] {
  return strikes.map((strike, index) => heroRegion(first + index, first + index, strike, effect, groundedEffect));
}

/** One narrow blade position per frame; the end of the blade has priority. */
function cut(first: number, heights: readonly number[], reach: number, inner: Readonly<HitEffect>, tip?: Readonly<HitEffect>, facing = 1.0): readonly MoveRegion[] {
  const regions: MoveRegion[] = [];
  const end = f32(reach - BLADE_RADIUS);
  const boundary = f32(reach - 30.0);
  for (let index = 0; index < heights.length; index++) {
    const height = heights[index];
    if (height === undefined) continue;
    const frame = first + index;
    const rise = f32(height - 45.0);
    const zAt = (x: number) => f32(45.0 + f32(rise * f32(x / end)));
    if (tip !== undefined) {
      const tipStart = f32(boundary + BLADE_RADIUS);
      regions.push(heroRegion(frame, frame, blade(f32(tipStart * facing), zAt(tipStart), f32(end * facing), height), tip));
    }
    const innerEnd = tip === undefined ? end : boundary;
    regions.push(heroRegion(frame, frame, blade(f32(18.0 * facing), zAt(18.0), f32(innerEnd * facing), zAt(innerEnd)), inner));
  }
  return regions;
}

function throwMove(release: number, recovery: number, damage: number, kind: keyof typeof CLASS, angle: keyof typeof ANGLES, facing = 1.0) {
  return { contactFrame: release, totalFrames: release + recovery, effect: hit(damage, kind, angle, facing) };
}

const BACK_AIR = hit(11.0, "KILL", 35, -1.0);
const DOWN_AIR = hit(11.0, "SPIKE", 270);
const DOWN_AIR_GROUNDED = hit(11.0, "SPIKE", 55);
const GRAB_EFFECT = { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

export const WARDEN_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: 1.25,
  maxPummels: 2,
  normals: {
    [AttackStyle.jab]: heroMove(3, 2, 13, 0, cut(3, [44.0, 48.0], S, hit(3.0, "POKE", 35))),
    [AttackStyle.forwardTilt]: heroMove(7, 3, 18, 0, cut(7, [58.0, 45.0, 32.0], M, hit(8.0, "POKE", 35))),
    [AttackStyle.forwardTiltUp]: heroMove(7, 3, 18, 0, cut(7, [85.0, 100.0, 112.0], M, hit(8.0, "POKE", 35))),
    [AttackStyle.forwardTiltDown]: heroMove(7, 3, 18, 0, cut(7, [16.0, 0.0, -16.0], M, hit(8.0, "POKE", 35))),
    [AttackStyle.upTilt]: heroMove(6, 4, 18, 0, path(6, [
      blade(18.0, 40.0, f32(M - BLADE_RADIUS), 55.0),
      blade(16.0, 48.0, 70.0, 84.0),
      blade(8.0, 54.0, 35.0, f32(M - BLADE_RADIUS)),
      blade(0.0, 54.0, -8.0, f32(M - BLADE_RADIUS)),
    ], hit(7.0, "LINK", 85))),
    [AttackStyle.downTilt]: heroMove(5, 2, 17, 0, path(5, [
      blade(16.0, 9.0, f32(M - BLADE_RADIUS), 9.0),
      blade(16.0, 6.0, f32(M - BLADE_RADIUS), 6.0),
    ], hit(5.0, "LINK", 70))),
    [AttackStyle.dashAttack]: heroMove(8, 4, 24, 0, cut(8, [26.0, 42.0, 58.0, 74.0], M, hit(9.0, "LAUNCH", 60)), f32(HERO_REFERENCE_HEIGHT * f32(0.60)), true),
    [AttackStyle.forwardSmash]: heroMove(15, 3, 30, 0, cut(15, [64.0, 45.0, 26.0], L, hit(12.0, "KILL", 40), hit(16.0, "KILL", 40))),
    [AttackStyle.upSmash]: heroMove(13, 4, 27, 0, path(13, [
      blade(12.0, 46.0, 24.0, f32(M - BLADE_RADIUS)),
      blade(8.0, 46.0, 10.0, f32(M - BLADE_RADIUS)),
      blade(0.0, 46.0, -10.0, f32(M - BLADE_RADIUS)),
      blade(-8.0, 46.0, -24.0, f32(M - BLADE_RADIUS)),
    ], hit(14.0, "KILL", 90))),
    [AttackStyle.downSmash]: heroMove(12, 5, 28, 0, [
      ...path(12, [
        blade(18.0, 16.0, f32(M - BLADE_RADIUS), 16.0),
        blade(18.0, 8.0, f32(M - BLADE_RADIUS), 8.0),
        blade(18.0, 2.0, 84.0, 2.0),
      ], hit(12.0, "EDGE", 25)),
      ...path(15, [
        blade(-18.0, 12.0, -f32(M - BLADE_RADIUS), 12.0),
        blade(-18.0, 4.0, -f32(M - BLADE_RADIUS), 4.0),
      ], hit(12.0, "EDGE", 25, -1.0)),
    ]),
    [AttackStyle.neutralAir]: heroMove(5, 5, 18, 10, path(5, [
      blade(18.0, 35.0, f32(M - BLADE_RADIUS), 35.0),
      blade(12.0, 50.0, 62.0, 85.0),
      blade(0.0, 52.0, 0.0, f32(M - BLADE_RADIUS)),
      blade(-12.0, 50.0, -62.0, 85.0),
      blade(-18.0, 35.0, -f32(M - BLADE_RADIUS), 35.0),
    ], hit(6.0, "POKE", 50))),
    [AttackStyle.forwardAir]: heroMove(8, 3, 20, 12, cut(8, [64.0, 45.0, 26.0], M, hit(10.0, "EDGE", 40))),
    // The exposed leg remains inside the body. Only the heel blade extends.
    [AttackStyle.backAir]: heroMove(7, 3, 22, 12, [
      ...cut(7, [54.0, 45.0, 36.0], M, BACK_AIR, undefined, -1.0),
      heroRegion(7, 9, blade(-8.0, 42.0, -16.0, 38.0, 8.0), BACK_AIR),
    ]),
    [AttackStyle.upAir]: heroMove(5, 3, 17, 10, path(5, [
      blade(0.0, 48.0, 0.0, f32(M - BLADE_RADIUS)),
      blade(4.0, 48.0, 4.0, f32(M - BLADE_RADIUS)),
      blade(-4.0, 48.0, -4.0, f32(M - BLADE_RADIUS)),
    ], hit(7.0, "LAUNCH", 85))),
    [AttackStyle.downAir]: heroMove(12, 3, 27, 19, path(12, [
      blade(0.0, -18.0, 0.0, -f32(M - BLADE_RADIUS)),
      blade(2.0, -18.0, 2.0, -f32(M - BLADE_RADIUS)),
      blade(-2.0, -18.0, -2.0, -f32(M - BLADE_RADIUS)),
    ], DOWN_AIR, DOWN_AIR_GROUNDED)),
    [AttackStyle.grab]: heroMove(6, 2, 22, 0, [heroRegion(6, 7,
      blade(16.0, 45.0, f32(GRAB - 10.0), 45.0, 10.0), GRAB_EFFECT)]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 1.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } },
    [GrabAction.throwForward]: throwMove(10, 18, 6.0, "EDGE", 35),
    [GrabAction.throwBack]: throwMove(14, 21, 7.0, "EDGE", 40, -1.0),
    [GrabAction.throwUp]: throwMove(11, 16, 5.0, "LAUNCH", 85),
    [GrabAction.throwDown]: throwMove(14, 20, 4.0, "LINK", 70),
  },
};

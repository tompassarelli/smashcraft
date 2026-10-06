import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction, HitElement } from "../codes";
import { type AuthoredThrow, type FighterMoves, type MoveRegion, type StrikeCapsule, HERO_REFERENCE_HEIGHT, heroHurtPose, heroMove, heroRegion } from "../heroMoves";
import { type FighterHurtboxes, type HurtPart, hurtPart } from "../hurtboxes";
import type { HitEffect } from "../hitRegions";

// smashcraft:docs/design/roster.md uses Archer's standing outer capsule height.
export const H = HERO_REFERENCE_HEIGHT;
export const length = (heights: number) => f32(H * heights);
export const S = length(f32(0.55));
export const M = length(f32(0.80));
export const L = length(f32(1.10));
export const XL = length(f32(1.40));
const TIP_LENGTH = length(f32(0.20));
export const BLADE_RADIUS = 6.0;

// Provisional class hypotheses, consumed by the existing knockback formula;
// the roster's displacement bands are calibration targets, not measured results.
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
  45: { x: f32(0.707106781), z: f32(0.707106781) },
  50: { x: f32(0.642787610), z: f32(0.766044443) },
  55: { x: f32(0.573576436), z: f32(0.819152044) },
  65: { x: f32(0.422618262), z: f32(0.906307787) },
  75: { x: f32(0.258819045), z: f32(0.965925826) },
  80: { x: f32(0.173648178), z: f32(0.984807753) },
  85: { x: f32(0.087155743), z: f32(0.996194698) },
  90: { x: 0.0, z: 1.0 },
  270: { x: 0.0, z: -1.0 },
} as const;

export function hit(damage: number, kind: keyof typeof CLASS, angle: keyof typeof ANGLE, facing = 1.0): Readonly<HitEffect> {
  const tuning = CLASS[kind];
  const direction = ANGLE[angle];
  return { damage, growth: tuning.growth, base: tuning.base, launchX: f32(direction.x * facing), launchZ: direction.z, electric: false, element: HitElement.slash };
}

export function capsule(x1: number, z1: number, x2: number, z2: number, radius = BLADE_RADIUS): StrikeCapsule {
  return { x1, z1, x2, z2, radius };
}

/** Each entry is one blade position, never the filled bounding box of an arc. */
export function path(firstFrame: number, strikes: readonly StrikeCapsule[], effect: Readonly<HitEffect>): readonly MoveRegion[] {
  return strikes.map((strike, index) => heroRegion(firstFrame + index, firstFrame + index, strike, effect));
}

/** Tip is ordered first so its reward wins an overlap with the inner blade. */
export function cut(firstFrame: number, tipHeights: readonly number[], reach: number, inner: Readonly<HitEffect>, tip?: Readonly<HitEffect>, facing = 1.0): readonly MoveRegion[] {
  const regions: MoveRegion[] = [];
  const endX = f32(reach - BLADE_RADIUS);
  const boundary = f32(reach - TIP_LENGTH);
  const startTipX = f32(boundary + BLADE_RADIUS);
  const endInnerX = tip === undefined ? endX : boundary;
  for (let index = 0; index < tipHeights.length; index++) {
    const tipHeight = tipHeights[index];
    if (tipHeight === undefined) continue;
    const frame = firstFrame + index;
    const rise = f32(tipHeight - 45.0);
    const heightAt = (x: number) => f32(45.0 + f32(rise * f32(x / endX)));
    if (tip !== undefined) regions.push(heroRegion(frame, frame,
      capsule(f32(startTipX * facing), heightAt(startTipX), f32(endX * facing), tipHeight), tip));
    regions.push(heroRegion(frame, frame,
      capsule(f32(18.0 * facing), heightAt(18.0), f32(endInnerX * facing), heightAt(endInnerX)), inner));
  }
  return regions;
}

function lowSweep(firstFrame: number, facing: number): readonly MoveRegion[] {
  return path(firstFrame, [
    capsule(f32(18.0 * facing), 14.0, f32(f32(L - BLADE_RADIUS) * facing), 14.0),
    capsule(f32(18.0 * facing), 8.0, f32(f32(L - BLADE_RADIUS) * facing), 8.0),
    capsule(f32(18.0 * facing), 2.0, f32(f32(L - BLADE_RADIUS) * facing), 2.0),
  ], hit(14.0, "EDGE", 25, facing));
}

const downAir: MoveRegion[] = [];
for (let frame = 13; frame <= 16; frame++) {
  const x = f32((frame - 13) * 2.0);
  downAir.push(heroRegion(frame, frame,
    capsule(x, -f32(M - TIP_LENGTH), x, -f32(M - BLADE_RADIUS)), hit(12.0, "SPIKE", 270), hit(12.0, "SPIKE", 55)));
  downAir.push(heroRegion(frame, frame,
    capsule(x, -18.0, x, -f32(M - TIP_LENGTH)), hit(12.0, "POKE", 55)));
}

function authoredThrow(releaseFrame: number, recovery: number, damage: number, kind: keyof typeof CLASS, angle: keyof typeof ANGLE, facing = 1.0): AuthoredThrow {
  return { contactFrame: releaseFrame, totalFrames: releaseFrame + recovery, effect: hit(damage, kind, angle, facing) };
}

// The body is Archer's capsule at the roster's 1.05 height. The sword arm
// reaches toward each strike from late startup into early recovery, so a
// whiff is punishable at the hand; the blade past the hand is the disjoint.
// Hand positions follow the stock model's Attack, Attack 2 and Stand - 4
// sequences (blademasterClips.ts).
const TORSO = hurtPart(0.0, 4.0, 0.0, f32(94.6), 24.0);
const ARM_RADIUS = 9.0;
const arm = (x1: number, z1: number, x2: number, z2: number): readonly HurtPart[] => [TORSO, hurtPart(x1, z1, x2, z2, ARM_RADIUS)];
const SHOULDER_X = 6.0;
const SHOULDER_Z = 90.0;
/** The torso with the sword arm reaching to a hand position. */
export const reach = (handX: number, handZ: number) => arm(SHOULDER_X, SHOULDER_Z, handX, handZ);

const BODY: FighterHurtboxes = {
  stand: [TORSO],
  attacks: {
    [AttackStyle.jab]: [heroHurtPose(2, 8, reach(46.0, 76.0))],
    [AttackStyle.forwardTilt]: [heroHurtPose(6, 14, reach(48.0, 66.0))],
    [AttackStyle.forwardTiltUp]: [heroHurtPose(6, 14, reach(46.0, 92.0))],
    [AttackStyle.forwardTiltDown]: [heroHurtPose(6, 14, reach(46.0, 44.0))],
    [AttackStyle.upTilt]: [heroHurtPose(5, 14, reach(14.0, 136.0))],
    [AttackStyle.downTilt]: [heroHurtPose(5, 12, reach(44.0, 30.0))],
    [AttackStyle.dashAttack]: [heroHurtPose(8, 16, reach(46.0, 56.0))],
    // Smash charge holds the frame before the first active one, wound back.
    [AttackStyle.forwardSmash]: [heroHurtPose(17, 23, reach(62.0, 76.0))],
    [AttackStyle.upSmash]: [heroHurtPose(15, 21, reach(10.0, 140.0))],
    [AttackStyle.downSmash]: [heroHurtPose(14, 16, reach(44.0, 26.0)), heroHurtPose(17, 22, reach(-44.0, 26.0))],
    [AttackStyle.neutralAir]: [heroHurtPose(6, 13, reach(46.0, 86.0))],
    [AttackStyle.forwardAir]: [heroHurtPose(8, 16, reach(46.0, 60.0))],
    [AttackStyle.backAir]: [heroHurtPose(6, 14, reach(-46.0, 70.0))],
    [AttackStyle.upAir]: [heroHurtPose(5, 11, reach(4.0, 140.0))],
    [AttackStyle.downAir]: [heroHurtPose(11, 19, arm(0.0, 70.0, 4.0, 26.0))],
    [AttackStyle.grab]: [heroHurtPose(5, 12, reach(50.0, 76.0))],
  },
};

export const BLADEMASTER_MOVES: FighterMoves = {
  normals: {
    [AttackStyle.jab]: heroMove(4, 2, 13, 0, path(4, [
      capsule(18.0, 45.0, f32(S - BLADE_RADIUS), 45.0),
      capsule(20.0, 47.0, f32(S - BLADE_RADIUS), 47.0),
    ], hit(3.0, "POKE", 35))),
    [AttackStyle.forwardTilt]: heroMove(8, 3, 19, 0, cut(8, [34.0, 45.0, 56.0], L, hit(8.0, "POKE", 35), hit(10.0, "POKE", 35))),
    [AttackStyle.forwardTiltUp]: heroMove(8, 3, 19, 0, cut(8, [80.0, 95.0, 110.0], L, hit(8.0, "POKE", 35), hit(10.0, "POKE", 35))),
    [AttackStyle.forwardTiltDown]: heroMove(8, 3, 19, 0, cut(8, [10.0, -5.0, -20.0], L, hit(8.0, "POKE", 35), hit(10.0, "POKE", 35))),
    [AttackStyle.upTilt]: heroMove(7, 5, 20, 0, path(7, [
      capsule(35.0, 35.0, 90.0, 60.0),
      capsule(24.0, 55.0, 65.0, 90.0),
      capsule(2.0, 55.0, 8.0, f32(M - BLADE_RADIUS)),
      capsule(-20.0, 50.0, -65.0, 85.0),
      capsule(-30.0, 40.0, -f32(M - BLADE_RADIUS), 55.0),
    ], hit(8.0, "LAUNCH", 90))),
    [AttackStyle.downTilt]: heroMove(7, 3, 17, 0, path(7, [
      capsule(18.0, 14.0, f32(L - BLADE_RADIUS), 14.0),
      capsule(18.0, 8.0, f32(L - BLADE_RADIUS), 8.0),
      capsule(18.0, 2.0, f32(L - BLADE_RADIUS), 2.0),
    ], hit(6.0, "LINK", 75))),
    [AttackStyle.dashAttack]: heroMove(10, 4, 26, 0, cut(10, [60.0, 45.0, 30.0, 18.0], L, hit(10.0, "LAUNCH", 45)), S),
    [AttackStyle.forwardSmash]: heroMove(17, 3, 32, 0, cut(17, [58.0, 45.0, 32.0], XL, hit(15.0, "KILL", 40), hit(19.0, "KILL", 40))),
    [AttackStyle.upSmash]: heroMove(15, 4, 30, 0, path(15, [
      capsule(16.0, 38.0, 24.0, f32(L - BLADE_RADIUS)),
      capsule(8.0, 38.0, 12.0, f32(L - BLADE_RADIUS)),
      capsule(0.0, 38.0, 0.0, f32(L - BLADE_RADIUS)),
      capsule(-8.0, 38.0, -12.0, f32(L - BLADE_RADIUS)),
    ], hit(16.0, "KILL", 90))),
    [AttackStyle.downSmash]: heroMove(14, 6, 31, 0, [...lowSweep(14, 1.0), ...lowSweep(17, -1.0)]),
    [AttackStyle.neutralAir]: heroMove(7, 5, 20, 12, path(7, [
      capsule(20.0, 35.0, f32(M - BLADE_RADIUS), 35.0),
      capsule(15.0, 50.0, 60.0, 90.0),
      capsule(0.0, 55.0, 0.0, f32(M - BLADE_RADIUS)),
      capsule(-15.0, 50.0, -70.0, 80.0),
      capsule(-20.0, 30.0, -f32(M - BLADE_RADIUS), 30.0),
    ], hit(8.0, "POKE", 50))),
    [AttackStyle.forwardAir]: heroMove(10, 3, 22, 14, cut(10, [60.0, 45.0, 30.0], L, hit(11.0, "EDGE", 40), hit(14.0, "EDGE", 40))),
    [AttackStyle.backAir]: heroMove(8, 3, 23, 13, cut(8, [34.0, 45.0, 56.0], L, hit(12.0, "KILL", 35, -1.0), undefined, -1.0)),
    [AttackStyle.upAir]: heroMove(6, 3, 19, 11, path(6, [
      capsule(0.0, 45.0, 0.0, f32(M - BLADE_RADIUS)),
      capsule(3.0, 45.0, 3.0, f32(M - BLADE_RADIUS)),
      capsule(6.0, 45.0, 6.0, f32(M - BLADE_RADIUS)),
    ], hit(8.0, "LAUNCH", 85))),
    [AttackStyle.downAir]: heroMove(13, 4, 28, 20, downAir),
    [AttackStyle.grab]: heroMove(7, 2, 22, 0, path(7, [
      capsule(18.0, 45.0, f32(S - 10.0), 45.0, 10.0),
      capsule(18.0, 47.0, f32(S - 10.0), 47.0, 10.0),
    ], hit(0.0, "POKE", 35))),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 3.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } },
    [GrabAction.throwForward]: authoredThrow(12, 18, 7.0, "EDGE", 35),
    [GrabAction.throwBack]: authoredThrow(15, 22, 8.0, "EDGE", 40, -1.0),
    [GrabAction.throwUp]: authoredThrow(13, 10, 6.0, "JUGGLE", 85),
    [GrabAction.throwDown]: authoredThrow(16, 20, 5.0, "CHASE", 65),
  },
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: 1.25,
  maxPummels: 2,
  hurtboxes: BODY,
};

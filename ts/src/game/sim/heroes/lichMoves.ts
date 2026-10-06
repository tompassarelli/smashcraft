import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction, HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT, heroHurtPose, heroMove, heroRegion, type AuthoredThrow, type FighterMoves, type MoveRegion, type StrikeCapsule } from "../heroMoves";
import { LICH_GROUND, groundPoses } from "./groundNormals";
import type { HitEffect } from "../hitRegions";
import { type FighterHurtboxes, type HurtPart, type HurtPose, hurtPart, hurtPose } from "../hurtboxes";
import { type Strike, linkAt, multiHit } from "./multiHit";

// Original geometry for smashcraft:docs/design/roster.md; the frost volumes
// stay attached to the caster and never become traveling projectiles.
const S = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
const M = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
const L = f32(HERO_REFERENCE_HEIGHT * f32(1.10));
const XL = f32(HERO_REFERENCE_HEIGHT * f32(1.40));
const GRAB = f32(HERO_REFERENCE_HEIGHT * f32(0.70));

// Provisional hypotheses in the existing formula, not measured displacement
// calibration or evidence that a LINK guarantees a follow-up.
const CLASS = {
  LINK: { growth: 55.0, base: 12.0 },
  POKE: { growth: 75.0, base: 18.0 },
  LAUNCH: { growth: 105.0, base: 20.0 },
  EDGE: { growth: 110.0, base: 22.0 },
  KILL: { growth: 120.0, base: 26.0 },
  SPIKE: { growth: 100.0, base: 22.0 },
  // Throw roles (#107): an up throw's guaranteed short juggle and a down throw's tech chase.
  JUGGLE: { growth: 70.0, base: 45.0 },
  CHASE: { growth: 40.0, base: 75.0 },
} as const;
const ANGLE = {
  25: { x: f32(0.906307787), z: f32(0.422618262) },
  35: { x: f32(0.819152044), z: f32(0.573576436) },
  40: { x: f32(0.766044443), z: f32(0.642787610) },
  50: { x: f32(0.642787610), z: f32(0.766044443) },
  55: { x: f32(0.573576436), z: f32(0.819152044) },
  60: { x: f32(0.5), z: f32(0.866025404) },
  65: { x: f32(0.422618262), z: f32(0.906307787) },
  70: { x: f32(0.342020143), z: f32(0.939692621) },
  75: { x: f32(0.258819045), z: f32(0.965925826) },
  80: { x: f32(0.173648178), z: f32(0.984807753) },
  85: { x: f32(0.087155743), z: f32(0.996194698) },
  90: { x: 0.0, z: 1.0 },
  270: { x: 0.0, z: -1.0 },
} as const;

export function hit(damage: number, kind: keyof typeof CLASS, angle: keyof typeof ANGLE, backwards = false, element: HitElement = HitElement.ice): Readonly<HitEffect> {
  const strength = CLASS[kind];
  const direction = ANGLE[angle];
  return { damage, growth: strength.growth, base: strength.base, launchX: backwards ? -direction.x : direction.x, launchZ: direction.z, electric: false, element };
}

const capsule = (x1: number, z1: number, x2: number, z2: number, radius = 8.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const circle = (x: number, z: number, radius: number): StrikeCapsule => capsule(x, z, x, z, radius);
const frame = (active: number, strike: StrikeCapsule, effect: Readonly<HitEffect>, groundedEffect?: Readonly<HitEffect>) => heroRegion(active, active, strike, effect, groundedEffect);

function palm(first: number, heights: readonly number[]): readonly MoveRegion[] {
  return heights.map((height, index) => frame(first + index, capsule(20.0, 45.0, f32(M - 8.0), height), hit(8.0, "POKE", 35)));
}

/** Opposite thin arcs rotate around the torso instead of filling their box. */
/** Frost Halo (#152): a ring around the torso that pulses, after Ultimate's rehitting n-airs. */
function halo(): readonly MoveRegion[] {
  const outer = f32(M - 10.0);
  const diagonal = f32(outer * f32(0.707106781));
  const strikes = [
    capsule(outer, 24.0, outer, 66.0, 10.0),
    capsule(diagonal, f32(45.0 + diagonal), 18.0, f32(45.0 + outer), 10.0),
    capsule(18.0, f32(45.0 + outer), -18.0, f32(45.0 + outer), 10.0),
    capsule(-18.0, f32(45.0 + outer), -diagonal, f32(45.0 + diagonal), 10.0),
    capsule(-outer, 66.0, -outer, 24.0, 10.0),
    capsule(-diagonal, f32(45.0 - diagonal), -18.0, f32(45.0 - outer), 10.0),
  ];
  const ring = [...strikes, ...strikes.map(strike => capsule(-strike.x1, f32(90.0 - strike.z1), -strike.x2, f32(90.0 - strike.z2), strike.radius))];
  // Three chilling pulses hold a target in the ring at any percent; the last bursts outward.
  const hold = (effect: Readonly<HitEffect>): readonly Strike[] => ring.map(strike => [strike, effect]);
  const burst: readonly Strike[] = ring.map(strike => [strike, hit(4.0, "POKE", 50, strike.x1 + strike.x2 < 0.0)]);
  return multiHit([
    { first: 9, last: 11, strikes: hold(linkAt(2.0, 18.0, 90, HitElement.ice)) },
    { first: 13, last: 15, strikes: hold(linkAt(2.0, 18.0, 90, HitElement.ice)) },
    { first: 17, last: 19, strikes: hold(linkAt(2.0, 18.0, 90, HitElement.ice)) },
    { first: 21, last: 22, strikes: burst },
  ]);
}

function fan(): readonly MoveRegion[] {
  const regions: MoveRegion[] = [];
  for (let active = 12; active <= 14; active++) {
    const shift = f32((active - 12) * 4.0);
    for (const height of [24.0, 45.0, 66.0]) {
      regions.push(frame(active, capsule(26.0, 45.0, f32(L - 8.0), f32(height - shift)), hit(11.0, "EDGE", 40)));
    }
  }
  return regions;
}

function throwMove(release: number, recovery: number, damage: number, kind: keyof typeof CLASS, angle: keyof typeof ANGLE, backwards = false): AuthoredThrow {
  return { contactFrame: release, totalFrames: release + recovery, effect: hit(damage, kind, angle, backwards) };
}

// Lich's body: the reference capsule scaled by the roster's 0.90 width and
// 1.05 height. Lich has no weapon, so the conjured frost beyond the hand is the
// move's disjoint while the casting arm extends the body from late startup
// through early recovery; a whiffed cast is punishable at the hand.
const BODY_RADIUS = f32(24.0 * f32(0.90));
const BODY_TOP = f32(f32(4.0 + f32(HERO_REFERENCE_HEIGHT * f32(1.05))) - f32(2.0 * BODY_RADIUS));
const SHOULDER = f32(BODY_TOP - 14.0);
const TORSO = hurtPart(0.0, 4.0, 0.0, BODY_TOP, BODY_RADIUS);
const ARM_RADIUS = 9.0;
const arm = (handX: number, handZ: number, shoulderX = 8.0) => hurtPart(shoulderX, SHOULDER, handX, handZ, ARM_RADIUS);
const reach = (first: number, last: number, ...limbs: readonly HurtPart[]) => [heroHurtPose(first, last, [TORSO, ...limbs])];

/** A special's casting arm over special frames (entry frame 1). */
export const lichCastBody = (first: number, last: number, handX: number, handZ: number): readonly HurtPose[] =>
  [hurtPose(first, last, [TORSO, arm(handX, handZ)])];

const LICH_BODY: FighterHurtboxes = {
  stand: [TORSO],
  crouch: [hurtPart(0.0, 4.0, 0.0, f32(BODY_TOP * f32(0.6)), BODY_RADIUS)],
  attacks: {
    ...groundPoses(LICH_GROUND, (x, z) => [TORSO, arm(x, z)]),
    [AttackStyle.upTilt]: reach(6, 17, arm(14.0, f32(BODY_TOP + 18.0)), arm(-14.0, f32(BODY_TOP + 18.0), -8.0)),
    [AttackStyle.forwardSmash]: reach(18, 30, arm(28.0, 47.0)),
    [AttackStyle.upSmash]: reach(16, 30, arm(10.0, f32(BODY_TOP + 20.0)), arm(-10.0, f32(BODY_TOP + 20.0), -8.0)),
    [AttackStyle.downSmash]: reach(16, 28, arm(28.0, 14.0), arm(-28.0, 14.0, -8.0)),
    [AttackStyle.forwardAir]: reach(10, 18, arm(28.0, 47.0)),
    // Bone Spike: an elbow-and-hand strike, so the rear arm reaches the burst's root.
    [AttackStyle.backAir]: reach(8, 15, arm(-34.0, 47.0, -8.0)),
    [AttackStyle.upAir]: reach(6, 14, arm(8.0, f32(BODY_TOP + 16.0))),
    [AttackStyle.downAir]: reach(13, 22, arm(10.0, -6.0)),
    // The spectral hand is conjured; the real arm reaches toward it.
    [AttackStyle.grab]: reach(8, 14, arm(30.0, 47.0)),
  },
};

const GRAB_EFFECT ={ damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;
export const LICH_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: 1.25,
  maxPummels: 2,
  hurtboxes: LICH_BODY,
  normals: {
    ...LICH_GROUND.normals,
    [AttackStyle.forwardSmash]: heroMove(22, 3, 36, 0, [
      heroRegion(22, 24, capsule(20.0, 45.0, f32(XL - 7.0), 45.0, 7.0), hit(18.0, "KILL", 35)),
    ]),
    [AttackStyle.upSmash]: heroMove(20, 5, 34, 0, [
      heroRegion(20, 24, capsule(0.0, 8.0, 0.0, f32(L - 10.0), 10.0), hit(17.0, "KILL", 90)),
    ]),
    [AttackStyle.downSmash]: heroMove(19, 5, 35, 0, [
      heroRegion(19, 23, capsule(24.0, 8.0, f32(L - 10.0), 8.0, 10.0), hit(14.0, "EDGE", 25)),
      heroRegion(19, 23, capsule(-24.0, 8.0, -f32(L - 10.0), 8.0, 10.0), hit(14.0, "EDGE", 25, true)),
    ]),
    [AttackStyle.neutralAir]: heroMove(9, 14, 17, 16, halo()),
    [AttackStyle.forwardAir]: heroMove(12, 3, 27, 17, fan()),
    [AttackStyle.backAir]: heroMove(10, 3, 25, 15, [
      frame(10, capsule(-20.0, 49.0, -f32(M - 8.0), 49.0), hit(12.0, "KILL", 35, true)),
      frame(11, capsule(-20.0, 45.0, -f32(M - 8.0), 45.0), hit(12.0, "KILL", 35, true)),
      frame(12, capsule(-20.0, 41.0, -f32(M - 8.0), 41.0), hit(12.0, "KILL", 35, true)),
    ]),
    [AttackStyle.upAir]: heroMove(8, 4, 23, 14, [
      heroRegion(8, 11, circle(0.0, f32(M - 12.0), 12.0), hit(9.0, "LAUNCH", 85)),
    ]),
    [AttackStyle.downAir]: heroMove(16, 4, 31, 22, [
      heroRegion(16, 19, capsule(0.0, -12.0, 0.0, -f32(M - 10.0), 10.0), hit(12.0, "SPIKE", 270), hit(12.0, "SPIKE", 55)),
    ]),
    [AttackStyle.grab]: heroMove(10, 2, 28, 0, [
      heroRegion(10, 11, capsule(18.0, 45.0, f32(GRAB - 10.0), 45.0, 10.0), GRAB_EFFECT),
    ]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 3.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false, element: HitElement.ice } },
    [GrabAction.throwForward]: throwMove(14, 23, 7.0, "EDGE", 35),
    [GrabAction.throwBack]: throwMove(18, 26, 8.0, "EDGE", 40, true),
    [GrabAction.throwUp]: throwMove(17, 13, 7.0, "JUGGLE", 90),
    [GrabAction.throwDown]: throwMove(19, 26, 6.0, "CHASE", 75),
  },
};

import { downSmashHit } from "../downMoveValues";
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction, HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT, jabStep, heroHurtPose, heroMove, heroRegion, type FighterMoves, type MoveRegion, type StrikeCapsule } from "../heroMoves";
import type { HitEffect } from "../hitRegions";
import { type FighterHurtboxes, type HurtPart, hurtPart } from "../hurtboxes";

// The Lich King (#167): a heavy Frostmourne swordsman. The blade paths, reach
// and frame data are original and provisional: longer and faster than Pit
// Lord's cleaver, slower than Forsaken Paladin's hammer, with kill power on the smashes
// and back air. Only Frostmourne past his gauntlets is disjoint.
const S = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
const M = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
const L = f32(HERO_REFERENCE_HEIGHT * f32(1.10));
const XL = f32(HERO_REFERENCE_HEIGHT * f32(1.35));
const BLADE_RADIUS = 11.0;

// Provisional coefficients in the shared formula, as the other kits use them; weight 1.20 does the rest.
const CLASS = {
  LINK: { growth: 50.0, base: 14.0 },
  POKE: { growth: 75.0, base: 18.0 },
  LAUNCH: { growth: 95.0, base: 20.0 },
  EDGE: { growth: 95.0, base: 22.0 },
  KILL: { growth: 100.0, base: 24.0 },
  SPIKE: { growth: 100.0, base: 22.0 },
  // Throw roles (#107): an up throw's short juggle and a down throw's tech chase.
  JUGGLE: { growth: 55.0, base: 50.0 },
  CHASE: { growth: 40.0, base: 75.0 },
} as const;
const ANGLE = {
  25: { x: f32(0.906307787), z: f32(0.422618262) },
  30: { x: f32(0.866025404), z: 0.5 },
  35: { x: f32(0.819152044), z: f32(0.573576436) },
  40: { x: f32(0.766044443), z: f32(0.642787610) },
  50: { x: f32(0.642787610), z: f32(0.766044443) },
  55: { x: f32(0.573576436), z: f32(0.819152044) },
  70: { x: f32(0.342020143), z: f32(0.939692621) },
  80: { x: f32(0.173648178), z: f32(0.984807753) },
  85: { x: f32(0.087155743), z: f32(0.996194698) },
  270: { x: 0.0, z: -1.0 },
} as const;

/** A hit; facing -1 sends it to his back. Frostmourne cuts with ice unless named otherwise. */
export function hit(damage: number, kind: keyof typeof CLASS, angle: keyof typeof ANGLE, facing = 1.0, element: HitElement = HitElement.ice): Readonly<HitEffect> {
  const strength = CLASS[kind];
  const direction = ANGLE[angle];
  return { damage, growth: strength.growth, base: strength.base, launchX: f32(direction.x * facing), launchZ: direction.z, electric: false, element };
}

export function capsule(x1: number, z1: number, x2: number, z2: number, radius = BLADE_RADIUS): StrikeCapsule {
  return { x1, z1, x2, z2, radius };
}

/** One strike position per active frame from `first`. */
function path(first: number, strikes: readonly StrikeCapsule[], effect: Readonly<HitEffect>, groundedEffect?: Readonly<HitEffect>): readonly MoveRegion[] {
  return strikes.map((strike, index) => heroRegion(first + index, first + index, strike, effect, groundedEffect));
}

/** Frostmourne from the hilt outward to `reach`, one blade height per active frame. */
function sweep(first: number, heights: readonly number[], reach: number, effect: Readonly<HitEffect>, facing = 1.0): readonly MoveRegion[] {
  return path(first, heights.map(z => capsule(f32(facing * 36.0), 72.0, f32(facing * f32(reach - BLADE_RADIUS)), z)), effect);
}

// Body: the reference capsule scaled by the roster's 1.12 width and 1.26
// height. His gauntlets reach toward each swing; the blade stays out.
const BODY_RADIUS = f32(24.0 * f32(1.12));
const BODY_TOP = f32(f32(4.0 + f32(HERO_REFERENCE_HEIGHT * f32(1.26))) - f32(2.0 * BODY_RADIUS));

const BODY = hurtPart(0.0, 4.0, 0.0, BODY_TOP, BODY_RADIUS);
const ARM_RADIUS = 13.0;
const arm = (x1: number, z1: number, x2: number, z2: number, radius = ARM_RADIUS): readonly HurtPart[] => [BODY, hurtPart(x1, z1, x2, z2, radius)];
/** The arm pose from two frames before the first active frame through two after the last. */
const reaching = (first: number, active: number, parts: readonly HurtPart[]) => [heroHurtPose(first - 2, first + active + 1, parts)];
const FORWARD_ARM = arm(20.0, 82.0, 66.0, 76.0);
const LOW_ARM = arm(20.0, 60.0, 64.0, 40.0);
const RAISED_ARM = arm(10.0, 120.0, 22.0, 164.0);
const BACK_ARM = arm(-20.0, 82.0, -66.0, 76.0);

const LICH_KING_BODY: FighterHurtboxes = {
  stand: [BODY],
  attacks: {
    [AttackStyle.jab]: reaching(6, 3, arm(20.0, 76.0, 56.0, 72.0)),
    [AttackStyle.jab2]: reaching(7, 3, arm(20.0, 76.0, 58.0, 70.0)),
    [AttackStyle.jab3]: reaching(9, 3, FORWARD_ARM),
    [AttackStyle.forwardTilt]: reaching(11, 4, FORWARD_ARM),
    [AttackStyle.forwardTiltUp]: reaching(11, 4, FORWARD_ARM),
    [AttackStyle.forwardTiltDown]: reaching(11, 4, FORWARD_ARM),
    [AttackStyle.upTilt]: reaching(10, 5, RAISED_ARM),
    [AttackStyle.downTilt]: [heroHurtPose(7, 10, LOW_ARM), heroHurtPose(11, 14, arm(-20.0, 60.0, -64.0, 40.0))],
    [AttackStyle.dashAttack]: reaching(12, 4, arm(20.0, 70.0, 70.0, 66.0)),
    [AttackStyle.forwardSmash]: reaching(22, 4, arm(20.0, 100.0, 72.0, 90.0)),
    [AttackStyle.upSmash]: reaching(18, 8, RAISED_ARM),
    [AttackStyle.downSmash]: [heroHurtPose(15, 19, LOW_ARM), heroHurtPose(20, 24, arm(-20.0, 60.0, -64.0, 40.0))],
    [AttackStyle.neutralAir]: [heroHurtPose(8, 13, FORWARD_ARM), heroHurtPose(14, 19, BACK_ARM)],
    [AttackStyle.forwardAir]: reaching(14, 4, arm(20.0, 96.0, 70.0, 86.0)),
    [AttackStyle.backAir]: reaching(11, 4, BACK_ARM),
    [AttackStyle.upAir]: reaching(10, 5, RAISED_ARM),
    [AttackStyle.downAir]: reaching(18, 5, arm(6.0, 60.0, 10.0, 8.0)),
    [AttackStyle.grab]: reaching(9, 2, arm(20.0, 66.0, 72.0, 62.0)),
  },
};

const NO_LAUNCH = { growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

// Frostmourne Sweep: from over his helm to the floor, so every stick angle plays it (Ultimate's angling rule).
const FROSTMOURNE_SWEEP = heroMove(11, 4, 24, 0, sweep(11, [150.0, 106.0, 60.0, 16.0], XL, hit(12.0, "EDGE", 35)));

export const LICH_KING_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: f32(1.3),
  maxPummels: 2,
  hurtboxes: LICH_KING_BODY,
  normals: {
    // Pommel and Rake: a gauntlet check, a short rake of the blade, then a Frostmourne thrust.
    [AttackStyle.jab]: { ...jabStep(heroMove(6, 3, 13, 0, path(6, [
      capsule(30.0, 70.0, f32(S + 6.0), 70.0, 12.0),
      capsule(30.0, 66.0, f32(S + 8.0), 64.0, 12.0),
      capsule(30.0, 62.0, f32(S + 6.0), 58.0, 12.0),
    ], hit(3.0, "LINK", 70, 1.0, HitElement.normal)))), inspiredBy: "Ike's jab (a heavy sword's quick check)" },
    [AttackStyle.jab2]: jabStep(heroMove(7, 3, 16, 0, path(7, [
      capsule(30.0, 86.0, f32(M - 6.0), 70.0),
      capsule(30.0, 70.0, f32(M - 6.0), 54.0),
      capsule(30.0, 56.0, f32(M - 8.0), 40.0),
    ], hit(3.0, "LINK", 80)))),
    [AttackStyle.jab3]: heroMove(9, 3, 23, 0, path(9, [
      capsule(30.0, 70.0, f32(L - 10.0), 68.0),
      capsule(30.0, 68.0, f32(L - 4.0), 66.0),
      capsule(30.0, 66.0, f32(L - 10.0), 64.0),
    ], hit(5.0, "POKE", 40))),
    [AttackStyle.forwardTilt]: { ...FROSTMOURNE_SWEEP, inspiredBy: "Byleth's forward tilt (a non-angled weapon arc)" },
    [AttackStyle.forwardTiltUp]: FROSTMOURNE_SWEEP,
    [AttackStyle.forwardTiltDown]: FROSTMOURNE_SWEEP,
    // Overhead Reap: front to back over his helm, an anti-air that covers behind him.
    [AttackStyle.upTilt]: { ...heroMove(10, 5, 23, 0, path(10, [
      capsule(50.0, 110.0, 100.0, 150.0),
      capsule(30.0, 120.0, 50.0, f32(L + 36.0)),
      capsule(0.0, 120.0, 0.0, f32(L + 46.0)),
      capsule(-30.0, 120.0, -50.0, f32(L + 36.0)),
      capsule(-50.0, 110.0, -100.0, 150.0),
    ], hit(11.0, "LAUNCH", 85))), inspiredBy: "Marth's up tilt (an arc that covers behind)" },
    // Frozen Ground: a low sweep in front, then the blade comes round behind him.
    [AttackStyle.downTilt]: { ...heroMove(9, 4, 22, 0, [
      ...path(9, [
        capsule(30.0, 18.0, f32(L - 14.0), 10.0, 13.0),
        capsule(30.0, 14.0, f32(L - 14.0), 6.0, 13.0),
      ], hit(6.0, "POKE", 25)),
      ...path(11, [
        capsule(-30.0, 18.0, -f32(M + 10.0), 10.0, 13.0),
        capsule(-30.0, 14.0, -f32(M + 10.0), 6.0, 13.0),
      ], hit(6.0, "POKE", 25, -1.0)),
    ]), inspiredBy: "Two-sided sweeps (Ganondorf's and Ike's down smashes, at tilt speed)" },
    // Death Knight's Charge: a lunging Frostmourne thrust that stops at a body.
    [AttackStyle.dashAttack]: { ...heroMove(12, 4, 30, 0, path(12, [
      capsule(20.0, 66.0, f32(L - 4.0), 64.0, 13.0),
      capsule(20.0, 64.0, f32(L - 4.0), 62.0, 13.0),
      capsule(20.0, 62.0, f32(L - 8.0), 60.0, 12.0),
      capsule(20.0, 60.0, f32(L - 12.0), 58.0, 12.0),
    ], hit(11.0, "LAUNCH", 40)), 40.0, true), inspiredBy: "Arthas's charge at Stratholme" },
    // Frostmourne Cleave: the tip is the sweetspot, listed before the inner blade so it wins the overlap.
    [AttackStyle.forwardSmash]: { ...heroMove(22, 4, 38, 0, [
      ...[130.0, 96.0, 60.0, 16.0].map((z, index) => heroRegion(22 + index, 22 + index,
        capsule(f32(XL - 46.0), z, f32(XL - 12.0), f32(z - 10.0), 14.0), hit(21.0, "KILL", 40))),
      ...sweep(22, [130.0, 96.0, 60.0, 16.0], f32(XL - 40.0), hit(17.0, "KILL", 40)),
    ]), inspiredBy: "Frostmourne's overhead strike (Warcraft III cinematic)" },
    // Remorseless Winter: a frost burst all round him, strong on frames 18-21, a chilling gust after.
    [AttackStyle.upSmash]: { ...heroMove(18, 8, 38, 0, [
      heroRegion(18, 21, capsule(0.0, 90.0, 0.0, f32(L + 10.0), f32(M - 10.0)), hit(15.0, "KILL", 85)),
      heroRegion(22, 25, capsule(0.0, 90.0, 0.0, f32(L + 10.0), f32(M - 20.0)), hit(10.0, "LAUNCH", 80)),
    ]), inspiredBy: "Remorseless Winter (Icecrown Citadel)" },
    // Quake: Frostmourne driven into the floor, front f17-19, behind f20-22.
    [AttackStyle.downSmash]: { ...heroMove(17, 6, 28, 0, [
      ...path(17, [
        capsule(30.0, 16.0, f32(L - 10.0), 14.0, 15.0),
        capsule(30.0, 12.0, f32(L - 10.0), 10.0, 15.0),
        capsule(30.0, 10.0, f32(L - 10.0), 6.0, 15.0),
      ], downSmashHit(hit(14.0, "EDGE", 30, 1.0, HitElement.normal))),
      ...path(20, [
        capsule(-30.0, 16.0, -f32(L - 10.0), 14.0, 15.0),
        capsule(-30.0, 12.0, -f32(L - 10.0), 10.0, 15.0),
        capsule(-30.0, 10.0, -f32(L - 10.0), 6.0, 15.0),
      ], downSmashHit(hit(14.0, "EDGE", 30, -1.0, HitElement.normal))),
    ]), inspiredBy: "Quake (Icecrown Citadel's transition)" },
    // Frostmourne Spin: the blade comes round him, front then back.
    [AttackStyle.neutralAir]: heroMove(10, 8, 24, 16, [
      ...path(10, [
        capsule(30.0, 60.0, f32(L - BLADE_RADIUS), 70.0),
        capsule(30.0, 90.0, f32(L - 20.0), 116.0),
        capsule(20.0, 110.0, 30.0, f32(L + 26.0)),
        capsule(0.0, 110.0, -20.0, f32(L + 26.0)),
      ], hit(11.0, "POKE", 50)),
      ...path(14, [
        capsule(-30.0, 90.0, -f32(L - 20.0), 116.0),
        capsule(-30.0, 60.0, -f32(L - BLADE_RADIUS), 70.0),
        capsule(-30.0, 40.0, -f32(L - BLADE_RADIUS), 30.0),
        capsule(-20.0, 20.0, -f32(M - 10.0), 0.0),
      ], hit(11.0, "POKE", 50, -1.0)),
    ]),
    // Runeblade Arc: a wide downward arc ahead, his best aerial reach.
    [AttackStyle.forwardAir]: heroMove(14, 4, 30, 20, sweep(14, [140.0, 96.0, 52.0, 14.0], f32(HERO_REFERENCE_HEIGHT * f32(1.25)), hit(13.0, "KILL", 40))),
    // Backhand Reap: the strongest aerial, behind him.
    [AttackStyle.backAir]: heroMove(11, 4, 26, 18, sweep(11, [110.0, 80.0, 56.0, 34.0], L, hit(13.0, "KILL", 40, -1.0), -1.0)),
    [AttackStyle.upAir]: heroMove(10, 5, 25, 16, path(10, [
      capsule(40.0, 110.0, 80.0, f32(L + 20.0)),
      capsule(20.0, 120.0, 30.0, f32(L + 40.0)),
      capsule(0.0, 120.0, 0.0, f32(L + 46.0)),
      capsule(-20.0, 120.0, -30.0, f32(L + 40.0)),
      capsule(-40.0, 110.0, -80.0, f32(L + 20.0)),
    ], hit(12.0, "LAUNCH", 85))),
    // Frostmourne Plunge: point-down; a spike against an airborne target, 55 degrees against a grounded one.
    [AttackStyle.downAir]: heroMove(18, 5, 33, 26, path(18, [
      capsule(8.0, 30.0, 8.0, -60.0, 14.0),
      capsule(6.0, 30.0, 6.0, -66.0, 14.0),
      capsule(4.0, 30.0, 4.0, -70.0, 14.0),
      capsule(4.0, 30.0, 4.0, -70.0, 14.0),
      capsule(4.0, 30.0, 4.0, -66.0, 14.0),
    ], hit(14.0, "SPIKE", 270), hit(14.0, "SPIKE", 55))),
    [AttackStyle.grab]: heroMove(9, 2, 30, 0, [heroRegion(9, 10,
      capsule(30.0, 62.0, f32(M - 10.0), 60.0, 13.0),
      { damage: 0.0, ...NO_LAUNCH })]),
  },
  throws: {
    // Gauntlet crush: the shared 3 percent.
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 3.0, ...NO_LAUNCH } },
    [GrabAction.throwForward]: { contactFrame: 15, totalFrames: 38, effect: hit(10.0, "EDGE", 35, 1.0, HitElement.normal) },
    [GrabAction.throwBack]: { contactFrame: 18, totalFrames: 46, effect: hit(12.0, "KILL", 40, -1.0, HitElement.normal) },
    [GrabAction.throwUp]: { contactFrame: 16, totalFrames: 30, effect: hit(8.0, "JUGGLE", 85) },
    // Harvest Soul drops the victim into a tech chase.
    [GrabAction.throwDown]: { inspiredBy: "Harvest Soul (Icecrown Citadel)", contactFrame: 24, totalFrames: 50, effect: hit(6.0, "CHASE", 25, 1.0, HitElement.dark) },
  },
};

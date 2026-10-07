import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../../physics/contactGeometry";
import { AttackStyle, Character, GrabAction, HitElement } from "../codes";
import { heroHurtPose, heroMove, heroRegion, jabStep, type FighterMoves, type MoveRegion, type StrikeCapsule } from "../heroMoves";
import type { HitEffect } from "../hitRegions";
import { hurtPart, type HurtPart } from "../hurtboxes";

const STRENGTH = {
  link: { growth: 55.0, base: 12.0 }, poke: { growth: 75.0, base: 18.0 },
  launch: { growth: 70.0, base: 42.0 }, edge: { growth: 95.0, base: 22.0 },
  kill: { growth: 100.0, base: 24.0 }, juggle: { growth: 55.0, base: 50.0 },
  chase: { growth: 40.0, base: 75.0 },
} as const;
const DIRECTIONS = {
  25: [f32(0.906307787), f32(0.422618262)], 35: [f32(0.819152044), f32(0.573576436)],
  40: [f32(0.766044443), f32(0.642787610)], 50: [f32(0.642787610), f32(0.766044443)],
  55: [f32(0.573576436), f32(0.819152044)], 70: [f32(0.342020143), f32(0.939692621)],
  80: [f32(0.173648178), f32(0.984807753)], 85: [f32(0.087155743), f32(0.996194698)],
  270: [0.0, -1.0],
} as const;
export function cairneHit(damage: number, strength: keyof typeof STRENGTH, angle: keyof typeof DIRECTIONS, direction = 1): Readonly<HitEffect> {
  const vector = DIRECTIONS[angle];
  return { damage, ...STRENGTH[strength], launchX: f32(vector[0] * direction), launchZ: vector[1], electric: false, element: HitElement.normal };
}
export const cairneCapsule = (x1: number, z1: number, x2: number, z2: number, radius = 14.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const c = cairneCapsule;
const strike = (first: number, last: number, shape: StrikeCapsule, damage: number, strength: keyof typeof STRENGTH, angle: keyof typeof DIRECTIONS, direction = 1): MoveRegion =>
  heroRegion(first, last, shape, cairneHit(damage, strength, angle, direction));
const sweep = (first: number, reach: number, heights: readonly number[], damage: number, strength: keyof typeof STRENGTH, direction = 1): MoveRegion[] =>
  heights.map((z, i) => strike(first + i, first + i, c(34.0 * direction, 95.0, (reach - 14.0) * direction, z), damage, strength, 40, direction));
const BODY = hurtCapsule(Character.cairne);
const pose = (first: number, last: number, part: HurtPart) => [heroHurtPose(first, last, [BODY, part])];
const arm = (x: number, z: number) => hurtPart(20.0, 90.0, x, z, 18.0);
const FORWARD_TILT = heroMove(14, 4, 29, 0, sweep(14, 170.0, [170.0, 115.0, 60.0, 12.0], 13.0, "edge"));
const NO_LAUNCH = { growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

export const CAIRNE_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack, smashMaxChargeFrames: 45, smashMaxDamageMultiplier: 1.25, maxPummels: 1,
  hurtboxes: {
    stand: [BODY],
    attacks: {
      [AttackStyle.jab]: pose(5, 11, arm(80.0, 76.0)),
      [AttackStyle.jab2]: pose(7, 13, arm(86.0, 72.0)),
      [AttackStyle.forwardTilt]: pose(12, 19, arm(86.0, 95.0)),
      [AttackStyle.forwardTiltUp]: pose(12, 19, arm(86.0, 95.0)),
      [AttackStyle.forwardTiltDown]: pose(12, 19, arm(86.0, 95.0)),
      [AttackStyle.upTilt]: pose(11, 19, arm(25.0, 162.0)),
      [AttackStyle.downTilt]: pose(9, 15, arm(80.0, 28.0)),
      [AttackStyle.dashAttack]: pose(14, 23, hurtPart(15.0, 60.0, 95.0, 75.0, 34.0)),
      [AttackStyle.forwardSmash]: pose(26, 34, arm(95.0, 100.0)),
      [AttackStyle.upSmash]: pose(23, 32, arm(15.0, 178.0)),
      [AttackStyle.downSmash]: [...pose(21, 26, arm(85.0, 25.0)), ...pose(25, 32, arm(-85.0, 25.0))],
      [AttackStyle.neutralAir]: [...pose(10, 15, arm(82.0, 100.0)), ...pose(15, 21, arm(-82.0, 100.0))],
      [AttackStyle.forwardAir]: pose(18, 26, arm(90.0, 90.0)),
      [AttackStyle.backAir]: pose(13, 20, arm(-86.0, 80.0)),
      [AttackStyle.upAir]: pose(10, 18, hurtPart(0.0, 120.0, 0.0, 198.0, 22.0)),
      [AttackStyle.downAir]: pose(19, 28, arm(10.0, 15.0)),
      [AttackStyle.grab]: pose(9, 16, arm(96.0, 62.0)),
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(7, 3, 18, 0, [strike(7, 9, c(30.0, 75.0, 88.0, 72.0), 5.0, "link", 35)])),
    [AttackStyle.jab2]: heroMove(9, 3, 23, 0, [strike(9, 11, c(35.0, 85.0, 110.0, 60.0), 8.0, "poke", 40)]),
    [AttackStyle.forwardTilt]: FORWARD_TILT,
    [AttackStyle.forwardTiltUp]: FORWARD_TILT,
    [AttackStyle.forwardTiltDown]: FORWARD_TILT,
    [AttackStyle.upTilt]: heroMove(13, 5, 27, 0, [
      strike(13, 14, c(30.0, 115.0, 90.0, 175.0), 12.0, "launch", 85),
      strike(15, 15, c(0.0, 130.0, 0.0, 215.0), 12.0, "launch", 85),
      strike(16, 17, c(-30.0, 115.0, -90.0, 175.0), 12.0, "launch", 85),
    ]),
    [AttackStyle.downTilt]: heroMove(11, 3, 25, 0, [strike(11, 13, c(34.0, 25.0, 140.0, 14.0), 10.0, "launch", 70)]),
    [AttackStyle.dashAttack]: heroMove(16, 5, 33, 0, [strike(16, 20, c(20.0, 60.0, 95.0, 75.0, 32.0), 15.0, "kill", 40)], 32.0, true),
    [AttackStyle.forwardSmash]: heroMove(28, 4, 42, 0, [
      ...[180.0, 120.0, 60.0, 10.0].map((z, i) => strike(28 + i, 28 + i, c(148.0, z, 175.0, z, 15.0), 25.0, "kill", 40)),
      ...sweep(28, 145.0, [180.0, 120.0, 60.0, 10.0], 19.0, "kill"),
    ]),
    [AttackStyle.upSmash]: heroMove(25, 5, 39, 0, [strike(25, 29, c(0.0, 115.0, 0.0, 245.0, 20.0), 23.0, "kill", 85)]),
    [AttackStyle.downSmash]: heroMove(23, 7, 40, 0, [
      strike(23, 25, c(20.0, 20.0, 148.0, 10.0, 18.0), 19.0, "edge", 25),
      strike(27, 29, c(-20.0, 20.0, -148.0, 10.0, 18.0), 19.0, "edge", 25, -1),
    ]),
    [AttackStyle.neutralAir]: heroMove(12, 7, 29, 22, [
      strike(12, 14, c(28.0, 75.0, 132.0, 95.0), 13.0, "poke", 50),
      strike(15, 16, c(0.0, 130.0, 0.0, 194.0), 13.0, "poke", 50),
      strike(17, 18, c(-28.0, 75.0, -132.0, 95.0), 13.0, "poke", 50, -1),
    ]),
    [AttackStyle.forwardAir]: heroMove(20, 4, 36, 26, sweep(20, 175.0, [165.0, 110.0, 55.0, 0.0], 19.0, "kill")),
    [AttackStyle.backAir]: heroMove(15, 4, 30, 22, sweep(15, 155.0, [120.0, 90.0, 60.0, 30.0], 16.0, "edge", -1)),
    [AttackStyle.upAir]: heroMove(12, 4, 28, 20, [strike(12, 15, c(0.0, 125.0, 0.0, 194.0, 20.0), 13.0, "launch", 85)]),
    [AttackStyle.downAir]: heroMove(21, 5, 38, 28, [heroRegion(21, 25, c(0.0, 30.0, 0.0, -80.0, 20.0), cairneHit(18.0, "kill", 270), cairneHit(18.0, "kill", 55))]),
    [AttackStyle.grab]: heroMove(11, 3, 31, 0, [heroRegion(11, 13, c(30.0, 65.0, 98.0, 60.0), { damage: 0.0, ...NO_LAUNCH })]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 60, totalFrames: 68, effect: { damage: 3.0, ...NO_LAUNCH } },
    [GrabAction.throwForward]: { contactFrame: 19, totalFrames: 45, effect: cairneHit(11.0, "edge", 35) },
    [GrabAction.throwBack]: { contactFrame: 23, totalFrames: 54, effect: cairneHit(13.0, "kill", 40, -1) },
    [GrabAction.throwUp]: { contactFrame: 21, totalFrames: 32, effect: cairneHit(10.0, "juggle", 85) },
    [GrabAction.throwDown]: { contactFrame: 24, totalFrames: 51, effect: cairneHit(9.0, "chase", 25) },
  },
};

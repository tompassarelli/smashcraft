import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../../physics/contactGeometry";
import { AttackStyle, Character, GrabAction, HitElement } from "../codes";
import { type StrikeCapsule, heroMove, heroMoves, heroRegion, heroHurtPose, jabStep, cleanLateMove } from "../heroMoves";
import { hurtPart } from "../hurtboxes";
import { groundHit } from "./groundNormals";

export const capsule = (x1: number, z1: number, x2: number, z2: number, radius: number): StrikeCapsule => ({ x1, z1, x2, z2, radius });
export const thrallHit = (damage: number, angle: 20 | 25 | 35 | 40 | 45 | 50 | 55 | 70 | 75 | 85 | 90, growth: number, base: number, back = false, element: HitElement = HitElement.normal) => groundHit(damage, angle, growth, base, element, back);
const normal = (first: number, active: number, recovery: number, landing: number, strike: StrikeCapsule, damage: number, angle: 20 | 25 | 35 | 40 | 45 | 50 | 55 | 70 | 75 | 85 | 90, growth = 88.73999786376953, base = 24.0, back = false) => heroMove(first, active, recovery, landing, [heroRegion(first, first + active - 1, strike, thrallHit(damage, angle, growth, base, back))]);
const body = hurtCapsule(Character.thrall);
const wolf = hurtPart(-48.0, 36.0, 70.0, 36.0, 28.0);
const paw = hurtPart(48.0, 34.0, 96.0, 34.0, 20.0);
const down = { damage: 13.0, growth: 103.52999877929688, base: 24.0, launchX: 0.0, launchZ: -1.0, electric: false, element: HitElement.normal };

export const THRALL_MOVES = heroMoves({
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: {
    stand: [body, wolf],
    attacks: {
      [AttackStyle.jab]: [heroHurtPose(3, 9, [body, wolf, hurtPart(8.0, 118.0, 38.0, 85.0, 12.0)])],
      [AttackStyle.jab2]: [heroHurtPose(5, 12, [body, wolf, hurtPart(8.0, 118.0, 42.0, 87.0, 12.0)])],
      [AttackStyle.forwardTilt]: [heroHurtPose(8, 15, [body, wolf, hurtPart(8.0, 118.0, 85.0, 90.0, 12.0)])],
      [AttackStyle.dashAttack]: [heroHurtPose(9, 16, [body, wolf, hurtPart(52.0, 60.0, 84.0, 60.0, 20.0)])],
      [AttackStyle.grab]: [heroHurtPose(6, 12, [body, wolf, hurtPart(8.0, 95.0, 55.0, 70.0, 12.0)])],
      [AttackStyle.downTilt]: [heroHurtPose(6, 13, [body, wolf, paw])],
      [AttackStyle.forwardTiltDown]: [heroHurtPose(8, 15, [body, wolf, paw])],
      [AttackStyle.downSmash]: [heroHurtPose(14, 23, [body, wolf, paw, hurtPart(-48.0, 34.0, -96.0, 34.0, 20.0)])],
      [AttackStyle.downAir]: [heroHurtPose(12, 19, [body, wolf, hurtPart(50.0, 10.0, 96.0, 30.0, 20.0)])],
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(normal(4, 2, 14, 0, capsule(38.0, 65.0, 45.0, 70.0, 22.0), 5.119999885559082, 45, 54.22999954223633, 18.0)),
    [AttackStyle.jab2]: normal(7, 3, 18, 0, capsule(42.0, 67.0, 50.0, 72.0, 22.0), 6.144000053405762, 40),
    [AttackStyle.forwardTilt]: normal(8, 3, 21, 0, capsule(68.0, 70.0, 92.0, 75.0, 24.0), 12.800000190734863, 35, 108.45999908447266),
    [AttackStyle.forwardTiltUp]: normal(8, 3, 21, 0, capsule(-2.0, 178.0, -2.0, 188.0, 22.0), 12.800000190734863, 55, 108.45999908447266),
    [AttackStyle.forwardTiltDown]: normal(8, 3, 21, 0, capsule(52.0, 34.0, 96.0, 34.0, 20.0), 12.800000190734863, 20, 108.45999908447266),
    [AttackStyle.upTilt]: normal(8, 4, 20, 0, capsule(-2.0, 178.0, -2.0, 189.0, 22.0), 8.192000389099121, 85, 69.0199966430664, 36.0),
    [AttackStyle.downTilt]: normal(6, 3, 19, 0, capsule(52.0, 34.0, 96.0, 34.0, 20.0), 8.960000038146973, 70, 64.08999633789062, 20.0),
    [AttackStyle.dashAttack]: heroMove(11, 4, 25, 0, [heroRegion(11, 14, capsule(24.0, 45.0, 65.0, 60.0, 28.0), thrallHit(12.800000190734863, 55, 88.73999786376953, 28.0))], 65.0, true),
    [AttackStyle.forwardSmash]: cleanLateMove(heroMove(20, 3, 34, 0, [
      heroRegion(20, 22, capsule(34.0, 130.0, 39.0, 133.0, 23.0), thrallHit(18.43199920654297, 40, 108.45999908447266, 30.0)),
    ]), 1),
    [AttackStyle.upSmash]: normal(17, 4, 29, 0, capsule(-2.0, 176.0, -2.0, 186.0, 23.0), 15.359999656677246, 85, 106.48799896240234, 30.0),
    [AttackStyle.downSmash]: heroMove(14, 6, 30, 0, [heroRegion(14, 16, capsule(52.0, 34.0, 96.0, 34.0, 20.0), thrallHit(16.639999389648438, 25, 103.52999877929688, 28.0)), heroRegion(17, 19, capsule(-52.0, 34.0, -96.0, 34.0, 20.0), thrallHit(16.639999389648438, 25, 103.52999877929688, 28.0, true))]),
    [AttackStyle.neutralAir]: normal(8, 5, 20, 14, capsule(42.0, 126.0, 57.0, 126.0, 25.0), 8.192000389099121, 50),
    [AttackStyle.forwardAir]: normal(13, 3, 25, 18, capsule(40.0, 128.0, 47.0, 128.0, 23.0), 12.288000106811523, 45, 96.62799835205078, 24.0),
    [AttackStyle.backAir]: normal(11, 3, 25, 17, capsule(-30.0, 127.0, -40.0, 127.0, 25.0), 13.312000274658203, 35, 103.52999877929688, 28.0, true),
    [AttackStyle.upAir]: normal(8, 4, 20, 13, capsule(-2.0, 170.0, -2.0, 180.0, 22.0), 9.215999603271484, 85, 88.73999786376953, 28.0),
    [AttackStyle.downAir]: heroMove(14, 4, 28, 20, [heroRegion(14, 17, capsule(54.0, 20.0, 96.0, 29.0, 24.0), down, thrallHit(13.312000274658203, 55, 93.66999816894531, 26.0))]),
    [AttackStyle.grab]: heroMove(8, 2, 24, 0, [heroRegion(8, 9, capsule(20.0, 48.0, 62.0, 48.0, 16.0), { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false })]),
    [AttackStyle.getupAttack]: normal(8, 4, 18, 0, capsule(-82.0, 22.0, 82.0, 22.0, 14.0), 7.168000221252441, 40),
    [AttackStyle.ledgeAttack]: normal(8, 4, 18, 0, capsule(20.0, 35.0, 102.0, 35.0, 14.0), 8.192000389099121, 40),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 60, totalFrames: 68, effect: thrallHit(3.072000026702881, 90, 0.0, 0.0) },
    [GrabAction.throwForward]: { contactFrame: 14, totalFrames: 34, effect: thrallHit(8.192000389099121, 35, 88.73999786376953, 28.0) },
    [GrabAction.throwBack]: { contactFrame: 18, totalFrames: 40, effect: thrallHit(10.239999771118164, 40, 103.52999877929688, 30.0, true) },
    [GrabAction.throwUp]: { contactFrame: 15, totalFrames: 28, effect: thrallHit(7.168000221252441, 75, 83.80999755859375, 60.0, true) },
    [GrabAction.throwDown]: { contactFrame: 19, totalFrames: 42, effect: thrallHit(6.144000053405762, 70, 39.439998626708984, 75.0) },
  },
});

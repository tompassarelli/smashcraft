import { f32 } from "wisp/src/sim/f32";
import { hurtCapsule } from "../../physics/contactGeometry";
import { AttackStyle, Character, GrabAction, HitElement } from "../codes";
import { type FighterMoves, type StrikeCapsule, heroMove, heroRegion, heroHurtPose, jabStep } from "../heroMoves";
import { hurtPart } from "../hurtboxes";
import { groundHit } from "./groundNormals";

export const capsule = (x1: number, z1: number, x2: number, z2: number, radius: number): StrikeCapsule => ({ x1, z1, x2, z2, radius });
export const thrallHit = (damage: number, angle: 20 | 25 | 35 | 40 | 45 | 50 | 55 | 70 | 75 | 85 | 90, growth: number, base: number, back = false, element: HitElement = HitElement.normal) => groundHit(damage, angle, growth, base, element, back);
const normal = (first: number, active: number, recovery: number, landing: number, strike: StrikeCapsule, damage: number, angle: 20 | 25 | 35 | 40 | 45 | 50 | 55 | 70 | 75 | 85 | 90, growth = 90.0, base = 24.0, back = false) => heroMove(first, active, recovery, landing, [heroRegion(first, first + active - 1, strike, thrallHit(damage, angle, growth, base, back))]);
const body = hurtCapsule(Character.thrall);
const down = { damage: 13.0, growth: 105.0, base: 24.0, launchX: 0.0, launchZ: -1.0, electric: false };

export const THRALL_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack, smashMaxChargeFrames: 45, smashMaxDamageMultiplier: 1.25, maxPummels: 1,
  hurtboxes: {
    stand: [body],
    attacks: {
      [AttackStyle.jab]: [heroHurtPose(3, 9, [body, hurtPart(8.0, 70.0, 42.0, 68.0, 12.0)])],
      [AttackStyle.jab2]: [heroHurtPose(5, 12, [body, hurtPart(8.0, 70.0, 46.0, 62.0, 12.0)])],
      [AttackStyle.grab]: [heroHurtPose(6, 12, [body, hurtPart(8.0, 68.0, 55.0, 55.0, 12.0)])],
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(normal(5, 2, 14, 0, capsule(18.0, 65.0, 70.0, 65.0, 12.0), 4.0, 45, 55.0, 18.0)),
    [AttackStyle.jab2]: normal(7, 3, 18, 0, capsule(20.0, 60.0, 82.0, 60.0, 14.0), 6.0, 40),
    [AttackStyle.forwardTilt]: normal(10, 3, 21, 0, capsule(30.0, 60.0, 118.0, 60.0, 14.0), 10.0, 35),
    [AttackStyle.forwardTiltUp]: normal(10, 3, 21, 0, capsule(30.0, 65.0, 110.0, 103.0, 14.0), 10.0, 55),
    [AttackStyle.forwardTiltDown]: normal(10, 3, 21, 0, capsule(30.0, 48.0, 118.0, 15.0, 14.0), 10.0, 20),
    [AttackStyle.upTilt]: normal(8, 4, 20, 0, capsule(5.0, 90.0, 20.0, 155.0, 18.0), 8.0, 85, 70.0, 36.0),
    [AttackStyle.downTilt]: normal(8, 3, 19, 0, capsule(25.0, 14.0, 105.0, 14.0, 13.0), 7.0, 70, 65.0, 20.0),
    [AttackStyle.dashAttack]: heroMove(11, 4, 25, 0, [heroRegion(11, 14, capsule(0.0, 16.0, 15.0, 70.0, 28.0), thrallHit(10.0, 55, 90.0, 28.0))], 65.0, true),
    [AttackStyle.forwardSmash]: heroMove(20, 3, 34, 0, [
      heroRegion(20, 20, capsule(95.0, 100.0, 112.0, 108.0, 20.0), thrallHit(18.0, 40, 110.0, 30.0)),
      heroRegion(21, 21, capsule(114.0, 62.0, 130.0, 62.0, 20.0), thrallHit(18.0, 40, 110.0, 30.0)),
      heroRegion(22, 22, capsule(104.0, 20.0, 120.0, 16.0, 20.0), thrallHit(18.0, 40, 110.0, 30.0)),
    ]),
    [AttackStyle.upSmash]: normal(17, 4, 29, 0, capsule(-38.0, 130.0, 38.0, 150.0, 22.0), 15.0, 85, 108.0, 30.0),
    [AttackStyle.downSmash]: heroMove(16, 6, 30, 0, [heroRegion(16, 18, capsule(24.0, 18.0, 118.0, 18.0, 16.0), thrallHit(13.0, 25, 105.0, 28.0)), heroRegion(19, 21, capsule(-24.0, 18.0, -118.0, 18.0, 16.0), thrallHit(13.0, 25, 105.0, 28.0, true))]),
    [AttackStyle.neutralAir]: normal(8, 5, 20, 14, capsule(-30.0, 44.0, 38.0, 64.0, 26.0), 8.0, 50),
    [AttackStyle.forwardAir]: normal(13, 3, 25, 18, capsule(34.0, 70.0, 120.0, 55.0, 18.0), 12.0, 45, 98.0, 24.0),
    [AttackStyle.backAir]: normal(11, 3, 25, 17, capsule(-30.0, 65.0, -118.0, 60.0, 18.0), 13.0, 35, 105.0, 28.0, true),
    [AttackStyle.upAir]: normal(8, 4, 20, 13, capsule(-14.0, 105.0, 14.0, 155.0, 17.0), 9.0, 85, 90.0, 28.0),
    [AttackStyle.downAir]: heroMove(14, 4, 28, 20, [heroRegion(14, 17, capsule(18.0, 5.0, 18.0, -65.0, 18.0), down, thrallHit(13.0, 55, 95.0, 26.0))]),
    [AttackStyle.grab]: heroMove(8, 2, 24, 0, [heroRegion(8, 9, capsule(20.0, 48.0, 62.0, 48.0, 16.0), { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false })]),
    [AttackStyle.getupAttack]: normal(8, 4, 18, 0, capsule(-82.0, 22.0, 82.0, 22.0, 14.0), 7.0, 40),
    [AttackStyle.ledgeAttack]: normal(8, 4, 18, 0, capsule(20.0, 35.0, 102.0, 35.0, 14.0), 8.0, 40),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: thrallHit(2.0, 90, 0.0, 0.0) },
    [GrabAction.throwForward]: { contactFrame: 14, totalFrames: 34, effect: thrallHit(8.0, 35, 90.0, 28.0) },
    [GrabAction.throwBack]: { contactFrame: 18, totalFrames: 40, effect: thrallHit(10.0, 40, 105.0, 30.0, true) },
    [GrabAction.throwUp]: { contactFrame: 15, totalFrames: 28, effect: thrallHit(7.0, 90, 55.0, 50.0) },
    [GrabAction.throwDown]: { contactFrame: 19, totalFrames: 42, effect: thrallHit(6.0, 25, 40.0, 75.0) },
  },
};

import { AttackStyle, GrabAction, HitElement } from "../codes";
import { heroMove, heroRegion, jabStep, type FighterMoves, type StrikeCapsule } from "../heroMoves";
import { heroHurtPose } from "../heroMoves";
import { hurtPart } from "../hurtboxes";
import { groundHit } from "./groundNormals";

export const anubarakHit = (damage: number, angle: 25 | 35 | 40 | 55 | 70 | 80 | 90, growth = 90.0, base = 26.0, behind = false) => groundHit(damage, angle, growth, base, HitElement.normal, behind);
const claw = (x1: number, z1: number, x2: number, z2: number, radius = 15.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const shell = hurtPart(-24.0, 32.0, 18.0, 88.0, 35.0);
const tilt = (z: number, angle: 25 | 40 | 55) => heroMove(10, 4, 24, 0, [heroRegion(10, 13, claw(32.0, 60.0, 124.0, z), anubarakHit(11.0, angle))]);

export const ANUBARAK_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack, smashMaxChargeFrames: 45, smashMaxDamageMultiplier: 1.25, maxPummels: 1,
  hurtboxes: {
    stand: [shell, hurtPart(20.0, 76.0, 52.0, 100.0, 20.0)],
    crouch: [hurtPart(-28.0, 24.0, 22.0, 55.0, 35.0)],
    attacks: {
      [AttackStyle.forwardTilt]: [heroHurtPose(8, 17, [shell, hurtPart(26.0, 62.0, 72.0, 62.0, 13.0)])],
      [AttackStyle.forwardSmash]: [heroHurtPose(17, 28, [shell, hurtPart(26.0, 66.0, 75.0, 66.0, 13.0)])],
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(6, 3, 17, 0, [heroRegion(6, 8, claw(25.0, 60.0, 66.0, 60.0), anubarakHit(4.0, 35, 55.0, 18.0))])),
    [AttackStyle.jab2]: heroMove(8, 3, 20, 0, [heroRegion(8, 10, claw(28.0, 60.0, 80.0, 66.0), anubarakHit(6.0, 40, 75.0, 22.0))]),
    [AttackStyle.forwardTilt]: tilt(62.0, 40), [AttackStyle.forwardTiltUp]: tilt(95.0, 55), [AttackStyle.forwardTiltDown]: tilt(18.0, 25),
    [AttackStyle.upTilt]: heroMove(9, 5, 23, 0, [heroRegion(9, 13, claw(20.0, 85.0, 12.0, 155.0, 20.0), anubarakHit(10.0, 90, 72.0, 42.0))]),
    [AttackStyle.downTilt]: heroMove(8, 4, 20, 0, [heroRegion(8, 11, claw(30.0, 12.0, 120.0, 12.0), anubarakHit(8.0, 70, 65.0, 36.0))]),
    [AttackStyle.dashAttack]: heroMove(12, 5, 28, 0, [heroRegion(12, 16, claw(32.0, 44.0, 115.0, 50.0, 21.0), anubarakHit(12.0, 55))], 42.0, true),
    [AttackStyle.forwardSmash]: heroMove(20, 4, 34, 0, [heroRegion(20, 23, claw(32.0, 65.0, 153.0, 65.0, 18.0), anubarakHit(20.0, 40, 60.0, 36.0))]),
    [AttackStyle.upSmash]: heroMove(17, 5, 31, 0, [heroRegion(17, 21, claw(-22.0, 104.0, 25.0, 172.0, 27.0), anubarakHit(18.0, 90, 110.0, 32.0))]),
    [AttackStyle.downSmash]: heroMove(16, 6, 32, 0, [
      heroRegion(16, 18, claw(28.0, 14.0, 134.0, 14.0, 18.0), anubarakHit(16.0, 25, 105.0, 32.0)),
      heroRegion(19, 21, claw(-28.0, 14.0, -134.0, 14.0, 18.0), anubarakHit(16.0, 25, 105.0, 32.0, true)),
    ]),
    [AttackStyle.neutralAir]: heroMove(10, 7, 24, 18, [heroRegion(10, 16, claw(-62.0, 64.0, 62.0, 64.0, 30.0), anubarakHit(10.0, 55))]),
    [AttackStyle.forwardAir]: heroMove(13, 4, 27, 20, [heroRegion(13, 16, claw(30.0, 66.0, 134.0, 60.0, 18.0), anubarakHit(13.0, 40, 100.0, 28.0))]),
    [AttackStyle.backAir]: heroMove(11, 4, 27, 20, [heroRegion(11, 14, claw(-30.0, 46.0, -128.0, 46.0, 20.0), anubarakHit(14.0, 35, 108.0, 32.0, true))]),
    [AttackStyle.upAir]: heroMove(9, 4, 23, 16, [heroRegion(9, 12, claw(-10.0, 112.0, 12.0, 160.0, 18.0), anubarakHit(10.0, 90, 85.0, 26.0))]),
    [AttackStyle.downAir]: heroMove(17, 4, 30, 24, [heroRegion(17, 20, claw(0.0, 28.0, 0.0, -64.0, 23.0), { ...anubarakHit(15.0, 90, 100.0, 28.0), launchZ: -1.0 }, anubarakHit(15.0, 70, 100.0, 28.0))]),
    [AttackStyle.grab]: heroMove(10, 3, 25, 0, [heroRegion(10, 12, claw(28.0, 55.0, 80.0, 55.0), anubarakHit(0.0, 35, 0.0, 0.0))]),
    [AttackStyle.getupAttack]: heroMove(17, 5, 26, 0, [heroRegion(17, 21, claw(-95.0, 24.0, 95.0, 24.0, 20.0), anubarakHit(8.0, 35))]),
    [AttackStyle.ledgeAttack]: heroMove(17, 3, 24, 0, [heroRegion(17, 19, claw(24.0, 50.0, 112.0, 50.0), anubarakHit(8.0, 35))]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 1, totalFrames: 1, effect: anubarakHit(3.0, 35, 0.0, 0.0) },
    [GrabAction.throwForward]: { contactFrame: 16, totalFrames: 40, effect: anubarakHit(9.0, 40, 95.0, 30.0) },
    [GrabAction.throwBack]: { contactFrame: 19, totalFrames: 46, effect: anubarakHit(11.0, 40, 110.0, 34.0, true) },
    [GrabAction.throwUp]: { contactFrame: 15, totalFrames: 36, effect: anubarakHit(8.0, 90, 60.0, 50.0) },
    [GrabAction.throwDown]: { contactFrame: 21, totalFrames: 48, effect: anubarakHit(7.0, 70, 40.0, 75.0) },
  },
};

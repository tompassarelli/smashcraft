import { AttackStyle, GrabAction, HitElement } from "../codes";
import { heroMove, heroMoves, heroRegion, jabStep, type StrikeCapsule, tipperMove } from "../heroMoves";
import { heroHurtPose } from "../heroMoves";
import { hurtPart } from "../hurtboxes";
import { groundHitWith } from "./authoring";

export const anubarakHit = groundHitWith({ growth: 83.69999694824219, base: 26.0, element: HitElement.normal });
const claw = (x1: number, z1: number, x2: number, z2: number, radius = 15.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const shell = hurtPart(-24.0, 32.0, 18.0, 88.0, 35.0);
const tilt = (z: number, angle: 25 | 40 | 55) => heroMove(10, 4, 24, 0, [heroRegion(10, 13, claw(32.0, 60.0, 124.0, z), anubarakHit(12.276000022888184, angle))]);

export const ANUBARAK_MOVES = heroMoves({
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: {
    stand: [shell, hurtPart(20.0, 76.0, 52.0, 100.0, 20.0)],
    crouch: [hurtPart(-28.0, 24.0, 22.0, 55.0, 35.0)],
    attacks: {
      [AttackStyle.forwardTilt]: [heroHurtPose(8, 17, [shell, hurtPart(26.0, 62.0, 72.0, 62.0, 13.0)])],
      [AttackStyle.forwardSmash]: [heroHurtPose(17, 28, [shell, hurtPart(26.0, 66.0, 75.0, 66.0, 13.0)])],
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(6, 3, 17, 0, [heroRegion(6, 8, claw(25.0, 60.0, 66.0, 60.0), anubarakHit(4.464000225067139, 35, 51.150001525878906, 18.0))])),
    [AttackStyle.jab2]: heroMove(8, 3, 20, 0, [heroRegion(8, 10, claw(28.0, 60.0, 80.0, 66.0), anubarakHit(6.696000099182129, 40, 69.75, 22.0))]),
    [AttackStyle.forwardTilt]: tilt(62.0, 40), [AttackStyle.forwardTiltUp]: tilt(95.0, 55), [AttackStyle.forwardTiltDown]: tilt(18.0, 25),
    [AttackStyle.upTilt]: heroMove(9, 5, 23, 0, [heroRegion(9, 13, claw(20.0, 85.0, 12.0, 155.0, 20.0), anubarakHit(11.15999984741211, 90, 66.95999908447266, 42.0))]),
    [AttackStyle.downTilt]: heroMove(8, 4, 20, 0, [heroRegion(8, 11, claw(30.0, 12.0, 120.0, 12.0), anubarakHit(8.928000450134277, 70, 60.45000076293945, 36.0))]),
    [AttackStyle.dashAttack]: heroMove(12, 5, 28, 0, [heroRegion(12, 16, claw(32.0, 44.0, 115.0, 50.0, 21.0), anubarakHit(13.392000198364258, 55))], 42.0, true),
    [AttackStyle.forwardSmash]: tipperMove(heroMove(20, 4, 34, 0, [heroRegion(20, 23, claw(32.0, 65.0, 153.0, 65.0, 18.0), anubarakHit(22.31999969482422, 40, 55.79999923706055, 36.0))]), 0.25),
    [AttackStyle.upSmash]: heroMove(17, 5, 31, 0, [heroRegion(17, 21, claw(-22.0, 104.0, 25.0, 172.0, 27.0), anubarakHit(20.08799934387207, 90, 102.30000305175781, 32.0))]),
    [AttackStyle.downSmash]: heroMove(16, 6, 32, 0, [
      heroRegion(16, 18, claw(28.0, 14.0, 134.0, 14.0, 18.0), anubarakHit(17.856000900268555, 25, 97.6500015258789, 32.0)),
      heroRegion(19, 21, claw(-28.0, 14.0, -134.0, 14.0, 18.0), anubarakHit(17.856000900268555, 25, 97.6500015258789, 32.0, true)),
    ]),
    [AttackStyle.neutralAir]: heroMove(10, 7, 24, 18, [heroRegion(10, 16, claw(-62.0, 64.0, 62.0, 64.0, 30.0), anubarakHit(11.15999984741211, 55))]),
    [AttackStyle.forwardAir]: heroMove(13, 4, 27, 20, [heroRegion(13, 16, claw(30.0, 66.0, 134.0, 60.0, 18.0), anubarakHit(14.508000373840332, 40, 93.0, 28.0))]),
    [AttackStyle.backAir]: heroMove(11, 4, 27, 20, [heroRegion(11, 14, claw(-30.0, 46.0, -128.0, 46.0, 20.0), anubarakHit(15.62399959564209, 35, 100.44000244140625, 32.0, true))]),
    [AttackStyle.upAir]: heroMove(9, 4, 23, 16, [heroRegion(9, 12, claw(-10.0, 112.0, 12.0, 160.0, 18.0), anubarakHit(11.15999984741211, 90, 79.05000305175781, 26.0))]),
    [AttackStyle.downAir]: heroMove(17, 4, 30, 24, [heroRegion(17, 20, claw(0.0, 28.0, 0.0, -64.0, 23.0), { ...anubarakHit(16.739999771118164, 90, 93.0, 28.0), launchZ: -1.0 }, anubarakHit(16.739999771118164, 70, 93.0, 28.0))]),
    [AttackStyle.grab]: heroMove(10, 3, 25, 0, [heroRegion(10, 12, claw(28.0, 55.0, 80.0, 55.0), anubarakHit(0.0, 35, 0.0, 0.0))]),
    [AttackStyle.getupAttack]: heroMove(17, 5, 26, 0, [heroRegion(17, 21, claw(-95.0, 24.0, 95.0, 24.0, 20.0), anubarakHit(8.928000450134277, 35))]),
    [AttackStyle.ledgeAttack]: heroMove(17, 3, 24, 0, [heroRegion(17, 19, claw(24.0, 50.0, 112.0, 50.0), anubarakHit(8.928000450134277, 35))]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 1, totalFrames: 1, effect: anubarakHit(3.3480000495910645, 35, 0.0, 0.0) },
    [GrabAction.throwForward]: { contactFrame: 16, totalFrames: 40, effect: anubarakHit(10.043999671936035, 40, 88.3499984741211, 30.0) },
    [GrabAction.throwBack]: { contactFrame: 19, totalFrames: 46, effect: anubarakHit(12.276000022888184, 40, 102.30000305175781, 34.0, true) },
    [GrabAction.throwUp]: { contactFrame: 15, totalFrames: 36, effect: anubarakHit(8.928000450134277, 80, 102.30000305175781, 65.0, true) },
    [GrabAction.throwDown]: { contactFrame: 21, totalFrames: 48, effect: anubarakHit(7.811999797821045, 70, 37.20000076293945, 75.0) },
  },
});

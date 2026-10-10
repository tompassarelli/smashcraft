import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../codes";
import { hurtCapsule } from "../../physics/contactGeometry";
import { heroHurtPose, heroMove, heroMoves, heroRegion, jabStep, type StrikeCapsule, cleanLateMove } from "../heroMoves";
import { hurtPart, hurtPose, type HurtPose } from "../hurtboxes";
import { groundHit } from "./groundNormals";

export const jainaHit = (damage: number, angle: 25 | 35 | 40 | 55 | 70 | 80 | 90, growth = 89.50499725341797, base = 24.0, behind = false) =>
  groundHit(damage, angle, f32(growth * 1.125), base, HitElement.ice, behind);
const path = (x1: number, z1: number, x2: number, z2: number, radius = 9.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const body = hurtCapsule(Character.jaina);
const torso = hurtPart(0.0, 4.0, 0.0, body.z2, body.radius);
const arm = (x: number, z: number) => hurtPart(8.0, f32(body.z2 - 15.0), x, z, 9.0);
const reach = (first: number, last: number, x: number, z: number) => [heroHurtPose(first, last, [torso, arm(x, z)])];
export const jainaCastBody = (first: number, last: number): readonly HurtPose[] => [hurtPose(first, last, [torso, arm(36.0, 58.0)])];
const tilt = (height: number, angle: 25 | 35 | 55) => heroMove(9, 3, 22, 0,
  [heroRegion(9, 11, path(28.0, 54.0, 115.0, height, 8.0), jainaHit(7.616000175476074, angle))]);
const noHit = { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false };

export const JAINA_MOVES = heroMoves({
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: {
    stand: [torso], crouch: [hurtPart(0.0, 4.0, 0.0, f32(body.z2 * f32(0.6)), body.radius)],
    attacks: {
      [AttackStyle.jab]: reach(3, 8, 40.0, 48.0), [AttackStyle.jab2]: reach(3, 8, 44.0, 50.0),
      [AttackStyle.forwardTilt]: reach(7, 13, 40.0, 54.0), [AttackStyle.forwardTiltUp]: reach(7, 13, 38.0, 74.0),
      [AttackStyle.forwardTiltDown]: reach(7, 13, 38.0, 28.0), [AttackStyle.upTilt]: reach(6, 13, 8.0, 110.0),
      [AttackStyle.downTilt]: reach(5, 11, 38.0, 22.0), [AttackStyle.dashAttack]: reach(9, 16, 44.0, 50.0),
      [AttackStyle.forwardSmash]: reach(17, 23, 44.0, 54.0), [AttackStyle.upSmash]: reach(16, 23, 8.0, 112.0),
      [AttackStyle.downSmash]: reach(15, 25, 34.0, 20.0), [AttackStyle.neutralAir]: reach(6, 15, 36.0, 50.0),
      [AttackStyle.forwardAir]: reach(10, 16, 42.0, 52.0), [AttackStyle.backAir]: reach(7, 13, -42.0, 52.0),
      [AttackStyle.upAir]: reach(8, 15, 8.0, 114.0), [AttackStyle.downAir]: reach(14, 20, 10.0, 0.0),
      [AttackStyle.grab]: reach(7, 12, 48.0, 48.0),
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(5, 2, 13, 0, [heroRegion(5, 6, path(20.0, 48.0, 56.0, 48.0, 7.0), jainaHit(2.8559999465942383, 70, 52.650001525878906, 18.0))])),
    [AttackStyle.jab2]: heroMove(5, 2, 17, 0, [heroRegion(5, 6, path(22.0, 50.0, 62.0, 50.0, 8.0), jainaHit(3.808000087738037, 35, 89.50499725341797, 22.0))]),
    [AttackStyle.forwardTilt]: tilt(54.0, 35), [AttackStyle.forwardTiltUp]: tilt(94.0, 55), [AttackStyle.forwardTiltDown]: tilt(10.0, 25),
    [AttackStyle.upTilt]: heroMove(8, 4, 21, 0, [heroRegion(8, 11, path(-30.0, 116.0, 38.0, 124.0, 16.0), jainaHit(6.664000034332275, 90, 78.9749984741211, 36.0))]),
    [AttackStyle.downTilt]: heroMove(7, 3, 18, 0, [heroRegion(7, 9, path(18.0, 10.0, 103.0, 8.0, 8.0), jainaHit(5.711999893188477, 80, 68.44499969482422, 35.0))]),
    [AttackStyle.dashAttack]: heroMove(11, 4, 26, 0, [heroRegion(11, 14, path(30.0, 48.0, 102.0, 48.0, 15.0), jainaHit(9.520000457763672, 55, 94.7699966430664, 28.0))], 55.0, true),
    [AttackStyle.forwardSmash]: heroMove(19, 3, 34, 0, [heroRegion(19, 21, path(30.0, 55.0, 175.0, 55.0, 8.0), jainaHit(16.18400001525879, 35, 122.14800262451172, 26.0))]),
    [AttackStyle.upSmash]: heroMove(18, 4, 34, 0, [heroRegion(18, 21, path(0.0, 65.0, 0.0, 170.0, 22.0), jainaHit(15.232000350952148, 90, 117.93599700927734, 24.0))]),
    [AttackStyle.downSmash]: heroMove(17, 6, 32, 0, [
      heroRegion(17, 19, path(25.0, 12.0, 130.0, 12.0, 10.0), jainaHit(12.37600040435791, 25, 110.56500244140625, 25.0)),
      heroRegion(20, 22, path(-25.0, 12.0, -130.0, 12.0, 10.0), jainaHit(12.37600040435791, 25, 110.56500244140625, 25.0, true)),
    ]),
    [AttackStyle.neutralAir]: cleanLateMove(heroMove(8, 5, 24, 16, [
      heroRegion(8, 12, path(28.0, 24.0, 66.0, 68.0, 14.0), jainaHit(7.616000175476074, 55, 84.23999786376953, 24.0)),
      heroRegion(8, 12, path(-28.0, 24.0, -66.0, 68.0, 14.0), jainaHit(7.616000175476074, 55, 84.23999786376953, 24.0, true)),
    ]), 2),
    [AttackStyle.forwardAir]: heroMove(12, 3, 26, 18, [heroRegion(12, 14, path(28.0, 52.0, 125.0, 52.0, 9.0), jainaHit(11.423999786376953, 35, 110.56500244140625, 25.0))]),
    [AttackStyle.backAir]: heroMove(9, 3, 24, 16, [heroRegion(9, 11, path(-20.0, 52.0, -100.0, 52.0, 8.0), jainaHit(10.472000122070312, 35, 113.7239990234375, 23.0, true))]),
    [AttackStyle.upAir]: heroMove(10, 4, 25, 16, [heroRegion(10, 13, path(-24.0, 144.0, 24.0, 144.0, 20.0), jainaHit(10.472000122070312, 90, 113.7239990234375, 24.0))]),
    [AttackStyle.downAir]: heroMove(16, 3, 30, 22, [heroRegion(16, 18, path(0.0, -8.0, 0.0, -92.0, 10.0),
      { ...jainaHit(11.423999786376953, 90, 103.19400024414062, 24.0), launchZ: -1.0 }, jainaHit(11.423999786376953, 55, 103.19400024414062, 24.0))]),
    [AttackStyle.grab]: heroMove(9, 2, 26, 0, [heroRegion(9, 10, path(20.0, 48.0, 62.0, 48.0, 10.0), noHit)]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 60, totalFrames: 68, effect: { ...noHit, damage: 3.0, element: HitElement.ice } },
    [GrabAction.throwForward]: { contactFrame: 14, totalFrames: 36, effect: jainaHit(7.616000175476074, 35, 110.56500244140625, 24.0) },
    [GrabAction.throwBack]: { contactFrame: 17, totalFrames: 41, effect: jainaHit(8.567999839782715, 40, 113.7239990234375, 24.0, true) },
    [GrabAction.throwUp]: { contactFrame: 15, totalFrames: 25, effect: jainaHit(6.664000034332275, 90, 73.70999908447266, 45.0) },
    [GrabAction.throwDown]: { contactFrame: 19, totalFrames: 43, effect: jainaHit(5.711999893188477, 70, 42.119998931884766, 75.0) },
  },
});

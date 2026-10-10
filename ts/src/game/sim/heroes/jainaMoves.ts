import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../codes";
import { hurtCapsule } from "../../physics/contactGeometry";
import { heroHurtPose, heroMove, heroRegion, jabStep, type FighterMoves, type StrikeCapsule, cleanLateMove } from "../heroMoves";
import { hurtPart, hurtPose, type HurtPose } from "../hurtboxes";
import { groundHit } from "./groundNormals";

export const jainaHit = (damage: number, angle: 25 | 35 | 40 | 55 | 70 | 80 | 90, growth = 92.45866394042969, base = 24.0, behind = false) =>
  groundHit(damage, angle, f32(growth * 1.125), base, HitElement.ice, behind);
const path = (x1: number, z1: number, x2: number, z2: number, radius = 9.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const body = hurtCapsule(Character.jaina);
const torso = hurtPart(0.0, 4.0, 0.0, body.z2, body.radius);
const arm = (x: number, z: number) => hurtPart(8.0, f32(body.z2 - 15.0), x, z, 9.0);
const reach = (first: number, last: number, x: number, z: number) => [heroHurtPose(first, last, [torso, arm(x, z)])];
export const jainaCastBody = (first: number, last: number): readonly HurtPose[] => [hurtPose(first, last, [torso, arm(36.0, 58.0)])];
const tilt = (height: number, angle: 25 | 35 | 55) => heroMove(9, 3, 22, 0,
  [heroRegion(9, 11, path(28.0, 54.0, 115.0, height, 8.0), jainaHit(7.3875203132629395, angle))]);
const noHit = { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false };

export const JAINA_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack, smashMaxChargeFrames: 45, smashMaxDamageMultiplier: 1.25, maxPummels: 1,
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
    [AttackStyle.jab]: jabStep(heroMove(5, 2, 13, 0, [heroRegion(5, 6, path(20.0, 48.0, 56.0, 48.0, 7.0), jainaHit(2.770319938659668, 70, 54.387451171875, 18.0))])),
    [AttackStyle.jab2]: heroMove(5, 2, 17, 0, [heroRegion(5, 6, path(22.0, 50.0, 62.0, 50.0, 8.0), jainaHit(3.6937601566314697, 35, 92.45866394042969, 22.0))]),
    [AttackStyle.forwardTilt]: tilt(54.0, 35), [AttackStyle.forwardTiltUp]: tilt(94.0, 55), [AttackStyle.forwardTiltDown]: tilt(10.0, 25),
    [AttackStyle.upTilt]: heroMove(8, 4, 21, 0, [heroRegion(8, 11, path(-30.0, 116.0, 38.0, 124.0, 16.0), jainaHit(6.464079856872559, 90, 81.5811767578125, 36.0))]),
    [AttackStyle.downTilt]: heroMove(7, 3, 18, 0, [heroRegion(7, 9, path(18.0, 10.0, 103.0, 8.0, 8.0), jainaHit(5.540639877319336, 80, 70.70368194580078, 35.0))]),
    [AttackStyle.dashAttack]: heroMove(11, 4, 26, 0, [heroRegion(11, 14, path(30.0, 48.0, 102.0, 48.0, 15.0), jainaHit(9.234400749206543, 55, 97.89740753173828, 28.0))], 55.0, true),
    [AttackStyle.forwardSmash]: heroMove(19, 3, 34, 0, [heroRegion(19, 21, path(30.0, 55.0, 175.0, 55.0, 8.0), jainaHit(15.698479652404785, 35, 126.17888641357422, 26.0))]),
    [AttackStyle.upSmash]: heroMove(18, 4, 34, 0, [heroRegion(18, 21, path(0.0, 65.0, 0.0, 170.0, 22.0), jainaHit(14.775040626525879, 90, 121.82788848876953, 24.0))]),
    [AttackStyle.downSmash]: heroMove(17, 6, 32, 0, [
      heroRegion(17, 19, path(25.0, 12.0, 130.0, 12.0, 10.0), jainaHit(12.004720687866211, 25, 114.2136459350586, 25.0)),
      heroRegion(20, 22, path(-25.0, 12.0, -130.0, 12.0, 10.0), jainaHit(12.004720687866211, 25, 114.2136459350586, 25.0, true)),
    ]),
    [AttackStyle.neutralAir]: cleanLateMove(heroMove(8, 5, 24, 16, [
      heroRegion(8, 12, path(28.0, 24.0, 66.0, 68.0, 14.0), jainaHit(7.3875203132629395, 55, 87.0199203491211, 24.0)),
      heroRegion(8, 12, path(-28.0, 24.0, -66.0, 68.0, 14.0), jainaHit(7.3875203132629395, 55, 87.0199203491211, 24.0, true)),
    ]), 2),
    [AttackStyle.forwardAir]: heroMove(12, 3, 26, 18, [heroRegion(12, 14, path(28.0, 52.0, 125.0, 52.0, 9.0), jainaHit(11.081279754638672, 35, 114.2136459350586, 25.0))]),
    [AttackStyle.backAir]: heroMove(9, 3, 24, 16, [heroRegion(9, 11, path(-20.0, 52.0, -100.0, 52.0, 8.0), jainaHit(10.15783977508545, 35, 117.47689056396484, 23.0, true))]),
    [AttackStyle.upAir]: heroMove(10, 4, 25, 16, [heroRegion(10, 13, path(-24.0, 144.0, 24.0, 144.0, 20.0), jainaHit(10.15783977508545, 90, 117.47689056396484, 24.0))]),
    [AttackStyle.downAir]: heroMove(16, 3, 30, 22, [heroRegion(16, 18, path(0.0, -8.0, 0.0, -92.0, 10.0),
      { ...jainaHit(11.081279754638672, 90, 106.59940338134766, 24.0), launchZ: -1.0 }, jainaHit(11.081279754638672, 55, 106.59940338134766, 24.0))]),
    [AttackStyle.grab]: heroMove(9, 2, 26, 0, [heroRegion(9, 10, path(20.0, 48.0, 62.0, 48.0, 10.0), noHit)]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 60, totalFrames: 68, effect: { ...noHit, damage: 3.0, element: HitElement.ice } },
    [GrabAction.throwForward]: { contactFrame: 14, totalFrames: 36, effect: jainaHit(7.3875203132629395, 35, 114.2136459350586, 24.0) },
    [GrabAction.throwBack]: { contactFrame: 17, totalFrames: 41, effect: jainaHit(8.310959815979004, 40, 117.47689056396484, 24.0, true) },
    [GrabAction.throwUp]: { contactFrame: 15, totalFrames: 25, effect: jainaHit(6.464079856872559, 90, 76.14242553710938, 45.0) },
    [GrabAction.throwDown]: { contactFrame: 19, totalFrames: 43, effect: jainaHit(5.540639877319336, 70, 43.50996017456055, 75.0) },
  },
};

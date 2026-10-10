

import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../codes";
import { hurtCapsule } from "../../physics/contactGeometry";
import { heroHurtPose, heroMove, heroMoves, heroRegion, jabStep, type StrikeCapsule, cleanLateMove } from "../heroMoves";
import { hurtPart } from "../hurtboxes";
import { groundHit } from "./groundNormals";

type Angle = 25 | 35 | 40 | 55 | 70 | 80 | 90;
export const murlocHit = (damage: number, angle: Angle, growth = 66.91999816894531, base = 18.0, behind = false, element: HitElement = HitElement.normal) =>
  groundHit(damage, angle, growth, base, element, behind);
const ordinary = (damage: number, angle: Angle, growth = 66.91999816894531, base = 18.0, behind = false) =>
  murlocHit(damage, angle, growth, base, behind);
const claw = (x1: number, z1: number, x2: number, z2: number, radius = 10.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const body = hurtCapsule(Character.murloc);
const torso = hurtPart(0.0, 4.0, 0.0, body.z2, body.radius);
const arm = (x: number, z: number) => hurtPart(8.0, 40.0, x, z, 8.0);
const reach = (first: number, last: number, x: number, z: number) => [heroHurtPose(first, last, [torso, arm(x, z)])];
const tilt = (z: number, angle: 25 | 35 | 55) => heroMove(6, 3, 19, 0, [heroRegion(6, 8, claw(20.0, 40.0, 66.0, z), ordinary(8.583999633789062, angle))]);

export const MURLOC_MOVES = heroMoves({
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: {
    stand: [torso], crouch: [hurtPart(0.0, 4.0, 0.0, f32(body.z2 * f32(0.6)), body.radius)],
    attacks: {
      [AttackStyle.jab]: reach(2, 6, 40.0, 40.0), [AttackStyle.jab2]: reach(4, 8, 46.0, 40.0),
      [AttackStyle.forwardTilt]: reach(5, 10, 50.0, 40.0), [AttackStyle.forwardTiltUp]: reach(5, 10, 48.0, 66.0),
      [AttackStyle.forwardTiltDown]: reach(5, 10, 50.0, 16.0), [AttackStyle.upTilt]: reach(4, 10, 12.0, 90.0),
      [AttackStyle.downTilt]: reach(4, 9, 46.0, 12.0), [AttackStyle.dashAttack]: reach(6, 13, 46.0, 30.0),
      [AttackStyle.forwardSmash]: reach(12, 18, 58.0, 40.0), [AttackStyle.upSmash]: reach(9, 16, 10.0, 96.0),
      [AttackStyle.downSmash]: reach(10, 17, 52.0, 14.0), [AttackStyle.neutralAir]: reach(4, 12, 30.0, 44.0),
      [AttackStyle.forwardAir]: reach(5, 11, 50.0, 46.0), [AttackStyle.backAir]: reach(6, 12, -50.0, 40.0),
      [AttackStyle.upAir]: reach(5, 11, 10.0, 96.0), [AttackStyle.downAir]: reach(10, 16, 8.0, -12.0),
      [AttackStyle.grab]: reach(5, 10, 40.0, 38.0),
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(3, 2, 11, 0, [heroRegion(3, 4, claw(16.0, 40.0, 40.0, 40.0, 8.0), ordinary(2.1459999084472656, 25, 47.79999923706055, 14.0))])),
    [AttackStyle.jab2]: heroMove(5, 2, 15, 0, [heroRegion(5, 6, claw(18.0, 40.0, 46.0, 42.0), ordinary(4.291999816894531, 35))]),
    [AttackStyle.forwardTilt]: tilt(40.0, 35), [AttackStyle.forwardTiltUp]: tilt(64.0, 55), [AttackStyle.forwardTiltDown]: tilt(14.0, 25),
    [AttackStyle.upTilt]: heroMove(5, 4, 18, 0, [heroRegion(5, 8, claw(14.0, 50.0, 6.0, 90.0, 14.0), ordinary(7.511000156402588, 90, 86.04000091552734, 22.0))]),
    [AttackStyle.downTilt]: heroMove(5, 3, 16, 0, [heroRegion(5, 7, claw(18.0, 8.0, 60.0, 8.0), ordinary(6.438000202178955, 80, 86.04000091552734, 22.0))]),
    [AttackStyle.dashAttack]: heroMove(7, 5, 26, 0, [heroRegion(7, 11, claw(16.0, 26.0, 64.0, 26.0, 14.0), ordinary(9.656999588012695, 55))], 48.0, true),
    [AttackStyle.forwardSmash]: heroMove(14, 3, 36, 0, [heroRegion(14, 16, claw(24.0, 40.0, 86.0, 40.0, 12.0), ordinary(17.167999267578125, 35, 107.0719985961914, 26.0))]),
    [AttackStyle.upSmash]: heroMove(11, 4, 34, 0, [heroRegion(11, 14, claw(0.0, 40.0, 0.0, 114.0, 16.0), ordinary(16.094999313354492, 90, 100.37999725341797, 26.0))]),
    [AttackStyle.downSmash]: heroMove(12, 4, 34, 0, [
      heroRegion(12, 15, claw(18.0, 10.0, 74.0, 10.0, 12.0), ordinary(13.949000358581543, 25, 100.37999725341797, 26.0)),
      heroRegion(12, 15, claw(-18.0, 10.0, -74.0, 10.0, 12.0), ordinary(13.949000358581543, 25, 100.37999725341797, 26.0, true)),
    ]),
    [AttackStyle.neutralAir]: cleanLateMove(heroMove(5, 6, 20, 12, [heroRegion(5, 10, claw(-28.0, 40.0, 28.0, 40.0, 20.0), ordinary(8.583999633789062, 55))]), 2),
    [AttackStyle.forwardAir]: heroMove(7, 3, 24, 14, [heroRegion(7, 9, claw(18.0, 44.0, 70.0, 40.0), ordinary(10.729999542236328, 40, 86.04000091552734, 22.0))]),
    [AttackStyle.backAir]: heroMove(8, 3, 24, 14, [heroRegion(8, 10, claw(-18.0, 40.0, -72.0, 40.0, 12.0), ordinary(12.87600040435791, 35, 105.16000366210938, 26.0, true))]),
    [AttackStyle.upAir]: heroMove(6, 4, 20, 12, [heroRegion(6, 9, claw(-18.0, 92.0, 18.0, 92.0, 16.0), ordinary(9.656999588012695, 90, 86.04000091552734, 22.0))]),
    [AttackStyle.downAir]: heroMove(12, 3, 28, 18, [heroRegion(12, 14, claw(0.0, 10.0, 0.0, -46.0, 12.0), { ...ordinary(11.803000450134277, 90, 86.04000091552734, 22.0), launchZ: -1.0 }, ordinary(11.803000450134277, 70, 86.04000091552734, 22.0))]),
    [AttackStyle.grab]: heroMove(7, 2, 24, 0, [heroRegion(7, 8, claw(16.0, 38.0, 44.0, 38.0), murlocHit(0.0, 35, 0.0, 0.0))]),
    [AttackStyle.getupAttack]: heroMove(17, 3, 30, 0, [heroRegion(17, 19, claw(-56.0, 14.0, 56.0, 14.0, 14.0), ordinary(6.438000202178955, 35))]),
    [AttackStyle.ledgeAttack]: heroMove(17, 3, 21, 0, [heroRegion(17, 19, claw(16.0, 36.0, 70.0, 36.0), ordinary(6.438000202178955, 35))]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 1, totalFrames: 1, effect: ordinary(2.1459999084472656, 35, 0.0, 0.0) },
    [GrabAction.throwForward]: { contactFrame: 12, totalFrames: 32, effect: ordinary(7.511000156402588, 40, 86.04000091552734, 22.0) },
    [GrabAction.throwBack]: { contactFrame: 14, totalFrames: 36, effect: ordinary(9.656999588012695, 40, 100.37999725341797, 26.0, true) },
    [GrabAction.throwUp]: { contactFrame: 12, totalFrames: 26, effect: ordinary(6.438000202178955, 90, 52.58000183105469, 50.0) },
    [GrabAction.throwDown]: { contactFrame: 16, totalFrames: 38, effect: ordinary(5.364999771118164, 25, 38.2400016784668, 75.0) },
  },
});

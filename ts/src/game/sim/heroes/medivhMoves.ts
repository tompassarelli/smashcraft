import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../codes";
import { hurtCapsule } from "../../physics/contactGeometry";
import { heroHurtPose, heroMove, heroMoves, heroRegion, jabStep, type StrikeCapsule, cleanLateMove } from "../heroMoves";
import { hurtPart } from "../hurtboxes";
import { groundHit } from "./groundNormals";

export const medivhHit = (damage: number, angle: 25 | 35 | 40 | 55 | 70 | 80 | 90, growth = 77.27999877929688, base = 20.0, behind = false) =>
  groundHit(damage, angle, growth, base, HitElement.arcane, behind);
const ordinary = (damage: number, angle: 25 | 35 | 40 | 55 | 70 | 80 | 90, growth = 77.27999877929688, base = 20.0, behind = false) =>
  medivhHit(damage, angle, growth, base, behind);
const capsule = (x1: number, z1: number, x2: number, z2: number, radius = 12.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const body = hurtCapsule(Character.medivh);
const torso = hurtPart(0.0, 4.0, 0.0, body.z2, body.radius);
const arm = (x: number, z: number) => hurtPart(8.0, f32(body.z2 - 12.0), x, z, 9.0);
const reach = (first: number, last: number, x: number, z: number) => [heroHurtPose(first, last, [torso, arm(x, z)])];
const tilt = (height: number, angle: 25 | 35 | 55) => heroMove(9, 3, 20, 0, [heroRegion(9, 11, capsule(28.0, 58.0, 96.0, height), ordinary(7.39900016784668, angle))]);
const throwMove = (contactFrame: number, recovery: number, effect: ReturnType<typeof ordinary>) => ({ contactFrame, totalFrames: contactFrame + recovery, effect });

export const MEDIVH_MOVES = heroMoves({
  dashAttack: AttackStyle.dashAttack,
  hurtboxes: {
    stand: [torso], crouch: [hurtPart(0.0, 4.0, 0.0, f32(body.z2 * f32(0.6)), body.radius)],
    attacks: {
      [AttackStyle.jab]: reach(3, 8, 50.0, 54.0), [AttackStyle.jab2]: reach(4, 10, 58.0, 54.0),
      [AttackStyle.forwardTilt]: reach(7, 13, 38.0, 58.0), [AttackStyle.forwardTiltUp]: reach(7, 13, 38.0, 88.0),
      [AttackStyle.forwardTiltDown]: reach(7, 13, 38.0, 20.0), [AttackStyle.upTilt]: reach(6, 13, 18.0, 114.0),
      [AttackStyle.downTilt]: reach(5, 11, 42.0, 18.0), [AttackStyle.dashAttack]: reach(8, 15, 42.0, 48.0),
      [AttackStyle.forwardSmash]: reach(10, 19, 42.0, 60.0), [AttackStyle.upSmash]: reach(15, 25, 16.0, 122.0),
      [AttackStyle.downSmash]: reach(17, 26, 42.0, 20.0), [AttackStyle.neutralAir]: reach(6, 16, 34.0, 64.0),
      [AttackStyle.forwardAir]: reach(6, 12, 42.0, 62.0), [AttackStyle.backAir]: reach(10, 16, -44.0, 62.0),
      [AttackStyle.upAir]: reach(8, 15, 12.0, 120.0), [AttackStyle.downAir]: reach(12, 20, 12.0, -20.0),
      [AttackStyle.grab]: reach(6, 11, 48.0, 54.0),
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(5, 2, 13, 0, [heroRegion(5, 6, capsule(20.0, 54.0, 50.0, 54.0, 10.0), ordinary(3.1710000038146973, 25, 53.130001068115234, 16.0))])),
    [AttackStyle.jab2]: heroMove(6, 3, 16, 0, [heroRegion(6, 8, capsule(24.0, 54.0, 58.0, 54.0), ordinary(4.228000164031982, 35))]),
    [AttackStyle.forwardTilt]: tilt(58.0, 35), [AttackStyle.forwardTiltUp]: tilt(98.0, 55), [AttackStyle.forwardTiltDown]: tilt(14.0, 25),
    [AttackStyle.upTilt]: heroMove(8, 4, 20, 0, [heroRegion(8, 11, capsule(18.0, 62.0, 18.0, 120.0, 16.0), ordinary(7.39900016784668, 90, 91.7699966430664, 24.0))]),
    [AttackStyle.downTilt]: heroMove(7, 3, 18, 0, [heroRegion(7, 9, capsule(20.0, 12.0, 86.0, 10.0), ordinary(6.3420000076293945, 80, 91.7699966430664, 24.0))]),
    [AttackStyle.dashAttack]: heroMove(10, 4, 24, 0, [heroRegion(10, 13, capsule(26.0, 46.0, 88.0, 46.0, 14.0), ordinary(8.456000328063965, 55))], 64.0, true),
    [AttackStyle.forwardSmash]: heroMove(13, 3, 31, 0, [heroRegion(13, 15, capsule(30.0, 60.0, 126.0, 60.0), ordinary(15.854999542236328, 35, 132.3419952392578, 28.0))]),
    [AttackStyle.upSmash]: heroMove(18, 5, 31, 0, [heroRegion(18, 22, capsule(0.0, 36.0, 0.0, 145.0, 18.0), ordinary(14.79800033569336, 90, 106.26000213623047, 28.0))]),
    [AttackStyle.downSmash]: heroMove(20, 4, 32, 0, [
      heroRegion(20, 23, capsule(28.0, 14.0, 101.0, 14.0, 14.0), ordinary(13.741000175476074, 25, 132.3419952392578, 28.0)),
      heroRegion(20, 23, capsule(-28.0, 14.0, -101.0, 14.0, 14.0), ordinary(13.741000175476074, 25, 132.3419952392578, 28.0, true)),
    ]),
    [AttackStyle.neutralAir]: cleanLateMove(heroMove(8, 6, 22, 14, [heroRegion(8, 13, capsule(-40.0, 55.0, 40.0, 55.0, 25.0), ordinary(6.3420000076293945, 55))]), 2),
    [AttackStyle.forwardAir]: heroMove(8, 3, 25, 14, [heroRegion(8, 10, capsule(24.0, 60.0, 95.0, 60.0), ordinary(9.512999534606934, 40, 91.7699966430664, 24.0))]),
    [AttackStyle.backAir]: heroMove(12, 3, 24, 16, [heroRegion(12, 14, capsule(-24.0, 60.0, -111.0, 60.0), ordinary(10.569999694824219, 35, 106.26000213623047, 28.0, true))]),
    [AttackStyle.upAir]: heroMove(10, 4, 21, 14, [heroRegion(10, 13, capsule(-24.0, 126.0, 24.0, 136.0, 19.0), ordinary(8.456000328063965, 90, 91.7699966430664, 24.0))]),
    [AttackStyle.downAir]: heroMove(15, 3, 29, 20, [heroRegion(15, 17, capsule(0.0, 20.0, 0.0, -66.0, 16.0), { ...ordinary(11.626999855041504, 90, 91.7699966430664, 24.0), launchZ: -1.0 }, ordinary(11.626999855041504, 70, 91.7699966430664, 24.0))]),
    [AttackStyle.grab]: heroMove(8, 2, 26, 0, [heroRegion(8, 9, capsule(20.0, 54.0, 58.0, 54.0), medivhHit(0.0, 35, 0.0, 0.0))]),
    [AttackStyle.getupAttack]: heroMove(17, 3, 30, 0, [heroRegion(17, 19, capsule(-65.0, 20.0, 65.0, 20.0, 18.0), ordinary(7.39900016784668, 35))]),
    [AttackStyle.ledgeAttack]: heroMove(17, 3, 21, 0, [heroRegion(17, 19, capsule(20.0, 50.0, 90.0, 50.0), ordinary(7.39900016784668, 35))]),
  },
  throws: {
    [GrabAction.pummel]: throwMove(1, 0, ordinary(3.1710000038146973, 35, 0.0, 0.0)),
    [GrabAction.throwForward]: throwMove(14, 22, ordinary(7.39900016784668, 35)),
    [GrabAction.throwBack]: throwMove(17, 25, ordinary(9.512999534606934, 40, 106.26000213623047, 28.0, true)),
    [GrabAction.throwUp]: throwMove(16, 15, ordinary(7.39900016784668, 90, 53.130001068115234, 50.0)),
    [GrabAction.throwDown]: throwMove(18, 24, ordinary(6.3420000076293945, 70, 38.63999938964844, 75.0)),
  },
});

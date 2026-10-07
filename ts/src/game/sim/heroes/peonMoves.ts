import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction, HitElement } from "../codes";
import { heroHurtPose, heroMove, heroRegion, jabStep, type FighterMoves, type MoveRegion, type StrikeCapsule } from "../heroMoves";
import { hurtPart, type HurtPart, type HurtPose } from "../hurtboxes";
import { groundHit } from "./groundNormals";

export const peonHit = (damage: number, angle: 25 | 35 | 40 | 55 | 70 | 85 | 90, growth = 90.0, base = 22.0, behind = false) =>
  groundHit(damage, angle, growth, base, HitElement.normal, behind);

const blade = (x1: number, z1: number, x2: number, z2: number, radius = 8.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const swing = (first: number, points: readonly (readonly [number, number])[], damage: number, angle: 25 | 35 | 40 | 55 | 70 | 85 | 90, growth = 90.0, base = 22.0, behind = false): readonly MoveRegion[] =>
  points.map(([x, z], index) => heroRegion(first + index, first + index, blade(behind ? -16.0 : 16.0, 48.0, x, z), peonHit(damage, angle, growth, base, behind)));

const BODY = hurtPart(0.0, 4.0, 0.0, f32(f32(105.44) - f32(42.24)), f32(21.12));
const reaching = (first: number, last: number, x: number, z: number): readonly HurtPose[] => {
  const parts: readonly HurtPart[] = [BODY, hurtPart(12.0, 48.0, x, z, 10.0)];
  return [heroHurtPose(Math.max(1, first - 2), last + 2, parts)];
};
const tilt = (z: number) => heroMove(8, 3, 19, 0, swing(8, [[92.0, f32(z + 16.0)], [92.0, z], [84.0, f32(z - 16.0)]], 9.0, 40));

export const PEON_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: 1.25,
  maxPummels: 1,
  hurtboxes: {
    stand: [BODY],
    attacks: {
      [AttackStyle.jab]: reaching(4, 5, 42.0, 48.0),
      [AttackStyle.jab2]: reaching(6, 7, 44.0, 50.0),
      [AttackStyle.forwardTilt]: reaching(8, 10, 55.0, 48.0),
      [AttackStyle.forwardTiltUp]: reaching(8, 10, 55.0, 66.0),
      [AttackStyle.forwardTiltDown]: reaching(8, 10, 55.0, 28.0),
      [AttackStyle.upTilt]: reaching(7, 10, 12.0, 92.0),
      [AttackStyle.downTilt]: reaching(6, 8, 45.0, 18.0),
      [AttackStyle.dashAttack]: reaching(10, 13, 54.0, 38.0),
      [AttackStyle.forwardSmash]: reaching(22, 24, 70.0, 60.0),
      [AttackStyle.upSmash]: reaching(17, 20, 10.0, 110.0),
      [AttackStyle.downSmash]: [...reaching(18, 20, 55.0, 18.0), ...reaching(21, 22, -55.0, 18.0)],
      [AttackStyle.neutralAir]: [...reaching(6, 8, 45.0, 48.0), ...reaching(9, 10, -45.0, 48.0)],
      [AttackStyle.forwardAir]: reaching(11, 13, 62.0, 45.0),
      [AttackStyle.backAir]: reaching(9, 11, -72.0, 48.0),
      [AttackStyle.upAir]: reaching(8, 10, 8.0, 92.0),
      [AttackStyle.downAir]: reaching(14, 17, 10.0, -20.0),
      [AttackStyle.grab]: reaching(8, 9, 48.0, 40.0),
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(4, 2, 12, 0, swing(4, [[50.0, 48.0], [50.0, 42.0]], 3.0, 70, 45.0, 14.0))),
    [AttackStyle.jab2]: heroMove(6, 2, 18, 0, swing(6, [[62.0, 62.0], [62.0, 32.0]], 5.0, 40, 80.0, 22.0)),
    [AttackStyle.forwardTilt]: tilt(48.0),
    [AttackStyle.forwardTiltUp]: tilt(72.0),
    [AttackStyle.forwardTiltDown]: tilt(24.0),
    [AttackStyle.upTilt]: heroMove(7, 4, 20, 0, swing(7, [[45.0, 106.0], [15.0, 118.0], [-15.0, 118.0], [-36.0, 102.0]], 7.0, 85, 70.0, 40.0)),
    [AttackStyle.downTilt]: heroMove(6, 3, 19, 0, swing(6, [[74.0, 8.0], [74.0, 16.0], [66.0, 28.0]], 6.0, 70, 65.0, 45.0)),
    [AttackStyle.dashAttack]: heroMove(10, 4, 25, 0, swing(10, [[80.0, 38.0], [80.0, 42.0], [74.0, 48.0], [68.0, 50.0]], 10.0, 55), 34.0, true),
    [AttackStyle.forwardSmash]: heroMove(22, 3, 35, 0, swing(22, [[110.0, 104.0], [128.0, 55.0], [116.0, 8.0]], 19.0, 40, 120.0, 28.0)),
    [AttackStyle.upSmash]: heroMove(17, 4, 31, 0, swing(17, [[34.0, 136.0], [10.0, 148.0], [-10.0, 148.0], [-34.0, 136.0]], 16.0, 90, 120.0, 26.0)),
    [AttackStyle.downSmash]: heroMove(18, 5, 32, 0, [
      ...swing(18, [[100.0, 22.0], [100.0, 8.0], [90.0, 2.0]], 14.0, 25, 110.0, 26.0),
      ...swing(21, [[-100.0, 20.0], [-100.0, 5.0]], 14.0, 25, 110.0, 26.0, true),
    ]),
    [AttackStyle.neutralAir]: heroMove(6, 5, 21, 12, [
      ...swing(6, [[70.0, 40.0], [50.0, 78.0], [0.0, 98.0]], 8.0, 55),
      ...swing(9, [[-50.0, 78.0], [-70.0, 40.0]], 8.0, 55, 90.0, 22.0, true),
    ]),
    [AttackStyle.forwardAir]: heroMove(11, 3, 25, 16, swing(11, [[92.0, 90.0], [102.0, 40.0], [88.0, -10.0]], 12.0, 40, 105.0, 24.0)),
    [AttackStyle.backAir]: heroMove(9, 3, 24, 14, swing(9, [[-80.0, 48.0], [-80.0, 40.0], [-72.0, 34.0]], 11.0, 35, 105.0, 24.0, true)),
    [AttackStyle.upAir]: heroMove(8, 3, 23, 12, swing(8, [[22.0, 122.0], [0.0, 130.0], [-22.0, 122.0]], 9.0, 85, 100.0, 24.0)),
    [AttackStyle.downAir]: heroMove(14, 4, 28, 18, [heroRegion(14, 17, blade(10.0, 0.0, 10.0, -62.0),
      { ...peonHit(13.0, 90, 100.0, 24.0), launchZ: -1.0 }, peonHit(13.0, 55, 100.0, 24.0))]),
    [AttackStyle.grab]: heroMove(8, 2, 25, 0, [heroRegion(8, 9, blade(18.0, 40.0, 48.0, 40.0, 10.0), peonHit(0.0, 90, 0.0, 0.0))]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 60, totalFrames: 68, effect: peonHit(3.0, 90, 0.0, 0.0) },
    [GrabAction.throwForward]: { contactFrame: 13, totalFrames: 34, effect: peonHit(7.0, 35, 105.0, 22.0) },
    [GrabAction.throwBack]: { contactFrame: 16, totalFrames: 40, effect: peonHit(8.0, 40, 110.0, 22.0, true) },
    [GrabAction.throwUp]: { contactFrame: 12, totalFrames: 22, effect: peonHit(6.0, 85, 55.0, 50.0) },
    [GrabAction.throwDown]: { contactFrame: 17, totalFrames: 42, effect: peonHit(5.0, 25, 40.0, 75.0) },
  },
};

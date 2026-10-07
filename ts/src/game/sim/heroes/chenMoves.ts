import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../codes";
import { hurtCapsule } from "../../physics/contactGeometry";
import { heroHurtPose, heroMove, heroRegion, jabStep, type FighterMoves, type StrikeCapsule } from "../heroMoves";
import { hurtPart, type HurtPose } from "../hurtboxes";
import type { HitEffect } from "../hitRegions";

export const chenCapsule = (x1: number, z1: number, x2: number, z2: number, radius: number): StrikeCapsule => ({ x1, z1, x2, z2, radius });
export const chenHit = (damage: number, growth: number, base: number, x: number, z: number, element: HitElement = HitElement.normal): Readonly<HitEffect> =>
  ({ damage: growth === 0.0 ? damage : f32(damage * 1.25), growth, base, launchX: f32(x), launchZ: f32(z), electric: false, element });
const poke = (damage: number) => chenHit(damage, 78.0, 18.0, f32(0.819152), f32(0.573576));
const lift = (damage: number) => chenHit(damage, 83.0, 28.0, f32(0.173648), f32(0.984808));
const finish = (damage: number, back = false) => chenHit(damage, 108.0, 28.0, back ? -f32(0.766044) : f32(0.766044), f32(0.642788));
const region = (first: number, last: number, x1: number, z1: number, x2: number, z2: number, radius: number, effect: Readonly<HitEffect>) =>
  heroRegion(first, last, chenCapsule(x1, z1, x2, z2, radius), effect);
const torso = hurtCapsule(Character.chen);
const body = hurtPart(torso.x1, torso.z1, torso.x2, torso.z2, torso.radius);
const reach = (first: number, last: number, x: number, z: number): readonly HurtPose[] =>
  [heroHurtPose(first, last, [body, hurtPart(x < 0 ? -12.0 : 12.0, 60.0, x, z, 11.0)])];
const tilt = (height: number) => heroMove(9, 3, 21, 0, [region(9, 11, 22.0, 58.0, 96.0, height, 12.0, poke(9.0))]);

export const CHEN_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack, smashMaxChargeFrames: 45, smashMaxDamageMultiplier: 1.25, maxPummels: 1,
  hurtboxes: {
    stand: [body], attacks: {
      [AttackStyle.jab]: reach(3, 8, 48.0, 64.0), [AttackStyle.jab2]: reach(4, 9, 50.0, 58.0), [AttackStyle.jab3]: reach(6, 12, 44.0, 52.0),
      [AttackStyle.forwardTilt]: reach(7, 14, 49.0, 58.0), [AttackStyle.forwardTiltUp]: reach(7, 14, 49.0, 80.0), [AttackStyle.forwardTiltDown]: reach(7, 14, 49.0, 34.0),
      [AttackStyle.upTilt]: reach(5, 13, 20.0, 104.0), [AttackStyle.downTilt]: reach(5, 12, 70.0, 20.0),
      [AttackStyle.dashAttack]: reach(8, 17, 54.0, 50.0), [AttackStyle.forwardSmash]: reach(16, 26, 58.0, 60.0),
      [AttackStyle.upSmash]: reach(12, 22, 14.0, 116.0), [AttackStyle.downSmash]: [...reach(12, 17, 46.0, 24.0), ...reach(18, 24, -46.0, 24.0)],
      [AttackStyle.neutralAir]: [heroHurtPose(5, 14, [body, hurtPart(-56.0, 44.0, 58.0, 48.0, 12.0)])],
      [AttackStyle.forwardAir]: [...reach(6, 8, 40.0, 48.0), ...reach(9, 17, 78.0, 48.0), ...reach(18, 20, 40.0, 48.0)], [AttackStyle.backAir]: reach(6, 14, -76.0, 44.0),
      [AttackStyle.upAir]: reach(5, 13, 12.0, 106.0), [AttackStyle.downAir]: reach(11, 21, 12.0, -60.0),
      [AttackStyle.grab]: reach(5, 12, 52.0, 48.0),
    },
  },
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(4, 2, 11, 0, [region(4, 5, 18.0, 62.0, 48.0, 64.0, 12.0, poke(3.0))])),
    [AttackStyle.jab2]: jabStep(heroMove(5, 2, 13, 0, [region(5, 6, 18.0, 56.0, 62.0, 58.0, 11.0, poke(3.0))])),
    [AttackStyle.jab3]: heroMove(7, 3, 18, 0, [region(7, 9, 18.0, 46.0, 48.0, 58.0, 20.0, poke(5.0))]),
    [AttackStyle.forwardTilt]: tilt(58.0), [AttackStyle.forwardTiltUp]: tilt(88.0), [AttackStyle.forwardTiltDown]: tilt(26.0),
    [AttackStyle.upTilt]: heroMove(7, 4, 20, 0, [region(7, 10, 18.0, 72.0, 26.0, 112.0, 15.0, lift(7.0))]),
    [AttackStyle.downTilt]: heroMove(7, 3, 20, 0, [region(7, 9, 14.0, 22.0, 70.0, 16.0, 13.0, lift(6.0))]),
    [AttackStyle.dashAttack]: heroMove(10, 5, 27, 0, [region(10, 14, 16.0, 42.0, 52.0, 68.0, 24.0, poke(10.0))]),
    [AttackStyle.forwardSmash]: heroMove(19, 4, 34, 0, [region(19, 22, 24.0, 66.0, 104.0, 48.0, 14.0, finish(18.0))]),
    [AttackStyle.upSmash]: heroMove(15, 4, 31, 0, [region(15, 18, 12.0, 62.0, 8.0, 122.0, 24.0, chenHit(16.0, 108.0, 30.0, 0.0, 1.0))]),
    [AttackStyle.downSmash]: heroMove(15, 6, 32, 0, [region(15, 17, 18.0, 24.0, 88.0, 18.0, 13.0, finish(14.0)), region(18, 20, -18.0, 24.0, -88.0, 18.0, 13.0, finish(14.0, true))]),
    [AttackStyle.neutralAir]: heroMove(7, 5, 22, 14, [region(7, 11, -55.0, 42.0, 58.0, 48.0, 15.0, poke(8.0))]),
    [AttackStyle.forwardAir]: heroMove(11, 4, 27, 17, [region(11, 14, 16.0, 45.0, 78.0, 50.0, 13.0, finish(12.0))]),
    [AttackStyle.backAir]: heroMove(8, 3, 23, 14, [region(8, 10, -18.0, 42.0, -76.0, 45.0, 13.0, finish(11.0, true))]),
    [AttackStyle.upAir]: heroMove(7, 4, 22, 14, [region(7, 10, -22.0, 102.0, 28.0, 110.0, 13.0, lift(8.0))]),
    [AttackStyle.downAir]: heroMove(14, 4, 30, 21, [heroRegion(14, 17, chenCapsule(12.0, 6.0, 12.0, -60.0, 13.0), chenHit(12.0, 95.0, 24.0, 0.0, -1.0), lift(12.0))]),
    [AttackStyle.grab]: heroMove(7, 2, 24, 0, [region(7, 8, 18.0, 50.0, 52.0, 48.0, 12.0, chenHit(0.0, 0.0, 0.0, 0.0, 0.0))]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: chenHit(3.0, 0.0, 0.0, 0.0, 0.0) },
    [GrabAction.throwForward]: { contactFrame: 12, totalFrames: 33, effect: finish(8.0) },
    [GrabAction.throwBack]: { contactFrame: 16, totalFrames: 39, effect: finish(9.0, true) },
    [GrabAction.throwUp]: { contactFrame: 14, totalFrames: 25, effect: chenHit(7.0, 55.0, 50.0, 0.0, 1.0) },
    [GrabAction.throwDown]: { contactFrame: 18, totalFrames: 42, effect: chenHit(6.0, 40.0, 75.0, f32(0.906308), f32(0.422618)) },
  },
};

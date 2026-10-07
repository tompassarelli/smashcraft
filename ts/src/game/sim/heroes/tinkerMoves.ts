import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../codes";
import { hurtCapsule } from "../../physics/contactGeometry";
import { heroHurtPose, heroMove, heroRegion, jabStep, type FighterMoves, type MoveRegion, type StrikeCapsule } from "../heroMoves";
import type { HitEffect } from "../hitRegions";
import { hurtPart } from "../hurtboxes";

const STRENGTH = {
  link: { growth: 50.0, base: 12.0 }, poke: { growth: 75.0, base: 20.0 },
  launch: { growth: 90.0, base: 32.0 }, edge: { growth: 105.0, base: 25.0 },
  kill: { growth: 118.0, base: 28.0 }, spike: { growth: 95.0, base: 22.0 },
  juggle: { growth: 55.0, base: 50.0 }, chase: { growth: 40.0, base: 75.0 },
} as const;
const ANGLES = {
  25: [f32(0.906307787), f32(0.422618262)], 35: [f32(0.819152044), f32(0.573576436)],
  45: [f32(0.707106781), f32(0.707106781)], 55: [f32(0.573576436), f32(0.819152044)],
  70: [f32(0.342020143), f32(0.939692621)], 85: [f32(0.087155743), f32(0.996194698)], 270: [0.0, -1.0],
} as const;
export function tinkerHit(damage: number, kind: keyof typeof STRENGTH, angle: keyof typeof ANGLES, facing = 1.0, element: HitElement = HitElement.normal): Readonly<HitEffect> {
  const direction = ANGLES[angle];
  return { damage, ...STRENGTH[kind], launchX: f32(direction[0] * facing), launchZ: direction[1], electric: false, element };
}
export const claw = (x1: number, z1: number, x2: number, z2: number, radius = 10.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const region = (first: number, last: number, strike: StrikeCapsule, effect: Readonly<HitEffect>, grounded?: Readonly<HitEffect>): MoveRegion => heroRegion(first, last, strike, effect, grounded);
const poke = (first: number, last: number, reach: number, height: number, effect: Readonly<HitEffect>) => [region(first, last, claw(18.0, 48.0, reach, height), effect)];
const body = hurtCapsule(Character.tinker);
const BODY = hurtPart(0.0, 4.0, 0.0, body.z2, body.radius);
const limb = (first: number, last: number, x: number, z: number) => [heroHurtPose(first - 2, last + 2, [BODY, hurtPart(12.0, 40.0, x, z, 12.0)])];
const none = { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

export const TINKER_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack, smashMaxChargeFrames: 45, smashMaxDamageMultiplier: 1.25, maxPummels: 1,
  hurtboxes: { stand: [BODY], attacks: {
    [AttackStyle.jab]: limb(4, 5, 38.0, 48.0), [AttackStyle.jab2]: limb(4, 5, 40.0, 56.0),
    [AttackStyle.jab3]: limb(6, 8, 43.0, 48.0), [AttackStyle.grab]: limb(8, 9, 55.0, 46.0),
    [AttackStyle.dashAttack]: limb(10, 13, 54.0, 42.0),
  } },
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(4, 2, 12, 0, poke(4, 5, 52.0, 46.0, tinkerHit(3.0, "link", 35)))),
    [AttackStyle.jab2]: jabStep(heroMove(4, 2, 12, 0, poke(4, 5, 57.0, 55.0, tinkerHit(3.0, "link", 70)))),
    [AttackStyle.jab3]: heroMove(6, 3, 18, 0, poke(6, 8, 68.0, 48.0, tinkerHit(5.0, "poke", 45))),
    [AttackStyle.forwardTilt]: heroMove(8, 3, 20, 0, poke(8, 10, 98.0, 48.0, tinkerHit(8.0, "edge", 35))),
    [AttackStyle.forwardTiltUp]: heroMove(8, 3, 20, 0, poke(8, 10, 88.0, 94.0, tinkerHit(8.0, "edge", 55))),
    [AttackStyle.forwardTiltDown]: heroMove(8, 3, 20, 0, poke(8, 10, 96.0, 12.0, tinkerHit(8.0, "edge", 25))),
    [AttackStyle.upTilt]: heroMove(7, 4, 22, 0, [region(7, 10, claw(-28.0, 86.0, 30.0, 134.0, 15.0), tinkerHit(7.0, "launch", 85))]),
    [AttackStyle.downTilt]: heroMove(6, 3, 19, 0, [region(6, 8, claw(20.0, 14.0, 87.0, 8.0), tinkerHit(6.0, "launch", 70))]),
    [AttackStyle.dashAttack]: heroMove(10, 4, 26, 0, [region(10, 13, claw(15.0, 36.0, 70.0, 44.0, 17.0), tinkerHit(10.0, "launch", 55))], 38.0, true),
    [AttackStyle.forwardSmash]: heroMove(20, 4, 34, 0, [region(20, 23, claw(28.0, 68.0, 124.0, 42.0, 17.0), tinkerHit(17.0, "kill", 35))]),
    [AttackStyle.upSmash]: heroMove(17, 5, 32, 0, [region(17, 21, claw(0.0, 65.0, 0.0, 160.0, 22.0), tinkerHit(16.0, "kill", 85, 1.0, HitElement.fire))]),
    [AttackStyle.downSmash]: heroMove(16, 6, 32, 0, [
      region(16, 18, claw(20.0, 14.0, 107.0, 10.0, 13.0), tinkerHit(13.0, "edge", 25)),
      region(19, 21, claw(-20.0, 14.0, -107.0, 10.0, 13.0), tinkerHit(13.0, "edge", 25, -1.0)),
    ]),
    [AttackStyle.neutralAir]: heroMove(8, 6, 24, 16, [
      region(8, 10, claw(10.0, 55.0, 86.0, 45.0, 14.0), tinkerHit(9.0, "poke", 45)),
      region(11, 13, claw(-10.0, 55.0, -86.0, 45.0, 14.0), tinkerHit(9.0, "poke", 45, -1.0)),
    ]),
    [AttackStyle.forwardAir]: heroMove(10, 3, 24, 16, poke(10, 12, 95.0, 65.0, tinkerHit(10.0, "edge", 35))),
    [AttackStyle.backAir]: heroMove(12, 3, 26, 18, [region(12, 14, claw(-20.0, 38.0, -102.0, 44.0, 15.0), tinkerHit(12.0, "edge", 35, -1.0, HitElement.fire))]),
    [AttackStyle.upAir]: heroMove(8, 4, 23, 14, [region(8, 11, claw(-20.0, 88.0, 24.0, 143.0, 13.0), tinkerHit(8.0, "launch", 85))]),
    [AttackStyle.downAir]: heroMove(16, 4, 31, 22, [region(16, 19, claw(0.0, 10.0, 0.0, -98.0, 16.0), tinkerHit(12.0, "spike", 270, 1.0, HitElement.fire), tinkerHit(12.0, "spike", 55, 1.0, HitElement.fire))]),
    [AttackStyle.grab]: heroMove(8, 2, 25, 0, [region(8, 9, claw(20.0, 45.0, 64.0, 46.0, 12.0), none)]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { ...none, damage: 3.0 } },
    [GrabAction.throwForward]: { contactFrame: 14, totalFrames: 36, effect: tinkerHit(8.0, "edge", 35) },
    [GrabAction.throwBack]: { contactFrame: 18, totalFrames: 43, effect: tinkerHit(9.0, "edge", 45, -1.0) },
    [GrabAction.throwUp]: { contactFrame: 15, totalFrames: 24, effect: tinkerHit(7.0, "juggle", 85) },
    [GrabAction.throwDown]: { contactFrame: 19, totalFrames: 44, effect: tinkerHit(6.0, "chase", 25) },
  },
};

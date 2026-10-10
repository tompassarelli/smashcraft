import { AttackStyle, GrabAction, HitElement } from "../codes";
import { heroHurtPose, heroMove, heroRegion, jabStep, type FighterMoves, type StrikeCapsule, tipperMove } from "../heroMoves";
import { groundHit } from "./groundNormals";
import { hurtPart } from "../hurtboxes";

export const gromHit = (damage: number, angle: 25 | 35 | 40 | 55 | 70 | 75 | 80 | 90, growth = 79.55999755859375, base = 19.799999237060547, behind = false) => groundHit(damage, angle, growth, base, HitElement.slash, behind);
const axe = (x1: number, z1: number, x2: number, z2: number, radius = 12.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
const move = (first: number, active: number, total: number, landing: number, regions: Parameters<typeof heroMove>[4], travel?: number, stops?: boolean) => heroMove(first, active, total - first + 1 - active, landing, regions, travel, stops);
const tilt = (z: number, angle: 25 | 35 | 55) => move(9, 3, 28, 0, [heroRegion(9, 11, axe(24.0, 55.0, 104.0, z), gromHit(8.949599266052246, angle))]);
const torso = hurtPart(0.0, 8.0, 0.0, 125.0, 24.0);
const reach = (first: number, last: number, x: number, z: number) => [heroHurtPose(first, last, [torso, hurtPart(10.0, 60.0, x, z, 10.0)])];
export const GROM_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack, smashMaxChargeFrames: 45, smashMaxDamageMultiplier: 1.25, maxPummels: 1,
  hurtboxes: { stand: [torso], crouch: [hurtPart(0.0, 8.0, 0.0, 75.0, 24.0)], attacks: {
    [AttackStyle.jab]: reach(2, 8, 36.0, 52.0), [AttackStyle.jab2]: reach(4, 10, 48.0, 55.0),
    [AttackStyle.forwardTilt]: reach(7, 14, 60.0, 55.0), [AttackStyle.forwardTiltUp]: reach(7, 14, 52.0, 90.0), [AttackStyle.forwardTiltDown]: reach(7, 14, 52.0, 24.0),
    [AttackStyle.upTilt]: reach(6, 14, 8.0, 120.0), [AttackStyle.downTilt]: reach(5, 12, 54.0, 18.0),
    [AttackStyle.dashAttack]: reach(7, 16, 60.0, 50.0), [AttackStyle.forwardSmash]: reach(16, 24, 66.0, 50.0), [AttackStyle.upSmash]: reach(12, 20, 0.0, 130.0), [AttackStyle.downSmash]: reach(13, 23, 56.0, 22.0),
    [AttackStyle.neutralAir]: reach(6, 16, 45.0, 58.0), [AttackStyle.forwardAir]: reach(10, 17, 64.0, 56.0), [AttackStyle.backAir]: reach(8, 15, -60.0, 56.0), [AttackStyle.upAir]: reach(6, 14, 0.0, 122.0), [AttackStyle.downAir]: reach(13, 20, 0.0, -24.0), [AttackStyle.grab]: reach(6, 12, 48.0, 56.0),
  } },
  normals: {
    [AttackStyle.jab]: jabStep(move(4, 2, 14, 0, [heroRegion(4, 5, axe(18.0, 52.0, 52.0, 52.0, 8.0), gromHit(2.4407999515533447, 25, 49.724998474121094, 12.600000381469727))])),
    [AttackStyle.jab2]: move(6, 2, 20, 0, [heroRegion(6, 7, axe(20.0, 60.0, 74.0, 55.0), gromHit(4.8815999031066895, 35))]),
    [AttackStyle.forwardTilt]: tilt(55.0, 35), [AttackStyle.forwardTiltUp]: tilt(96.0, 55), [AttackStyle.forwardTiltDown]: tilt(18.0, 25),
    [AttackStyle.upTilt]: move(8, 4, 26, 0, [heroRegion(8, 11, axe(14.0, 60.0, 6.0, 144.0, 14.0), gromHit(7.3224005699157715, 90, 84.53250122070312, 23.399999618530273))]),
    [AttackStyle.downTilt]: move(7, 3, 24, 0, [heroRegion(7, 9, axe(18.0, 12.0, 96.0, 12.0), gromHit(6.508800029754639, 80, 69.61499786376953, 30.600000381469727))]),
    [AttackStyle.dashAttack]: move(9, 5, 32, 0, [heroRegion(9, 13, axe(16.0, 46.0, 84.0, 46.0, 18.0), gromHit(8.949599266052246, 55))], 52.0, true),
    [AttackStyle.forwardSmash]: tipperMove(move(18, 4, 46, 0, [heroRegion(18, 21, axe(24.0, 90.0, 132.0, 40.0), gromHit(16.27199935913086, 35, 111.38400268554688, 25.200000762939453))]), 0.30000001192092896),
    [AttackStyle.upSmash]: move(14, 4, 42, 0, [heroRegion(14, 17, axe(0.0, 60.0, 0.0, 160.0, 16.0), gromHit(13.83120059967041, 90, 107.40599822998047, 25.200000762939453))]),
    [AttackStyle.downSmash]: move(15, 6, 44, 0, [heroRegion(15, 17, axe(18.0, 12.0, 112.0, 12.0), gromHit(13.017600059509277, 25, 107.40599822998047, 25.200000762939453)), heroRegion(18, 20, axe(-18.0, 12.0, -112.0, 12.0), gromHit(13.017600059509277, 25, 107.40599822998047, 25.200000762939453, true))]),
    [AttackStyle.neutralAir]: move(8, 6, 28, 16, [heroRegion(8, 13, axe(-62.0, 54.0, 62.0, 54.0, 24.0), gromHit(8.13599967956543, 55))]),
    [AttackStyle.forwardAir]: move(12, 3, 34, 20, [heroRegion(12, 14, axe(18.0, 86.0, 120.0, 40.0), gromHit(11.390399932861328, 40, 91.49400329589844, 23.399999618530273))]),
    [AttackStyle.backAir]: move(10, 3, 30, 18, [heroRegion(10, 12, axe(-18.0, 64.0, -116.0, 54.0), gromHit(10.576799392700195, 35, 107.40599822998047, 23.399999618530273, true))]),
    [AttackStyle.upAir]: move(8, 4, 26, 16, [heroRegion(8, 11, axe(-24.0, 138.0, 24.0, 138.0, 16.0), gromHit(8.13599967956543, 90, 85.5270004272461, 23.399999618530273))]),
    [AttackStyle.downAir]: move(15, 3, 38, 24, [heroRegion(15, 17, axe(0.0, 16.0, 0.0, -64.0), { ...gromHit(12.204000473022461, 90, 89.50499725341797, 23.399999618530273), launchZ: -1.0 }, gromHit(12.204000473022461, 70, 89.50499725341797, 23.399999618530273))]),
    [AttackStyle.grab]: move(8, 2, 27, 0, [heroRegion(8, 9, axe(16.0, 56.0, 58.0, 56.0), gromHit(0.0, 35, 0.0, 0.0))]),
    [AttackStyle.getupAttack]: move(17, 3, 30, 0, [heroRegion(17, 19, axe(-85.0, 20.0, 85.0, 20.0), gromHit(5.695199966430664, 35))]),
    [AttackStyle.ledgeAttack]: move(17, 3, 21, 0, [heroRegion(17, 19, axe(16.0, 50.0, 96.0, 50.0), gromHit(5.695199966430664, 35))]),
  },
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: gromHit(2.7119998931884766, 35, 0.0, 0.0) },
    [GrabAction.throwForward]: { contactFrame: 14, totalFrames: 34, effect: gromHit(8.13599967956543, 40, 101.66000366210938, 26.0) },
    [GrabAction.throwBack]: { contactFrame: 16, totalFrames: 38, effect: gromHit(9.944000244140625, 40, 119.33999633789062, 26.0, true) },
    [GrabAction.throwUp]: { contactFrame: 14, totalFrames: 28, effect: gromHit(7.23199987411499, 75, 93.92500305175781, 60.0, true) },
    [GrabAction.throwDown]: { contactFrame: 18, totalFrames: 40, effect: gromHit(6.328000068664551, 25, 44.20000076293945, 72.0) },
  },
};

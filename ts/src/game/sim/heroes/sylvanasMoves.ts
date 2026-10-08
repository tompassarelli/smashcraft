import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character, GrabAction, HitElement } from "../codes";
import { hurtCapsule } from "../../physics/contactGeometry";
import { heroHurtPose, heroMove, heroRegion, jabStep, type AuthoredMove, type FighterMoves, type StrikeCapsule } from "../heroMoves";
import type { HitEffect } from "../hitRegions";
import { hurtPart, type HurtPart, type HurtPose } from "../hurtboxes";
import { groundHit } from "./groundNormals";

export const sylvanasStrike = (x1: number, z1: number, x2: number, z2: number, radius = 8.0): StrikeCapsule => ({ x1, z1, x2, z2, radius });
export const sylvanasHit = (damage: number, angle: Parameters<typeof groundHit>[1], growth = 85.0, base = 22.0, behind = false): Readonly<HitEffect> =>
  groundHit(damage, angle, growth, base, HitElement.dark, behind);
const bow = (first: number, active: number, recovery: number, landing: number, strike: StrikeCapsule, effect: Readonly<HitEffect>, groundedEffect?: Readonly<HitEffect>): AuthoredMove =>
  heroMove(first, active, recovery, landing, [heroRegion(first, first + active - 1, strike, effect, groundedEffect)]);
const frontTilt = (height: number): AuthoredMove => bow(9, 3, 18, 0, sylvanasStrike(22.0, 54.0, 104.0, height), sylvanasHit(9.0, 40));
const NOTHING = { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;
const SPIKE = { ...sylvanasHit(11.0, 90, 100.0, 24.0), launchZ: -1.0 };

const NORMALS: FighterMoves["normals"] = {
  [AttackStyle.jab]: jabStep(bow(4, 2, 13, 0, sylvanasStrike(18.0, 55.0, 46.0, 55.0), sylvanasHit(3.0, 35, 45.0, 12.0))),
  [AttackStyle.jab2]: jabStep(bow(5, 2, 14, 0, sylvanasStrike(18.0, 50.0, 51.0, 52.0), sylvanasHit(3.0, 45, 45.0, 12.0))),
  [AttackStyle.jab3]: bow(6, 2, 17, 0, sylvanasStrike(20.0, 50.0, 58.0, 60.0), sylvanasHit(5.0, 55, 80.0, 24.0)),
  [AttackStyle.forwardTilt]: frontTilt(46.0),
  [AttackStyle.forwardTiltUp]: frontTilt(80.0),
  [AttackStyle.forwardTiltDown]: frontTilt(18.0),
  [AttackStyle.upTilt]: bow(8, 4, 19, 0, sylvanasStrike(8.0, 68.0, 14.0, 132.0), sylvanasHit(7.0, 85, 65.0, 38.0)),
  [AttackStyle.downTilt]: bow(7, 3, 17, 0, sylvanasStrike(18.0, 18.0, 84.0, 10.0), sylvanasHit(7.0, 75, 60.0, 38.0)),
  [AttackStyle.dashAttack]: heroMove(10, 3, 22, 0, [heroRegion(10, 12, sylvanasStrike(18.0, 55.0, 102.0, 48.0), sylvanasHit(10.0, 50, 90.0, 24.0))], 55.0, true),
  [AttackStyle.forwardSmash]: bow(16, 3, 29, 0, sylvanasStrike(22.0, 60.0, 134.0, 58.0), sylvanasHit(16.5, 40, 110.0, 28.0)),
  [AttackStyle.upSmash]: bow(15, 4, 29, 0, sylvanasStrike(0.0, 82.0, 0.0, 158.0, 12.0), sylvanasHit(13.0, 90, 110.0, 28.0)),
  [AttackStyle.downSmash]: heroMove(14, 6, 28, 0, [
    heroRegion(14, 16, sylvanasStrike(18.0, 24.0, 100.0, 10.0), sylvanasHit(12.0, 25, 100.0, 25.0)),
    heroRegion(17, 19, sylvanasStrike(-18.0, 24.0, -100.0, 10.0), sylvanasHit(12.0, 25, 100.0, 25.0, true)),
  ]),
  [AttackStyle.neutralAir]: heroMove(6, 5, 18, 12, [
    heroRegion(6, 8, sylvanasStrike(18.0, 50.0, 80.0, 40.0), sylvanasHit(7.0, 50)),
    heroRegion(9, 10, sylvanasStrike(-18.0, 50.0, -80.0, 40.0), sylvanasHit(7.0, 50, 85.0, 22.0, true)),
  ]),
  [AttackStyle.forwardAir]: bow(10, 3, 23, 16, sylvanasStrike(18.0, 54.0, 112.0, 48.0), sylvanasHit(10.0, 40, 100.0, 24.0)),
  [AttackStyle.backAir]: bow(8, 3, 22, 12, sylvanasStrike(-18.0, 50.0, -102.0, 54.0), sylvanasHit(11.0, 35, 105.0, 26.0, true)),
  [AttackStyle.upAir]: bow(8, 4, 20, 12, sylvanasStrike(0.0, 68.0, 0.0, 118.0), sylvanasHit(8.0, 85, 90.0, 24.0)),
  [AttackStyle.downAir]: bow(12, 4, 28, 20, sylvanasStrike(0.0, 16.0, 8.0, -82.0), SPIKE, sylvanasHit(11.0, 55, 100.0, 24.0)),
  [AttackStyle.grab]: bow(7, 2, 23, 0, sylvanasStrike(12.0, 50.0, 48.0, 44.0, 12.0), NOTHING),
};

const body = hurtCapsule(Character.sylvanas);
export const SYLVANAS_STAND: readonly HurtPart[] = [hurtPart(body.x1, body.z1, body.x2, body.z2, body.radius)];
export const sylvanasReach = (x: number, z: number): readonly HurtPart[] => [...SYLVANAS_STAND, hurtPart(8.0, 65.0, x, z, 10.0)];
const limbPoses: { [style: number]: readonly HurtPose[] } = {};
for (const key in NORMALS) {
  const style = Number(key);
  const move = NORMALS[style];
  if (move === undefined) continue;
  limbPoses[style] = move.regions.map((region, index) => {
    const strike = region.hit.strike;
    if (strike === undefined) return heroHurtPose(1, move.totalFrames, SYLVANAS_STAND);
    const x = f32(Math.max(-48.0, Math.min(48.0, strike.x2)));
    const z = f32(Math.max(20.0, Math.min(112.0, strike.z2)));
    const next = move.regions[index + 1];
    const last = Math.min(move.totalFrames, region.lastFrame + 3, next === undefined ? move.totalFrames : Math.max(1, next.firstFrame - 1) - 1);
    return heroHurtPose(Math.max(1, region.firstFrame - 1), last, sylvanasReach(x, z));
  });
}

export const SYLVANAS_MOVES: FighterMoves = {
  normals: NORMALS,
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: 1.25,
  maxPummels: 1,
  hurtboxes: { stand: SYLVANAS_STAND, attacks: limbPoses },
  throws: {
    [GrabAction.pummel]: { contactFrame: 60, totalFrames: 75, effect: { ...NOTHING, damage: 3.0 } },
    [GrabAction.throwForward]: { contactFrame: 13, totalFrames: 33, effect: sylvanasHit(7.0, 40, 100.0, 24.0) },
    [GrabAction.throwBack]: { contactFrame: 16, totalFrames: 37, effect: sylvanasHit(8.0, 40, 100.0, 24.0, true) },
    [GrabAction.throwUp]: { contactFrame: 14, totalFrames: 24, effect: sylvanasHit(6.0, 90, 55.0, 45.0) },
    [GrabAction.throwDown]: { contactFrame: 18, totalFrames: 39, effect: sylvanasHit(6.0, 25, 40.0, 75.0) },
  },
};

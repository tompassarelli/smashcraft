import { downSmashHit } from "../downMoveValues";
import { f32 } from "wisp/src/sim/f32";
import { floorDiv } from "wisp/src/sim/intMath";
import { AttackStyle, GrabAction, HitElement, LAST_ATTACK_STYLE } from "../codes";
import { HERO_REFERENCE_HEIGHT, heroHurtPose, heroMove, heroRegion, type AuthoredMove, type FighterMoves, type MoveRegion, type StrikeCapsule } from "../heroMoves";
import { WARDEN_GROUND } from "./groundNormals";
import type { HitEffect } from "../hitRegions";
import { strongHit } from "../strongHits";
import { type FighterHurtboxes, type HurtPart, type HurtPose, hurtPart, hurtPose } from "../hurtboxes";
import { type Strike, drillStrikes, linkAt, multiHit } from "./multiHit";
import { type Angle, capsuleOf, makeHit, path } from "./authoring";


const S = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
const M = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
const L = f32(HERO_REFERENCE_HEIGHT * f32(1.10));
const GRAB = f32(HERO_REFERENCE_HEIGHT * f32(0.48));
const BLADE_RADIUS = 6.0;



export const wardenHit = makeHit({
  LINK: { growth: 68.2369613647461, base: 12.0 },
  POKE: { growth: 93.05039978027344, base: 18.0 },
  LAUNCH: { growth: 117.86384582519531, base: 20.0 },
  EDGE: { growth: 124.06719970703125, base: 22.0 },
  KILL: { growth: 136.4739227294922, base: 26.0 },
  SPIKE: { growth: 124.06719970703125, base: 22.0 },

  JUGGLE: { growth: 68.2369613647461, base: 45.0 },
  CHASE: { growth: 49.62688064575195, base: 75.0 },
}, HitElement.slash);


const blade = capsuleOf(BLADE_RADIUS);


function cut(first: number, heights: readonly number[], reach: number, inner: Readonly<HitEffect>, tip?: Readonly<HitEffect>, facing = 1.0): readonly MoveRegion[] {
  const regions: MoveRegion[] = [];
  const end = f32(reach - BLADE_RADIUS);
  const boundary = f32(reach - 30.0);
  for (let index = 0; index < heights.length; index++) {
    const height = heights[index];
    if (height === undefined) continue;
    const frame = first + index;
    const rise = f32(height - 45.0);
    const zAt = (x: number) => f32(45.0 + f32(rise * f32(x / end)));
    if (tip !== undefined) {
      const tipStart = f32(boundary + BLADE_RADIUS);
      regions.push(heroRegion(frame, frame, blade(f32(tipStart * facing), zAt(tipStart), f32(end * facing), height), strongHit(tip)));
    }
    const innerEnd = tip === undefined ? end : boundary;
    regions.push(heroRegion(frame, frame, blade(f32(18.0 * facing), zAt(18.0), f32(innerEnd * facing), zAt(innerEnd)), inner));
  }
  return regions;
}

function throwMove(release: number, recovery: number, damage: number, kind: Parameters<typeof wardenHit>[1], angle: Angle, facing = 1.0) {
  return { contactFrame: release, totalFrames: release + recovery, effect: wardenHit(damage, kind, angle, facing) };
}

const BACK_AIR = wardenHit(8.39594841003418, "KILL", 35, -1.0);

const SKY_LIFT: readonly Strike[] = [
  [blade(0.0, 48.0, 0.0, f32(M - BLADE_RADIUS), 10.0), linkAt(2.0, 8.0, 90, HitElement.normal)],
  [blade(16.0, 40.0, 30.0, f32(M - 20.0), 10.0), linkAt(2.0, 8.0, 95, HitElement.normal)],
  [blade(-16.0, 40.0, -30.0, f32(M - 20.0), 10.0), linkAt(2.0, 8.0, 85, HitElement.normal)],
];





const KNIFE_REACH = f32(S + 10.0);
const fallingKnives = (damage: number, base: number) => drillStrikes(-4.0, -70.0, KNIFE_REACH,
  { centre: linkAt(damage, base, 270), front: linkAt(damage, base, 250), back: linkAt(damage, base, 290) },
  { centre: linkAt(damage, base, 270), front: linkAt(damage, base, 250), back: linkAt(damage, base, 290) });
const FALLING_KNIVES: AuthoredMove = {
  ...heroMove(7, 7, 14, 10, multiHit([
    { first: 7, last: 7, strikes: fallingKnives(1.526535987854004, 25.0) },
    { first: 9, last: 9, strikes: fallingKnives(1.526535987854004, 25.0) },
    { first: 11, last: 11, strikes: fallingKnives(1.526535987854004, 25.0) },
    { first: 13, last: 13, strikes: fallingKnives(2.289803981781006, 40.0) },
  ])),
  fall: [{ firstFrame: 6, lastFrame: 12, speedZ: -9.0 }],
};
const GRAB_EFFECT = { damage: 0.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

const NORMALS: { readonly [style: number]: AuthoredMove | undefined } = {
    ...WARDEN_GROUND.normals,
    [AttackStyle.forwardSmash]: heroMove(15, 3, 30, 0, cut(15, [64.0, 45.0, 26.0], L, wardenHit(9.159215927124023, "KILL", 40), wardenHit(12.212287902832031, "KILL", 40))),
    [AttackStyle.upSmash]: heroMove(13, 4, 27, 0, path(13, [
      blade(12.0, 46.0, 24.0, f32(M - BLADE_RADIUS)),
      blade(8.0, 46.0, 10.0, f32(M - BLADE_RADIUS)),
      blade(0.0, 46.0, -10.0, f32(M - BLADE_RADIUS)),
      blade(-8.0, 46.0, -24.0, f32(M - BLADE_RADIUS)),
    ], wardenHit(10.685750961303711, "KILL", 90))),
    [AttackStyle.downSmash]: heroMove(12, 5, 28, 0, [
      ...path(12, [
        blade(18.0, 16.0, f32(M - BLADE_RADIUS), 16.0),
        blade(18.0, 8.0, f32(M - BLADE_RADIUS), 8.0),
        blade(18.0, 2.0, 84.0, 2.0),
      ], downSmashHit(wardenHit(12.0, "EDGE", 25))),
      ...path(15, [
        blade(-18.0, 12.0, -f32(M - BLADE_RADIUS), 12.0),
        blade(-18.0, 4.0, -f32(M - BLADE_RADIUS), 4.0),
      ], downSmashHit(wardenHit(12.0, "EDGE", 25, -1.0))),
    ]),
    [AttackStyle.neutralAir]: heroMove(5, 5, 18, 10, path(5, [
      blade(2.0908799171447754, 89.08098602294922, 96.7898941040039, 89.08098602294922),
      blade(-96.76730346679688, 89.08098602294922, 2.0908799171447754, 89.08098602294922),
      blade(-96.7898941040039, 89.08098602294922, -2.0908799171447754, 89.08098602294922),
      blade(-2.0908799171447754, 89.08098602294922, 96.76730346679688, 89.08098602294922),
      blade(96.76730346679688, 89.08098602294922, 96.76730346679688, 89.08098602294922),
    ], wardenHit(4.579607963562012, "POKE", 50))),
    [AttackStyle.forwardAir]: heroMove(8, 3, 20, 12, cut(8, [64.0, 45.0, 26.0], M, wardenHit(7.6326799392700195, "EDGE", 40))),

    [AttackStyle.backAir]: heroMove(7, 3, 22, 12, [
      ...cut(7, [54.0, 45.0, 36.0], M, BACK_AIR, undefined, -1.0),
      heroRegion(7, 9, blade(-8.0, 42.0, -16.0, 38.0, 8.0), BACK_AIR),
    ]),


    [AttackStyle.upAir]: heroMove(5, 9, 15, 10, multiHit([
      { first: 5, last: 6, strikes: SKY_LIFT },
      { first: 8, last: 9, strikes: SKY_LIFT },
      { first: 11, last: 13, strikes: [[blade(0.0, 48.0, 0.0, f32(M - BLADE_RADIUS), 10.0), wardenHit(3.8163399696350098, "LAUNCH", 85, 1.0, HitElement.normal)]] },
    ])),
    [AttackStyle.downAir]: FALLING_KNIVES,
    [AttackStyle.grab]: heroMove(6, 2, 22, 0, [heroRegion(6, 7,
      blade(16.0, 45.0, f32(GRAB - 10.0), 45.0, 10.0), GRAB_EFFECT)]),
};





const BODY_RADIUS = f32(24.0 * f32(0.90));
export const WARDEN_BODY: HurtPart = hurtPart(0.0, 4.0, 0.0, f32(f32(4.0 + 132.0) - f32(2.0 * BODY_RADIUS)), BODY_RADIUS);
const SHOULDER_Z = 70.0;
const LIMB_RADIUS = 7.0;
const LIMB_LEAD_FRAMES = 2;
const LIMB_HOLD_FRAMES = 4;
const LIMB_POSE_FRAMES = 3;
const HEEL = hurtPart(-4.0, 42.0, -26.0, 38.0, 8.0);

interface Point {
  readonly x: number;
  readonly z: number;
}


function handOf(strike: StrikeCapsule): Point {
  const near = (x: number, z: number) => f32(f32(x * x) + f32(f32(z - SHOULDER_Z) * f32(z - SHOULDER_Z)));
  return near(strike.x1, strike.z1) <= near(strike.x2, strike.z2) ? { x: strike.x1, z: strike.z1 } : { x: strike.x2, z: strike.z2 };
}


function handAt(move: AuthoredMove, frame: number, reachEnd: boolean): Point | undefined {
  let hand: Point | undefined;
  for (const region of move.regions) {
    const strike = region.hit.strike;
    if (strike === undefined || frame < region.firstFrame || frame > region.lastFrame) continue;

    const candidate = reachEnd ? { x: strike.x2, z: strike.z2 } : handOf(strike);
    if (hand === undefined || Math.abs(candidate.x) < Math.abs(hand.x)) hand = candidate;
  }
  return hand;
}






function limbPoses(move: AuthoredMove | undefined, reachEnd: boolean): readonly HurtPose[] {
  if (move === undefined) return [];
  let first = Number.MAX_SAFE_INTEGER;
  let last = -1;
  for (const region of move.regions) {
    first = Math.min(first, region.firstFrame);
    last = Math.max(last, region.lastFrame);
  }
  const poses: HurtPose[] = [];
  const from = Math.max(0, first - LIMB_LEAD_FRAMES);
  const through = last + LIMB_HOLD_FRAMES;
  for (let poseStart = from; poseStart <= through; poseStart += LIMB_POSE_FRAMES) {
    const poseEnd = through - poseStart < 2 * LIMB_POSE_FRAMES ? through : poseStart + LIMB_POSE_FRAMES - 1;
    const middle = Math.min(last, Math.max(first, floorDiv(poseStart + poseEnd, 2)));
    const hand = handAt(move, middle, reachEnd);
    if (hand !== undefined) poses.push(hurtPose(poseStart, poseEnd, [WARDEN_BODY, hurtPart(0.0, SHOULDER_Z, hand.x, hand.z, LIMB_RADIUS)]));
    if (poseEnd === through) break;
  }
  return poses;
}

function wardenHurtboxes(): FighterHurtboxes {
  const attacks: { [style: number]: readonly HurtPose[] | undefined } = {};
  for (let style = 0; style <= LAST_ATTACK_STYLE; style++) {
    if (NORMALS[style] === undefined) continue;

    attacks[style] = style === AttackStyle.backAir
      ? [heroHurtPose(5, 13, [WARDEN_BODY, HEEL])]
      : limbPoses(NORMALS[style], style === AttackStyle.grab);
  }
  return { stand: [WARDEN_BODY], attacks };
}

export const WARDEN_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: 1.25,
  maxPummels: 2,
  normals: NORMALS,
  hurtboxes: wardenHurtboxes(),
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 3.0, growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } },
    [GrabAction.throwForward]: throwMove(10, 18, 4.579607963562012, "EDGE", 35),
    [GrabAction.throwBack]: throwMove(14, 21, 5.3428754806518555, "EDGE", 40, -1.0),
    [GrabAction.throwUp]: throwMove(11, 9, 3.8163399696350098, "JUGGLE", 85),
    [GrabAction.throwDown]: throwMove(14, 20, 3.053071975708008, "CHASE", 25),
  },
};

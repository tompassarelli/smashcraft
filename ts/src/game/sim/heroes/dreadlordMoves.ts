import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, GrabAction, HitElement } from "../codes";
import { HERO_REFERENCE_HEIGHT, heroMove, heroRegion, type AuthoredMove, type FighterMoves, type MoveRegion, type StrikeCapsule } from "../heroMoves";
import { type FighterHurtboxes, type HurtPart, type HurtPose, hurtPart, hurtPose } from "../hurtboxes";
import { DREADLORD_GROUND } from "./groundNormals";
import type { HitEffect } from "../hitRegions";
import { type Strike, linkAt, multiHit } from "./multiHit";

// smashcraft:docs/design/roster.md supplies timing, damage and outer reach.
// These original limb paths require matching exposed hurt volumes in poses.
const S = f32(HERO_REFERENCE_HEIGHT * f32(0.55));
const M = f32(HERO_REFERENCE_HEIGHT * f32(0.80));
const L = f32(HERO_REFERENCE_HEIGHT * f32(1.10));
const GRAB = f32(HERO_REFERENCE_HEIGHT * f32(0.65));
const CLAW_RADIUS = 10.0;
const WING_RADIUS = 12.0;

// Provisional hypotheses in the existing knockback formula, not measured
// displacement bands or guaranteed follow-ups.
const CLASS = {
  LINK: { growth: 55.0, base: 12.0 },
  POKE: { growth: 75.0, base: 18.0 },
  LAUNCH: { growth: 95.0, base: 20.0 },
  EDGE: { growth: 100.0, base: 22.0 },
  KILL: { growth: 110.0, base: 26.0 },
  SPIKE: { growth: 100.0, base: 22.0 },
  // Throw roles (#107): an up throw's guaranteed short juggle and a down throw's tech chase.
  JUGGLE: { growth: 62.0, base: 50.0 },
  CHASE: { growth: 40.0, base: 75.0 },
} as const;
const DIRECTION = {
  25: { x: f32(0.906307787), z: f32(0.422618262) },
  35: { x: f32(0.819152044), z: f32(0.573576436) },
  40: { x: f32(0.766044443), z: f32(0.642787610) },
  50: { x: f32(0.642787610), z: f32(0.766044443) },
  55: { x: f32(0.573576436), z: f32(0.819152044) },
  65: { x: f32(0.422618262), z: f32(0.906307787) },
  70: { x: f32(0.342020143), z: f32(0.939692621) },
  85: { x: f32(0.087155743), z: f32(0.996194698) },
  270: { x: 0.0, z: -1.0 },
} as const;

const BATWING_DRAG: readonly Strike[] = [
  [capsule(16.0, 30.0, f32(M - WING_RADIUS), 50.0, WING_RADIUS), linkAt(2.0, 28.0, 100)],
  [capsule(0.0, 65.0, 0.0, f32(M - WING_RADIUS), WING_RADIUS), linkAt(2.0, 28.0, 90)],
  [capsule(-16.0, 30.0, -f32(M - WING_RADIUS), 50.0, WING_RADIUS), linkAt(2.0, 28.0, 80)],
];

export function dreadlordHit(damage: number, kind: keyof typeof CLASS, angle: keyof typeof DIRECTION, facing = 1.0, element: HitElement = HitElement.slash): Readonly<HitEffect> {
  const tuning = CLASS[kind];
  const direction = DIRECTION[angle];
  return { damage, growth: tuning.growth, base: tuning.base, launchX: f32(direction.x * facing), launchZ: direction.z, electric: false, element };
}

function capsule(x1: number, z1: number, x2: number, z2: number, radius = CLAW_RADIUS): StrikeCapsule {
  return { x1, z1, x2, z2, radius };
}

/** One narrow limb position per active tick; all contacts share one window. */
function path(first: number, strikes: readonly StrikeCapsule[], effect: Readonly<HitEffect>, groundedEffect?: Readonly<HitEffect>): readonly MoveRegion[] {
  return strikes.map((strike, index) => heroRegion(first + index, first + index, strike, effect, groundedEffect));
}

function rake(first: number, heights: readonly number[], reach: number, effect: Readonly<HitEffect>, facing = 1.0): readonly MoveRegion[] {
  return path(first, heights.map(height => capsule(f32(18.0 * facing), 46.0, f32(f32(reach - CLAW_RADIUS) * facing), height)), effect);
}

function wingSweep(first: number, facing: number): readonly MoveRegion[] {
  return path(first, [
    capsule(f32(16.0 * facing), 24.0, f32(f32(L - WING_RADIUS) * facing), 22.0, WING_RADIUS),
    capsule(f32(16.0 * facing), 20.0, f32(f32(L - WING_RADIUS) * facing), 12.0, WING_RADIUS),
    capsule(f32(16.0 * facing), 16.0, f32(f32(L - WING_RADIUS) * facing), 2.0, WING_RADIUS),
  ], dreadlordHit(14.0, "EDGE", 25, facing));
}

const NO_LAUNCH = { growth: 0.0, base: 0.0, launchX: 0.0, launchZ: 0.0, electric: false } as const;

const NORMALS: { readonly [style: number]: AuthoredMove | undefined } = {
    ...DREADLORD_GROUND.normals,
    [AttackStyle.forwardSmash]: heroMove(18, 4, 34, 0, [
      ...rake(18, [70.0, 58.0, 46.0, 34.0], L, dreadlordHit(18.0, "KILL", 40)),
      ...rake(18, [22.0, 34.0, 46.0, 58.0], L, dreadlordHit(18.0, "KILL", 40)),
    ]),
    [AttackStyle.upSmash]: heroMove(16, 5, 31, 0, path(16, [
      capsule(20.0, 58.0, 70.0, 95.0, WING_RADIUS),
      capsule(12.0, 68.0, 38.0, 125.0, WING_RADIUS),
      capsule(0.0, 75.0, 0.0, f32(L - WING_RADIUS), WING_RADIUS),
      capsule(-12.0, 68.0, -38.0, 125.0, WING_RADIUS),
      capsule(-20.0, 58.0, -70.0, 95.0, WING_RADIUS),
    ], dreadlordHit(16.0, "KILL", 85))),
    [AttackStyle.downSmash]: heroMove(15, 6, 32, 0, [...wingSweep(15, 1.0), ...wingSweep(18, -1.0)]),
    // Batwing Turn (#152): three wing beats around him. The first two drag the
    // target along with him at any percent; the third launches it.
    [AttackStyle.neutralAir]: heroMove(7, 10, 19, 14, multiHit([
      { first: 7, last: 8, strikes: BATWING_DRAG },
      { first: 10, last: 11, strikes: BATWING_DRAG },
      { first: 14, last: 16, strikes: [
        [capsule(16.0, 30.0, f32(M - WING_RADIUS), 45.0, WING_RADIUS), dreadlordHit(5.0, "POKE", 50)],
        [capsule(0.0, 65.0, 0.0, f32(M - WING_RADIUS), WING_RADIUS), dreadlordHit(5.0, "POKE", 50)],
        [capsule(-16.0, 30.0, -f32(M - WING_RADIUS), 45.0, WING_RADIUS), dreadlordHit(5.0, "POKE", 50, -1.0)],
      ] },
    ])),
    [AttackStyle.forwardAir]: heroMove(10, 4, 24, 15, rake(10, [64.0, 52.0, 40.0, 28.0], L, dreadlordHit(12.0, "EDGE", 40))),
    [AttackStyle.backAir]: heroMove(9, 4, 25, 15, path(9, [
      capsule(-16.0, 54.0, -f32(L - WING_RADIUS), 68.0, WING_RADIUS),
      capsule(-16.0, 46.0, -f32(L - WING_RADIUS), 52.0, WING_RADIUS),
      capsule(-16.0, 38.0, -f32(L - WING_RADIUS), 36.0, WING_RADIUS),
      capsule(-16.0, 30.0, -f32(L - WING_RADIUS), 20.0, WING_RADIUS),
    ], dreadlordHit(13.0, "KILL", 35, -1.0))),
    [AttackStyle.upAir]: heroMove(7, 3, 21, 12, path(7, [
      capsule(0.0, 68.0, 8.0, f32(M - 12.0), 12.0),
      capsule(0.0, 68.0, 0.0, f32(M - 12.0), 12.0),
      capsule(0.0, 68.0, -8.0, f32(M - 12.0), 12.0),
    ], dreadlordHit(8.0, "LAUNCH", 85))),
    [AttackStyle.downAir]: heroMove(14, 4, 29, 20, path(14, [
      capsule(12.0, 0.0, 12.0, -f32(M - CLAW_RADIUS)),
      capsule(8.0, 0.0, 8.0, -f32(M - CLAW_RADIUS)),
      capsule(4.0, 0.0, 4.0, -f32(M - CLAW_RADIUS)),
      capsule(0.0, 0.0, 0.0, -f32(M - CLAW_RADIUS)),
    ], dreadlordHit(12.0, "SPIKE", 270), dreadlordHit(12.0, "SPIKE", 55))),
    [AttackStyle.grab]: heroMove(7, 3, 26, 0, path(7, [
      capsule(14.0, 35.0, f32(GRAB - 12.0), 40.0, 12.0),
      capsule(14.0, 35.0, f32(GRAB - 12.0), 35.0, 12.0),
      capsule(14.0, 35.0, f32(GRAB - 12.0), 30.0, 12.0),
    ], { damage: 0.0, ...NO_LAUNCH })),
};

// The roster body (width 1.10, height 1.15 of the reference capsule) plus the
// folded wings behind the shoulders: Dreadlord's large target.
const TORSO = hurtPart(0.0, 4.0, 0.0, 103.0, f32(26.4));
const FOLDED_WINGS = hurtPart(-18.0, 70.0, -30.0, 135.0, 16.0);
export const DREADLORD_STAND: readonly HurtPart[] = [TORSO, FOLDED_WINGS];
/** A touch thinner than the strike, so a mirrored limb-on-limb meeting trades rather than whiffs. */
const LIMB_INSET = 2.0;
/** Largest extent change per body change, inside the 60-unit legible-hurtbox rule. */
const BODY_STEP = 55.0;
/** Every authored pose is held at least this long (legible-hurtbox rule 3). */
const POSE_FRAMES = 3;

interface Extent { front: number; back: number; top: number; bottom: number }

function extent(parts: readonly HurtPart[]): Extent {
  const out = { front: -1.0e9, back: 1.0e9, top: -1.0e9, bottom: 1.0e9 };
  for (const p of parts) {
    out.front = Math.max(out.front, f32(Math.max(p.x1, p.x2) + p.radius));
    out.back = Math.min(out.back, f32(Math.min(p.x1, p.x2) - p.radius));
    out.top = Math.max(out.top, f32(Math.max(p.z1, p.z2) + p.radius));
    out.bottom = Math.min(out.bottom, f32(Math.min(p.z1, p.z2) - p.radius));
  }
  return out;
}

function smallStep(a: readonly HurtPart[], b: readonly HurtPart[]): boolean {
  const x = extent(a);
  const y = extent(b);
  return Math.abs(f32(x.front - y.front)) <= BODY_STEP && Math.abs(f32(x.back - y.back)) <= BODY_STEP
    && Math.abs(f32(x.top - y.top)) <= BODY_STEP && Math.abs(f32(x.bottom - y.bottom)) <= BODY_STEP;
}

const torsoZ = (z: number): number => Math.min(Math.max(z, TORSO.z1), TORSO.z2);
const toward = (from: number, to: number, t: number): number => f32(from + f32(f32(to - from) * t));

/** The strike path drawn `t` of the way out from the torso axis. */
function drawnOut(strike: Readonly<StrikeCapsule>, t: number): HurtPart {
  return hurtPart(toward(0.0, strike.x1, t), toward(torsoZ(strike.z1), strike.z1, t),
    toward(0.0, strike.x2, t), toward(torsoZ(strike.z2), strike.z2, t), f32(strike.radius - LIMB_INSET));
}

/**
 * Dreadlord carries no weapon, so nothing he swings is disjointed: every claw,
 * wing, horn and elbow path is also his body (roster "Weapon-only extensions
 * can be disjointed"). The limbs are fully out from a frame before the first
 * strike to two after the last, and are drawn out and folded back through
 * held intermediate poses so no body change moves an extent more than
 * BODY_STEP. `offset` shifts zero-based region frames to the pose numbering
 * (1 for specials, which count their entry frame as one).
 */
export function dreadlordLimbPoses(regions: readonly MoveRegion[], totalFrames: number, offset = 0): readonly HurtPose[] {
  let first = totalFrames;
  let last = -1;
  for (const region of regions) {
    first = Math.min(first, region.firstFrame);
    last = Math.max(last, region.lastFrame);
  }
  const strikes: StrikeCapsule[] = [];
  for (const region of regions) if (region.hit.strike !== undefined) strikes.push(region.hit.strike);
  const posed = (t: number): readonly HurtPart[] => [...DREADLORD_STAND, ...strikes.map(strike => drawnOut(strike, t))];
  let steps = 1;
  for (;;) {
    let ok = true;
    for (let k = 0; k < steps && ok; k++) ok = smallStep(k === 0 ? DREADLORD_STAND : posed(f32(k / steps)), posed(f32((k + 1) / steps)));
    if (ok) break;
    steps++;
  }
  const lastFrame = totalFrames - 1;
  let peakFirst = Math.max(0, first - 1);
  const peakLast = Math.min(lastFrame, last + 2);
  if (peakLast - peakFirst + 1 < POSE_FRAMES) peakFirst = peakLast - POSE_FRAMES + 1;
  const poses: HurtPose[] = [hurtPose(peakFirst + offset, peakLast + offset, posed(1.0))];
  for (let k = steps - 1; k >= 1; k--) {
    const end = peakFirst - (steps - 1 - k) * POSE_FRAMES - 1;
    const begin = peakLast + (steps - k - 1) * POSE_FRAMES + 1;
    if (end - POSE_FRAMES + 1 < 0 || begin + POSE_FRAMES - 1 > lastFrame) throw new Error("Dreadlord limb ramp does not fit its move");
    const parts = posed(f32(k / steps));
    poses.unshift(hurtPose(end - POSE_FRAMES + 1 + offset, end + offset, parts));
    poses.push(hurtPose(begin + offset, begin + POSE_FRAMES - 1 + offset, parts));
  }
  return poses;
}

function attachedBodies(): FighterHurtboxes {
  const attacks: { [style: number]: readonly HurtPose[] | undefined } = {};
  for (let style = AttackStyle.jab; style <= AttackStyle.dashAttack; style++) {
    const move = NORMALS[style];
    if (move !== undefined) attacks[style] = dreadlordLimbPoses(move.regions, move.totalFrames);
  }
  return { stand: DREADLORD_STAND, attacks };
}

export const DREADLORD_MOVES: FighterMoves = {
  dashAttack: AttackStyle.dashAttack,
  smashMaxChargeFrames: 45,
  smashMaxDamageMultiplier: 1.25,
  maxPummels: 2,
  normals: NORMALS,
  hurtboxes: attachedBodies(),
  throws: {
    [GrabAction.pummel]: { contactFrame: 5, totalFrames: 12, effect: { damage: 3.0, ...NO_LAUNCH } },
    [GrabAction.throwForward]: { contactFrame: 12, totalFrames: 32, effect: dreadlordHit(8.0, "EDGE", 35) },
    [GrabAction.throwBack]: { contactFrame: 18, totalFrames: 43, effect: dreadlordHit(10.0, "KILL", 40, -1.0) },
    [GrabAction.throwUp]: { contactFrame: 15, totalFrames: 26, effect: dreadlordHit(7.0, "JUGGLE", 85) },
    [GrabAction.throwDown]: { contactFrame: 19, totalFrames: 44, effect: dreadlordHit(6.0, "CHASE", 65) },
  },
};

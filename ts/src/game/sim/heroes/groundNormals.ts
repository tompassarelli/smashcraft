// Each hero's jab, tilts and dash attack (smashcraft:docs/design/tilts.md):
// distinct timing, volumes and rewards by identity. Coordinates are
// facing-relative world units from the fighter's centre at the feet; H is
// 131.8, so 1.10H is 145. Each active frame is one strike position, never the
// filled box of an arc. A kit whose forward tilt is a vertical swing plays it
// for every angle (Ultimate's angling rule); an angleable kit gives each angle
// its own volume and launch.
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, HitElement } from "../codes";
import { type AuthoredMove, type MoveRegion, type StrikeCapsule, heroHurtPose, heroMove, heroRegion, jabStep } from "../heroMoves";
import type { HitEffect } from "../hitRegions";
import type { HurtPart, HurtPose } from "../hurtboxes";
import type { HeroClip } from "./hero";

/** Launch directions by degrees from facing; literals so every runtime reads the same floats. */
const DIRECTION = {
  0: { x: 1.0, z: 0.0 },
  10: { x: f32(0.984807753), z: f32(0.173648178) },
  15: { x: f32(0.965925826), z: f32(0.258819045) },
  20: { x: f32(0.939692621), z: f32(0.342020143) },
  25: { x: f32(0.906307787), z: f32(0.422618262) },
  30: { x: f32(0.866025404), z: 0.5 },
  35: { x: f32(0.819152044), z: f32(0.573576436) },
  40: { x: f32(0.766044443), z: f32(0.642787610) },
  45: { x: f32(0.707106781), z: f32(0.707106781) },
  50: { x: f32(0.642787610), z: f32(0.766044443) },
  55: { x: f32(0.573576436), z: f32(0.819152044) },
  60: { x: 0.5, z: f32(0.866025404) },
  65: { x: f32(0.422618262), z: f32(0.906307787) },
  70: { x: f32(0.342020143), z: f32(0.939692621) },
  75: { x: f32(0.258819045), z: f32(0.965925826) },
  80: { x: f32(0.173648178), z: f32(0.984807753) },
  85: { x: f32(0.087155743), z: f32(0.996194698) },
  90: { x: 0.0, z: 1.0 },
  /** Along the floor toward the attacker. */
  180: { x: -1.0, z: 0.0 },
} as const;
type Angle = keyof typeof DIRECTION;

/** A hit; `behind` mirrors the launch to the attacker's back. */
export function groundHit(damage: number, angle: Angle, growth: number, base: number, element: HitElement, behind = false): Readonly<HitEffect> {
  const direction = DIRECTION[angle];
  return { damage, growth, base, launchX: behind ? -direction.x : direction.x, launchZ: direction.z, electric: false, element };
}

type Segment = readonly [number, number, number, number];
const capsule = ([x1, z1, x2, z2]: Segment, radius: number): StrikeCapsule => ({ x1, z1, x2, z2, radius });

/** One strike per active frame from `first`. */
function swing(first: number, segments: readonly Segment[], radius: number, effect: Readonly<HitEffect>): MoveRegion[] {
  return segments.map((segment, index) => heroRegion(first + index, first + index, capsule(segment, radius), effect));
}

/**
 * A blade whose outer `tip` units have their own reward: each frame's tip
 * region is listed first, so it wins an overlap with the inner blade. Tips
 * are horizontal-led segments, so the split follows x.
 */
function tipped(first: number, segments: readonly Segment[], radius: number, tip: number, tipEffect: Readonly<HitEffect>, inner: Readonly<HitEffect>): MoveRegion[] {
  const regions: MoveRegion[] = [];
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    if (segment === undefined) continue;
    const [x1, z1, x2, z2] = segment;
    const t = f32(f32(f32(x2 - x1) - tip) / f32(x2 - x1));
    const splitX = f32(x1 + f32(f32(x2 - x1) * t));
    const splitZ = f32(z1 + f32(f32(z2 - z1) * t));
    const frame = first + index;
    regions.push(heroRegion(frame, frame, capsule([splitX, splitZ, x2, z2], radius), tipEffect));
    regions.push(heroRegion(frame, frame, capsule([x1, z1, splitX, splitZ], radius), inner));
  }
  return regions;
}

/** A region held over several frames that may hit again on a later window. */
function held(first: number, last: number, segment: Segment, radius: number, effect: Readonly<HitEffect>, window = 1): MoveRegion {
  const region = heroRegion(first, last, capsule(segment, radius), effect);
  return window === 1 ? region : { ...region, hit: { ...region.hit, window } };
}

export interface GroundKit {
  readonly normals: { readonly [style: number]: AuthoredMove };
  /** The striking hand (or foot) each normal reaches toward, for the kit's own limb. */
  readonly reaches: { readonly [style: number]: readonly [number, number] };
}

/** A kit's forward tilt for every stick angle: one move when the swing is vertical. */
function unangled(move: AuthoredMove): { readonly [style: number]: AuthoredMove } {
  return { [AttackStyle.forwardTilt]: move, [AttackStyle.forwardTiltUp]: move, [AttackStyle.forwardTiltDown]: move };
}

/**
 * Limb poses for a kit's ground normals: the limb reaches its target from two
 * frames before the first active frame through two after the last, at least
 * three frames (smashcraft:docs/gameplay-design.md, "Legible hurtboxes").
 */
export function groundPoses(kit: GroundKit, limb: (x: number, z: number) => readonly HurtPart[]): { [style: number]: readonly HurtPose[] } {
  const poses: { [style: number]: readonly HurtPose[] } = {};
  for (const key in kit.reaches) {
    const style = Number(key);
    const reach = kit.reaches[style];
    const move = kit.normals[style];
    if (reach === undefined || move === undefined) continue;
    const firstActive = move.startupFrames + 1;
    const first = Math.max(1, firstActive - 2);
    const last = Math.min(move.totalFrames, Math.max(first + 2, firstActive + move.activeFrames + 1));
    poses[style] = [heroHurtPose(first, last, limb(reach[0], reach[1]))];
  }
  return poses;
}

// Blademaster: the spacing sword. A descending cut over head to feet (not
// angled) with a 0.20H tipper; the longest low poke, safe on shield at the tip.
const BM = HitElement.slash;
export const BLADEMASTER_GROUND: GroundKit = {
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(3, 2, 13, 0, swing(3, [[18.0, 46.0, 76.0, 46.0], [20.0, 48.0, 76.0, 48.0]], 6.0, groundHit(4.0, 50, 55.0, 22.0, BM)))),
    [AttackStyle.jab2]: heroMove(3, 2, 16, 0, swing(3, [[18.0, 52.0, 80.0, 50.0], [20.0, 50.0, 80.0, 44.0]], 6.0, groundHit(5.0, 40, 90.0, 22.0, BM))),
    ...unangled(heroMove(7, 3, 20, 0, tipped(7, [[18.0, 80.0, 159.0, 110.0], [18.0, 60.0, 159.0, 58.0], [18.0, 40.0, 159.0, 6.0]], 6.0, 26.0,
      groundHit(11.0, 30, 100.0, 24.0, BM), groundHit(8.0, 40, 75.0, 18.0, BM)))),
    [AttackStyle.upTilt]: heroMove(6, 5, 18, 0, swing(6, [
      [24.0, 50.0, 100.0, 80.0], [18.0, 66.0, 75.0, 130.0], [2.0, 72.0, 2.0, 150.0], [-18.0, 66.0, -75.0, 130.0], [-24.0, 50.0, -100.0, 80.0],
    ], 6.0, groundHit(7.0, 85, 70.0, 38.0, BM))),
    [AttackStyle.downTilt]: heroMove(6, 2, 10, 0, tipped(6, [[18.0, 10.0, 152.0, 8.0], [18.0, 6.0, 152.0, 4.0]], 6.0, 26.0,
      groundHit(8.0, 20, 60.0, 18.0, BM), groundHit(5.0, 20, 60.0, 18.0, BM))),
    [AttackStyle.dashAttack]: heroMove(9, 4, 22, 0, tipped(9, [[18.0, 60.0, 145.0, 50.0], [18.0, 50.0, 145.0, 40.0], [18.0, 40.0, 145.0, 30.0], [18.0, 30.0, 145.0, 22.0]], 6.0, 26.0,
      groundHit(10.0, 30, 100.0, 24.0, BM), groundHit(8.0, 40, 75.0, 18.0, BM)), 92.0, true),
  },
  reaches: {
    [AttackStyle.jab]: [40.0, 72.0], [AttackStyle.jab2]: [42.0, 70.0], [AttackStyle.forwardTilt]: [48.0, 66.0], [AttackStyle.forwardTiltUp]: [48.0, 66.0], [AttackStyle.forwardTiltDown]: [48.0, 66.0],
    [AttackStyle.upTilt]: [14.0, 136.0], [AttackStyle.downTilt]: [44.0, 30.0], [AttackStyle.dashAttack]: [46.0, 56.0],
  },
};

// Mountain King: the heavy hammer. A horizontal hook, so it angles; a boot and
// axe that only bumps at low percent and tumbles vertically at high percent;
// a shoulder charge that launches.
const MK = HitElement.normal;
const mkHook = (angle: Angle) => groundHit(12.0, angle, 100.0, 25.0, MK);
export const MOUNTAIN_KING_GROUND: GroundKit = {
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(5, 2, 16, 0, swing(5, [[18.0, 40.0, 70.0, 42.0], [18.0, 42.0, 70.0, 38.0]], 12.0, groundHit(5.0, 30, 55.0, 16.0, MK)))),
    [AttackStyle.jab2]: heroMove(6, 3, 18, 0, swing(6, [[18.0, 46.0, 74.0, 48.0], [18.0, 46.0, 76.0, 44.0], [18.0, 44.0, 70.0, 40.0]], 12.0, groundHit(6.0, 35, 95.0, 24.0, MK))),
    [AttackStyle.forwardTilt]: heroMove(10, 3, 22, 0, swing(10, [[22.0, 58.0, 113.0, 62.0], [22.0, 52.0, 113.0, 52.0], [22.0, 46.0, 100.0, 44.0]], 12.0, mkHook(30))),
    [AttackStyle.forwardTiltUp]: heroMove(10, 3, 22, 0, swing(10, [[22.0, 62.0, 100.0, 100.0], [22.0, 60.0, 108.0, 90.0], [22.0, 56.0, 95.0, 80.0]], 12.0, mkHook(45))),
    [AttackStyle.forwardTiltDown]: heroMove(10, 3, 22, 0, swing(10, [[22.0, 44.0, 108.0, 14.0], [22.0, 40.0, 113.0, 4.0], [22.0, 36.0, 100.0, -8.0]], 12.0, mkHook(20))),
    [AttackStyle.upTilt]: heroMove(8, 4, 22, 0, swing(8, [[20.0, 56.0, 68.0, 80.0], [16.0, 66.0, 40.0, 100.0], [4.0, 70.0, -12.0, 100.0], [-8.0, 66.0, -28.0, 80.0]], 14.0,
      groundHit(10.0, 80, 95.0, 24.0, MK))),
    [AttackStyle.downTilt]: heroMove(8, 3, 21, 0, swing(8, [[12.0, 10.0, 87.0, 12.0], [12.0, 8.0, 87.0, 6.0], [12.0, 8.0, 70.0, 2.0]], 12.0,
      groundHit(10.0, 85, 70.0, 10.0, MK))),
    // Body actions stay inside the exposed torso; the charge carries its reach by movement.
    [AttackStyle.dashAttack]: heroMove(11, 5, 26, 0, [held(11, 15, [0.0, 12.0, 0.0, 65.0], 24.0, groundHit(12.0, 75, 95.0, 30.0, MK))], 79.0, true),
  },
  reaches: {
    [AttackStyle.jab]: [40.0, 42.0], [AttackStyle.jab2]: [42.0, 46.0], [AttackStyle.forwardTilt]: [46.0, 52.0], [AttackStyle.forwardTiltUp]: [42.0, 72.0], [AttackStyle.forwardTiltDown]: [44.0, 34.0],
    [AttackStyle.upTilt]: [22.0, 92.0],
  },
};

// Warden: the fastest blade. A straight crescent thrust that angles, and a
// frame-3 chain poke along the floor.
const WD = HitElement.slash;
const wardenThrust = (angle: Angle) => groundHit(8.0, angle, 75.0, 18.0, WD);
export const WARDEN_GROUND: GroundKit = {
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(2, 2, 11, 0, swing(2, [[18.0, 46.0, 66.0, 46.0], [18.0, 48.0, 66.0, 48.0]], 6.0, groundHit(3.0, 70, 40.0, 30.0, WD)))),
    [AttackStyle.jab2]: jabStep(heroMove(2, 2, 12, 0, swing(2, [[18.0, 50.0, 68.0, 52.0], [18.0, 50.0, 68.0, 50.0]], 6.0, groundHit(3.0, 70, 30.0, 26.0, WD)))),
    [AttackStyle.jab3]: heroMove(4, 3, 16, 0, swing(4, [[18.0, 46.0, 86.0, 50.0], [18.0, 46.0, 90.0, 46.0], [18.0, 44.0, 84.0, 42.0]], 6.0, groundHit(4.0, 40, 90.0, 22.0, WD))),
    [AttackStyle.forwardTilt]: heroMove(5, 3, 17, 0, swing(5, [[18.0, 50.0, 119.0, 52.0], [18.0, 50.0, 119.0, 50.0], [18.0, 48.0, 110.0, 46.0]], 6.0, wardenThrust(35))),
    [AttackStyle.forwardTiltUp]: heroMove(5, 3, 17, 0, swing(5, [[18.0, 58.0, 105.0, 100.0], [18.0, 60.0, 110.0, 95.0], [18.0, 58.0, 100.0, 88.0]], 6.0, wardenThrust(55))),
    [AttackStyle.forwardTiltDown]: heroMove(5, 3, 17, 0, swing(5, [[18.0, 40.0, 110.0, 10.0], [18.0, 38.0, 119.0, 4.0], [18.0, 36.0, 105.0, 0.0]], 6.0, wardenThrust(20))),
    [AttackStyle.upTilt]: heroMove(4, 4, 16, 0, swing(4, [[18.0, 40.0, 95.0, 60.0], [16.0, 50.0, 70.0, 90.0], [8.0, 56.0, 35.0, 99.0], [0.0, 56.0, -10.0, 99.0]], 6.0,
      groundHit(6.0, 90, 60.0, 32.0, WD))),
    [AttackStyle.downTilt]: heroMove(3, 2, 9, 0, swing(3, [[16.0, 8.0, 99.0, 8.0], [16.0, 5.0, 99.0, 5.0]], 6.0, groundHit(3.0, 0, 20.0, 32.0, WD))),
    [AttackStyle.dashAttack]: heroMove(5, 3, 18, 0, swing(5, [[18.0, 30.0, 105.0, 40.0], [18.0, 40.0, 105.0, 52.0], [18.0, 50.0, 100.0, 62.0]], 6.0,
      groundHit(7.0, 50, 70.0, 24.0, WD)), 53.0, true),
  },
  reaches: {},
};

// Lich: the slow caster. A frost palm that angles, a crown of ice that
// lingers above the shoulders, and creeping low frost.
const LICH = HitElement.ice;
const palm = (ends: readonly (readonly [number, number])[], angle: Angle) =>
  swing(9, ends.map(([x, z]): Segment => [20.0, 45.0, x, z]), 8.0, groundHit(9.0, angle, 80.0, 20.0, LICH));
export const LICH_GROUND: GroundKit = {
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(6, 2, 15, 0, swing(6, [[18.0, 42.0, 58.0, 42.0], [18.0, 44.0, 58.0, 44.0]], 8.0, groundHit(3.0, 30, 55.0, 16.0, HitElement.normal)))),
    [AttackStyle.jab2]: heroMove(6, 3, 17, 0, swing(6, [[18.0, 44.0, 62.0, 44.0], [18.0, 44.0, 64.0, 46.0], [18.0, 42.0, 60.0, 44.0]], 8.0, groundHit(4.0, 30, 85.0, 22.0, LICH))),
    [AttackStyle.forwardTilt]: heroMove(9, 4, 22, 0, palm([[110.0, 43.0], [124.0, 45.0], [124.0, 47.0], [115.0, 46.0]], 30)),
    [AttackStyle.forwardTiltUp]: heroMove(9, 4, 22, 0, palm([[100.0, 80.0], [112.0, 90.0], [112.0, 96.0], [104.0, 92.0]], 55)),
    [AttackStyle.forwardTiltDown]: heroMove(9, 4, 22, 0, palm([[110.0, 18.0], [124.0, 8.0], [124.0, 2.0], [115.0, 6.0]], 15)),
    [AttackStyle.upTilt]: heroMove(8, 8, 20, 0, [
      held(8, 9, [-36.0, 140.0, 36.0, 140.0], 22.0, groundHit(9.0, 90, 95.0, 22.0, LICH)),
      held(10, 15, [-44.0, 166.0, 44.0, 166.0], 26.0, groundHit(9.0, 90, 95.0, 22.0, LICH)),
    ]),
    [AttackStyle.downTilt]: heroMove(10, 4, 19, 0, swing(10, [[20.0, 6.0, 90.0, 6.0], [20.0, 5.0, 120.0, 5.0], [20.0, 4.0, 144.0, 4.0], [20.0, 4.0, 144.0, 4.0]], 8.0,
      groundHit(6.0, 30, 70.0, 25.0, LICH))),
    [AttackStyle.dashAttack]: heroMove(10, 6, 22, 0, [held(10, 15, [18.0, 14.0, 96.0, 10.0], 10.0, groundHit(8.0, 25, 90.0, 30.0, LICH))], 105.0, true),
  },
  reaches: {
    [AttackStyle.jab]: [50.0, 44.0], [AttackStyle.jab2]: [52.0, 44.0], [AttackStyle.forwardTilt]: [26.0, 47.0], [AttackStyle.forwardTiltUp]: [26.0, 80.0], [AttackStyle.forwardTiltDown]: [26.0, 22.0],
    [AttackStyle.downTilt]: [26.0, 16.0], [AttackStyle.dashAttack]: [26.0, 30.0],
  },
};

// Uther: the defensive hammer. The longest, slowest tilt is an overhead arc to
// the floor (not angled); the handle sweep knocks down.
const UTHER = HitElement.normal;
export const UTHER_GROUND: GroundKit = {
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(5, 3, 15, 0, swing(5, [[24.0, 64.0, 62.0, 60.0], [24.0, 64.0, 62.0, 60.0], [24.0, 62.0, 58.0, 58.0]], 10.0, groundHit(4.0, 20, 40.0, 24.0, UTHER)))),
    [AttackStyle.jab2]: heroMove(6, 3, 18, 0, swing(6, [[24.0, 60.0, 70.0, 58.0], [24.0, 58.0, 72.0, 54.0], [24.0, 56.0, 66.0, 50.0]], 10.0, groundHit(6.0, 30, 90.0, 26.0, UTHER))),
    ...unangled(heroMove(11, 3, 24, 0, swing(11, [[20.0, 100.0, 120.0, 140.0], [20.0, 70.0, 159.0, 60.0], [20.0, 40.0, 140.0, 8.0]], 12.0, groundHit(12.0, 35, 100.0, 25.0, UTHER)))),
    [AttackStyle.upTilt]: heroMove(10, 4, 22, 0, swing(10, [[20.0, 60.0, 70.0, 96.0], [12.0, 72.0, 30.0, 120.0], [4.0, 76.0, -10.0, 120.0], [-6.0, 70.0, -34.0, 98.0]], 14.0,
      groundHit(11.0, 85, 105.0, 28.0, UTHER))),
    [AttackStyle.downTilt]: heroMove(9, 3, 20, 0, swing(9, [[14.0, 10.0, 124.0, 10.0], [14.0, 8.0, 124.0, 6.0], [14.0, 6.0, 110.0, 2.0]], 8.0, groundHit(8.0, 10, 40.0, 72.0, UTHER))),
    [AttackStyle.dashAttack]: heroMove(12, 3, 20, 0, swing(12, [[20.0, 90.0, 120.0, 60.0], [20.0, 60.0, 125.0, 20.0], [20.0, 40.0, 115.0, 6.0]], 12.0,
      groundHit(12.0, 30, 100.0, 26.0, UTHER)), 46.0, true),
  },
  reaches: {
    [AttackStyle.forwardTilt]: [48.0, 64.0], [AttackStyle.forwardTiltUp]: [48.0, 64.0], [AttackStyle.forwardTiltDown]: [48.0, 64.0],
    [AttackStyle.upTilt]: [10.0, 136.0], [AttackStyle.downTilt]: [44.0, 28.0], [AttackStyle.dashAttack]: [48.0, 60.0],
  },
};

// Dreadlord: the grappler. A straight claw rake that angles, a wing arc that
// reaches farther behind, a low rake that drags the victim in toward his grab,
// and a wing dash that passes through to hit from behind.
const DL = HitElement.slash;
const rake = (ends: readonly (readonly [number, number, number])[], angle: Angle) =>
  swing(8, ends.map(([z1, x, z]): Segment => [18.0, z1, x, z]), 10.0, groundHit(12.0, angle, 100.0, 22.0, DL));
export const DREADLORD_GROUND: GroundKit = {
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(4, 3, 14, 0, swing(4, [[18.0, 46.0, 69.0, 46.0], [18.0, 46.0, 69.0, 42.0], [18.0, 46.0, 64.0, 40.0]], 10.0, groundHit(4.0, 40, 50.0, 25.0, DL)))),
    [AttackStyle.jab2]: jabStep(heroMove(4, 2, 14, 0, swing(4, [[18.0, 50.0, 70.0, 48.0], [18.0, 48.0, 70.0, 44.0]], 10.0, groundHit(3.0, 60, 30.0, 28.0, DL)))),
    [AttackStyle.jab3]: heroMove(6, 3, 20, 0, swing(6, [[18.0, 40.0, 84.0, 44.0], [18.0, 40.0, 88.0, 40.0], [18.0, 40.0, 82.0, 36.0]], 10.0, groundHit(6.0, 35, 100.0, 22.0, DL))),
    [AttackStyle.forwardTilt]: heroMove(8, 3, 21, 0, rake([[46.0, 115.0, 60.0], [46.0, 115.0, 46.0], [46.0, 105.0, 32.0]], 35)),
    [AttackStyle.forwardTiltUp]: heroMove(8, 3, 21, 0, rake([[50.0, 100.0, 98.0], [50.0, 110.0, 88.0], [50.0, 100.0, 78.0]], 55)),
    [AttackStyle.forwardTiltDown]: heroMove(8, 3, 21, 0, rake([[40.0, 110.0, 16.0], [40.0, 115.0, 4.0], [36.0, 100.0, -6.0]], 20)),
    [AttackStyle.upTilt]: heroMove(7, 4, 20, 0, swing(7, [[18.0, 60.0, 60.0, 80.0], [10.0, 68.0, 30.0, 93.0], [0.0, 70.0, -30.0, 93.0], [-12.0, 65.0, -80.0, 80.0]], 12.0,
      groundHit(9.0, 90, 90.0, 25.0, DL))),
    [AttackStyle.downTilt]: heroMove(6, 3, 18, 0, swing(6, [[16.0, 12.0, 95.0, 12.0], [16.0, 10.0, 95.0, 6.0], [16.0, 8.0, 80.0, 2.0]], 10.0, groundHit(6.0, 180, 30.0, 30.0, DL))),
    // The wing dash passes through an unshielded body; the back wing hits once it is behind him.
    [AttackStyle.dashAttack]: heroMove(7, 4, 24, 0, [
      ...swing(7, [[16.0, 40.0, 90.0, 46.0], [16.0, 40.0, 90.0, 40.0]], 10.0, groundHit(9.0, 60, 90.0, 22.0, DL)),
      ...swing(9, [[-16.0, 40.0, -90.0, 46.0], [-16.0, 40.0, -90.0, 40.0]], 10.0, groundHit(9.0, 60, 90.0, 22.0, DL, true)),
    ], 132.0),
  },
  reaches: {},
};

// Shadow Hunter: the glaive angles. An angled thrust whose down angle reaches
// below the stage, an edge poke under the lip, and a three-hit glaive spin.
const SH = HitElement.slash;
const thrust = (ends: readonly (readonly [number, number, number])[], angle: Angle) =>
  swing(9, ends.map(([z1, x, z]): Segment => [20.0, z1, x, z]), 7.0, groundHit(11.0, angle, 75.0, 18.0, SH));
const spin = (damage: number, angle: Angle, growth: number, base: number) => groundHit(damage, angle, growth, base, SH);
export const SHADOW_HUNTER_GROUND: GroundKit = {
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(4, 2, 12, 0, swing(4, [[16.0, 44.0, 85.0, 44.0], [18.0, 46.0, 85.0, 46.0]], 7.0, groundHit(3.0, 35, 50.0, 16.0, HitElement.normal)))),
    [AttackStyle.jab2]: jabStep(heroMove(4, 2, 13, 0, swing(4, [[16.0, 48.0, 88.0, 48.0], [18.0, 48.0, 88.0, 44.0]], 7.0, groundHit(3.0, 60, 30.0, 26.0, HitElement.normal)))),
    [AttackStyle.jab3]: heroMove(6, 3, 18, 0, swing(6, [[18.0, 40.0, 100.0, 52.0], [18.0, 46.0, 104.0, 46.0], [18.0, 40.0, 100.0, 40.0]], 7.0, groundHit(5.0, 40, 90.0, 22.0, SH))),
    [AttackStyle.forwardTilt]: heroMove(9, 2, 21, 0, thrust([[50.0, 151.0, 52.0], [50.0, 151.0, 48.0]], 35)),
    [AttackStyle.forwardTiltUp]: heroMove(9, 2, 21, 0, thrust([[56.0, 130.0, 120.0], [56.0, 138.0, 110.0]], 55)),
    [AttackStyle.forwardTiltDown]: heroMove(9, 2, 21, 0, thrust([[40.0, 145.0, -10.0], [38.0, 151.0, -20.0]], 15)),
    [AttackStyle.upTilt]: heroMove(7, 5, 19, 0, swing(7, [
      [-40.0, 120.0, 60.0, 135.0], [-55.0, 128.0, 55.0, 128.0], [-60.0, 135.0, 40.0, 120.0], [-55.0, 128.0, 55.0, 128.0], [-40.0, 120.0, 60.0, 135.0],
    ], 9.0, groundHit(7.0, 80, 95.0, 20.0, SH))),
    [AttackStyle.downTilt]: heroMove(7, 2, 16, 0, swing(7, [[18.0, 12.0, 145.0, -20.0], [18.0, 10.0, 145.0, -26.0]], 7.0, groundHit(7.0, 30, 70.0, 22.0, SH))),
    [AttackStyle.dashAttack]: heroMove(8, 9, 20, 0, [
      held(8, 10, [20.0, 30.0, 100.0, 60.0], 7.0, spin(3.0, 0, 15.0, 25.0), 1),
      held(11, 13, [20.0, 60.0, 100.0, 30.0], 7.0, spin(3.0, 0, 15.0, 25.0), 2),
      held(14, 16, [20.0, 30.0, 100.0, 60.0], 7.0, spin(5.0, 45, 100.0, 22.0), 3),
    ], 66.0, true),
  },
  reaches: {
    [AttackStyle.jab]: [45.0, 52.0], [AttackStyle.jab2]: [46.0, 50.0], [AttackStyle.jab3]: [52.0, 48.0], [AttackStyle.forwardTilt]: [58.0, 55.0], [AttackStyle.forwardTiltUp]: [55.0, 80.0], [AttackStyle.forwardTiltDown]: [55.0, 35.0],
    [AttackStyle.upTilt]: [5.0, 140.0], [AttackStyle.downTilt]: [50.0, 15.0], [AttackStyle.dashAttack]: [58.0, 55.0],
  },
};

// Archer keeps the original tables' jab and tilts (moves.ts, hitRegions.ts): a
// frame-5 jab and a forward tilt with an early tip, already unlike every kit.
// Her own move is the sliding kick that pops the victim up into her up air.
const ARCHER = HitElement.normal;
export const ARCHER_GROUND: GroundKit = {
  normals: {
    [AttackStyle.jab2]: heroMove(4, 3, 16, 0, swing(4, [[16.0, 30.0, 96.0, 26.0], [16.0, 28.0, 100.0, 22.0], [16.0, 26.0, 94.0, 20.0]], 10.0, groundHit(5.0, 40, 95.0, 22.0, ARCHER))),
    [AttackStyle.dashAttack]: heroMove(6, 4, 20, 0, [held(6, 9, [14.0, 14.0, 90.0, 10.0], 10.0, groundHit(6.0, 70, 55.0, 38.0, ARCHER))], 99.0, true),
  },
  reaches: {},
};

// Rifleman: the rifle as a club and a bayonet. A thrust that angles, an
// overhead swing, a low sweep that pops the victim straight up (Falco's 1.3
// ratio over the old shared down tilt), and a lunge.
const RIFLE = HitElement.normal;
const bayonet = (ends: readonly (readonly [number, number, number])[], angle: Angle) =>
  swing(7, ends.map(([z1, x, z]): Segment => [18.0, z1, x, z]), 10.0, groundHit(10.0, angle, 90.0, 22.0, RIFLE));
export const RIFLEMAN_GROUND: GroundKit = {
  normals: {
    [AttackStyle.jab]: jabStep(heroMove(4, 3, 16, 0, swing(4, [[18.0, 50.0, 95.0, 52.0], [18.0, 50.0, 95.0, 50.0], [18.0, 50.0, 90.0, 48.0]], 10.0, groundHit(4.0, 20, 45.0, 18.0, RIFLE)))),
    [AttackStyle.jab2]: heroMove(4, 2, 18, 0, swing(4, [[18.0, 54.0, 100.0, 56.0], [18.0, 52.0, 100.0, 52.0]], 10.0, groundHit(5.0, 30, 90.0, 22.0, RIFLE))),
    [AttackStyle.forwardTilt]: heroMove(7, 3, 21, 0, bayonet([[52.0, 155.0, 54.0], [52.0, 155.0, 52.0], [50.0, 145.0, 50.0]], 30)),
    [AttackStyle.forwardTiltUp]: heroMove(7, 3, 21, 0, bayonet([[58.0, 125.0, 110.0], [60.0, 135.0, 104.0], [58.0, 125.0, 98.0]], 50)),
    [AttackStyle.forwardTiltDown]: heroMove(7, 3, 21, 0, bayonet([[40.0, 140.0, 12.0], [38.0, 150.0, 4.0], [36.0, 140.0, 0.0]], 15)),
    [AttackStyle.upTilt]: heroMove(6, 3, 22, 0, swing(6, [[24.0, 60.0, 80.0, 100.0], [10.0, 70.0, 20.0, 125.0], [-10.0, 66.0, -50.0, 105.0]], 12.0,
      groundHit(8.0, 90, 80.0, 26.0, RIFLE))),
    [AttackStyle.downTilt]: heroMove(7, 3, 22, 0, swing(7, [[14.0, 10.0, 108.0, 10.0], [14.0, 8.0, 108.0, 6.0], [14.0, 6.0, 100.0, 2.0]], 10.0,
      groundHit(10.0, 80, 45.0, 50.0, RIFLE))),
    [AttackStyle.dashAttack]: heroMove(9, 3, 25, 0, swing(9, [[18.0, 50.0, 140.0, 52.0], [18.0, 50.0, 140.0, 50.0], [18.0, 48.0, 130.0, 48.0]], 10.0,
      groundHit(11.0, 40, 95.0, 22.0, RIFLE)), 66.0, true),
  },
  reaches: {},
};

/** A jab's slice of a stock sequence: its first `until` seconds, reached on the first active frame (HeroClip.until). */
export function jabSlice(clip: { readonly index: number }, until: number): HeroClip {
  return { index: clip.index, seconds: until, aligned: true, until };
}

/**
 * A stock sequence retimed so its strike moment (seconds into the sequence,
 * measured where the drawn weapon or limb reaches farthest) plays on `frame`
 * of a kit's ground normal: the first active frame unless named (1-based).
 * The clip stretches over the whole action, so seconds = strike × total / frames before it.
 */
export function strikeClip(clip: { readonly index: number }, strike: number, kit: GroundKit, style: AttackStyle, frame?: number): HeroClip {
  const move = kit.normals[style];
  const before = frame === undefined ? move?.startupFrames ?? 1 : frame - 1;
  return { index: clip.index, seconds: f32(f32(strike * (move?.totalFrames ?? 1)) / Math.max(1, before)), aligned: true };
}

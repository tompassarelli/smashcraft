// Camera_800293E0/8002958C/80029CF8/8002A768: subject box, fit, follow
// and corner limits. Warcraft's side view keeps yaw/pitch fixed; only the
// eye distance and interest move. Gameplay uses one 16:9 view on every client.
import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS, type Slots } from "../input/participants";
import { fighterAt, isActive, type Roster } from "./roster";
import { stageBounds, type StageRegion } from "./stageBounds";
import { MAIN_DECK_UNDERSIDE_Z } from "./stage";

export const MATCH_CAMERA_ASPECT = 1.7777777910232544;
export const CAMERA_PITCH_COS = 0.9848077297210693;
export const CAMERA_PITCH_SIN = 0.1736481785774231;
// tan(30°/2) and tan(38°/2), the camera's authored field-of-view endpoints.
const NARROW = 0.2679491937160492;
const WIDE = 0.3443276286125183;

export interface MatchCamera {
  readonly boxes: Slots<{ left: number; right: number; bottom: number; top: number }>;
  initialized: boolean;
  x: number;
  z: number;
  distance: number;
  tangent: number;
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export function createMatchCamera(): MatchCamera {
  const box = () => ({ left: 0.0, right: 0.0, bottom: 0.0, top: 0.0 });
  return { boxes: [box(), box(), box(), box()], initialized: false, x: 0.0, z: 160.0, distance: 1450.0, tangent: NARROW, left: 0.0, right: 0.0, bottom: 0.0, top: 0.0 };
}

export function copyMatchCamera(target: MatchCamera, source: Readonly<MatchCamera>): void {
  target.initialized = source.initialized;
  target.x = source.x;
  target.z = source.z;
  target.distance = source.distance;
  target.tangent = source.tangent;
  target.left = source.left;
  target.right = source.right;
  target.bottom = source.bottom;
  target.top = source.top;
  for (const slot of PARTICIPANT_SLOTS) {
    const box = target.boxes[slot];
    const from = source.boxes[slot];
    box.left = from.left;
    box.right = from.right;
    box.bottom = from.bottom;
    box.top = from.top;
  }
}

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));
const ease = (current: number, target: number, rate: number): number => f32(current + f32(f32(target - current) * rate));
const extent = (current: number, target: number): number => f32(current + clamp(f32(target - current), -3.0, 3.0));

/** The extreme vertical rays where the camera meets the fighters' plane. */
export function cameraReach(distance: number, tangent: number): { readonly above: number; readonly below: number } {
  const span = f32(distance * tangent);
  const tilt = f32(tangent * CAMERA_PITCH_SIN);
  return { above: f32(span / f32(CAMERA_PITCH_COS + tilt)), below: f32(span / f32(CAMERA_PITCH_COS - tilt)) };
}

/** The whole frame stays in the stage's camera range, even during easing or an aspect change. */
export function limitCamera(camera: MatchCamera, bounds: StageRegion, aspect: number, blastBottom: number = -840.0): void {
  const unit = cameraReach(1.0, camera.tangent);
  const hud = cameraReach(1.0, f32(camera.tangent * 0.4399999976158142));
  const wide = f32(f32(1.0 + f32(unit.below * CAMERA_PITCH_SIN)) * f32(camera.tangent * aspect));
  const maxWidth = f32(f32(bounds.right - bounds.left) / f32(2.0 * wide));
  // The camera limit is the bottom of the unobscured fighting view. The HUD
  // may cover farther down, but its raw frame also stays above the KO plane.
  const maxHeight = Math.min(f32(f32(bounds.top - bounds.bottom) / f32(unit.above + hud.below)), f32(f32(bounds.top - f32(blastBottom + 20.0)) / f32(unit.above + unit.below)));
  camera.distance = Math.min(camera.distance, maxWidth, maxHeight);
  const reach = cameraReach(camera.distance, camera.tangent);
  const aboveHud = cameraReach(camera.distance, f32(camera.tangent * 0.4399999976158142));
  const halfWidth = f32(f32(camera.distance + f32(reach.below * CAMERA_PITCH_SIN)) * f32(camera.tangent * aspect));
  camera.x = clamp(camera.x, f32(bounds.left + halfWidth), f32(bounds.right - halfWidth));
  camera.z = clamp(camera.z, Math.max(f32(bounds.bottom + aboveHud.below), f32(f32(blastBottom + 20.0) + reach.below)), f32(bounds.top - reach.above));
}

/** Camera bone: ftData's box is centred ten Melee units above the feet. */
export function outsideCamera(camera: Readonly<MatchCamera>, x: number, z: number, aspect: number = MATCH_CAMERA_ASPECT): boolean {
  const dz = f32(z - camera.z);
  const depth = f32(camera.distance - f32(dz * CAMERA_PITCH_SIN));
  const halfHeight = f32(depth * camera.tangent);
  return depth <= 0 || Math.abs(f32(x - camera.x)) > f32(halfHeight * aspect) || Math.abs(f32(dz * CAMERA_PITCH_COS)) > halfHeight;
}

/** Advances exactly once per match frame; rollback restores the camera with the match. */
export function advanceMatchCamera(camera: MatchCamera, world: Readonly<Roster>, stage: number): void {
  const { camera: bounds, blast } = stageBounds(stage);
  let count = 0;
  for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot) && !fighterAt(world, slot).status.out) count++;
  if (count === 0) return;
  const ratio = f32(1.5 * (count === 1 ? 1.5 : count === 2 ? 1.3200000524520874 : count === 3 ? 1.159999966621399 : 1.0));
  let left = bounds.right;
  let right = bounds.left;
  let bottom = bounds.top;
  let top = bounds.bottom;
  let lowest = bounds.top;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const fighter = fighterAt(world, slot);
    if (fighter.status.out) continue;
    const { x, z } = fighter.motion;
    lowest = Math.min(lowest, clamp(z, bounds.bottom, bounds.top));
    const front = f32(198.0 * ratio);
    const back = f32(54.0 * ratio);
    const box = camera.boxes[slot];
    const toward = fighter.facing > 0;
    box.left = camera.initialized ? extent(box.left, -(toward ? back : front)) : -(toward ? back : front);
    box.right = camera.initialized ? extent(box.right, toward ? front : back) : toward ? front : back;
    box.bottom = camera.initialized ? extent(box.bottom, -f32(54.0 * ratio)) : -f32(54.0 * ratio);
    box.top = camera.initialized ? extent(box.top, f32(96.0 * ratio)) : f32(96.0 * ratio);
    left = Math.min(left, clamp(f32(x + box.left), bounds.left, bounds.right));
    right = Math.max(right, clamp(f32(x + box.right), bounds.left, bounds.right));
    bottom = Math.min(bottom, clamp(f32(f32(z + 60.0) + box.bottom), bounds.bottom, bounds.top));
    top = Math.max(top, clamp(f32(f32(z + 60.0) + box.top), bounds.bottom, bounds.top));
  }
  camera.left = left;
  camera.right = right;
  camera.bottom = bottom;
  camera.top = top;
  camera.tangent = ease(camera.tangent, WIDE, 0.10000000149011612);
  const spread = f32(camera.right - camera.left);
  // cm_803BCCA0: interest 0.05..0.1 * track_smooth 1.8, eye 0.15 * 1.8.
  const rate = f32(f32(0.05000000074505806 + f32(clamp(f32(f32(f32(spread / 6.0) - 120.0) / 780.0), 0.0, 1.0) * 0.05000000074505806)) * 1.7999999523162842);
  const padding = f32(60.0 + f32(2340.0 * clamp(f32(f32(f32(camera.distance / 6.0) - 80.0) / 4920.0), 0.0, 1.0)));
  const lower = f32(camera.bottom - padding);
  const targetX = f32(f32(camera.left + camera.right) / 2.0);
  const middleZ = f32(f32(lower + camera.top) / 2.0);
  const vertical = f32(f32(camera.top - lower) / f32(1.440000057220459 * camera.tangent));
  const horizontal = f32(spread / f32(f32(2.0 * camera.tangent) * MATCH_CAMERA_ASPECT));
  const distance = clamp(Math.max(vertical, horizontal), 498.0, 6000.0);
  // Keep recovery space above the HUD, including the foreground underside
  // when a fighter is within 100 of it. Distant high subjects get a bubble.
  const nearUnderside = lowest >= f32(MAIN_DECK_UNDERSIDE_Z - 100.0) && lowest <= f32(MAIN_DECK_UNDERSIDE_Z + 100.0);
  const floorOfView = nearUnderside ? Math.min(lowest, f32(MAIN_DECK_UNDERSIDE_Z - 35.0)) : lowest;
  const hud = cameraReach(distance, f32(camera.tangent * 0.4399999976158142));
  const targetZ = Math.min(middleZ, f32(floorOfView + hud.below));
  camera.x = camera.initialized ? ease(camera.x, targetX, rate) : targetX;
  camera.z = camera.initialized ? ease(camera.z, targetZ, rate) : targetZ;
  camera.distance = camera.initialized ? ease(camera.distance, distance, 0.27000001072883606) : distance;
  camera.initialized = true;
  limitCamera(camera, bounds, MATCH_CAMERA_ASPECT, blast.bottom);
  if (nearUnderside) {
    const unit = cameraReach(1.0, camera.tangent);
    const unitHud = cameraReach(1.0, f32(camera.tangent * 0.4399999976158142));
    camera.distance = Math.min(camera.distance, f32(f32(floorOfView - f32(blast.bottom + 20.0)) / f32(unit.below - unitHud.below)));
    const actualHud = cameraReach(camera.distance, f32(camera.tangent * 0.4399999976158142));
    camera.z = Math.min(camera.z, f32(floorOfView + actualHud.below));
    limitCamera(camera, bounds, MATCH_CAMERA_ASPECT, blast.bottom);
  }
}

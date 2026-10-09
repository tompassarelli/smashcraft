


import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_SLOTS, type Slots } from "../input/participants";
import { fighterAt, isActive, type Roster } from "./roster";
import { stageBounds, type StageRegion } from "./stageBounds";
import { mainDeckUndersideZ } from "./stage";

export const MATCH_CAMERA_ASPECT = 1.7777777910232544;
const CAMERA_PITCH_COS = 0.9848077297210693;
const CAMERA_PITCH_SIN = 0.1736481785774231;

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

const ease = (current: number, target: number, rate: number): number => current === target && current !== 0 ? current : f32(current + f32(f32(target - current) * rate));

const extent = (current: number, target: number, step: number): number => current === target && current !== 0 ? current : f32(current + clamp(f32(target - current), -step, step));

const goal = createMatchCamera();





function cameraReach(distance: number, tangent: number, denominator: number): number {
  return f32(f32(distance * tangent) / denominator);
}







const tangentTerms = { tangent: -1.0, above: 0.0, below: 0.0, hudTangent: 0.0, hudAbove: 0.0, hudBelow: 0.0 };

function termsOf(tangent: number): Readonly<typeof tangentTerms> {
  const terms = tangentTerms;
  if (terms.tangent === tangent) return terms;
  const tilt = f32(tangent * CAMERA_PITCH_SIN);
  terms.above = f32(CAMERA_PITCH_COS + tilt);
  terms.below = f32(CAMERA_PITCH_COS - tilt);
  const hudTangent = f32(tangent * 0.4399999976158142);
  const hudTilt = f32(hudTangent * CAMERA_PITCH_SIN);
  terms.hudTangent = hudTangent;
  terms.hudAbove = f32(CAMERA_PITCH_COS + hudTilt);
  terms.hudBelow = f32(CAMERA_PITCH_COS - hudTilt);
  terms.tangent = tangent;
  return terms;
}






interface RangeTerms {
  tangent: number;
  bounds: Readonly<StageRegion> | undefined;
  aspect: number;
  blastBottom: number;
  maxWidth: number;
  maxHeight: number;
  tangentAspect: number;
  blastFloor: number;
}
const emptyRange = (): RangeTerms => ({ tangent: -1.0, bounds: undefined, aspect: 0.0, blastBottom: 0.0, maxWidth: 0.0, maxHeight: 0.0, tangentAspect: 0.0, blastFloor: 0.0 });
const rangeTerms = { first: emptyRange(), second: emptyRange(), firstNewer: false };

const rangeFor = (range: Readonly<RangeTerms>, tangent: number, bounds: Readonly<StageRegion>, aspect: number, blastBottom: number): boolean =>
  range.tangent === tangent && range.bounds === bounds && range.aspect === aspect && range.blastBottom === blastBottom;

function rangeOf(tangent: number, bounds: Readonly<StageRegion>, aspect: number, blastBottom: number): Readonly<RangeTerms> {
  const cache = rangeTerms;
  if (rangeFor(cache.first, tangent, bounds, aspect, blastBottom)) return cache.first;
  if (rangeFor(cache.second, tangent, bounds, aspect, blastBottom)) return cache.second;

  const range = cache.firstNewer ? cache.second : cache.first;
  cache.firstNewer = !cache.firstNewer;
  const terms = termsOf(tangent);
  const unitAbove = cameraReach(1.0, tangent, terms.above);
  const unitBelow = cameraReach(1.0, tangent, terms.below);
  const hudBelow = cameraReach(1.0, terms.hudTangent, terms.hudBelow);
  const tangentAspect = f32(tangent * aspect);
  const wide = f32(f32(1.0 + f32(unitBelow * CAMERA_PITCH_SIN)) * tangentAspect);
  const blastFloor = f32(blastBottom + 20.0);
  range.maxWidth = f32(f32(bounds.right - bounds.left) / f32(2.0 * wide));


  range.maxHeight = Math.min(f32(f32(bounds.top - bounds.bottom) / f32(unitAbove + hudBelow)), f32(f32(bounds.top - blastFloor) / f32(unitAbove + unitBelow)));
  range.tangentAspect = tangentAspect;
  range.blastFloor = blastFloor;
  range.tangent = tangent;
  range.bounds = bounds;
  range.aspect = aspect;
  range.blastBottom = blastBottom;
  return range;
}


interface Reaches {
  distance: number;
  tangent: number;
  above: number;
  below: number;
  hudBelow: number;
}






const emptyReaches = (): Reaches => ({ distance: 0.0, tangent: -1.0, above: 0.0, below: 0.0, hudBelow: 0.0 });
const reachTerms = { first: emptyReaches(), second: emptyReaches(), firstNewer: false };

function reachesOf(distance: number, tangent: number): Readonly<Reaches> {
  const cache = reachTerms;
  if (cache.first.distance === distance && cache.first.tangent === tangent) return cache.first;
  if (cache.second.distance === distance && cache.second.tangent === tangent) return cache.second;
  const reaches = cache.firstNewer ? cache.second : cache.first;
  cache.firstNewer = !cache.firstNewer;
  const terms = termsOf(tangent);
  reaches.above = cameraReach(distance, tangent, terms.above);
  reaches.below = cameraReach(distance, tangent, terms.below);
  reaches.hudBelow = cameraReach(distance, terms.hudTangent, terms.hudBelow);
  reaches.distance = distance;
  reaches.tangent = tangent;
  return reaches;
}


export function limitCamera(camera: MatchCamera, bounds: StageRegion, aspect: number, blastBottom: number = -840.0): void {
  const range = rangeOf(camera.tangent, bounds, aspect, blastBottom);
  camera.distance = Math.min(camera.distance, range.maxWidth, range.maxHeight);
  const { above: reachAbove, below: reachBelow, hudBelow } = reachesOf(camera.distance, camera.tangent);
  const halfWidth = f32(f32(camera.distance + f32(reachBelow * CAMERA_PITCH_SIN)) * range.tangentAspect);
  camera.x = clamp(camera.x, f32(bounds.left + halfWidth), f32(bounds.right - halfWidth));
  camera.z = clamp(camera.z, Math.max(f32(bounds.bottom + hudBelow), f32(range.blastFloor + reachBelow)), f32(bounds.top - reachAbove));
}


export function outsideCamera(camera: Readonly<MatchCamera>, x: number, z: number, aspect: number = MATCH_CAMERA_ASPECT): boolean {
  const dz = f32(z - camera.z);
  const depth = f32(camera.distance - f32(dz * CAMERA_PITCH_SIN));
  const halfHeight = f32(depth * camera.tangent);
  return depth <= 0 || Math.abs(f32(x - camera.x)) > f32(halfHeight * aspect) || Math.abs(f32(dz * CAMERA_PITCH_COS)) > halfHeight;
}


interface SubjectScale {
  readonly ratio: number;
  readonly step: number;
  readonly front: number;
  readonly back: number;
  readonly bottom: number;
  readonly top: number;
}

function subjectScale(count: number): SubjectScale {
  const ratio = f32(1.5 * (count === 1 ? 1.5 : count === 2 ? 1.3200000524520874 : count === 3 ? 1.159999966621399 : 1.0));

  return { ratio, step: f32(3.0 * ratio), front: f32(198.0 * ratio), back: f32(54.0 * ratio), bottom: -f32(54.0 * ratio), top: f32(96.0 * ratio) };
}


const SUBJECT_SCALES: readonly SubjectScale[] = [subjectScale(1), subjectScale(2), subjectScale(3), subjectScale(4)];

// Within the camera range, raw rounding stays within hundredths; retain the whole-unit acceptance margin.






export function wellInsideCamera(camera: Readonly<MatchCamera>, x: number, z: number, aspect: number = MATCH_CAMERA_ASPECT): boolean {
  const dz = z - camera.z;
  const depth = camera.distance - dz * CAMERA_PITCH_SIN;
  const halfHeight = depth * camera.tangent;
  return depth > 1.0 && Math.abs(x - camera.x) < halfHeight * aspect - 1.0 && Math.abs(dz * CAMERA_PITCH_COS) < halfHeight - 1.0;
}


export function advanceMatchCamera(camera: MatchCamera, world: Readonly<Roster>, stage: number): void {
  const { camera: bounds, blast } = stageBounds(stage);
  let count = 0;
  for (const slot of PARTICIPANT_SLOTS) if (isActive(world, slot) && !fighterAt(world, slot).status.out) count++;
  if (count === 0) return;
  const { step, front, back, bottom: boxBottom, top: boxTop } = count <= SUBJECT_SCALES.length ? at(SUBJECT_SCALES, count - 1) : subjectScale(count);
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
    const box = camera.boxes[slot];
    const toward = fighter.facing > 0;
    box.left = camera.initialized ? extent(box.left, -(toward ? back : front), step) : -(toward ? back : front);
    box.right = camera.initialized ? extent(box.right, toward ? front : back, step) : toward ? front : back;
    box.bottom = camera.initialized ? extent(box.bottom, boxBottom, step) : boxBottom;
    box.top = camera.initialized ? extent(box.top, boxTop, step) : boxTop;
    left = Math.min(left, clamp(f32(x + box.left), bounds.left, bounds.right));
    right = Math.max(right, clamp(f32(x + box.right), bounds.left, bounds.right));
    const centre = f32(z + 60.0);
    bottom = Math.min(bottom, clamp(f32(centre + box.bottom), bounds.bottom, bounds.top));
    top = Math.max(top, clamp(f32(centre + box.top), bounds.bottom, bounds.top));
  }
  camera.left = left;
  camera.right = right;
  camera.bottom = bottom;
  camera.top = top;
  camera.tangent = ease(camera.tangent, WIDE, 0.10000000149011612);
  const width = f32(camera.right - camera.left);

  const spread = Math.max(width, f32(camera.top - camera.bottom));

  const rate = f32(f32(0.05000000074505806 + f32(clamp(f32(f32(f32(spread / 6.0) - 120.0) / 780.0), 0.0, 1.0) * 0.05000000074505806)) * 1.7999999523162842);
  const padding = f32(60.0 + f32(2340.0 * clamp(f32(f32(f32(camera.distance / 6.0) - 80.0) / 4920.0), 0.0, 1.0)));
  const lower = f32(camera.bottom - padding);
  const targetX = f32(f32(camera.left + camera.right) / 2.0);
  const middleZ = f32(f32(lower + camera.top) / 2.0);
  const vertical = f32(f32(camera.top - lower) / f32(1.440000057220459 * camera.tangent));
  const horizontal = f32(width / f32(f32(2.0 * camera.tangent) * MATCH_CAMERA_ASPECT));
  const distance = clamp(Math.max(vertical, horizontal), 498.0, 6000.0);


  const underside = mainDeckUndersideZ(stage);
  const nearUnderside = lowest >= f32(underside - 100.0) && lowest <= f32(underside + 100.0);
  const floorOfView = nearUnderside ? Math.min(lowest, f32(underside - 35.0)) : lowest;
  const terms = termsOf(camera.tangent);
  const targetZ = Math.min(middleZ, f32(floorOfView + cameraReach(distance, terms.hudTangent, terms.hudBelow)));


  goal.tangent = camera.tangent;
  goal.x = targetX;
  goal.z = targetZ;
  goal.distance = distance;
  limitCamera(goal, bounds, MATCH_CAMERA_ASPECT, blast.bottom);
  if (nearUnderside) {
    const goalTerms = termsOf(goal.tangent);
    const unitBelow = cameraReach(1.0, goal.tangent, goalTerms.below);
    const unitHudBelow = cameraReach(1.0, goalTerms.hudTangent, goalTerms.hudBelow);
    goal.distance = Math.min(goal.distance, f32(f32(floorOfView - f32(blast.bottom + 20.0)) / f32(unitBelow - unitHudBelow)));
    goal.z = Math.min(goal.z, f32(floorOfView + cameraReach(goal.distance, goalTerms.hudTangent, goalTerms.hudBelow)));
    limitCamera(goal, bounds, MATCH_CAMERA_ASPECT, blast.bottom);
  }
  camera.x = camera.initialized ? ease(camera.x, goal.x, rate) : goal.x;
  camera.z = camera.initialized ? ease(camera.z, goal.z, rate) : goal.z;
  camera.distance = camera.initialized ? ease(camera.distance, goal.distance, 0.27000001072883606) : goal.distance;
  camera.initialized = true;

  limitCamera(camera, bounds, MATCH_CAMERA_ASPECT, blast.bottom);
}

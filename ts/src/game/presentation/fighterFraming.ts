import { at } from "wisp/src/runtime/lookup";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { Character } from "../sim/codes";
import { copyMatchCamera, createMatchCamera, limitCamera, type MatchCamera } from "../sim/matchCamera";
import { fighterAt, isActive, type Roster } from "../sim/roster";
import { stageBounds } from "../sim/stageBounds";
import { FIGHTER_VIEW_BOUNDS, type ViewBounds } from "./fighterViewBounds";
import { characterModelScale } from "./modelScale";

const PITCH_COS = 0.9848077297210693;
const PITCH_SIN = 0.1736481785774231;
const HUD_SHARE = 0.4399999976158142;

export const FRAMING_MARGIN = { top: 80.0, bottom: 100.0, side: 15.0 } as const;
export const CLOSEST_BODY_SHARE = 0.30000001192092896;

export function lookFrame(character: Character, look: "classic" | "definitive"): ViewBounds {
  const bounds = FIGHTER_VIEW_BOUNDS[character][look];
  const scale = characterModelScale(character);
  return { left: bounds.left * scale, right: bounds.right * scale, bottom: bounds.bottom * scale, top: bounds.top * scale };
}

function frameOf(character: Character): ViewBounds {
  const classic = lookFrame(character, "classic"), definitive = lookFrame(character, "definitive");
  const half = Math.max(-classic.left, classic.right, -definitive.left, definitive.right);
  return { left: -half, right: half, bottom: Math.min(classic.bottom, definitive.bottom), top: Math.max(classic.top, definitive.top) };
}

const FRAMES: readonly ViewBounds[] = (() => {
  const frames: ViewBounds[] = [];
  for (const character of Object.values(Character)) frames[character] = frameOf(character);
  return frames;
})();

export function fighterFrame(character: Character): Readonly<ViewBounds> {
  return at(FRAMES, character);
}

const reach = (tangent: number, denominator: number): number => tangent / denominator;

const rowOf = (camera: Readonly<MatchCamera>, z: number): number => {
  const dz = z - camera.z;
  return 0.5 - (dz * PITCH_COS) / (2.0 * (camera.distance - dz * PITCH_SIN) * camera.tangent);
};

const probe = createMatchCamera();

function widestDistance(camera: Readonly<MatchCamera>, stage: number, aspect: number): number {
  const bounds = stageBounds(stage);
  copyMatchCamera(probe, camera);
  probe.distance = 100000.0;
  limitCamera(probe, bounds.camera, aspect, bounds.blast.bottom);
  return probe.distance;
}

interface LiveBody { x: number; z: number; frame: Readonly<ViewBounds> }
const LIVE: readonly LiveBody[] = PARTICIPANT_SLOTS.map(() => ({ x: 0.0, z: 0.0, frame: fighterFrame(Character.rifleman) }));
let liveCount = 0;

function gatherLive(world: Readonly<Roster>): void {
  let count = 0;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const fighter = fighterAt(world, slot);
    if (fighter.status.out) continue;
    const body = at(LIVE, count++);
    body.x = fighter.motion.x;
    body.z = fighter.motion.z;
    body.frame = fighterFrame(fighter.character);
  }
  liveCount = count;
}

function limitBodyShare(camera: MatchCamera, widest: number): void {
  for (let pass = 0; pass < 3; pass++) {
    let share = 0.0, left = 0.0, right = 0.0, lowest = 0.0, count = 0;
    let index = 0;
    for (const { frame, x, z } of LIVE) {
      if (index++ >= liveCount) break;
      share = Math.max(share, rowOf(camera, z + frame.bottom) - rowOf(camera, z + frame.top));
      if (count === 0 || x < left) left = x;
      if (count === 0 || x > right) right = x;
      if (count === 0 || z < lowest) lowest = z;
      count++;
    }
    if (share <= CLOSEST_BODY_SHARE) return;
    const scale = Math.min((share / CLOSEST_BODY_SHARE) * 1.0199999809265137, Math.max(1.0, widest / camera.distance));
    if (scale <= 1.0) return;
    const anchor = (left + right) / 2.0;
    camera.x = anchor + (camera.x - anchor) * scale;
    camera.z = lowest + (camera.z - lowest) * scale;
    camera.distance *= scale;
  }
}

export function fitFighterFrames(camera: MatchCamera, world: Readonly<Roster>, stage: number, aspect: number): boolean {
  const widest = widestDistance(camera, stage, aspect);
  gatherLive(world);
  limitBodyShare(camera, widest);
  containFighters(camera, stage, aspect, widest);
  limitBodyShare(camera, widest);
  containFighters(camera, stage, aspect, widest);
  const { x, z, distance } = camera;
  const bounds = stageBounds(stage);
  limitCamera(camera, bounds.camera, aspect, bounds.blast.bottom);
  return distance < widest && camera.x === x && camera.z === z && camera.distance === distance;
}

function containFighters(camera: MatchCamera, stage: number, aspect: number, widest: number): void {
  const region = stageBounds(stage).camera;
  let left = 0.0, right = 0.0, bottom = 0.0, top = 0.0, count = 0;
  let index = 0;
  for (const { frame, x, z } of LIVE) {
    if (index++ >= liveCount) break;
    const l = Math.max(region.left, x + frame.left - FRAMING_MARGIN.side), r = Math.min(region.right, x + frame.right + FRAMING_MARGIN.side);
    const b = z + frame.bottom - FRAMING_MARGIN.bottom, t = Math.min(region.top, z + frame.top + FRAMING_MARGIN.top);
    if (count === 0 || l < left) left = l;
    if (count === 0 || r > right) right = r;
    if (count === 0 || b < bottom) bottom = b;
    if (count === 0 || t > top) top = t;
    count++;
  }
  if (count === 0) return;
  const tangent = camera.tangent;
  const unitAbove = reach(tangent, PITCH_COS + tangent * PITCH_SIN);
  const hudTangent = tangent * HUD_SHARE;
  const unitHud = reach(hudTangent, PITCH_COS - hudTangent * PITCH_SIN);
  const aboveHud = bottom >= camera.z - camera.distance * unitHud;
  const unitBelow = reach(tangent, PITCH_COS - tangent * PITCH_SIN);
  const vertical = aboveHud ? (top - bottom) / (unitAbove + unitHud) : Math.max((top - camera.z + camera.distance * unitHud) / (unitAbove + unitHud), (camera.z - bottom) / unitBelow);
  const horizontal = (right - left) / 2.0 / ((1.0 - unitAbove * PITCH_SIN) * tangent * aspect);
  const distance = Math.max(camera.distance, Math.min(widest, Math.max(vertical, horizontal)));
  const z = Math.max(camera.z, Math.min(top - distance * unitAbove, aboveHud ? bottom + distance * unitHud : camera.z + (distance - camera.distance) * unitHud));
  const half = (distance - (top - z) * PITCH_SIN) * tangent * aspect;
  camera.distance = distance;
  camera.z = z;
  camera.x = Math.min(Math.max(camera.x, right - half), left + half);
}

function edgeOutside(camera: Readonly<MatchCamera>, aspect: number, x: number, z: number, half: number): boolean {
  const dz = z - camera.z;
  const depth = camera.distance - dz * PITCH_SIN;
  const halfHeight = depth * camera.tangent;
  return depth <= 0.0 || Math.abs(dz * PITCH_COS) > halfHeight || Math.abs(x - camera.x) + half > halfHeight * aspect;
}

export function fighterOffscreen(camera: Readonly<MatchCamera>, aspect: number, character: Character, x: number, z: number): boolean {
  const frame = fighterFrame(character);
  return edgeOutside(camera, aspect, x, z + frame.bottom, frame.right) || edgeOutside(camera, aspect, x, z + frame.top, frame.right);
}

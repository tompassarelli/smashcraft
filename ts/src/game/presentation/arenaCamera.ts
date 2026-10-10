


import { f32 } from "wisp/src/sim/f32";
import { copyMatchCamera, createMatchCamera, limitCamera, MATCH_CAMERA_ASPECT, type MatchCamera } from "../sim/matchCamera";
import { arctangentDegrees } from "../sim/mathTables";
import { stageBounds } from "../sim/stageBounds";
import { TOMB_OF_SARGERAS_STAGE } from "../sim/stage";


export const FLOOR_HEIGHT = 1800.0;






export const WORLD_BOUNDS = { left: -4096.0, right: 4096.0, front: -4096.0, back: 8192.0 } as const;
export const HIDDEN_EFFECT_DEPTH = 8192.0;
export const PLAYABLE_BOUNDS = { left: -3328.0, right: 3328.0, front: -3584.0, back: 3072.0, centreY: -256.0 } as const;


export const ARENA_CAMERA = { rotation: 90.0, angleOfAttack: 350.0, farZ: 8000.0 } as const;


export function localCamera(target: MatchCamera, source: Readonly<MatchCamera>, stage: number, aspect: number): void {
  copyMatchCamera(target, source);
  const bounds = stageBounds(stage);
  limitCamera(target, bounds.camera, aspect, bounds.blast.bottom);
}

export function cameraFieldOfView(camera: Readonly<MatchCamera>, aspect: number): number {
  return f32(2.0 * arctangentDegrees(f32(camera.tangent * aspect)));
}

export function finalCamera(camera: MatchCamera, stage: number): void {
  if (stage === TOMB_OF_SARGERAS_STAGE) camera.z = Math.max(camera.z, 80.0 - camera.distance * 0.1736481785774231);
}


export type CameraExtreme = "near" | "far";


export function extremeCamera(target: MatchCamera, stage: number, aspect: number, extreme: CameraExtreme): void {
  const bounds = stageBounds(stage);
  target.x = 0.0;
  target.z = extreme === "near" ? 100.0 : -100000.0;
  target.distance = extreme === "near" ? 1450.0 : 100000.0;
  target.tangent = extreme === "near" ? 0.2679491937160492 : 0.3443276286125183;
  limitCamera(target, bounds.camera, aspect, bounds.blast.bottom);
}


export function cameraPoint(camera: Readonly<MatchCamera>, aspect: number, x: number, z: number): { readonly column: number; readonly row: number } {
  const dz = z - camera.z;
  const depth = camera.distance - dz * 0.1736481785774231;
  return { column: 0.5 + (x - camera.x) / (2.0 * depth * camera.tangent * aspect), row: 0.5 - dz * 0.9848077297210693 / (2.0 * depth * camera.tangent) };
}


export function arenaFraming(left: number, right: number, bottom: number, top: number): { readonly x: number; readonly z: number; readonly distance: number; readonly fieldOfView: number } {
  const camera = createMatchCamera();
  camera.tangent = 0.3443276286125183;
  camera.x = f32(f32(left + right) / 2.0);
  camera.z = f32(f32(bottom + top) / 2.0);
  camera.distance = Math.max(1450.0, right - left, top - bottom);
  limitCamera(camera, stageBounds(0).camera, MATCH_CAMERA_ASPECT);
  return { x: camera.x, z: camera.z, distance: camera.distance, fieldOfView: cameraFieldOfView(camera, MATCH_CAMERA_ASPECT) };
}

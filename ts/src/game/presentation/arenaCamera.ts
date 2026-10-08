// The arena camera frames the live fighters from the side above a floor that
// stands FLOOR_HEIGHT over the ground at the world origin. The map's camera
// and the host's view checks share these numbers.
import { f32 } from "wisp/src/sim/f32";
import { copyMatchCamera, createMatchCamera, limitCamera, MATCH_CAMERA_ASPECT, type MatchCamera } from "../sim/matchCamera";
import { stageBounds } from "../sim/stageBounds";

/** The arena floor stands this far above the ground at the world origin. */
export const FLOOR_HEIGHT = 1800.0;

/**
 * Warcraft draws no effect whose position lies outside the map's world bounds
 * (#298). The base map's are 64 x 64 cells, x and y -4096..4096, and its playable
 * centre is at y -256; Wisp's headless world has no bounds and centres at 0.
 */
export const WORLD_BOUNDS = { left: -4096.0, right: 4096.0, front: -4096.0, back: 4096.0, playableCentreY: -256.0 } as const;

/** The arena stands this far south of the playable centre, so scenery up to 7,600 behind the fighters stays inside the world bounds. */
export const ARENA_SOUTH = 3500.0;

/** The fields the arena camera keeps, in degrees and world units: along +y, ten degrees down. */
export const ARENA_CAMERA = { rotation: 90.0, angleOfAttack: 350.0, farZ: 8000.0 } as const;

/** Local-only projection of the canonical match camera; never fed into simulation. */
export function localCamera(target: MatchCamera, source: Readonly<MatchCamera>, stage: number, aspect: number): void {
  copyMatchCamera(target, source);
  const bounds = stageBounds(stage);
  limitCamera(target, bounds.camera, aspect, bounds.blast.bottom);
}

export function cameraFieldOfView(camera: Readonly<MatchCamera>, aspect: number): number {
  return (Math.atan(camera.tangent * aspect) * 360.0) / Math.PI;
}

/** The two framings a match can reach on a stage: closest (fighters together on the deck) and widest and lowest (fighters spread to the camera limits, one far below). */
export type CameraExtreme = "near" | "far";

/** Sets `target` to one of the stage's camera extremes, after the same limits every match framing passes. */
export function extremeCamera(target: MatchCamera, stage: number, aspect: number, extreme: CameraExtreme): void {
  const bounds = stageBounds(stage);
  target.x = 0.0;
  target.z = extreme === "near" ? 100.0 : -100000.0;
  target.distance = extreme === "near" ? 1450.0 : 100000.0;
  target.tangent = extreme === "near" ? 0.2679491937160492 : 0.3443276286125183;
  limitCamera(target, bounds.camera, aspect, bounds.blast.bottom);
}

/** Projection against the actual local view, as fractions from the top-left. */
export function cameraPoint(camera: Readonly<MatchCamera>, aspect: number, x: number, z: number): { readonly column: number; readonly row: number } {
  const dz = z - camera.z;
  const depth = camera.distance - dz * 0.1736481785774231;
  return { column: 0.5 + (x - camera.x) / (2.0 * depth * camera.tangent * aspect), row: 0.5 - dz * 0.9848077297210693 / (2.0 * depth * camera.tangent) };
}

/** Static view spans for the model parking check, with the same final corner clamp. */
export function arenaFraming(left: number, right: number, bottom: number, top: number): { readonly x: number; readonly z: number; readonly distance: number; readonly fieldOfView: number } {
  const camera = createMatchCamera();
  camera.tangent = 0.3443276286125183;
  camera.x = f32(f32(left + right) / 2.0);
  camera.z = f32(f32(bottom + top) / 2.0);
  camera.distance = Math.max(1450.0, right - left, top - bottom);
  limitCamera(camera, stageBounds(0).camera, MATCH_CAMERA_ASPECT);
  return { x: camera.x, z: camera.z, distance: camera.distance, fieldOfView: cameraFieldOfView(camera, MATCH_CAMERA_ASPECT) };
}

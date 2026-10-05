// The arena camera frames the live fighters from the side above a floor that
// stands FLOOR_HEIGHT over the ground at the world origin. The map's camera
// and the host's view checks share these numbers.
import { f32 } from "wisp/src/sim/f32";

/** The arena floor stands this far above the ground at the world origin. */
export const FLOOR_HEIGHT = 1800.0;

/** The fields the arena camera keeps, in degrees and world units: along +y, ten degrees down. */
export const ARENA_CAMERA = { rotation: 90.0, angleOfAttack: 350.0, fieldOfView: 70.0, farZ: 8000.0 } as const;

/** Where the camera looks, relative to the stage center at floor height, and from how far, for live fighters spanning this box. */
export function arenaFraming(left: number, right: number, bottom: number, top: number): { readonly x: number; readonly z: number; readonly distance: number } {
  return {
    x: (left + right) / 2,
    z: Math.max(160.0, (bottom + top) / 2),
    distance: Math.max(1450.0, (right - left + 500) * f32(1.15), (top - bottom + 350) * 1.5),
  };
}

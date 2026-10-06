// The arena camera frames the live fighters from the side above a floor that
// stands FLOOR_HEIGHT over the ground at the world origin. The map's camera
// and the host's view checks share these numbers.
import { f32 } from "wisp/src/sim/f32";
import { MAIN_DECK_UNDERSIDE_Z } from "../sim/stage";

/** The arena floor stands this far above the ground at the world origin. */
export const FLOOR_HEIGHT = 1800.0;

/** The fields the arena camera keeps, in degrees and world units: along +y, ten degrees down. */
export const ARENA_CAMERA = { rotation: 90.0, angleOfAttack: 350.0, fieldOfView: 70.0, farZ: 8000.0 } as const;

/** Clients run 16:9, and Warcraft spreads the field of view across the frame's width. */
const FRAME_ASPECT = 16.0 / 9.0;
/** The match HUD's panels reach 0.139 up the 0.6-high screen (ui/matchHud.ts), 77% of the way down the frame; framing keeps the lowest fighter above 72%. */
const ABOVE_HUD_ROW = f32(0.72);
/** Framing keeps the highest fighter's head below the frame's top 3%; fighters stand up to about 150 tall. */
const BELOW_TOP_ROW = f32(0.03);
const FIGHTER_HEIGHT = 150.0;
/** A fighter below the floor keeps this much of what is below it in view, down to the main deck's underside. */
const ROOM_BELOW = 100.0;
/**
 * Hidden effects park on the ground beneath the stage center
 * (render/effects.ts hideEffect), so the frame's lowest ray meets the ground
 * no nearer than this beyond it.
 */
const PARKING_CLEARANCE = 1300.0;

/**
 * Where the camera looks, relative to the stage center at floor height, and
 * from how far, for live fighters spanning this box. Fighters on the floor
 * stand 160 below the camera's target. When that would put the lowest fighter
 * behind the HUD, as one below the floor would be, the camera follows it down,
 * as Melee's follows a fighter under the stage, and backs off to keep the
 * highest in view. Near the main deck's underside, the underside stays in view
 * with it.
 */
export function arenaFraming(left: number, right: number, bottom: number, top: number): { readonly x: number; readonly z: number; readonly distance: number } {
  const pitch = ((360.0 - ARENA_CAMERA.angleOfAttack) * Math.PI) / 180.0;
  const halfHeight = Math.tan((ARENA_CAMERA.fieldOfView * Math.PI) / 360.0) / FRAME_ASPECT;
  const toHud = (2 * ABOVE_HUD_ROW - 1) * halfHeight;
  const toTop = (1 - 2 * BELOW_TOP_ROW) * halfHeight;
  // Per unit of distance, how far below the target a point shows above the HUD, and how far above it below the top.
  const belowHud = toHud / (Math.cos(pitch) - toHud * Math.sin(pitch));
  const aboveTop = toTop / (Math.cos(pitch) + toTop * Math.sin(pitch));
  const lowest = Math.min(bottom, Math.max(MAIN_DECK_UNDERSIDE_Z, bottom - Math.min(ROOM_BELOW, Math.max(0.0, -bottom))));
  const standing = Math.max(160.0, (bottom + top) / 2);
  let distance = Math.max(1450.0, (right - left + 500) * f32(1.15), (top - bottom + 350) * 1.5);
  if (standing > lowest + belowHud * distance) distance = Math.max(distance, (top + FIGHTER_HEIGHT - lowest) / (belowHud + aboveTop));
  const parked = (PARKING_CLEARANCE + distance * Math.cos(pitch)) * Math.tan(pitch + Math.atan(halfHeight)) - distance * Math.sin(pitch) - FLOOR_HEIGHT;
  return { x: (left + right) / 2, z: Math.max(Math.min(standing, lowest + belowHud * distance), parked), distance };
}

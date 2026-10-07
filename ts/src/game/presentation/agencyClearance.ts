// Whether a tumbling fighter flying with no input surely touches nothing for
// a while: no deck, solid surface or blast line. The agency
// forecast (fighterAgency.ts) stops there instead of simulating every frame
// of its tech window, which made each launching hit's frame cost several
// milliseconds (#168). Coarse on purpose: positions are bounded per frame
// from the fighter's own velocity, its knockback (which decays by at most a
// decay step a frame along each axis), gravity to terminal speed, the wind
// and its shield recoil, and the fighter's bounds are widened by its body
// with room to spare, so a "clear" answer holds with margin and anything
// close gets the full simulation. Ledges and the cannon catch fighters in the
// match step, which the forecast doesn't run, so they are no contact here.
import { f32 } from "wisp/src/sim/f32";
import { solidSurfaceAt, solidSurfaceCount, surfaceCount, surfaceLeft, surfaceRight, surfaceZ } from "../sim/stage";
import { stageBounds } from "../sim/stageBounds";
import { WIND_SPEED, hasWind } from "../sim/stageHazards";
import { AIR_KNOCKBACK_DECAY } from "../sim/motion";
import { WORLD_UNITS_PER_MELEE_UNIT } from "../sim/tuning";
import type { Fighter } from "../sim/fighter";

/** World units a fighter's bounds widen by: sideways, well past its flank (12); below, past its feet, its position; above, past its top (at most 113). */
const SIDE_MARGIN = 60.0;
const BELOW_MARGIN = 10.0;
const ABOVE_MARGIN = 200.0;
/** World units a frame's bounds widen by beyond the terms they follow, for rounding and unmodelled nudges. */
const CLEAR_SLACK = 2.0;
const KNOCKBACK_DECAY = f32(AIR_KNOCKBACK_DECAY * WORLD_UNITS_PER_MELEE_UNIT);

const abs = (value: number) => (value < 0 ? -value : value);
const overlaps = (lowA: number, highA: number, lowB: number, highB: number) => lowA <= highB && lowB <= highA;

/**
 * Whether `f`, airborne with no input, surely touches no surface or blast
 * line on match frames `frame` + 1 through `frame` + `frames`.
 */
export function surelyClear(f: Readonly<Fighter>, stage: number, frame: number, frames: number): boolean {
  const { motion, launch, shield } = f;
  const { gravity, terminalSpeed } = f.tuning.physics;
  const extra = f32(abs(shield.recoilX) + abs(shield.recoilZ) + CLEAR_SLACK);
  const wind = hasWind(stage) ? abs(WIND_SPEED) : 0.0;
  const { blast } = stageBounds(stage);
  const decks = surfaceCount(stage);
  const solids = solidSurfaceCount(stage);
  let lowX = motion.x;
  let highX = motion.x;
  let lowZ = motion.z;
  let highZ = motion.z;
  // Gravity only lowers vertical speed, to terminal speed; drag only slows horizontal speed.
  const highVz = motion.vz > -terminalSpeed ? motion.vz : -terminalSpeed;
  for (let step = 1; step <= frames; step++) {
    const spread = f32(step * KNOCKBACK_DECAY);
    const falling = f32(motion.vz - step * gravity);
    const lowVz = motion.vz < -terminalSpeed ? motion.vz : falling > -terminalSpeed ? falling : -terminalSpeed;
    lowZ = f32(lowZ + lowVz + launch.knockbackZ - spread - extra);
    highZ = f32(highZ + highVz + launch.knockbackZ + spread + extra);
    lowX = f32(lowX + (motion.vx < 0 ? motion.vx : 0.0) + launch.knockbackX - spread - wind - extra);
    highX = f32(highX + (motion.vx > 0 ? motion.vx : 0.0) + launch.knockbackX + spread + wind + extra);
    const left = f32(lowX - SIDE_MARGIN);
    const right = f32(highX + SIDE_MARGIN);
    const bottom = f32(lowZ - BELOW_MARGIN);
    const top = f32(highZ + ABOVE_MARGIN);
    if (left < blast.left || right > blast.right || bottom < blast.bottom || top > blast.top) return false;
    for (let index = 0; index < decks; index++) {
      const z = surfaceZ(stage, index, frame + step);
      if (z >= bottom && z <= top && overlaps(left, right, surfaceLeft(stage, index, frame + step), surfaceRight(stage, index, frame + step))) return false;
    }
    for (let index = 0; index < solids; index++) {
      const solid = solidSurfaceAt(stage, index);
      const solidLeft = solid.startX < solid.endX ? solid.startX : solid.endX;
      const solidRight = solid.startX < solid.endX ? solid.endX : solid.startX;
      const solidBottom = solid.startZ < solid.endZ ? solid.startZ : solid.endZ;
      const solidTop = solid.startZ < solid.endZ ? solid.endZ : solid.startZ;
      if (overlaps(left, right, solidLeft, solidRight) && overlaps(bottom, top, solidBottom, solidTop)) return false;
    }
  }
  return true;
}

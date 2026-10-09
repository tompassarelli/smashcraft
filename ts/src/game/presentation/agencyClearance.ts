










import { f32 } from "wisp/src/sim/f32";
import { MAIN_DECK_BODY_SURFACES, mainDeckZ, solidSurfaceAt, solidSurfaceCount, surfaceCount, surfaceLeft, surfaceRight, surfaceTopZ, surfaceZ } from "../sim/stage";
import { stageBounds } from "../sim/stageBounds";
import { WIND_SPEED, hasWind } from "../sim/stageHazards";
import { AIR_KNOCKBACK_DECAY } from "../sim/motion";
import { WORLD_UNITS_PER_MELEE_UNIT } from "../sim/tuning";
import type { Fighter } from "../sim/fighter";


const SIDE_MARGIN = 60.0;
const BELOW_MARGIN = 10.0;
const ABOVE_MARGIN = 200.0;

const CLEAR_SLACK = 2.0;
const KNOCKBACK_DECAY = f32(AIR_KNOCKBACK_DECAY * WORLD_UNITS_PER_MELEE_UNIT);

const abs = (value: number) => (value < 0 ? -value : value);
const overlaps = (lowA: number, highA: number, lowB: number, highB: number) => lowA <= highB && lowB <= highA;





export function surelyClear(f: Readonly<Fighter>, stage: number, frame: number, frames: number): boolean {
  const { motion, launch, shield } = f;
  const { gravity, terminalSpeed } = f.tuning.physics;



  const extra = abs(shield.recoilX) + abs(shield.recoilZ) + CLEAR_SLACK;
  const wind = hasWind(stage) ? abs(WIND_SPEED) : 0.0;
  const { blast } = stageBounds(stage);
  const decks = surfaceCount(stage);
  const solids = solidSurfaceCount(stage);
  let lowX = motion.x;
  let highX = motion.x;
  let lowZ = motion.z;
  let highZ = motion.z;

  const highVz = motion.vz > -terminalSpeed ? motion.vz : -terminalSpeed;
  for (let step = 1; step <= frames; step++) {
    const spread = step * KNOCKBACK_DECAY;
    const falling = motion.vz - step * gravity;
    const lowVz = motion.vz < -terminalSpeed ? motion.vz : falling > -terminalSpeed ? falling : -terminalSpeed;
    lowZ = lowZ + lowVz + launch.knockbackZ - spread - extra;
    highZ = highZ + highVz + launch.knockbackZ + spread + extra;
    lowX = lowX + (motion.vx < 0 ? motion.vx : 0.0) + launch.knockbackX - spread - wind - extra;
    highX = highX + (motion.vx > 0 ? motion.vx : 0.0) + launch.knockbackX + spread + wind + extra;
    const left = lowX - SIDE_MARGIN;
    const right = highX + SIDE_MARGIN;
    const bottom = lowZ - BELOW_MARGIN;
    const top = highZ + ABOVE_MARGIN;
    if (left < blast.left || right > blast.right || bottom < blast.bottom || top > blast.top) return false;
    for (let index = 0; index < decks; index++) {
      const z = surfaceZ(stage, index, frame + step);
      if (surfaceTopZ(stage, index, frame + step) >= bottom && z <= top && overlaps(left, right, surfaceLeft(stage, index, frame + step), surfaceRight(stage, index, frame + step))) return false;
    }
    const firstSolid = bottom > mainDeckZ(stage) ? MAIN_DECK_BODY_SURFACES : 0;
    for (let index = firstSolid; index < solids; index++) {
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

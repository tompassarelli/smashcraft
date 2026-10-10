


import { f32 } from "wisp/src/sim/f32";
import { HERO_REFERENCE_HEIGHT } from "./heroMoves";
import type { Fighter } from "./fighter";
import { runningHeroSpecial, runningTableSpecial } from "./heroSpecialRules";
import { isUpSpecialAction, snapToLedge } from "./ledge";
import { setWorldMotionValue } from "./motion";
import type { Roster } from "./roster";
import { fighterAt } from "./roster";
import { MAIN_DECK_BODY_SURFACES, mainDeckLeft, mainDeckRight, mainDeckZ, solidSurfaceAt, solidSurfaceCount } from "./stage";
import { BODY_HALF_WIDTH, insideMainDeckBody } from "./surfaces";
import { melee } from "./tuning";
import { squareRoot } from "./warcraftMath";


export const TELEPORT_LIP_DEPTH = f32(HERO_REFERENCE_HEIGHT * f32(0.5));

export const TELEPORT_LEDGE_INSET = f32(HERO_REFERENCE_HEIGHT * f32(0.5));


function teleportsThisFrame(f: Readonly<Fighter>): boolean {
  const move = runningTableSpecial(f) >= 0 ? undefined : runningHeroSpecial(f);
  if (move === undefined) return false;
  for (const segment of move.motion ?? []) {
    if (segment.throughEdge === true && f.special.frame >= segment.first && f.special.frame <= segment.last) return true;
  }
  return false;
}









export function rideWall(f: Fighter, wallSide: number, intendedX: number, intendedZ: number, oldX: number, oldZ: number): void {
  const { motion, special } = f;
  if (wallSide === 0 || !isUpSpecialAction(special.action) || special.fall || teleportsThisFrame(f)) return;
  if (f32(intendedX * wallSide) <= 0 || intendedZ < 0) return;
  const nx = f.surfaceRecovery.contactNormalX;
  const nz = f.surfaceRecovery.contactNormalZ;

  const tx = nz >= 0 ? -nz : nz;
  const tz = nz >= 0 ? nx * -wallSide : -nx * -wallSide;
  const upX = tz < 0 ? -tx : tx;
  const upZ = tz < 0 ? -tz : tz;
  if (upZ <= 0) return;
  const removedX = f32(intendedX - f32(motion.x - oldX));
  const removedZ = f32(intendedZ - f32(motion.z - oldZ));
  const removed = squareRoot(f32(f32(removedX * removedX) + f32(removedZ * removedZ)));
  if (removed <= 0) return;
  motion.x = f32(motion.x + f32(upX * removed));
  motion.z = f32(motion.z + f32(upZ * removed));
  setWorldMotionValue(motion.meleeX, motion.x);
  setWorldMotionValue(motion.meleeZ, motion.z);
}


export const EdgePass = { none: 0, through: 1, land: 2, ledge: 3 } as const;
export type EdgePass = (typeof EdgePass)[keyof typeof EdgePass];


function deckEntry(stage: number, oldX: number, oldZ: number, x: number, z: number): number {
  const dx = f32(x - oldX);
  const dz = f32(z - oldZ);
  let first = 2.0;
  if (solidSurfaceCount(stage) === 0) return first;
  for (let i = 0; i < MAIN_DECK_BODY_SURFACES; i++) {
    const s = solidSurfaceAt(stage, i);
    const ex = f32(s.endX - s.startX);
    const ez = f32(s.endZ - s.startZ);
    const denominator = f32(f32(dx * ez) - f32(dz * ex));
    if (denominator === 0) continue;
    const ox = f32(s.startX - oldX);
    const oz = f32(s.startZ - oldZ);
    const t = f32(f32(f32(ox * ez) - f32(oz * ex)) / denominator);
    const u = f32(f32(f32(ox * dz) - f32(oz * dx)) / denominator);
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t < first) first = t;
  }
  return first;
}










export function passThroughEdge(world: Roster, slot: number, stage: number, oldX: number, oldZ: number): EdgePass {
  const f = fighterAt(world, slot);
  const { motion } = f;
  if (!teleportsThisFrame(f)) return EdgePass.none;
  const entry = deckEntry(stage, oldX, oldZ, motion.x, motion.z);
  if (entry > 1) return EdgePass.none;
  const top = mainDeckZ(stage);
  const entryZ = f32(oldZ + f32(f32(motion.z - oldZ) * entry));
  if (f32(top - entryZ) > TELEPORT_LIP_DEPTH) return EdgePass.none;
  if (motion.z >= top) return EdgePass.through;
  if (f32(top - motion.z) > TELEPORT_LIP_DEPTH || !insideMainDeckBody(stage, motion.x, motion.z)) return EdgePass.none;
  const side = motion.x >= 0 ? 1 : -1;
  const ledge = side > 0 ? mainDeckRight(stage) : mainDeckLeft(stage);
  const inset = f32(side * f32(ledge - motion.x));
  if (inset > TELEPORT_LEDGE_INSET) {
    motion.z = top;
    setWorldMotionValue(motion.meleeZ, motion.z);
    return EdgePass.land;
  }
  f.facing = -side;
  if (snapToLedge(world, slot, stage, side)) return EdgePass.ledge;
  motion.x = f32(ledge + f32(side * f32(melee(BODY_HALF_WIDTH) + 1.0)));
  setWorldMotionValue(motion.meleeX, motion.x);
  return EdgePass.through;
}

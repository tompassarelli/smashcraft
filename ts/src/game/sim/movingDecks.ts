// Moving decks carry what stands on them: grounded fighters, freeze traps and bears.
import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import type { Fighter } from "./fighter";
import { moveMeleeX, setWorldMotionValue } from "./motion";
import { type Roster, fighterAt, isActive } from "./roster";
import { surfaceCount, surfaceMoves, surfaceShiftX, surfaceZ } from "./stage";

function carryFighter(f: Fighter, deck: number, shiftX: number, z: number): void {
  const { motion } = f;
  if (f.status.out || !motion.grounded || motion.surface !== deck) return;
  moveMeleeX(f, shiftX);
  if (motion.z === z) return;
  motion.z = z;
  setWorldMotionValue(motion.meleeZ, z);
}

function carrySummons(f: Fighter, deck: number, shiftX: number, z: number): void {
  const { freezeTrap: trap, bear } = f;
  if (trap.life > 0 && trap.surface === deck) {
    trap.x = f32(trap.x + shiftX);
    trap.z = z;
  }
  if (bear.life > 0 && bear.surface === deck) {
    bear.x = f32(bear.x + shiftX);
    bear.z = z;
  }
}

/**
 * Moves everything standing on a moving deck along with it, before anything
 * else moves on match frame `matchFrame`. Melee adds a grounded fighter's
 * floor line's motion to its position on every frame, whatever its action
 * and in hitlag too (mpGetSpeed in Fighter_procUpdate,
 * melee:src/melee/ft/fighter.c), and its ground collision then keeps it on
 * the line; grounded items ride the same way (melee:src/melee/it/item.c).
 */
export function carryOnMovingDecks(world: Roster, stage: number, matchFrame: number): void {
  for (let deck = 1; deck < surfaceCount(stage); deck++) {
    if (!surfaceMoves(stage, deck)) continue;
    const shiftX = surfaceShiftX(stage, deck, matchFrame);
    const z = surfaceZ(stage, deck, matchFrame);
    for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
      if (!isActive(world, slot)) continue;
      const f = fighterAt(world, slot);
      carryFighter(f, deck, shiftX, z);
      carrySummons(f, deck, shiftX, z);
    }
  }
}

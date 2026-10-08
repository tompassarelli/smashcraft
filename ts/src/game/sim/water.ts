// The Tomb of Sargeras sea (smashcraft:docs/design/water-stage.md): each
// fighter's visit to the water, kept in its state so rollback and replays
// restore it. Everything here is a fixed function of the fighters' own
// positions and the match frame.
import { PARTICIPANT_SLOTS } from "../input/participants";
import type { Fighter } from "./fighter";
import { type Roster, fighterAt, isActive } from "./roster";
import { hasTide, inSea } from "./stageHazards";

export function clearWater(f: Fighter): void {
  const { water } = f;
  water.inWater = false;
  water.frames = 0;
  water.entries = 0;
  water.hydraFrame = 0;
  water.hydraX = 0.0;
}

/** After the fighters move: who is in the sea, for how long, and how often they went back in since landing. */
export function advanceWater(world: Roster, stage: number): void {
  if (!hasTide(stage)) return;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    if (f.status.out) continue;
    const { motion, water } = f;
    const now = inSea(stage, motion.x, motion.z);
    if (motion.grounded) {
      water.frames = 0;
      water.entries = 0;
    }
    if (now && !water.inWater) water.entries++;
    if (now) water.frames++;
    water.inWater = now;
  }
}

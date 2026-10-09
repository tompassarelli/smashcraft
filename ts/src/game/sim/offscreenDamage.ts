

import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS, participantActive } from "../input/participants";
import { outsideCamera, wellInsideCamera, type MatchCamera } from "./matchCamera";
import { fighterAt, isActive, type Roster } from "./roster";


export const countsOffscreen = (camera: Readonly<MatchCamera>, x: number, z: number): boolean =>
  !wellInsideCamera(camera, x, z + 60.0) && outsideCamera(camera, x, f32(z + 60.0));

export function advanceOffscreenDamage(world: Roster, camera: Readonly<MatchCamera>, practice: boolean, slots: number = world.mask): void {
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot) || !participantActive(slots, slot)) continue;
    const { motion, status } = fighterAt(world, slot);
    if (practice || status.out) {
      status.offscreenFrames = 0;
      continue;
    }

    if (status.damage >= 150.0) continue;
    if (!countsOffscreen(camera, motion.x, motion.z)) {
      status.offscreenFrames = 0;
      continue;
    }
    status.offscreenFrames++;
    if (status.offscreenFrames < 60) continue;
    status.offscreenFrames = 0;
    status.damage = f32(status.damage + 1.0);
  }
}

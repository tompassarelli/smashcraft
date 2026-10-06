// Fighter_procAnim, PlCo +0x7AC/+0x7B0/+0x7B4: one percent each
// 60 consecutive magnifier frames below 150 percent; training disables it.
import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { outsideCamera, type MatchCamera } from "./matchCamera";
import { fighterAt, isActive, type Roster } from "./roster";

export function advanceOffscreenDamage(world: Roster, camera: Readonly<MatchCamera>, practice: boolean): void {
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const { motion, status } = fighterAt(world, slot);
    if (practice || status.out) {
      status.offscreenFrames = 0;
      continue;
    }
    // At 150% the original stops both counting and resetting.
    if (status.damage >= 150.0) continue;
    if (!outsideCamera(camera, motion.x, f32(motion.z + 60.0))) {
      status.offscreenFrames = 0;
      continue;
    }
    status.offscreenFrames++;
    if (status.offscreenFrames < 60) continue;
    status.offscreenFrames = 0;
    status.damage = f32(status.damage + 1.0);
  }
}

import { f32 } from "wisp/src/sim/f32";
import { PARTICIPANT_SLOTS, type Slots } from "../input/participants";
import { hurtCapsule } from "../physics/contactGeometry";
import { inGrabContext, isGroundDodging } from "./conditions";
import { moveMeleeX } from "./motion";
import { fighterAt, isActive, type Roster } from "./roster";
import { melee } from "./tuning";

const PUSH_PER_CONTACT = melee(0.30000001192092896);
const pushes: Slots<number> = [0.0, 0.0, 0.0, 0.0];

/** Grounded overlap contributes a small step, rather than a barrier to running. */
export function pushFighterBodies(world: Roster): void {
  pushes.fill(0.0);
  for (const first of PARTICIPANT_SLOTS) {
    if (!isActive(world, first)) continue;
    const a = fighterAt(world, first);
    if (!a.motion.grounded || a.status.out || a.launch.hitlag > 0 || inGrabContext(a) || isGroundDodging(a)) continue;
    for (const second of PARTICIPANT_SLOTS) {
      if (second <= first || !isActive(world, second)) continue;
      const b = fighterAt(world, second);
      if (!b.motion.grounded || b.status.out || b.launch.hitlag > 0 || inGrabContext(b) || isGroundDodging(b)) continue;
      if (a.motion.surface !== b.motion.surface || Math.abs(f32(a.motion.z - b.motion.z)) > 6.0) continue;
      const reach = f32(hurtCapsule(a.character).radius + hurtCapsule(b.character).radius);
      const gap = f32(b.motion.x - a.motion.x);
      if (Math.abs(gap) >= reach) continue;
      // Slot order breaks a coincident-centre tie identically during rollback.
      const direction = gap < 0 ? -1.0 : 1.0;
      const amount = f32(direction * PUSH_PER_CONTACT);
      pushes[first] = f32(pushes[first] - amount);
      pushes[second] = f32(pushes[second] + amount);
    }
  }
  for (const slot of PARTICIPANT_SLOTS) {
    if (isActive(world, slot)) moveMeleeX(fighterAt(world, slot), pushes[slot]);
  }
}

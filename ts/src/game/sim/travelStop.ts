


import { max, min } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { shieldCenterX, shieldCenterZ } from "./shieldTilt";
import { hurtCapsule } from "../physics/contactGeometry";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { type Roster, fighterAt, isActive } from "./roster";
import { shieldSizeMultiplier } from "./shield";


export function travelBeforeBodies(world: Roster, slot: number, distance: number, stopsAtBody: boolean): number {
  const f = fighterAt(world, slot);
  const ownRadius = hurtCapsule(f.character).radius;
  for (let targetSlot = 0; targetSlot < PARTICIPANT_CAPACITY; targetSlot++) {
    if (targetSlot === slot || !isActive(world, targetSlot)) continue;
    const target = fighterAt(world, targetSlot);
    if ((!target.shield.raised && !stopsAtBody) || target.status.out) continue;
    const geometry = target.tuning.shield;
    const body = hurtCapsule(target.character);
    const radius = target.shield.raised
      ? f32(geometry.radius * shieldSizeMultiplier(target.shield.energy, target.shield.strength)) : body.radius;
    const centerX = target.shield.raised ? shieldCenterX(target) : target.motion.x;
    const centerZ = target.shield.raised ? shieldCenterZ(target) : f32(target.motion.z + f32(f32(body.z1 + body.z2) * 0.5));
    if (Math.abs(f32(centerZ - f32(f.motion.z + f.tuning.shield.centerZ))) > f32(radius + ownRadius)) continue;
    const ahead = f32(f32(centerX - f.motion.x) * f.facing);
    if (ahead <= 0.0) continue;
    distance = min(distance, max(0.0, f32(ahead - f32(radius + ownRadius))));
  }
  return distance;
}

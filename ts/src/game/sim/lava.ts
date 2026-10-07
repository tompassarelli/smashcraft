import { PARTICIPANT_SLOTS } from "../input/participants";
import { collectTerrainContact } from "./contacts";
import { HitElement, type HitEffect } from "./hitRegions";
import { isIntangible } from "./conditions";
import { type Roster, fighterAt, isActive } from "./roster";
import { CANNON_TEST_STAGE, mainDeckRight, mainDeckZ } from "./stage";

export const LAVA_INNER_X = 410.0;
export const LAVA_HIT: Readonly<HitEffect> = {
  damage: 12.0, growth: 0.0, base: 100.0, launchX: 0.0, launchZ: 1.0,
  electric: false, element: HitElement.fire,
};

/** Blackrock's molten ends share the ordinary body-hit batch, including hitlag, launch and action interruption. */
export function collectLavaContacts(world: Roster, stage: number, enabled: boolean): void {
  if (!enabled || stage !== CANNON_TEST_STAGE) return;
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const fighter = fighterAt(world, slot);
    const { motion, status, launch } = fighter;
    if (status.out || isIntangible(fighter) || launch.hitlag > 0) continue;
    const x = Math.abs(motion.x);
    if (x < LAVA_INNER_X || x > mainDeckRight(stage) || motion.z > mainDeckZ(stage) || motion.z < mainDeckZ(stage) - 8.0) continue;
    collectTerrainContact(world, slot, LAVA_HIT);
  }
}

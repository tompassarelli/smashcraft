import { assertEquals, test } from "wisp/src/runtime/testing";
import { PARTICIPANT_SLOTS, participantActive } from "../input/participants";
import { createFighter } from "../sim/fighter";
import { matchSpawnX } from "./step";

test("two fighters start at opposite ends facing each other for all six slot pairs", () => {
  for (let lower = 0; lower < 3; lower++) {
    for (let higher = lower + 1; higher < 4; higher++) {
      const mask = (1 << lower) | (1 << higher);
      for (const slot of [lower, higher]) {
        const x = matchSpawnX(slot, mask);
        const fighter = createFighter(0, x, x < 0 ? 1 : -1);
        assertEquals(fighter.motion.x, slot === lower ? -240.0 : 240.0);
        assertEquals(fighter.facing, slot === lower ? 1 : -1);
      }
    }
  }
});

test("three and four fighters retain slot positions and respawns retain their positions", () => {
  const positions = [-240.0, 240.0, -80.0, 80.0];
  for (const mask of [7, 11, 13, 14, 15]) {
    for (const slot of PARTICIPANT_SLOTS) {
      if (participantActive(mask, slot)) assertEquals(matchSpawnX(slot, mask), positions[slot]);
    }
  }
  for (const slot of PARTICIPANT_SLOTS) assertEquals(matchSpawnX(slot), positions[slot]);
});

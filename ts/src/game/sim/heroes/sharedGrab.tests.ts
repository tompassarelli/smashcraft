import { assertEquals, test } from "wisp/src/runtime/testing";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character } from "../codes";
import { createFighter } from "../fighter";
import { testWorld } from "../testWorld";
import { BLADEMASTER_MOVES } from "./blademasterMoves";

test("Blademaster standing grab can catch on either of its separately authored active poses [spec docs/design/roster.md]", () => {
  for (const facing of [-1, 1]) {
    const grab = BLADEMASTER_MOVES.normals[AttackStyle.grab]!;
    for (let attackFrame = grab.startupFrames; attackFrame < grab.startupFrames + grab.activeFrames; attackFrame++) {
      const owner = createFighter(Character.rifleman, 0.0, facing);
      owner.tuning.moves = BLADEMASTER_MOVES;
      const target = createFighter(Character.rifleman, 50.0 * facing, -facing);
      const world = testWorld(owner, target);
      beginFighterAttack(world, 0, AttackStyle.grab, false);
      owner.attack.frame = attackFrame;
      resolveAttacks(world);
      assertEquals(owner.grab.target, 1);
      assertEquals(target.grab.owner, 0);
    }
  }
});

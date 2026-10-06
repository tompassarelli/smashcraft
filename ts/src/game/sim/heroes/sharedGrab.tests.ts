import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { beginFighterAttack, resolveAttacks } from "../attacks";
import { AttackStyle, Character, GrabAction } from "../codes";
import { createFighter } from "../fighter";
import { attackStartupFrames } from "../moves";
import { controls, testGrabFrame, testWorld } from "../testWorld";
import { BLADEMASTER_MOVES } from "./blademasterMoves";
import { MOUNTAIN_KING_MOVES } from "./mountainKingMoves";

test("expansion grabs permit two one-percent pummels and immediate throw input wins over pummel", () => {
  for (const moves of [BLADEMASTER_MOVES, MOUNTAIN_KING_MOVES]) {
    const owner = createFighter(Character.archer, 0.0, 1);
    owner.tuning.moves = moves;
    const target = createFighter(Character.rifleman, 50.0, -1);
    target.status.damage = 100.0;
    const world = testWorld(owner, target);
    beginFighterAttack(world, 0, AttackStyle.grab, false);
    owner.attack.frame = attackStartupFrames(AttackStyle.grab, moves);
    resolveAttacks(world);
    assertEquals(owner.grab.target, 1);
    for (let frame = 1; frame <= 40; frame++) testGrabFrame(world, [controls({ attackPressed: true }), controls()], false);
    assertEquals(target.status.damage, 102.0);
    assertEquals(owner.grab.pummels, 2);
    assertEquals(owner.grab.action, GrabAction.hold);
    testGrabFrame(world, [controls({ attackPressed: true, grabThrowX: 1 }), controls()], false);
    assertEquals(owner.grab.action, GrabAction.throwForward);
    assertEquals(owner.grab.frame, 1);
    assertEquals(owner.grab.pummels, 2);
    const release = moves.throws[GrabAction.throwForward]?.contactFrame;
    assertTrue(release !== undefined);
    if (release === undefined) continue;
    for (let frame = 2; frame <= release; frame++) testGrabFrame(world, [controls(), controls()], false);
    assertEquals(target.grab.owner, undefined);
    assertTrue(target.launch.throwHitstun);
  }
});

test("Blademaster standing grab can catch on either of its separately authored active poses", () => {
  for (const facing of [-1, 1]) {
    for (const attackFrame of [6, 7]) {
      const owner = createFighter(Character.archer, 0.0, facing);
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

import { assertEquals, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { beginFighterAttack } from "../attacks";
import { AttackStyle, Character } from "../codes";
import { createFighter } from "../fighter";
import { advanceFighter } from "../step";
import { controls, testWorld } from "../testWorld";
import { BLADEMASTER_MOVES } from "./blademasterMoves";
import { MOUNTAIN_KING_MOVES } from "./mountainKingMoves";
import { WARDEN_MOVES } from "./wardenMoves";

test("authored dash attacks travel during startup and stop before a raised shield", () => {
  for (const moves of [BLADEMASTER_MOVES, MOUNTAIN_KING_MOVES]) {
    for (const facing of [-1, 1]) {
      const move = moves.normals[AttackStyle.dashAttack];
      assertTrue(move !== undefined && move.startupTravelX !== undefined);
      if (move === undefined || move.startupTravelX === undefined) continue;
      const owner = createFighter(Character.archer, 0.0, facing);
      owner.tuning.moves = moves;
      owner.motion.vx = 10.0;
      const target = createFighter(Character.rifleman, 1000.0, -facing);
      const world = testWorld(owner, target);
      beginFighterAttack(world, 0, AttackStyle.dashAttack, false);
      assertEquals(owner.motion.vx, 0.0);
      for (let frame = 1; frame <= move.startupFrames; frame++) advanceFighter(world, 0, 0, controls(), 0.0, frame);
      assertNear(owner.motion.x * facing, move.startupTravelX, f32(0.0001));
      const reached = owner.motion.x;
      advanceFighter(world, 0, 0, controls(), 0.0, move.startupFrames + 1);
      assertEquals(owner.motion.x, reached);
      owner.motion.x = 0.0;
      owner.motion.meleeX.original = 0.0;
      owner.motion.meleeX.published = 0.0;
      owner.attack.cooldown = 0;
      owner.attack.style = undefined;
      target.motion.x = 90.0 * facing;
      target.shield.raised = true;
      beginFighterAttack(world, 0, AttackStyle.dashAttack, false);
      for (let frame = 1; frame <= move.startupFrames; frame++) advanceFighter(world, 0, 0, controls(), 0.0, frame);
      assertTrue(owner.motion.x * facing < target.motion.x * facing);
      assertTrue(owner.motion.x * facing < move.startupTravelX);
    }
  }
});

test("Warden Pursuit Cut stops at an exposed opponent without passing through", () => {
  for (const facing of [-1, 1]) {
    const owner = createFighter(Character.archer, 0.0, facing);
    owner.tuning.moves = WARDEN_MOVES;
    const target = createFighter(Character.rifleman, 90.0 * facing, -facing);
    const world = testWorld(owner, target);
    beginFighterAttack(world, 0, AttackStyle.dashAttack, false);
    const move = WARDEN_MOVES.normals[AttackStyle.dashAttack];
    assertTrue(move !== undefined);
    if (move === undefined) continue;
    for (let frame = 1; frame <= move.startupFrames; frame++) advanceFighter(world, 0, 0, controls(), 0.0, frame);
    assertNear(owner.motion.x * facing, 40.0, f32(0.0001));
    assertTrue(owner.motion.x * facing < target.motion.x * facing);
  }
});

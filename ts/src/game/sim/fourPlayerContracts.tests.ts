import { assertEquals, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character, LedgeState } from "./codes";
import { createFighter } from "./fighter";
import { beginFighterAttack, resolveAttacks } from "./attacks";
import { attackStartupFrames } from "./moves";
import { createRoster } from "./roster";
import { controls } from "./testWorld";
import { resolveLedges } from "./ledge";
import { imod } from "wisp/src/sim/intMath";

function fourWorld() {
  return createRoster(15, [
    createFighter(Character.archer, -300.0, 1),
    createFighter(Character.archer, -100.0, -1),
    createFighter(Character.archer, 100.0, 1),
    createFighter(Character.archer, 300.0, -1),
  ]);
}

test("multipleAttackersKeepIndependentVictimHitWindows [spec #12]", () => {
  const world = fourWorld();
  world.fighters[0]!.motion.x = 0.0;
  world.fighters[2]!.motion.x = 0.0;
  world.fighters[3]!.motion.x = 100.0;
  for (const slot of [0, 2]) {
    beginFighterAttack(world, slot, AttackStyle.jab, false);
    world.fighters[slot]!.attack.frame = attackStartupFrames(AttackStyle.jab);
  }
  resolveAttacks(world);
  assertEquals(world.fighters[3]!.status.damage, 10.0);
  world.fighters[0]!.launch.hitlag = 0;
  world.fighters[2]!.launch.hitlag = 0;
  resolveAttacks(world);
  assertEquals(world.fighters[3]!.status.damage, 10.0);
});

test("oneMeleeSwingCanContactAllThreeOpponents [spec #12]", () => {
  const world = fourWorld();
  world.fighters[0]!.motion.x = 0.0;
  for (let slot = 1; slot <= 3; slot++) world.fighters[slot]!.motion.x = 80.0 + slot * 5;
  beginFighterAttack(world, 0, AttackStyle.jab, false);
  world.fighters[0]!.attack.frame = attackStartupFrames(AttackStyle.jab);
  resolveAttacks(world);
  for (let slot = 1; slot <= 3; slot++) assertEquals(world.fighters[slot]!.status.damage, 5.0);
});

test("fourFightersArbitrateBothLedgesByDistance [spec docs/physics.md]", () => {
  const world = fourWorld();
  for (let slot = 0; slot < 4; slot++) {
    const fighter = world.fighters[slot]!;
    const side = slot < 2 ? -1 : 1;
    fighter.motion.x = side * (imod(slot, 2) === 0 ? 630.0 : 620.0);
    fighter.motion.z = -80.0;
    fighter.motion.vz = -2.0;
    fighter.motion.deltaZ = -2.0;
    fighter.motion.grounded = false;
    fighter.facing = -side;
  }
  resolveLedges(world, 0, [controls(), controls(), controls(), controls()]);
  assertEquals(world.fighters[0]!.ledge.state, LedgeState.none);
  assertEquals(world.fighters[1]!.ledge.state, LedgeState.hang);
  assertEquals(world.fighters[2]!.ledge.state, LedgeState.none);
  assertEquals(world.fighters[3]!.ledge.state, LedgeState.hang);
});


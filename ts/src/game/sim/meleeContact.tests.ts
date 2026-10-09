import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character } from "./codes";
import { type Fighter, SHIELD_MAX,  } from "./fighter";
import { createReferenceFighter } from "./referenceRig";
import { attackStartupFrames } from "./moves";
import type { Roster } from "./roster";
import { testBeginAttacks, testWorld } from "./testWorld";

function prepareJab(world: Roster, attacker: Fighter, facing: number): void {
  attacker.facing = facing;
  testBeginAttacks(world, AttackStyle.jab, undefined);
  attacker.attack.frame = attackStartupFrames(AttackStyle.jab);
}

test("a drained shield leaves a real melee poke at the exposed body edge [spec docs/physics.md]", () => {
  const attacker = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const defender = createReferenceFighter(Character.sylvanas, 100.0, -1);
  const world = testWorld(attacker, defender);
  defender.shield.raised = true;
  defender.shield.energy = 0.0;
  prepareJab(world, attacker, 1);
  resolveAttacks(world);
  assertGreaterThan(defender.status.damage, 0.0);
  assertEquals(defender.shield.stun, 0);
  assertGreaterThan(defender.launch.hitstun, 0);
});

test("melee reaches a shield before the body, blocks with shield stun, and facing mirrors its volume [spec docs/physics.md] [invariant]", () => {
  for (const direction of [-1, 1]) for (const gap of [70.0, 110.0]) {
    const attacker = createReferenceFighter(Character.sylvanas, 0.0, direction);
    const defender = createReferenceFighter(Character.sylvanas, direction * gap, -direction);
    const world = testWorld(attacker, defender);
    defender.shield.raised = true;
    prepareJab(world, attacker, direction);
    resolveAttacks(world);
    assertEquals(defender.status.damage, 0.0);
    assertTrue(defender.shield.energy < SHIELD_MAX);
    assertGreaterThan(defender.shield.stun, 0);
  }
});

test("melee trades queue both contacts before either hit resolves [spec docs/gameplay-design.md]", () => {
  const first = createReferenceFighter(Character.sylvanas, -35.0, 1);
  const second = createReferenceFighter(Character.sylvanas, 35.0, -1);
  const world = testWorld(first, second);
  testBeginAttacks(world, AttackStyle.jab, AttackStyle.jab);
  first.attack.frame = attackStartupFrames(AttackStyle.jab);
  second.attack.frame = attackStartupFrames(AttackStyle.jab);
  resolveAttacks(world);
  assertGreaterThan(first.status.damage, 0.0);
  assertGreaterThan(second.status.damage, 0.0);
  assertGreaterThan(first.launch.hitstun, 0);
  assertGreaterThan(second.launch.hitstun, 0);
});

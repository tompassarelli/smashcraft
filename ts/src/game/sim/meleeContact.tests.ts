import { assertEquals, assertGreaterThan, assertTrue, test } from "wisp/src/runtime/testing";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character } from "./codes";
import { type Fighter, SHIELD_MAX, createFighter } from "./fighter";
import { attackStartupFrames } from "./moves";
import type { Roster } from "./roster";
import { testBeginAttacks, testWorld } from "./testWorld";

function prepareJab(world: Roster, attacker: Fighter, facing: number): void {
  attacker.facing = facing;
  testBeginAttacks(world, AttackStyle.jab, undefined);
  attacker.attack.frame = attackStartupFrames(AttackStyle.jab);
}

test("a melee capsule blocks and damages a shield only when it reaches the circle", () => {
  const attacker = createFighter(Character.archer, 0.0, 1);
  const shielded = createFighter(Character.rifleman, 70.0, -1);
  const world = testWorld(attacker, shielded);
  shielded.shield.raised = true;
  prepareJab(world, attacker, 1);
  resolveAttacks(world);
  assertEquals(shielded.status.damage, 0.0);
  assertTrue(shielded.shield.energy < SHIELD_MAX);
  assertGreaterThan(shielded.shield.stun, 0);
});

test("a drained shield leaves a real melee poke at the exposed body edge", () => {
  const attacker = createFighter(Character.archer, 0.0, 1);
  const defender = createFighter(Character.rifleman, 100.0, -1);
  const world = testWorld(attacker, defender);
  defender.shield.raised = true;
  defender.shield.energy = 0.0;
  prepareJab(world, attacker, 1);
  resolveAttacks(world);
  assertGreaterThan(defender.status.damage, 0.0);
  assertEquals(defender.shield.stun, 0);
  assertGreaterThan(defender.launch.hitstun, 0);
});

test("melee can reach a shield before the body, and facing mirrors its volume", () => {
  for (const direction of [-1, 1]) {
    const attacker = createFighter(Character.archer, 0.0, direction);
    const defender = createFighter(Character.rifleman, direction * 110.0, -direction);
    const world = testWorld(attacker, defender);
    defender.shield.raised = true;
    prepareJab(world, attacker, direction);
    resolveAttacks(world);
    assertEquals(defender.status.damage, 0.0);
    assertTrue(defender.shield.energy < SHIELD_MAX);
  }
});

test("melee trades queue both contacts before either hit resolves", () => {
  const first = createFighter(Character.archer, -35.0, 1);
  const second = createFighter(Character.rifleman, 35.0, -1);
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

import { assertEquals, assertFalse, assertTrue, test } from "waygate/src/runtime/testing";
import { Character, DownState, GroundAction, ProjectileKind, SPECIAL_ACTION_CAPACITY, ShieldBreak } from "./codes";
import { PROJECTILE_CAPACITY, createFighter } from "./fighter";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { createRoster, fighterAt, isActive } from "./roster";
import { AUTHORED_DASH_GRAB_RULES, AUTHORED_PHYSICS, authoredPhysics } from "./tuning";

test("a created fighter has the Wurst constructor's initial state", () => {
  const f = createFighter(Character.rifleman, 120.0, -1);
  assertEquals(f.tuning.physics, AUTHORED_PHYSICS.rifleman);
  assertEquals(f.tuning.dashGrab.startupFrames, 5);
  assertEquals(f.tuning.dashGrab.totalFrames, 36);
  assertEquals(f.tuning.tech.ceilingImpulseFrame, 14);
  assertEquals(f.tuning.shieldBreak.landFrames, 12);
  assertEquals(f.tuning.shield.radius, 60.0);
  assertEquals(f.motion.x, 120.0);
  assertEquals(f.motion.z, 0.0);
  assertEquals(f.facing, -1);
  assertTrue(f.motion.grounded);
  assertEquals(f.motion.surface, undefined);
  assertEquals(f.motion.fastFallInputAge, 4);
  assertEquals(f.ground.action, GroundAction.none);
  assertEquals(f.jump.remaining, 2);
  assertEquals(f.jump.inputAge, 20);
  assertEquals(f.launch.knockbackAge, undefined);
  assertEquals(f.shield.energy, 60.0);
  assertEquals(f.shield.strength, 1.0);
  assertEquals(f.shield.triggerAge, 2);
  assertEquals(f.shield.breakState, ShieldBreak.none);
  assertEquals(f.attack.style, undefined);
  assertEquals(f.hits.lastAttackSerial, undefined);
  assertEquals(f.down.state, DownState.none);
  assertTrue(f.down.faceUp);
  assertEquals(f.tech.pressAge, 255);
  assertEquals(f.tech.previousPressAge, 255);
  assertEquals(f.status.stocks, 3);
  assertFalse(f.status.out);
  assertEquals(f.bear.surface, undefined);
  assertEquals(f.freezeTrap.surface, undefined);
  assertEquals(f.special.cooldowns.length, SPECIAL_ACTION_CAPACITY);
  assertEquals(f.projectiles.length, PROJECTILE_CAPACITY);
  for (const projectile of f.projectiles) {
    assertEquals(projectile.damageMultiplier, 1.0);
    assertEquals(projectile.kind, ProjectileKind.blaster);
    assertEquals(projectile.visualFamily, Character.archer);
  }
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    assertEquals(f.hits.entries[slot]?.attacker, undefined);
    assertEquals(f.special.hitTargets[slot], undefined);
  }
});

test("fighters own their state and share only immutable tuning", () => {
  const first = createFighter(Character.archer, 0.0, 1);
  const second = createFighter(Character.archer, 0.0, 1);
  first.motion.meleeX.original = 1.0;
  first.special.cooldowns[3] = 9;
  first.projectiles[0]!.life = 4;
  assertEquals(second.motion.meleeX.original, 0.0);
  assertEquals(second.special.cooldowns[3], 0);
  assertEquals(second.projectiles[0]?.life, 0);
  assertEquals(first.tuning.dashGrab, AUTHORED_DASH_GRAB_RULES);
  first.tuning.physics = authoredPhysics(Character.demonHunter);
  assertEquals(second.tuning.physics, AUTHORED_PHYSICS.archer);
});

test("rosters resolve fighters by participant slot", () => {
  const first = createFighter(Character.archer, 0.0, 1);
  const third = createFighter(Character.demonHunter, 0.0, -1);
  const roster = createRoster(5, [first]);
  roster.fighters[2] = third;
  assertTrue(isActive(roster, 0));
  assertFalse(isActive(roster, 1));
  assertTrue(isActive(roster, 2));
  assertFalse(isActive(roster, 3));
  assertEquals(fighterAt(roster, 2), third);
  assertFalse(isActive(createRoster(16), 0));
});

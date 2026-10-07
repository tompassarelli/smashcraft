import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "./codes";
import { createFighter } from "./fighter";
import { createRoster, fighterAt, isActive } from "./roster";
import { termsOfPhysics } from "./motion";
import { AUTHORED_DASH_GRAB_RULES, authoredPhysics } from "./tuning";

test("fighters own their state and share only immutable tuning", () => {
  for (const character of Object.values(Character)) {
    const first = createFighter(character, 0.0, 1);
    const second = createFighter(character, 0.0, 1);
    first.motion.meleeX.original = 1.0;
    first.special.cooldowns[3] = 9;
    first.projectiles[0]!.life = 4;
    assertEquals(second.motion.meleeX.original, 0.0);
    assertEquals(second.special.cooldowns[3], 0);
    assertEquals(second.projectiles[0]?.life, 0);
    assertEquals(first.tuning.dashGrab, AUTHORED_DASH_GRAB_RULES);
    assertEquals(first.tuning.physics, second.tuning.physics);
    assertEquals(first.tuning.shield, second.tuning.shield);
    assertEquals(termsOfPhysics(first.tuning.physics), termsOfPhysics(second.tuning.physics));
    first.tuning.physics = { ...first.tuning.physics, gravity: 0.0 };
    assertEquals(second.tuning.physics, authoredPhysics(character));
    assertTrue(second.tuning.physics.gravity > 0.0);
  }
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

import { assertGreaterThan, test } from "wisp/src/runtime/testing";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character } from "./codes";
import { createReferenceFighter } from "./referenceRig";
import { attackStartupFrames } from "./moves";
import { testBeginAttacks, testWorld } from "./testWorld";

test("melee trades queue both contacts before either hit resolves [k3 measure docs/gameplay-design.md]", () => {
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

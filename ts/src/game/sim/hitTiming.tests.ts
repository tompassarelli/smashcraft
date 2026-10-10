import { assertEquals, test } from "wisp/src/runtime/testing";
import { resolveAttacks } from "./attacks";
import { AttackStyle, Character } from "./codes";
import { createReferenceFighter } from "./referenceRig";
import { ordinaryHitlagFrames, ordinaryHitstunFrames } from "./knockback";
import { attackStartupFrames } from "./moves";
import { digitalShieldstunFrames } from "./shield";
import { advanceFighter } from "./step";
import { controls, testBeginAttacks, testWorld } from "./testWorld";

test("hitlag and shieldstun respect Melee integer boundaries [k4 reference melee]", () => {
  assertEquals(ordinaryHitlagFrames(0.0), 0);
  assertEquals(ordinaryHitlagFrames(2.999000072479248), 3);
  assertEquals(ordinaryHitlagFrames(3.0), 4);
  assertEquals(ordinaryHitlagFrames(5.999000072479248), 4);
  assertEquals(ordinaryHitlagFrames(6.0), 5);
  assertEquals(ordinaryHitlagFrames(15.0), 8);
  assertEquals(ordinaryHitlagFrames(100.0), 20);
  assertEquals(digitalShieldstunFrames(12.0), 7);
  assertEquals(digitalShieldstunFrames(7.0), 5);

  assertEquals(digitalShieldstunFrames(12.0, true), 9);
  assertEquals(digitalShieldstunFrames(7.0, true), 6);
  assertEquals(digitalShieldstunFrames(5.0, true), 4);
  assertEquals(ordinaryHitstunFrames(2.499000072479248), 1);
  assertEquals(ordinaryHitstunFrames(2.5), 1);
  assertEquals(ordinaryHitstunFrames(51.06666564941406), 20);
  assertEquals(ordinaryHitstunFrames(100.0), 40);
});

test("a shield contact freezes both bodies before shieldstun counts down [k4 reference melee]", () => {
  const attacker = createReferenceFighter(Character.sylvanas, 0.0, 1);
  const target = createReferenceFighter(Character.sylvanas, 100.0, -1);
  const world = testWorld(attacker, target);
  const input = controls({ shield: true });
  target.shield.raised = true;
  testBeginAttacks(world, AttackStyle.jab, undefined);
  attacker.attack.frame = attackStartupFrames(AttackStyle.jab);
  resolveAttacks(world);
  assertEquals(attacker.launch.hitlag, 4);
  assertEquals(target.launch.hitlag, 4);
  assertEquals(target.shield.stun, 4);
  for (let tick = 1; tick <= 3; tick++) {
    advanceFighter(world, 1, 0, input, 240.0);
    assertEquals(target.shield.stun, 4);
  }
  advanceFighter(world, 1, 0, input, 240.0);
  assertEquals(target.shield.stun, 3);
});


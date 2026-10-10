import { assertEquals, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, ContactKind } from "./codes";
import { beginDamageContacts, finishDamageContacts, queueDamageContact } from "./contacts";
import { createFighter } from "./fighter";
import { analogShieldStrength } from "./shield";
import { advanceFighter } from "./step";
import { controls, testWorld } from "./testWorld";
import { WORLD_UNITS_PER_MELEE_UNIT } from "./tuning";

test("a light shield contact uses its strength and freezes it through stun [k4 reference melee]", () => {
  const owner = createFighter(Character.rifleman, -100.0, 1);
  const target = createFighter(Character.rifleman, 0.0, -1);
  const world = testWorld(owner, target);
  target.shield.raised = true;
  target.shield.strength = analogShieldStrength(128);
  beginDamageContacts();
  queueDamageContact(world, 0, 1, { damage: 10.0, growth: 100.0, base: 20.0, launchX: 1.0, launchZ: 1.0, electric: false }, 1, ContactKind.launch, true, undefined);
  finishDamageContacts(world);
  assertEquals(target.status.damage, 0.0);
  assertEquals(target.shield.energy, 51.577030181884766);
  assertEquals(target.shield.stun, 13);
  assertEquals(target.shield.pushbackX, f32(1.612437129020691 * WORLD_UNITS_PER_MELEE_UNIT));
  const { strength, energy } = target.shield;
  const input = controls({ shield: true, shieldStrength: 1.0 });
  while (target.launch.hitlag > 1 || target.shield.stun > 0) {
    advanceFighter(world, 1, 0, input, 0.0);
    assertEquals(target.shield.strength, strength);
    assertEquals(target.shield.energy, energy);
  }
});

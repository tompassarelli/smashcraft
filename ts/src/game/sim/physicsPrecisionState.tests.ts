import { assertEquals, test } from "../../runtime/testing";
import { beginDamageContacts, finishDamageContacts, queueDamageContact } from "./contacts";
import { Character, ContactKind } from "./codes";
import { createFighter } from "./fighter";
import { controls, hitEffect, soloWorld, testWorld, withPhysics } from "./testWorld";
import { advance } from "./step";
import { digitalShieldDamage, digitalShieldstunDuration } from "./shield";
import { melee } from "./tuning";

// These are the five state-bearing comparisons from the native #9 arithmetic
// fixture. Run them through the production fighter and roster simulation.
test("#9 GROUNDED_BINARY32_EXACT_PASS", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  withPhysics(fighter, { traction: melee(0.07999999821186066) });
  fighter.launch.knockbackX = melee(0.7562744617462158);
  fighter.launch.hitstun = 10;

  advance(soloWorld(fighter), 0, 0, controls(), 0.0);

  assertEquals(fighter.launch.knockbackX, melee(0.6762744784355164));
});

test("#9 SHIELD_REGEN_BINARY32_EXACT_PASS", () => {
  const fighter = createFighter(Character.archer, 0.0, 1);
  fighter.shield.energy = 20.0;

  advance(soloWorld(fighter), 0, 0, controls(), 0.0);

  assertEquals(fighter.shield.energy, 20.06999969482422);
});

test("#9 SHIELD_DAMAGE_BINARY32_EXACT_PASS", () => {
  assertEquals(digitalShieldDamage(9.0), 6.299999713897705);
});

test("#9 SHIELD_STUN_BINARY32_EXACT_PASS", () => {
  assertEquals(digitalShieldstunDuration(9.0), 6.050000190734863);
  assertEquals(digitalShieldstunDuration(3.0), 3.3500001430511475);
});

test("#9 SHIELD_CONTACT_SUM_BINARY32_EXACT_PASS", () => {
  const defender = createFighter(Character.archer, 0.0, 1);
  const attacker = createFighter(Character.rifleman, 100.0, -1);
  const world = testWorld(defender, attacker);
  defender.shield.raised = true;
  defender.shield.energy = 8.0;

  beginDamageContacts();
  queueDamageContact(world, 1, 0, hitEffect(9.0, 0.0, 0.0, 0.0, 0.0), 1, ContactKind.damageOnly, false, undefined);
  queueDamageContact(world, 1, 0, hitEffect(1.0, 0.0, 0.0, 0.0, 0.0), 1, ContactKind.damageOnly, false, undefined);
  finishDamageContacts(world);

  assertEquals(defender.shield.energy, 1.0);
  assertEquals(defender.shield.raised, true);
});

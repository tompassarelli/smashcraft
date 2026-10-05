import { assertEquals, assertFalse, assertTrue, test } from "waygate/src/runtime/testing";
import { Character, ContactKind, DownState, ShieldBreak } from "../sim/codes";
import { queueDamageContact } from "../sim/contacts";
import { createFighter } from "../sim/fighter";
import { contactBatch, hitEffect, testWorld } from "../sim/testWorld";
import { DamagePose, damagePose } from "./damagePose";
import { captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "./impactEvents";

test("grounded contact freezes its reaction before the airborne launch", () => {
  const f = createFighter(Character.archer, 0.0, 1);
  f.motion.grounded = false;
  f.launch.sdiWasGrounded = true;
  f.launch.hitstun = 39;
  f.launch.hitlag = 5;
  f.down.state = DownState.tumble;
  for (let tick = 1; tick <= 5; tick++) {
    assertEquals(damagePose(f), DamagePose.ground);
    f.launch.hitlag--;
  }
  assertEquals(damagePose(f), DamagePose.tumble);
  f.launch.hitstun = 0;
  assertEquals(damagePose(f), DamagePose.tumble);
  f.down.state = DownState.bound;
  assertEquals(damagePose(f), DamagePose.none);
});

test("weak air hits and shield hits use distinct reactions", () => {
  const f = createFighter(Character.rifleman, 0.0, 1);
  f.motion.grounded = false;
  f.launch.hitstun = 11;
  f.launch.hitlag = 3;
  assertEquals(damagePose(f), DamagePose.air);
  f.launch.hitlag = 0;
  assertEquals(damagePose(f), DamagePose.air);
  f.motion.grounded = true;
  assertEquals(damagePose(f), DamagePose.ground);
  f.launch.hitstun = 0;
  assertEquals(damagePose(f), DamagePose.none);
  f.shield.raised = true;
  f.shield.stun = 4;
  assertEquals(damagePose(f), DamagePose.shield);
  f.shield.breakState = ShieldBreak.air;
  assertEquals(damagePose(f), DamagePose.none);
});

test("a repeated hit restarts the reaction even with shorter hitstun", () => {
  const f = createFighter(Character.archer, 0.0, 1);
  const attacker = createFighter(Character.rifleman, -100.0, 1);
  const world = testWorld(attacker, f);
  const events = createImpactEvents();
  f.launch.hitstun = 39;
  captureImpactEventsBefore(events, f);
  contactBatch(world, () => queueDamageContact(world, 0, 1, hitEffect(3.0, 0.0, 20.0, 1.0, 0.0), 1, ContactKind.launch, true, undefined));
  assertTrue(f.launch.hitstun > 0 && f.launch.hitstun < 39);
  finishImpactEventsAfter(events, f);
  assertTrue(events.hit);
  captureImpactEventsBefore(events, f);
  f.launch.hitstun--;
  finishImpactEventsAfter(events, f);
  assertFalse(events.hit);
});

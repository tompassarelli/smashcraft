import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, ContactKind, DownState, ShieldBreak } from "../sim/codes";
import { collectDamageContact, queueDamageContact } from "../sim/contacts";
import { createFighter } from "../sim/fighter";
import { contactBatch, hitEffect, testWorld } from "../sim/testWorld";
import { DamagePose, damagePose } from "./damagePose";
import { contactDamageClip } from "./damagePose";
import { copyFighterState } from "../replay/fighterState";
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

test("contact height and severity choose visual bands without changing the launch", () => {
  for (const height of [-30.0, 50.0, 180.0]) {
    const f = createFighter(Character.archer, 0.0, 1);
    const attacker = createFighter(Character.rifleman, -100.0, 1);
    const world = testWorld(attacker, f);
    contactBatch(world, () => collectDamageContact(world, 0, 1, hitEffect(3.0, 0.0, 20.0, 1.0, 0.0), 1, ContactKind.launch, true, undefined, false, undefined, undefined, height));
    assertEquals(f.visuals.hitHeight, height < 0 ? 0 : height > 100 ? 2 : 1);
    assertEquals(f.visuals.hitStrength, 0);
    assertEquals(f.status.damage, 3.0);
    assertEquals(f.launch.hitstun, 8);
  }
});

test("simultaneous contacts keep the strongest hit's pain pose through a snapshot", () => {
  for (const reversed of [false, true]) {
    const victim = createFighter(Character.archer, 0.0, -1);
    const attacker = createFighter(Character.rifleman, -100.0, 1);
    const world = testWorld(attacker, victim);
    const weak = () => collectDamageContact(world, 0, 1, hitEffect(3.0, 0.0, 20.0, 1.0, 0.0), 1, ContactKind.launch, true, undefined, false, undefined, undefined, -30.0);
    const strong = () => collectDamageContact(world, 0, 1, hitEffect(3.0, 0.0, 100.0, 1.0, 0.0), 1, ContactKind.launch, true, undefined, false, undefined, undefined, 180.0);
    contactBatch(world, () => { if (reversed) { strong(); weak(); } else { weak(); strong(); } });
    assertEquals(victim.visuals.hitHeight, 2);
    assertEquals(victim.visuals.hitStrength, 1);
    const restored = createFighter(Character.archer, 0.0, 1);
    copyFighterState(restored, victim, world.mask);
    assertEquals(contactDamageClip(restored).index, contactDamageClip(victim).index);
    assertEquals(restored.facing, -1);
  }
});

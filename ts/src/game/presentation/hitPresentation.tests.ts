import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, ContactKind } from "../sim/codes";
import { queueDamageContact } from "../sim/contacts";
import { createFighter } from "../sim/fighter";
import { HitElement } from "../sim/hitRegions";
import { contactBatch, hitEffect, testWorld } from "../sim/testWorld";
import { copyFighterState } from "../replay/fighterState";
import { captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "./impactEvents";
import { hitlagShake, hitlagTint, presentImpactSounds } from "./hitPresentation";

test("contact element and pummel survive snapshots and produce one distinct sound", () => {
  for (const element of [HitElement.normal, HitElement.electric, HitElement.fire, HitElement.slash, HitElement.ice]) {
    for (const pummel of [false, true]) {
      const attacker = createFighter(Character.archer, -50.0, 1);
      const victim = createFighter(Character.rifleman, 0.0, -1);
      const world = testWorld(attacker, victim);
      if (pummel) victim.grab.owner = 0;
      const events = createImpactEvents();
      const effect = hitEffect(8.0, 100.0, 20.0, 1.0, 1.0, element === HitElement.electric);
      effect.element = element;
      captureImpactEventsBefore(events, victim);
      contactBatch(world, () => queueDamageContact(world, 0, 1, effect, 1, pummel ? ContactKind.pummel : ContactKind.launch, true, undefined));
      finishImpactEventsAfter(events, victim);
      assertTrue(events.hit);
      assertEquals(events.element, element);
      assertEquals(events.pummel, pummel);
      const copy = createFighter(Character.rifleman, 0.0, -1);
      copyFighterState(copy, victim, world.mask);
      assertEquals(copy.visuals.hitElement, element);
      assertEquals(copy.visuals.hitPummel, pummel);
      assertEquals(copy.visuals.hitStrength, victim.visuals.hitStrength);
      const labels: string[] = [];
      presentImpactSounds(events, label => { labels.push(label); });
      assertEquals(labels.length, 1);
      assertEquals(labels[0], pummel ? "Defend" : element === HitElement.normal ? "StampedeHit" : element === HitElement.electric ? "LightningBolt"
        : element === HitElement.fire ? "Fireball" : element === HitElement.slash ? "RelentlessCleave" : "FrostNova");
      assertTrue(hitlagTint(victim) !== undefined);
      assertEquals(Math.abs(hitlagShake(victim)), element === HitElement.electric ? 3.0 : 2.0);
      victim.launch.hitlag = 0;
      assertEquals(hitlagShake(victim), 0.0);
      assertEquals(hitlagTint(victim), undefined);
    }
  }
});

test("electric shield contact keeps its element through a snapshot", () => {
  const attacker = createFighter(Character.archer, -50.0, 1);
  const victim = createFighter(Character.rifleman, 0.0, -1);
  victim.shield.raised = true;
  const world = testWorld(attacker, victim);
  const events = createImpactEvents();
  captureImpactEventsBefore(events, victim);
  contactBatch(world, () => queueDamageContact(world, 0, 1, hitEffect(8.0, 100.0, 20.0, 1.0, 1.0, true), 1, ContactKind.launch, true, undefined));
  finishImpactEventsAfter(events, victim);
  assertTrue(events.shieldHit);
  assertTrue(events.shieldElectric);
  assertEquals(events.hit, false);
  const copy = createFighter(Character.rifleman, 0.0, -1);
  copyFighterState(copy, victim, world.mask);
  assertTrue(copy.visuals.shieldElectric);
  const labels: string[] = [];
  presentImpactSounds(events, label => { labels.push(label); });
  assertEquals(labels[0], "LightningBolt");
});

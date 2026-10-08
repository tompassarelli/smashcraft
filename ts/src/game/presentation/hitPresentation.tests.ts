import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Character, ContactKind } from "../sim/codes";
import { queueDamageContact } from "../sim/contacts";
import { createFighter } from "../sim/fighter";
import { HitElement } from "../sim/hitRegions";
import { tierHitPath } from "./moveTiers";
import { contactBatch, hitEffect, testWorld } from "../sim/testWorld";
import { copyFighterState } from "../replay/fighterState";
import { captureImpactEventsBefore, createImpactEvents, finishImpactEventsAfter } from "./impactEvents";
import { hitlagShake, damageTint, presentImpactSounds } from "./hitPresentation";

test("contact element and pummel survive snapshots and produce one distinct sound [spec docs/design/melee/hit-effects.md] [invariant]", () => {
  for (const element of [HitElement.normal, HitElement.electric, HitElement.fire, HitElement.slash, HitElement.ice]) {
    for (const pummel of [false, true]) {
      const attacker = createFighter(Character.rifleman, -50.0, 1);
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
      // Without its attacker, a hit's tier is its launch strength (presentation/moveTiers.ts).
      assertEquals(events.tier, victim.visuals.hitStrength);
      assertEquals(labels[0], pummel ? "Defend" : element === HitElement.electric ? "LightningBolt" : element === HitElement.fire ? "Fireball"
        : element === HitElement.normal || element === HitElement.slash ? tierHitPath(element, events.tier, events.variant) : "FrostNova");
      assertTrue(damageTint(victim) !== undefined);
      assertEquals(Math.abs(hitlagShake(victim)), element === HitElement.electric ? 3.0 : 2.0);
      victim.launch.hitlag = 0;
      assertEquals(hitlagShake(victim), 0.0);
      assertEquals(damageTint(victim) !== undefined, !pummel, "launch damage remains readable after contact freeze");
      victim.launch.hitstun = 0;
      victim.grab.owner = undefined;
      assertEquals(damageTint(victim), undefined);
    }
  }
});

test("electric shield contact keeps its element through a snapshot [spec docs/design/melee/hit-effects.md] [invariant]", () => {
  const attacker = createFighter(Character.rifleman, -50.0, 1);
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

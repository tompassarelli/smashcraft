import { assertEquals, test } from "wisp/src/runtime/testing";
import { Character, ContactKind } from "../sim/codes";
import { collectDamageContact } from "../sim/contacts";
import { createFighter } from "../sim/fighter";
import { contactBatch, hitEffect, testWorld } from "../sim/testWorld";
import { contactDamageClip } from "./damagePose";
import { copyFighterState } from "../replay/fighterState";

test("simultaneous contacts keep the strongest hit's pain pose through a snapshot [spec #181] [invariant]", () => {
  for (const reversed of [false, true]) {
    const victim = createFighter(Character.rifleman, 0.0, -1);
    const attacker = createFighter(Character.rifleman, -100.0, 1);
    const world = testWorld(attacker, victim);
    const weak = () => collectDamageContact(world, 0, 1, hitEffect(3.0, 0.0, 20.0, 1.0, 0.0), 1, ContactKind.launch, true, undefined, false, undefined, -30.0);
    const strong = () => collectDamageContact(world, 0, 1, hitEffect(3.0, 0.0, 100.0, 1.0, 0.0), 1, ContactKind.launch, true, undefined, false, undefined, 180.0);
    contactBatch(world, () => { if (reversed) { strong(); weak(); } else { weak(); strong(); } });
    assertEquals(victim.visuals.hitHeight, 2);
    assertEquals(victim.visuals.hitStrength, 1);
    const restored = createFighter(Character.rifleman, 0.0, 1);
    copyFighterState(restored, victim, world.mask);
    assertEquals(contactDamageClip(restored).index, contactDamageClip(victim).index);
    assertEquals(restored.facing, -1);
  }
});

import { assertEquals, assertNear, assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { Character, ContactKind, GroundAction } from "../sim/codes";
import { fighterAt } from "../sim/roster";
import { mainDeckRight } from "../sim/stage";
import { beginDamageContacts, finishDamageContacts, queueDamageContact } from "../sim/contacts";
import { hitEffect } from "../sim/testWorld";
import { executeNext, testMatch } from "./testMatch";

const epsilon = f32(0.001);

test("idle overlapping bodies separate by 1.8 world units per fighter per frame [spec #338]", () => {
  const m = testMatch(3, Character.rifleman);
  const a = fighterAt(m.world, 0), b = fighterAt(m.world, 1);
  a.motion.x = 0.0; b.motion.x = 20.0;
  executeNext(m);
  assertNear(a.motion.x, -f32(1.8), epsilon);
  assertNear(b.motion.x, f32(21.8), epsilon);
});

test("walking pushes a shielding opponent off the ledge within two frames [spec #338]", () => {
  for (const direction of [-1, 1]) {
    const m = testMatch(3, Character.rifleman);
    const a = fighterAt(m.world, 0), b = fighterAt(m.world, 1);
    const edge = direction * mainDeckRight(0);
    a.motion.x = f32(edge - direction * 30.0); b.motion.x = f32(edge - direction * 3.0);
    m.inputs.inputs[0].walking = true;
    m.inputs.inputs[0].direction = direction;
    m.inputs.inputs[0].driftStickX = direction;
    m.inputs.inputs[1].shield = true;
    m.inputs.inputs[1].shieldStrength = 1.0;
    executeNext(m); executeNext(m);
    assertTrue(direction * b.motion.x > direction * edge);
    assertEquals(b.motion.grounded, false);
    assertEquals(b.status.damage, 0.0);
  }
});

test("dash and run cross an overlapping fighter rather than stopping at its body [spec #338]", () => {
  for (const run of [false, true]) {
    const m = testMatch(3, Character.rifleman);
    const a = fighterAt(m.world, 0), b = fighterAt(m.world, 1);
    a.motion.x = -20.0; b.motion.x = 0.0;
    m.inputs.inputs[0].direction = 1; m.inputs.inputs[0].driftStickX = 1.0;
    m.inputs.inputs[1].shield = true;
    if (run) {
      a.ground.action = GroundAction.run; a.ground.dashFrame = 30; a.ground.dashDirection = 1;
      a.motion.vx = a.tuning.physics.runSpeed;
    }
    for (let frame = 0; frame < 20; frame++) executeNext(m);
    assertTrue(a.motion.x > b.motion.x);
    assertEquals(b.status.damage, 0.0);
  }
});

test("four-damage shield contact moves defender 2.196 and attacker 1.272 after hitlag [reference]", () => {
  const m = testMatch(3, Character.rifleman);
  const a = fighterAt(m.world, 0), b = fighterAt(m.world, 1);
  a.motion.x = 0.0; b.motion.x = 90.0;
  a.tuning = { ...a.tuning, physics: { ...a.tuning.physics, traction: f32(f32(0.08) * 6.0) } };
  b.tuning = { ...b.tuning, physics: { ...b.tuning.physics, traction: f32(f32(0.09) * 6.0) } };
  b.shield.raised = true; b.shield.strength = 1.0;
  m.inputs.inputs[1].shield = true; m.inputs.inputs[1].shieldStrength = 1.0;
  beginDamageContacts();
  queueDamageContact(m.world, 0, 1, hitEffect(4.0, 0.0, 0.0, 0.0, 0.0), 1, ContactKind.flinch, true, undefined);
  finishDamageContacts(m.world);
  for (let frame = 0; frame < 4; frame++) executeNext(m);
  assertNear(a.motion.x, -f32(1.272), epsilon);
  assertNear(b.motion.x, f32(92.196), epsilon);
});

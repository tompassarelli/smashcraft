import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { neutralControls } from "../sim/roster";
import { Action, maskOf } from "./actions";
import { adaptInput } from "./adapter";
import { attackBuffer, hasPendingAttack, takeAttack } from "./attackBuffer";
import { emptyInput, inputRow, type RowFields } from "./inputRow";

function fixture(character: Character = Character.archer, graceFrames = 0) {
  const fighter = createFighter(character, 0, 1);
  const input = neutralControls();
  const attacks = attackBuffer(graceFrames);
  return {
    fighter, input, attacks,
    adapt(fields: RowFields, frame: number) {
      adaptInput(assertDefined(inputRow(fields)), fighter, frame, input, attacks);
    },
    take(frame: number) { return assertDefined(takeAttack(attacks, frame, true)); },
  };
}

test("a neutral row clears reused frame scratch without repeating an attack", () => {
  const f = fixture(Character.archer, 6);
  f.adapt({ pressed: maskOf(Action.attack) }, 1);
  assertTrue(hasPendingAttack(f.attacks, 1));
  f.input.attackRequested = true;
  f.adapt(emptyInput(), 2);
  assertFalse(f.input.attackRequested);
  assertFalse(f.input.attackPressed);
  assertFalse(hasPendingAttack(f.attacks, 2));
});

test("digital taps become movement without confusing C-stick down", () => {
  const f = fixture();
  f.adapt({ pressed: maskOf(Action.moveLeft, Action.smashDown), released: maskOf(Action.moveLeft) }, 1);
  assertEquals(f.input.direction, -1);
  assertEquals(f.input.verticalDirection, 0);
  assertEquals(f.input.cStickZ, 0);
  assertFalse(f.input.down);
  assertFalse(f.input.attackRequested);
  f.adapt({ held: maskOf(Action.smashDown), pressed: maskOf(Action.smashDown) }, 2);
  assertEquals(f.input.direction, 0);
  assertEquals(f.input.verticalDirection, 0);
  assertEquals(f.input.cStickZ, -1);
  assertFalse(f.input.down);
  assertEquals(f.take(2).style, 3);
});

test("analog axes remain usable without keyboard action bits", () => {
  const f = fixture();
  f.adapt({ axisX: -63, axisZ: 91 }, 1);
  assertEquals(f.input.direction, -1);
  assertEquals(f.input.verticalDirection, 1);
  f.adapt({ triggerLeft: 1 }, 2);
  assertFalse(f.input.shield);
  f.adapt({ triggerLeft: 77 }, 3);
  assertTrue(f.input.shield);
});

test("attack and jump share the exact frame and C-stick priority wins", () => {
  const f = fixture();
  f.adapt({ held: maskOf(Action.jump, Action.attack), pressed: maskOf(Action.jump, Action.attack, Action.smashRight), axisX: 127 }, 18);
  assertTrue(f.input.jumpPressed);
  assertTrue(f.input.jumpHeld);
  assertTrue(f.input.attackPressed);
  assertEquals(assertDefined(f.attacks.pending).frame, 18);
  const command = f.take(18);
  assertEquals(command.style, 4);
  assertEquals(command.facing, 1);
});

test("shield attack becomes grab and trigger presses retain dodge and tech intent", () => {
  const f = fixture();
  f.fighter.shield.raised = true;
  f.adapt({ held: maskOf(Action.attack, Action.leftTrigger), pressed: maskOf(Action.attack, Action.leftTrigger), axisX: -127, triggerLeft: 255, dodgeX: -1 }, 4);
  assertTrue(f.input.shield);
  assertTrue(f.input.techPressed);
  assertTrue(f.input.airDodgePressed);
  assertEquals(f.input.dodgeX, -1);
  assertEquals(f.take(4).style, 5);
});

test("special releases preserve press direction and leave neutral turnaround to simulation", () => {
  const f = fixture(Character.demonHunter);
  f.fighter.motion.grounded = false;
  const downSpecial: RowFields = { pressed: maskOf(Action.special), released: maskOf(Action.moveDown), specialZ: -1 };
  f.adapt(downSpecial, 1);
  assertEquals(f.input.direction, 0);
  assertTrue(f.input.specialPressed);
  assertEquals(f.input.specialZ, -1);
  assertTrue(f.input.getupAttackPressed);
  // Melee's down and ledge attacks take any A or B press: melee:src/melee/ft/kinds/ftCommon/ftCo_DownAttack.c, ftCo_CliffAttack.c.
  const rifleman = fixture(Character.rifleman);
  rifleman.adapt(downSpecial, 2);
  assertTrue(rifleman.input.getupAttackPressed);
  f.fighter.motion.lastAerialTapDirection = -1;
  f.adapt({ pressed: maskOf(Action.special) }, 3);
  assertEquals(f.input.specialX, 0);
  assertEquals(f.input.specialZ, 0);
});

test("grab, throw, mash, L-cancel, tech and ledge intents use fresh edges", () => {
  const f = fixture();
  f.adapt({ pressed: maskOf(Action.grab, Action.attack, Action.moveLeft, Action.moveUp, Action.rightTrigger), dodgeX: -1, sdi: true, sdiZ: 1, ledgeVertical: 1 }, 7);
  assertTrue(f.input.attackPressed);
  assertTrue(f.input.grabMashPressed);
  assertTrue(f.input.mashPressed);
  assertTrue(f.input.lCancelPressed);
  assertTrue(f.input.techPressed);
  assertEquals(f.input.grabThrowX, -1);
  assertEquals(f.input.grabThrowZ, 1);
  assertTrue(f.input.sdiPulse);
  assertEquals(f.input.sdiZ, 1);
  assertEquals(f.input.ledgeVerticalPressed, 1);
  assertEquals(f.input.getupDirection, -1);
  assertTrue(f.input.getupStandPressed);
  assertEquals(f.take(7).style, 5);
});

test("walking selects tilts and same-frame opposing smashes cancel facing", () => {
  const f = fixture();
  f.adapt({ held: maskOf(Action.attack, Action.walk, Action.moveUp), pressed: maskOf(Action.attack, Action.smashLeft, Action.smashRight), axisZ: 127 }, 10);
  assertTrue(f.input.walking);
  const command = f.take(10);
  assertEquals(command.style, 4);
  assertEquals(command.facing, 0);
});

import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { copyAttackBuffer, holdAttack, type AttackBuffer, type AttackCommand, attackBuffer, queueAttack, takeAttack } from "./attackBuffer";
import type { Direction } from "./inputRow";

const attack = (style: number, facing: Direction, frame: number, mayCharge = false): AttackCommand => ({ style, facing, frame, mayCharge });

function take(buffer: AttackBuffer, frame: number): AttackCommand {
  return assertDefined(takeAttack(buffer, frame, true), `attack on frame ${frame}`);
}


function winners(first: AttackCommand, second: AttackCommand): AttackCommand[] {
  const forward = attackBuffer(0);
  queueAttack(forward, first);
  queueAttack(forward, second);
  const reverse = attackBuffer(0);
  queueAttack(reverse, second);
  queueAttack(reverse, first);
  return [take(forward, first.frame), take(reverse, first.frame)];
}

test("same-frame smashes in opposing directions stay neutral in every order [k2 property]", () => {
  for (const [repeated, opposing] of [[-1, 1], [1, -1]] as const) {
    for (let position = 0; position <= 2; position++) {
      const buffer = attackBuffer(0);
      for (let event = 0; event <= 2; event++) queueAttack(buffer, attack(4, event === position ? opposing : repeated, 10));
      let taken = take(buffer, 10);
      assertEquals(taken.style, 4);
      assertEquals(taken.facing, 0);
      queueAttack(buffer, attack(4, repeated, 11));
      taken = take(buffer, 11);
      assertEquals(taken.style, 4);
      assertEquals(taken.facing, repeated);
    }
  }
});

test("a same-frame C-stick smash beats a smash that may charge, a jab, a tilt or an angled tilt in either order [k2 property]", () => {
  for (const other of [attack(0, 0, 10), attack(6, -1, 10), attack(9, -1, 10), attack(10, -1, 10)]) {
    for (const taken of winners(other, attack(4, 1, 10))) {
      assertEquals(taken.style, 4);
      assertEquals(taken.facing, 1);
    }
  }
  for (let direct = 2; direct <= 4; direct++) {
    for (let normal = 2; normal <= 4; normal++) {
      for (const taken of winners(attack(normal, -1, 1, true), attack(direct, 1, 1))) {
        assertEquals(taken.style, direct);
        assertFalse(taken.mayCharge);
        assertEquals(taken.facing, 1);
      }
    }
  }
});

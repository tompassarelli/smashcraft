import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "../../runtime/testing";
import { type AttackBuffer, type AttackCommand, attackBuffer, queueAttack, takeAttack } from "./attackBuffer";
import type { Direction } from "./inputRow";

const attack = (style: number, facing: Direction, frame: number, mayCharge = false): AttackCommand => ({ style, facing, frame, mayCharge });

function take(buffer: AttackBuffer, frame: number): AttackCommand {
  return assertDefined(takeAttack(buffer, frame, true), `attack on frame ${frame}`);
}

/** Queues two same-frame requests in both orders and takes the winner of each. */
function winners(first: AttackCommand, second: AttackCommand): AttackCommand[] {
  const forward = attackBuffer(0);
  queueAttack(forward, first);
  queueAttack(forward, second);
  const reverse = attackBuffer(0);
  queueAttack(reverse, second);
  queueAttack(reverse, first);
  return [take(forward, first.frame), take(reverse, first.frame)];
}

test("same-frame smashes in opposing directions stay neutral in every order", () => {
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

test("a C-stick smash beats a smash that may charge in either order", () => {
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

test("a same-frame C-stick smash beats a jab or a tilt in either order", () => {
  for (const other of [attack(0, 0, 10), attack(6, -1, 10)]) {
    for (const taken of winners(other, attack(4, 1, 10))) {
      assertEquals(taken.style, 4);
      assertEquals(taken.facing, 1);
    }
  }
});

test("charge permission travels with one command and expires with it", () => {
  const buffer = attackBuffer(0);
  queueAttack(buffer, attack(4, 1, 1, true));
  const charged = take(buffer, 1);
  assertEquals(charged.style, 4);
  assertTrue(charged.mayCharge);
  assertEquals(takeAttack(buffer, 1, true), undefined);
  queueAttack(buffer, attack(4, 1, 2, true));
  assertEquals(takeAttack(buffer, 2, false), undefined);
  assertEquals(takeAttack(buffer, 3, true), undefined);
  queueAttack(buffer, attack(4, 1, 4));
  const uncharged = take(buffer, 4);
  assertEquals(uncharged.style, 4);
  assertFalse(uncharged.mayCharge);
});

test("a press is taken once, on its frame", () => {
  const buffer = attackBuffer(0);
  queueAttack(buffer, attack(0, 0, 10));
  assertEquals(takeAttack(buffer, 9, true), undefined);
  assertEquals(take(buffer, 10).style, 0);
  assertEquals(takeAttack(buffer, 10, true), undefined);
  assertEquals(takeAttack(buffer, 11, true), undefined);
});

test("without grace frames an attack is not stored through recovery", () => {
  const buffer = attackBuffer(0);
  queueAttack(buffer, attack(1, 0, 10));
  assertEquals(takeAttack(buffer, 10, false), undefined);
  assertEquals(takeAttack(buffer, 11, true), undefined);
});

test("grace frames hold an attack through recovery until they run out", () => {
  const buffer = attackBuffer(3);
  queueAttack(buffer, attack(4, -1, 10));
  assertEquals(takeAttack(buffer, 10, false), undefined);
  const taken = take(buffer, 13);
  assertEquals(taken.style, 4);
  assertEquals(taken.facing, -1);
  queueAttack(buffer, attack(0, 0, 20));
  assertEquals(takeAttack(buffer, 24, true), undefined);
});

test("angled tilts reach their frame and yield to C-stick smashes", () => {
  for (let style = 9; style <= 10; style++) {
    const buffer = attackBuffer(0);
    queueAttack(buffer, attack(style, -1, 10));
    const tilt = take(buffer, 10);
    assertEquals(tilt.style, style);
    assertEquals(tilt.facing, -1);
    queueAttack(buffer, attack(style, -1, 11));
    queueAttack(buffer, attack(4, 1, 11));
    assertEquals(take(buffer, 11).style, 4);
    queueAttack(buffer, attack(4, 1, 12));
    queueAttack(buffer, attack(style, -1, 12));
    assertEquals(take(buffer, 12).style, 4);
    queueAttack(buffer, attack(11, 1, 13));
    assertEquals(takeAttack(buffer, 13, true), undefined);
  }
});

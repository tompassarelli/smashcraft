import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { copyAttackBuffer, holdAttack, type AttackBuffer, type AttackCommand, attackBuffer, queueAttack, takeAttack } from "./attackBuffer";
import type { Direction } from "./inputRow";

const attack = (style: number, facing: Direction, frame: number, mayCharge = false): AttackCommand => ({ style, facing, frame, mayCharge });

test("a snapshot and a consumed request keep their values when the source buffer queues or holds another [invariant]", () => {
  const live = attackBuffer(3);
  const snapshot = attackBuffer(3);
  queueAttack(live, attack(4, -1, 10, true));
  copyAttackBuffer(snapshot, live);
  holdAttack(live, 11);
  assertEquals(snapshot.pending?.frame, 10);
  assertEquals(snapshot.previousRequest?.frame, 10);
  const consumed = take(live, 11);
  queueAttack(live, attack(0, 1, 20));
  assertEquals(consumed.style, 4);
  assertEquals(consumed.frame, 11);
  assertEquals(consumed.facing, -1);
  assertTrue(consumed.mayCharge);
  assertEquals(snapshot.pending?.style, 4);
  assertEquals(snapshot.previousRequest?.facing, -1);
});

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

test("same-frame smashes in opposing directions stay neutral in every order [spec docs/gameplay-design.md] [invariant]", () => {
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

test("a same-frame C-stick smash beats a smash that may charge, a jab, a tilt or an angled tilt in either order [spec docs/gameplay-design.md] [invariant]", () => {
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

test("grace frames hold an attack through recovery until they run out [spec docs/gameplay-design.md]", () => {
  const buffer = attackBuffer(3);
  queueAttack(buffer, attack(4, -1, 10));
  assertEquals(takeAttack(buffer, 10, false), undefined);
  const taken = take(buffer, 13);
  assertEquals(taken.style, 4);
  assertEquals(taken.facing, -1);
  queueAttack(buffer, attack(0, 0, 20));
  assertEquals(takeAttack(buffer, 24, true), undefined);
});

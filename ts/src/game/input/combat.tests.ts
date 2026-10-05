import { assertEquals, test } from "wisp/src/runtime/testing";
import { AttackStyle } from "../sim/codes";
import { attackStyleForGrounding, groundDodgeIntent, normalAttackStyle } from "./combat";

test("airborne normals choose direction relative to facing", () => {
  assertEquals(attackStyleForGrounding(0, false, 1, 0), AttackStyle.neutralAir);
  for (const facing of [-1, 1]) {
    assertEquals(attackStyleForGrounding(4, false, facing, facing), AttackStyle.forwardAir);
    assertEquals(attackStyleForGrounding(4, false, facing, -facing), AttackStyle.backAir);
    assertEquals(attackStyleForGrounding(6, false, facing, -facing), AttackStyle.backAir);
    assertEquals(attackStyleForGrounding(2, false, facing, 0), AttackStyle.upAir);
    assertEquals(attackStyleForGrounding(3, false, facing, 0), AttackStyle.downAir);
    assertEquals(attackStyleForGrounding(9, false, facing, facing), AttackStyle.upAir);
    assertEquals(attackStyleForGrounding(10, false, facing, facing), AttackStyle.downAir);
  }
  assertEquals(attackStyleForGrounding(5, false, 1, 0), undefined);
  assertEquals(attackStyleForGrounding(1, false, 1, 0), 1);
  assertEquals(attackStyleForGrounding(undefined, false, 1, 0), undefined);
  for (const style of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const) {
    assertEquals(attackStyleForGrounding(style, true, 1, -1), style);
  }
});

test("grounded dodges require shield and fresh direction", () => {
  assertEquals(groundDodgeIntent(false, true, false, false), undefined);
  assertEquals(groundDodgeIntent(false, false, false, true), undefined);
  assertEquals(groundDodgeIntent(true, false, false, false), undefined);
  assertEquals(groundDodgeIntent(true, true, false, false), -1);
  assertEquals(groundDodgeIntent(true, false, true, false), 1);
  assertEquals(groundDodgeIntent(true, false, false, true), 0);
});

test("contradictory roll edges cancel and down chooses spot dodge", () => {
  assertEquals(groundDodgeIntent(true, true, true, false), undefined);
  assertEquals(groundDodgeIntent(true, true, false, true), 0);
  assertEquals(groundDodgeIntent(true, false, true, true), 0);
});

test("neutral attack is jab and direction chooses tilt or smash", () => {
  assertEquals(normalAttackStyle(0, 0, false, false), 0);
  assertEquals(normalAttackStyle(0, 0, true, false), 0);
  assertEquals(normalAttackStyle(1, 0, true, false), 6);
  assertEquals(normalAttackStyle(-1, 0, true, false), 6);
  assertEquals(normalAttackStyle(0, 1, true, false), 7);
  assertEquals(normalAttackStyle(0, -1, true, false), 8);
  assertEquals(normalAttackStyle(1, 0, false, false), 4);
  assertEquals(normalAttackStyle(-1, 0, false, false), 4);
  assertEquals(normalAttackStyle(0, 1, false, false), 2);
  assertEquals(normalAttackStyle(0, -1, false, false), 3);
});

test("walking diagonals angle forward tilt and leave smash selection unchanged", () => {
  for (const horizontal of [-1, 1]) {
    assertEquals(normalAttackStyle(horizontal, 1, true, false), 9);
    assertEquals(normalAttackStyle(horizontal, -1, true, false), 10);
    assertEquals(normalAttackStyle(horizontal, 0, true, false), 6);
    assertEquals(normalAttackStyle(horizontal, 1, false, false), 2);
    assertEquals(normalAttackStyle(horizontal, -1, false, false), 3);
  }
});

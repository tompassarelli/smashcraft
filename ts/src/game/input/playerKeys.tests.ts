import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, bit } from "./actions";
import { pulsePending } from "./directionalInput";
import { presetBindings, rebind } from "./keyBindings";
import { actionHeld, clearKeys, heldActions, keyDown, playerKeys, pressKey, releaseKey } from "./playerKeys";

const Key = { G: 71, N: 78, T: 84, W: 87 } as const;

test("each player's keys and bindings hold actions independently, and repeats are ignored", () => {
  const first = playerKeys();
  const second = playerKeys();
  const firstBindings = presetBindings("standard");
  const secondBindings = presetBindings("standard");
  assertTrue(rebind(secondBindings, Action.attack, 0, Key.G));
  assertEquals(pressKey(first, Key.N, firstBindings), Action.attack);
  assertEquals(pressKey(first, Key.N, firstBindings), undefined);
  assertTrue(actionHeld(first, Action.attack));
  assertEquals(pressKey(second, Key.N, secondBindings), undefined);
  assertTrue(keyDown(second, Key.N));
  assertFalse(actionHeld(second, Action.attack));
  assertEquals(pressKey(second, Key.G, secondBindings), Action.attack);
  assertEquals(releaseKey(first, Key.N, firstBindings), Action.attack);
  assertFalse(actionHeld(first, Action.attack));
  assertTrue(actionHeld(second, Action.attack));
  assertEquals(heldActions(second), bit(Action.attack));
});

test("an action bound to two keys stays held until both are up", () => {
  const keys = playerKeys();
  const bindings = presetBindings("standard");
  assertTrue(rebind(bindings, Action.attack, 1, Key.G));
  pressKey(keys, Key.N, bindings);
  pressKey(keys, Key.G, bindings);
  assertEquals(releaseKey(keys, Key.N, bindings), Action.attack);
  assertTrue(actionHeld(keys, Action.attack));
  releaseKey(keys, Key.G, bindings);
  assertFalse(actionHeld(keys, Action.attack));
});

test("light shield's last two slots release independently without clearing an attack", () => {
  const keys = playerKeys();
  const bindings = presetBindings("standard");
  assertTrue(rebind(bindings, Action.lightShield, 1, Key.T));
  pressKey(keys, 57, bindings);
  pressKey(keys, Key.T, bindings);
  pressKey(keys, Key.N, bindings);
  releaseKey(keys, 57, bindings);
  assertTrue(actionHeld(keys, Action.lightShield));
  releaseKey(keys, Key.T, bindings);
  assertFalse(actionHeld(keys, Action.lightShield));
  assertEquals(heldActions(keys), bit(Action.attack));
});

test("clearing drops held keys and the pending pulse without touching another player", () => {
  const first = playerKeys();
  const second = playerKeys();
  const bindings = presetBindings("standard");
  pressKey(first, Key.W, bindings);
  pressKey(second, Key.W, bindings);
  assertTrue(pulsePending(first.directions));
  clearKeys(first);
  assertFalse(keyDown(first, Key.W));
  assertFalse(actionHeld(first, Action.moveLeft));
  assertFalse(pulsePending(first.directions));
  assertTrue(actionHeld(second, Action.moveLeft));
  assertTrue(pulsePending(second.directions));
  assertEquals(pressKey(first, Key.W, bindings), Action.moveLeft);
});

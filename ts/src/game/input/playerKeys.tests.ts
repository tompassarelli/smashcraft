import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Action, bit } from "./actions";
import { presetBindings, rebind } from "./keyBindings";
import { actionHeld, heldActions, keyDown, playerKeys, pressKey, releaseKey } from "./playerKeys";

const Key = { G: 71, N: 78, T: 84, W: 87 } as const;

test("each player's keys and bindings hold actions independently, and repeats are ignored [spec docs/netcode-proposal.md]", () => {
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

test("an action bound to two keys stays held until both are up, light shield's last two slots included, without clearing another action [spec docs/controller-platforms.md]", () => {
  const keys = playerKeys();
  const bindings = presetBindings("standard");
  assertTrue(rebind(bindings, Action.attack, 1, Key.G));
  pressKey(keys, Key.N, bindings);
  pressKey(keys, Key.G, bindings);
  assertEquals(releaseKey(keys, Key.N, bindings), Action.attack);
  assertTrue(actionHeld(keys, Action.attack));
  releaseKey(keys, Key.G, bindings);
  assertFalse(actionHeld(keys, Action.attack));
  const shielding = playerKeys();
  const shieldBindings = presetBindings("standard");
  assertTrue(rebind(shieldBindings, Action.lightShield, 1, Key.T));
  pressKey(shielding, 57, shieldBindings);
  pressKey(shielding, Key.T, shieldBindings);
  pressKey(shielding, Key.N, shieldBindings);
  releaseKey(shielding, 57, shieldBindings);
  assertTrue(actionHeld(shielding, Action.lightShield));
  releaseKey(shielding, Key.T, shieldBindings);
  assertFalse(actionHeld(shielding, Action.lightShield));
  assertEquals(heldActions(shielding), bit(Action.attack));
});

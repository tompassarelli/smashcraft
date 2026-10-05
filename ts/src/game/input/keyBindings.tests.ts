import { assertDefined, assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { Action } from "./actions";
import { type BindingPreset, type KeyBindings, actionFor, decodeBindings, encodeBindings, keyFor, presetBindings, rebind } from "./keyBindings";

const Key = {
  seven: 55, eight: 56, nine: 57, A: 65, D: 68, E: 69, F: 70, G: 71, I: 73, L: 76, N: 78, O: 79, P: 80, Q: 81, R: 82, S: 83, U: 85,
  W: 87, Y: 89, F6: 117, F7: 118, semicolon: 186,
} as const;
const PRESETS: readonly BindingPreset[] = ["standard", "custom"];

const decode = (saved: string) => assertDefined(decodeBindings(saved), saved);
/** The same layout as a K2 save, which predates the current defaults. */
const asK2 = (bindings: KeyBindings) => `K2${encodeBindings(bindings).slice(2)}`;
/** The same layout as a K1 save, which predates the walk slots. */
const asK1 = (bindings: KeyBindings) => `K1${encodeBindings(bindings).slice(2, 86)}`;

test("presets put movement on QWER, actions on N and UIOP, and the owner's number row in custom", () => {
  for (const preset of PRESETS) {
    const bindings = presetBindings(preset);
    assertEquals(actionFor(bindings, Key.Q), Action.leftTrigger);
    assertEquals(actionFor(bindings, Key.W), Action.moveLeft);
    assertEquals(actionFor(bindings, Key.E), Action.moveDown);
    assertEquals(actionFor(bindings, Key.R), Action.moveRight);
    assertEquals(actionFor(bindings, Key.N), Action.attack);
    assertEquals(actionFor(bindings, Key.U), Action.special);
    assertEquals(actionFor(bindings, Key.I), Action.jump);
    assertEquals(actionFor(bindings, Key.O), Action.grab);
    assertEquals(actionFor(bindings, Key.P), Action.walk);
    assertEquals(keyFor(bindings, Action.walk, 0), Key.P);
    assertEquals(actionFor(bindings, Key.L), undefined);
  }
  const custom = presetBindings("custom");
  const standard = presetBindings("standard");
  assertEquals(keyFor(custom, Action.rightTrigger, 0), Key.eight);
  assertEquals(keyFor(standard, Action.rightTrigger, 0), Key.seven);
  assertEquals(keyFor(custom, Action.jump, 1), Key.nine);
  assertEquals(keyFor(standard, Action.jump, 1), Key.eight);
});

test("rebinding refuses reserved and already bound keys", () => {
  const bindings = presetBindings("custom");
  assertFalse(rebind(bindings, Action.grab, 0, Key.N));
  assertEquals(keyFor(bindings, Action.grab, 0), Key.O);
  for (const reserved of [Key.F6, Key.F7, Key.Y]) assertFalse(rebind(bindings, Action.grab, 0, reserved));
  assertTrue(rebind(bindings, Action.grab, 0, Key.G));
  assertEquals(actionFor(bindings, Key.G), Action.grab);
  assertEquals(actionFor(bindings, Key.L), undefined);
  assertEquals(actionFor(bindings, Key.O), undefined);
});

test("K2 saves move grab to O and walk to P unless the player bound those keys", () => {
  for (const preset of PRESETS) {
    const bindings = presetBindings(preset);
    assertTrue(rebind(bindings, Action.grab, 0, Key.L));
    assertTrue(rebind(bindings, Action.walk, 0, Key.semicolon));
    let restored = decode(asK2(bindings));
    assertEquals(actionFor(restored, Key.O), Action.grab);
    assertEquals(actionFor(restored, Key.P), Action.walk);
    // Current saves keep an intentional rebinding to the former defaults.
    restored = decode(encodeBindings(bindings));
    assertEquals(actionFor(restored, Key.L), Action.grab);
    assertEquals(actionFor(restored, Key.semicolon), Action.walk);
    // An older custom action on the new key is not displaced.
    assertTrue(rebind(bindings, Action.special, 1, Key.O));
    assertTrue(rebind(bindings, Action.attack, 1, Key.P));
    restored = decode(asK2(bindings));
    assertEquals(actionFor(restored, Key.O), Action.special);
    assertEquals(actionFor(restored, Key.P), Action.attack);
    assertEquals(actionFor(restored, Key.L), Action.grab);
    assertEquals(actionFor(restored, Key.semicolon), Action.walk);
  }
});

test("saves roundtrip, malformed saves are refused and a saved Y binding is dropped", () => {
  const source = presetBindings("custom");
  assertTrue(rebind(source, Action.grab, 0, Key.G));
  const saved = encodeBindings(source);
  assertEquals(encodeBindings(decode(saved)), saved);
  assertEquals(decodeBindings("K1broken"), undefined);
  assertEquals(decodeBindings(`XX${saved.slice(2)}`), undefined);
  const grabOffset = 2 + Action.grab * 6;
  const yBound = decode(`${saved.slice(0, grabOffset)}089${saved.slice(grabOffset + 3)}`);
  assertEquals(keyFor(yBound, Action.grab, 0), undefined);
  assertEquals(keyFor(yBound, Action.jump, 0), keyFor(source, Action.jump, 0));
});

test("K1 saves gain walk on P without losing rebindings", () => {
  const source = presetBindings("custom");
  assertTrue(rebind(source, Action.grab, 0, Key.G));
  let restored = decode(asK1(source));
  assertEquals(keyFor(restored, Action.grab, 0), Key.G);
  assertEquals(keyFor(restored, Action.rightTrigger, 0), Key.eight);
  assertEquals(keyFor(restored, Action.walk, 0), Key.P);
  assertTrue(rebind(source, Action.walk, 0, undefined));
  assertTrue(rebind(source, Action.grab, 0, Key.P));
  restored = decode(asK1(source));
  assertEquals(keyFor(restored, Action.grab, 0), Key.P);
  assertEquals(keyFor(restored, Action.walk, 0), undefined);
});

test("K2 saves on the old S F D movement block move to QWER, keeping custom keys", () => {
  const old = presetBindings("custom");
  assertTrue(rebind(old, Action.moveLeft, 0, Key.S));
  assertTrue(rebind(old, Action.moveRight, 0, Key.F));
  assertTrue(rebind(old, Action.moveDown, 0, Key.D));
  assertTrue(rebind(old, Action.leftTrigger, 0, Key.A));
  assertTrue(rebind(old, Action.attack, 0, Key.G));
  let restored = decode(asK2(old));
  assertEquals(actionFor(restored, Key.Q), Action.leftTrigger);
  assertEquals(actionFor(restored, Key.W), Action.moveLeft);
  assertEquals(actionFor(restored, Key.E), Action.moveDown);
  assertEquals(actionFor(restored, Key.R), Action.moveRight);
  assertEquals(actionFor(restored, Key.G), Action.attack);
  assertEquals(keyFor(restored, Action.rightTrigger, 0), Key.eight);
  assertTrue(rebind(old, Action.grab, 0, Key.Q));
  restored = decode(asK2(old));
  assertEquals(actionFor(restored, Key.Q), Action.grab);
  assertEquals(actionFor(restored, Key.S), Action.moveLeft);
});

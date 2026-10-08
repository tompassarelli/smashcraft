import { assertDefined, assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { Action } from "./actions";
import { type BindingPreset, type KeyBindings, actionFor, decodeBindings, encodeBindings, keyFor, presetBindings, rebind } from "./keyBindings";

const Key = {
  seven: 55, eight: 56, nine: 57, A: 65, D: 68, E: 69, F: 70, G: 71, I: 73, L: 76, N: 78, O: 79, P: 80, Q: 81, R: 82, S: 83, U: 85,
  T: 84, W: 87, Y: 89, F6: 117, F7: 118, semicolon: 186,
} as const;
const PRESETS: readonly BindingPreset[] = ["standard", "custom"];

const decode = (saved: string) => assertDefined(decodeBindings(saved), saved);
/** The same layout as a K2 save, which predates the current defaults. */
const asK2 = (bindings: KeyBindings) => `K2${encodeBindings(bindings).slice(2, 92)}`;
/** The same layout as a K1 save, which predates the walk slots. */
const asK1 = (bindings: KeyBindings) => `K1${encodeBindings(bindings).slice(2, 86)}`;

test("saves roundtrip, malformed saves are refused and a saved Y binding is dropped [invariant]", () => {
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

test("older saves gain light shield on T without losing custom bindings [repro #205]", () => {
  for (const preset of PRESETS) {
    const source = presetBindings(preset);
    assertTrue(rebind(source, Action.lightShield, 1, undefined));
    assertTrue(rebind(source, Action.attack, 0, Key.G));
    for (const saved of [asK1(source), asK2(source), `K3${encodeBindings(source).slice(2, 92)}`, `K4${encodeBindings(source).slice(2)}`]) {
      const restored = decode(saved);
      assertEquals(actionFor(restored, Key.T), Action.lightShield);
      assertEquals(actionFor(restored, Key.G), Action.attack);
    }
    assertTrue(rebind(source, Action.attack, 1, Key.T));
    const restored = decode(`K4${encodeBindings(source).slice(2)}`);
    assertEquals(actionFor(restored, Key.T), Action.attack);
    assertEquals(keyFor(restored, Action.lightShield, 1), undefined);
  }
});

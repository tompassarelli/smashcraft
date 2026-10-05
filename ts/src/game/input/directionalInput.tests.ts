import { assertEquals, assertFalse, assertTrue, test } from "../../runtime/testing";
import { type DirectionalInput, clearDirections, clearPulse, neutralDirections, pulsePending, updateDirections } from "./directionalInput";

function assertDirections(input: Readonly<DirectionalInput>, expected: Readonly<DirectionalInput>): void {
  assertEquals(input.heldX, expected.heldX, "heldX");
  assertEquals(input.heldZ, expected.heldZ, "heldZ");
  assertEquals(input.pulseX, expected.pulseX, "pulseX");
  assertEquals(input.pulseZ, expected.pulseZ, "pulseZ");
}

test("a press released before the frame keeps its pulse but not its hold", () => {
  const input = neutralDirections();
  updateDirections(input, 1, 0);
  updateDirections(input, 0, 0);
  assertTrue(pulsePending(input));
  assertDirections(input, { heldX: 0, heldZ: 0, pulseX: 1, pulseZ: 0 });
});

test("a held direction pulses once and components keep only their sign", () => {
  const input = neutralDirections();
  updateDirections(input, 5, -3);
  assertDirections(input, { heldX: 1, heldZ: -1, pulseX: 1, pulseZ: -1 });
  clearPulse(input);
  updateDirections(input, 2, -9);
  assertFalse(pulsePending(input));
  updateDirections(input, -2, -9);
  assertTrue(pulsePending(input));
  assertEquals(input.pulseX, -1);
  assertEquals(input.pulseZ, -1);
});

test("the newest component entry wins and releasing to a cardinal does not pulse", () => {
  const input = neutralDirections();
  updateDirections(input, 1, 0);
  updateDirections(input, 1, 1);
  assertEquals(input.pulseX, 1);
  assertEquals(input.pulseZ, 1);
  updateDirections(input, 1, 0);
  assertEquals(input.pulseZ, 1);
  clearPulse(input);
  updateDirections(input, 1, 1);
  assertTrue(pulsePending(input));
  clearPulse(input);
  updateDirections(input, 0, 1);
  assertFalse(pulsePending(input));
  updateDirections(input, -1, 1);
  assertTrue(pulsePending(input));
  assertEquals(input.pulseX, -1);
  assertEquals(input.pulseZ, 1);
});

test("opposing keys cancel the held axis without erasing an earlier pulse", () => {
  const input = neutralDirections();
  updateDirections(input, -1, 0);
  updateDirections(input, -1 + 1, 0);
  assertEquals(input.heldX, 0);
  assertTrue(pulsePending(input));
  assertEquals(input.pulseX, -1);
  clearPulse(input);
  updateDirections(input, -1 + 1, 0);
  assertFalse(pulsePending(input));
  updateDirections(input, 1, 0);
  assertTrue(pulsePending(input));
  assertEquals(input.pulseX, 1);
});

test("clearing resets hold and pulse while an expired pulse keeps the hold", () => {
  const input = neutralDirections();
  updateDirections(input, 1, -1);
  clearPulse(input);
  assertFalse(pulsePending(input));
  assertDirections(input, { heldX: 1, heldZ: -1, pulseX: 0, pulseZ: 0 });
  updateDirections(input, -1, 1);
  clearDirections(input);
  assertFalse(pulsePending(input));
  assertDirections(input, neutralDirections());
  updateDirections(input, -1, 1);
  assertTrue(pulsePending(input));
});

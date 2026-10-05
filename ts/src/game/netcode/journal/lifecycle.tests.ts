import { assertEquals, assertFalse, assertTrue, test } from "waygate/src/runtime/testing";
import { MatchLifecycle, pauseBarrierFrame } from "./lifecycle";

test("a match starts and ends only when every human crosses, and a rematch ignores the last epoch", () => {
  const match = new MatchLifecycle(1, 5);
  match.ready(1, 0);
  match.ready(1, 0);
  match.ready(1, 1);
  assertFalse(match.started());
  match.ready(1, 2);
  assertTrue(match.started());
  match.stopped(1, 0);
  assertFalse(match.quiescent());
  match.stopped(1, 2);
  assertTrue(match.quiescent());
  const rematch = new MatchLifecycle(2, 5);
  assertFalse(rematch.started());
  assertFalse(rematch.quiescent());
  for (const slot of [0, 2]) {
    rematch.ready(1, slot);
    rematch.stopped(1, slot);
  }
  assertFalse(rematch.started());
  assertFalse(rematch.quiescent());
  rematch.ready(2, 0);
  rematch.ready(2, 2);
  assertTrue(rematch.started());
});

test("a shared pause takes effect at the highest prepared frontier", () => {
  assertEquals(pauseBarrierFrame([60, 75, 61, 0]), 75);
  assertEquals(pauseBarrierFrame([96, 96, 0, 0]), 96);
});

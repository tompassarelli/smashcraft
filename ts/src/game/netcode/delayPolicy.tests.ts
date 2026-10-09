import { assertEquals, assertFalse, assertTrue, test } from "wisp/src/runtime/testing";
import { imod } from "wisp/src/sim/intMath";
import {
  AUTO_DELAY, type DelayPolicy, agreedDelay, connectionPoor, delayPolicy, expectedRollback, highDelay, nextDelay, observeRtt, requestedDelay, rttEstimate,
} from "./delayPolicy";

const SAMPLES_PER_STOCK = 900;

function lcg(seed: number): () => number {
  let state = imod(seed, 65536) + 1;
  return () => {
    state = imod(state * 75, 65537);
    return state - 1;
  };
}

function playStocks(policy: DelayPolicy, stocks: readonly number[], jitterMs: number, seed: number): number[] {
  const next = lcg(seed);
  const estimate = rttEstimate();
  const delays: number[] = [];
  let delay = policy.floor;
  for (const baseMs of stocks) {
    for (let sample = 0; sample < SAMPLES_PER_STOCK; sample++) observeRtt(estimate, baseMs + (jitterMs === 0 ? 0 : imod(next(), jitterMs + 1)));
    delay = nextDelay(policy, estimate, delay);
    delays.push(delay);
  }
  return delays;
}

test("over generated round-trip traces the delay stays within 2 and the ceiling and never reverses under jitter [spec #396]", () => {
  const draw = lcg(396);
  for (let trace = 0; trace < 120; trace++) {
    const window = [6, 12, 24][imod(draw(), 3)] ?? 24;
    const ceiling = 2 + imod(draw(), 7);
    const policy = delayPolicy(window, ceiling, 1 + imod(draw(), window - 1));
    const baseMs = imod(draw(), 1400);
    const jitterMs = imod(draw(), 34);
    const delays = playStocks(policy, [baseMs, baseMs, baseMs, baseMs, baseMs], jitterMs, draw());
    let changes = 0;
    for (let stock = 0; stock < delays.length; stock++) {
      const delay = delays[stock] ?? -1;
      assertTrue(delay >= 2 && delay <= ceiling);
      if (stock > 0 && delay !== delays[stock - 1]) {
        changes++;
        assertTrue(delay > (delays[stock - 1] ?? 0));
      }
    }
    assertTrue(changes <= 1);
  }
});

test("a rising-ping match keeps 2 frames until the one-way trip passes 2 + R frames, then warns [spec #396]", () => {
  const policy = delayPolicy(24);
  const pingMs = [30, 120, 290, 380, 700, 1200];
  assertEquals(playStocks(policy, pingMs, 6, 9).join(","), "2,2,2,5,8,8");
  const estimate = rttEstimate();
  for (const baseMs of pingMs.slice(0, 4)) for (let sample = 0; sample < SAMPLES_PER_STOCK; sample++) observeRtt(estimate, baseMs);
  assertEquals(expectedRollback(estimate, 5), 7);
  assertFalse(connectionPoor(policy, estimate, 5));
  assertFalse(highDelay(5));
  for (let sample = 0; sample < SAMPLES_PER_STOCK; sample++) observeRtt(estimate, 700);
  assertFalse(connectionPoor(policy, estimate, 8));
  for (let sample = 0; sample < SAMPLES_PER_STOCK; sample++) observeRtt(estimate, 1200);
  assertTrue(connectionPoor(policy, estimate, 8));
  assertTrue(highDelay(8));
  assertEquals(agreedDelay([requestedDelay(AUTO_DELAY, 2), requestedDelay(3, 2)]), 3);
  assertEquals(agreedDelay([requestedDelay(0, 2)]), 0);
});

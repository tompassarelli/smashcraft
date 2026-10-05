import { expect, test } from "bun:test";
import { actionFamily, firstActiveDelta, referenceJoinScope, referenceTradeoffVerdict } from "./moveData";

test("reference joins preserve action-family and clock boundaries", () => {
  expect(firstActiveDelta(4, 2)).toBe(3);
  expect(actionFamily(9)).toBe("ftilt");
  expect(actionFamily(1)).toBe("");
  expect(referenceJoinScope(9, 0)).toBe("family-only-angle-unknown");
  expect(referenceJoinScope(4, 60)).toBe("family-only-charge-unknown");
});

test("reference tradeoff projection rejects unsupported dominance", () => {
  const baseline = { category: "normal", spacing: 60, percent: 0, shielding: true, character: 0, connected: true,
    attackerReady: 28, defenderReady: 27, shieldDamage: 7, percentDamage: 0 };
  const costly = { ...baseline, character: 1, attackerReady: 38, defenderReady: 34, shieldDamage: 12.6 };
  const free = { ...baseline, character: 1, shieldDamage: 12.6 };
  const missing = { ...baseline, character: 1, defenderReady: -1, shieldDamage: 14 };
  const whiff = { ...baseline, character: 1, connected: false, shieldDamage: 0 };
  expect(referenceTradeoffVerdict(baseline, costly)).toBe("tradeoff");
  expect(referenceTradeoffVerdict(baseline, free)).toBe("b-dominates-projection");
  expect(referenceTradeoffVerdict(free, baseline)).toBe("a-dominates-projection");
  expect(referenceTradeoffVerdict(baseline, baseline)).toBe("equal-projection");
  expect(referenceTradeoffVerdict(baseline, missing)).toBe("readiness-unobserved");
  expect(referenceTradeoffVerdict(baseline, whiff)).toBe("contact-unavailable");
});

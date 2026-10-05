import { expect, test } from "bun:test";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { categoryTradeoffViolation, compareContact, compareFollowup, followupVerdict } from "./moveComparisons";

test("move comparison category rule detects the isolated recovery mutation", () => {
  const normal = compareContact(Character.archer, 1, 60, 0, true);
  const smash = compareContact(Character.archer, 0, 60, 0, true);
  const mutant = compareContact(Character.archer, 0, 60, 0, true, true);
  expect(categoryTradeoffViolation(smash, normal)).toBe(false);
  expect(categoryTradeoffViolation(mutant, normal)).toBe(true);
});

test("move comparison requires contact before normal action recovery", () => {
  const baseline = compareContact(Character.archer, 2, 60, 60, false);
  expect(baseline.attackerReady).toBe(12);
  expect(baseline.defenderReady).toBe(22);
  const standing = compareFollowup(Character.archer, 2, 60, 60, false, AttackStyle.jab, 0, false, baseline);
  const approach = compareFollowup(Character.archer, 2, 60, 60, false, AttackStyle.jab, 2, true, baseline);
  const late = compareFollowup(Character.archer, 2, 60, 60, false, AttackStyle.jab, 6, true, baseline);
  expect(standing.timingAllows).toBe(true);
  expect(standing.reachesBeforeAction).toBe(false);
  expect(approach.firstContact).toBe(19);
  expect(approach.reachesBeforeAction).toBe(true);
  expect(late.reachesBeforeAction).toBe(false);
  expect(followupVerdict(late, false, true)).toBe("chase-after-actionable");
});

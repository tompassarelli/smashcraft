import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { type FighterGameplan, GameplanSpecial, GameplanThrow, gameplanKeyMoves } from "../sim/gameplan";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { aimsLedge, defenseOption, gameplanOf, gameplanThrow, keptGap, moveWeight, onAnotherDeck, upSpecialFirst } from "./botGameplan";
import { botChoice } from "./botRandom";

/** A spacing fighter built around a back air, in the manner #105 describes. */
const SPACER: FighterGameplan = {
  range: { near: 120.0, far: 200.0 },
  spacing: [{ move: AttackStyle.backAir, near: 80.0, far: 160.0 }],
  approach: [{ via: "jump", moves: [AttackStyle.backAir, AttackStyle.forwardAir] }, { via: "shoot", moves: [GameplanSpecial.neutral], weight: 2 }],
  defense: ["roll", "roll", "shield"],
  combos: [{ starter: AttackStyle.downTilt, followUps: [AttackStyle.upAir] }, { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] }],
  kills: [{ move: AttackStyle.backAir, fromPercent: 100.0 }, { move: GameplanThrow.back, fromPercent: 130.0, toPercent: 200.0 }],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["close", "below", "edge"],
};

function pair(gap: number) {
  const f = createFighter(Character.archer, 0.0, 1);
  const target = createFighter(Character.rifleman, gap, -1);
  return { f, target };
}

test("Archer prefers Swift Arrow in her usual gap and saves homing-arrow spacing for long range [spec #273]", () => {
  const { f, target } = pair(240.0);
  const plan = gameplanOf(Character.archer);
  assertTrue(plan !== undefined);
  if (plan === undefined) return;
  for (const approach of [-1, 0]) {
    assertTrue(moveWeight(plan, approach, f, 0, target, GameplanSpecial.neutral)
      > moveWeight(plan, approach, f, 0, target, GameplanSpecial.side));
  }
  const nearWeight = moveWeight(plan, -1, f, 0, target, GameplanSpecial.side);
  target.motion.x = 440.0;
  assertTrue(moveWeight(plan, -1, f, 0, target, GameplanSpecial.side) > nearWeight);
});

test("every declared gameplan names key moves and an ordered range band [spec #105]", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const plan = gameplanOf(character);
    if (plan === undefined) continue;
    // A declared gameplan names at least one key move, a range band and a recovery route.
    assertTrue(gameplanKeyMoves(plan).length > 0);
    assertTrue(plan.range.near <= plan.range.far);
  }
});

test("a jump onto a raised deck keeps approaching until landing instead of turning back to ranged spacing [repro #160]", () => {
  const f = createFighter(Character.jaina, -8.0, -1);
  const target = createFighter(Character.archer, -265.0, 1);
  const plan = gameplanOf(f.character);
  assertTrue(plan !== undefined);
  if (plan === undefined) return;
  f.motion.grounded = false;
  f.motion.surface = undefined;
  target.motion.z = 170.0;
  target.motion.surface = 1;
  for (const height of [62.0, 167.0, 174.0]) {
    f.motion.z = height;
    assertEquals(keptGap(plan, f, target, 1, 0, 82, botChoice), 0.0);
  }
  f.motion.grounded = true;
  f.motion.z = 170.0;
  f.motion.surface = 1;
  assertTrue(keptGap(plan, f, target, 1, 0, 101, botChoice) > 0.0);
  f.motion.grounded = false;
  f.motion.surface = undefined;
  f.motion.z = 62.0;
  target.motion.z = 0.0;
  target.motion.surface = 0;
  assertEquals(onAnotherDeck(f, target), false);
});

test("a held grab throws for the kill in its window, else into a combo [spec #105]", () => {
  const { target } = pair(50.0);
  target.status.damage = 40.0;
  assertEquals(gameplanThrow(SPACER, target, 3, botChoice), GameplanThrow.up);
  target.status.damage = 150.0;
  assertEquals(gameplanThrow(SPACER, target, 3, botChoice), GameplanThrow.back);
  target.status.damage = 250.0;
  assertEquals(gameplanThrow(SPACER, target, 3, botChoice), GameplanThrow.up);
  assertEquals(gameplanThrow({ ...SPACER, combos: [], kills: [] }, target, 3, botChoice), undefined);
});

test("defense and recovery follow the declared answers and route [spec #105]", () => {
  let rolls = 0;
  for (let serial = 0; serial < 300; serial++) {
    const answer = defenseOption(SPACER, botChoice, serial, 1);
    assertTrue(answer === "roll" || answer === "shield");
    if (answer === "roll") rolls++;
  }
  assertTrue(rolls > 150 && rolls < 260);
  assertEquals(defenseOption({ ...SPACER, defense: [] }, botChoice, 1, 1), undefined);
  assertEquals(aimsLedge(SPACER, false), true);
  assertEquals(upSpecialFirst(SPACER, true), false);
  assertEquals(aimsLedge({ ...SPACER, recovery: { aim: "mixed", upSpecial: "mixed" } }, false), false);
});

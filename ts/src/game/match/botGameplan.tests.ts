import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { AttackStyle, Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { type FighterGameplan, GameplanSpecial, GameplanThrow, gameplanKeyMoves } from "../sim/gameplan";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { SPACE_PLAN, aimsLedge, defenseOption, gameplanGoal, gameplanOf, gameplanPlan, gameplanThrow, keptGap, moveWeight, toGameplanMove, upSpecialFirst } from "./botGameplan";
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

test("every declared gameplan names key moves and an ordered range band", () => {
  for (const character of SELECTABLE_CHARACTERS) {
    const plan = gameplanOf(character);
    if (plan === undefined) continue;
    // A declared gameplan names at least one key move, a range band and a recovery route.
    assertTrue(gameplanKeyMoves(plan).length > 0);
    assertTrue(plan.range.near <= plan.range.far);
  }
});

test("a gameplan's plan stretch is fixed for 40 frames and spreads by weight", () => {
  const { f } = pair(150.0);
  const counts = [0, 0, 0];
  for (let stretch = 0; stretch < 400; stretch++) {
    const plan = gameplanPlan(SPACER, f, 0, stretch * 40, botChoice);
    assertEquals(gameplanPlan(SPACER, f, 0, stretch * 40 + 39, botChoice), plan);
    counts[plan + 1] = (counts[plan + 1] ?? 0) + 1;
  }
  // Spacing 2, jump-in 1, shooting 2: every plan comes up, spacing and shooting about equally.
  for (const count of counts) assertTrue(count > 40);
});

test("the kept gap follows the plan and the avoided situations", () => {
  const { f, target } = pair(300.0);
  for (let frame = 0; frame < 4000; frame += 40) {
    const spacing = keptGap(SPACER, f, target, 0, SPACE_PLAN, frame, botChoice);
    assertTrue(spacing >= 120.0 && spacing <= 200.0);
  }
  // Jumping in, a fighter that avoids close range stops at the near end; shooting keeps the far end.
  assertEquals(keptGap(SPACER, f, target, 0, 0, 0, botChoice), 120.0);
  assertEquals(keptGap(SPACER, f, target, 0, 1, 0, botChoice), 200.0);
  // A raised shield on the ground draws a plan in to grab, unless it avoids close range.
  target.shield.raised = true;
  assertEquals(keptGap(SPACER, f, target, 0, 1, 0, botChoice), 200.0);
  assertEquals(keptGap({ ...SPACER, avoid: [] }, f, target, 0, 1, 0, botChoice), 0.0);
  target.shield.raised = false;
  // It keeps its side of the target and stays clear of the edge.
  assertEquals(gameplanGoal(SPACER, f, target, 0, 150.0), 150.0);
  target.motion.x = 2000.0;
  assertTrue(gameplanGoal(SPACER, f, target, 0, 0.0) < 2000.0);
});

test("spacing tools, approach moves, follow-ups and finishers outweigh unnamed moves", () => {
  const { f, target } = pair(120.0);
  assertEquals(moveWeight(SPACER, SPACE_PLAN, f, 0, target, AttackStyle.jab), 1);
  assertEquals(moveWeight(SPACER, SPACE_PLAN, f, 0, target, AttackStyle.backAir), 4);
  assertEquals(moveWeight(SPACER, 0, f, 0, target, AttackStyle.backAir), 12);
  assertEquals(moveWeight(SPACER, SPACE_PLAN, f, 0, target, AttackStyle.downTilt), 2);
  target.launch.hitstun = 20;
  target.hits.lastAttacker = 0;
  assertEquals(moveWeight(SPACER, SPACE_PLAN, f, 0, target, AttackStyle.upAir), 4);
  assertEquals(moveWeight(SPACER, SPACE_PLAN, f, 0, target, AttackStyle.downTilt), 1);
  target.status.damage = 110.0;
  assertEquals(moveWeight(SPACER, SPACE_PLAN, f, 0, target, AttackStyle.backAir), 24);
});

test("a held grab throws for the kill in its window, else into a combo", () => {
  const { target } = pair(50.0);
  target.status.damage = 40.0;
  assertEquals(gameplanThrow(SPACER, target, 3, botChoice), GameplanThrow.up);
  target.status.damage = 150.0;
  assertEquals(gameplanThrow(SPACER, target, 3, botChoice), GameplanThrow.back);
  target.status.damage = 250.0;
  assertEquals(gameplanThrow(SPACER, target, 3, botChoice), GameplanThrow.up);
  assertEquals(gameplanThrow({ ...SPACER, combos: [], kills: [] }, target, 3, botChoice), undefined);
});

test("defense and recovery follow the declared answers and route", () => {
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

test("computer options map onto gameplan moves", () => {
  assertEquals(toGameplanMove(AttackStyle.backAir), AttackStyle.backAir);
  assertEquals(toGameplanMove(31), GameplanSpecial.side);
});

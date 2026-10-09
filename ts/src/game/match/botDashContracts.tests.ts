import { f32 } from "wisp/src/sim/f32";
import { at } from "wisp/src/runtime/lookup";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { sweep } from "../../runtime/sweep";
import { attackBuffer } from "../input/attackBuffer";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { neutralControls } from "../sim/roster";
import { collectDashCalibration, collectTechnicalCalibration, dashPercentile } from "./botDashCalibration";
import { commitBotDirection, createBotMemory } from "./botPerception";
import { CPU_TIERS, cpuProfile } from "./cpuProfiles";
import { useMatchSeed } from "./botRandom";
import { executeBotTechnique } from "./botTechnicalExecution";

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

test("neutral braking is immediate and cannot bypass the four-frame reversal floor [spec #356]", () => {
  const memory = createBotMemory();
  const input = neutralControls();
  input.direction = 1;
  commitBotDirection(memory, 0, 1, input);
  input.direction = 0;
  commitBotDirection(memory, 0, 2, input);
  assertEquals(input.direction, 0);
  input.direction = -1;
  commitBotDirection(memory, 0, 3, input);
  assertEquals(input.direction, 1);
});

test("a missed wavedash preparation can legally become a roll [spec #356]", () => {
  const fighter = createFighter(Character.rifleman, 0.0, 1);
  const input = neutralControls();
  const commands = attackBuffer(0);
  const policy = { ...cpuProfile("wren", "expert"), executionPercent: 0 };
  let rolls = 0;
  useMatchSeed(817);
  for (let frame = 1; frame <= 40; frame++) {
    input.direction = -1;
    input.jumpPressed = true;
    input.airDodgePressed = true;
    input.groundDodgePressed = false;
    if (executeBotTechnique(fighter, input, commands, frame, 0, policy) === "wrongOption") {
      assertTrue(input.shield && input.groundDodgePressed);
      assertEquals(input.groundDodgeDirection, -1);
      assertTrue(!input.jumpPressed && !input.airDodgePressed);
      rolls++;
    }
  }
  useMatchSeed(0);
  assertTrue(rolls > 0);
});

sweep("production turns meet human intervals and run rates over 2000 reversals per level [spec #356]", () => {
  let previousMedian = 100;
  let previousRuns = 1000;
  for (const tier of CPU_TIERS) {
    const row = collectDashCalibration(tier);
    const minimum = dashPercentile(row, 0);
    const median = dashPercentile(row, 5);
    const runsPerMinute = f32(f32(row.runs * 3600.0) / row.frames);
    check(row.intervals.length >= 2000, `${tier}: ${row.intervals.length} reversals`);
    check(minimum >= 4, `${tier}: minimum ${minimum}`);
    const intendedMedian = at([8.0, 7.0, 6.0, 5.5, 5.0], CPU_TIERS.indexOf(tier));
    check(Math.abs(median - intendedMedian) <= 0.5, `${tier}: median ${median}, wanted ${intendedMedian} ± 0.5`);
    check(median <= previousMedian, `${tier}: median ${median} above ${previousMedian}`);
    check(runsPerMinute <= previousRuns, `${tier}: run rate ${runsPerMinute} above ${previousRuns}`);
    if (tier === "rookie") assertTrue(runsPerMinute <= 4.0);
    if (tier === "expert") {
      assertTrue(median >= 4.5 && median <= 5.5);
      check(runsPerMinute >= 0.699999988079071 && runsPerMinute <= 1.5, `Expert: ${runsPerMinute} unintended runs/minute`);
    }
    previousMedian = median;
    previousRuns = runsPerMinute;
  }
});

sweep("Expert technical slips stay at 2–5 percent and include wrong options through production input [spec #356]", () => {
  const row = collectTechnicalCalibration("expert");
  check(row.inputs >= 2000, `${row.inputs} technical inputs`);
  check(row.slips * 100 >= row.inputs * 2 && row.slips * 100 <= row.inputs * 5, `${row.slips}/${row.inputs} slips`);
  assertTrue(row.wrongOptions > 0);
});

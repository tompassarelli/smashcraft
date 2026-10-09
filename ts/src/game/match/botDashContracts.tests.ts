import { at } from "wisp/src/runtime/lookup";
import { assertEquals, assertTrue, test } from "wisp/src/runtime/testing";
import { sweep } from "../../runtime/sweep";
import { attackBuffer } from "../input/attackBuffer";
import { Character } from "../sim/codes";
import { createFighter } from "../sim/fighter";
import { neutralControls } from "../sim/roster";
import { collectTechnicalCalibration } from "./botDashCalibration";
import { cpuProfile } from "./cpuProfiles";
import { useMatchSeed } from "./botRandom";
import { executeBotTechnique } from "./botTechnicalExecution";

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

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

sweep("Expert frame-tight technical slips stay at 10–15 percent and include wrong options [spec #356]", () => {
  const row = collectTechnicalCalibration("expert");
  check(row.inputs >= 2000, `${row.inputs} technical inputs`);
  check(row.slips * 100 >= row.inputs * 10 && row.slips * 100 <= row.inputs * 15, `${row.slips}/${row.inputs} slips`);
  assertTrue(row.wrongOptions > 0);
});

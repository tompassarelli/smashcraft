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

sweep("Expert frame-tight technical slips stay at 10–15 percent and include wrong options [k3 measure #356]", () => {
  const row = collectTechnicalCalibration("expert");
  check(row.inputs >= 2000, `${row.inputs} technical inputs`);
  check(row.slips * 100 >= row.inputs * 10 && row.slips * 100 <= row.inputs * 15, `${row.slips}/${row.inputs} slips`);
  assertTrue(row.wrongOptions > 0);
});

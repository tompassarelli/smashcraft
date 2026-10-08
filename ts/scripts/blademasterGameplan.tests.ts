// Blademaster's computer plays his declared gameplan (#105 box 2): its spacing
// tools are among his most-started moves in its mirror on
// every soak stage.
import { expect } from "bun:test";
import { sweep } from "../test/sweep";
import { Character } from "../src/game/sim/codes";
import { gameplanKeyMovesCheck } from "./cpuField";

sweep("Blademaster's computer leans on his declared spacing tools [spec #105]", () => {
  const check = gameplanKeyMovesCheck(Character.blademaster);
  expect(check.missingNames).toEqual([]);
}, 60000);

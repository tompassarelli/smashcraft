// Illidan's computer plays his declared gameplan (#105 box 2): its spacing
// tools are among his most-started moves in its mirror on
// every soak stage.
import { expect } from "bun:test";
import { sweep } from "../test/sweep";
import { Character } from "../src/game/sim/codes";
import { gameplanKeyMovesCheck } from "./cpuField";

sweep("Illidan's computer leans on his declared spacing tools", () => {
  const check = gameplanKeyMovesCheck(Character.demonHunter);
  expect(check.missingNames).toEqual([]);
}, 60000);

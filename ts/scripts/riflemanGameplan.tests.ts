// Rifleman's computer plays his declared gameplan (#105 box 2): its spacing
// tools (blaster, bear, trap and down tilt) are among his most-started moves in its
// mirror on every soak stage.
import { expect } from "bun:test";
import { sweep } from "../test/sweep";
import { Character } from "../src/game/sim/codes";
import { gameplanKeyMovesCheck } from "./cpuField";

sweep("Rifleman's computer leans on his declared spacing tools [spec #105] [repro #242]", () => {
  const check = gameplanKeyMovesCheck(Character.rifleman);
  expect(check.missingNames).toEqual([]);
}, 60000);

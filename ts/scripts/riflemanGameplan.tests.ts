// Rifleman's computer plays his declared gameplan (#105 box 2): its spacing
// tools (blaster, bear, trap and down tilt) are among his most-started moves in its
// mirror on every soak stage.
import { expect, test } from "bun:test";
import { Character } from "../src/game/sim/codes";
import { gameplanKeyMovesCheck } from "./cpuField";

test("Rifleman's computer leans on his declared spacing tools", () => {
  const check = gameplanKeyMovesCheck(Character.rifleman);
  expect(check.missingNames).toEqual([]);
}, 60000);

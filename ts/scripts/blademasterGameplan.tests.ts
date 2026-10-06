// Blademaster's computer plays his declared gameplan (#105 box 2): its spacing
// tools are among his most-started moves in its mirror on
// every soak stage.
import { expect, test } from "bun:test";
import { Character } from "../src/game/sim/codes";
import { gameplanKeyMovesCheck } from "./cpuField";

test("Blademaster's computer leans on his declared spacing tools", () => {
  const check = gameplanKeyMovesCheck(Character.blademaster);
  expect(check.missingNames).toEqual([]);
}, 60000);

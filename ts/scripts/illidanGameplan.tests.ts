// Illidan's computer plays his declared gameplan (#105 box 2): its spacing
// tools are among his most-started moves against the field, in the soak's
// one-stock, one-minute matches on every soak stage.
import { expect, test } from "bun:test";
import { Character } from "../src/game/sim/codes";
import { gameplanKeyMovesCheck } from "./cpuField";

test("Illidan's computer leans on his declared spacing tools", () => {
  const check = gameplanKeyMovesCheck(Character.demonHunter, { options: { stocks: 1, minutes: 1 } });
  expect(check.missingNames).toEqual([]);
}, 60000);

// Archer's computer plays his declared gameplan (#105 box 2): its spacing
// tools (arrows, Multishot and forward air) are among his most-started moves against the
// field, in one-stock, one-minute matches on three soak stages.
import { expect, test } from "bun:test";
import { Character } from "../src/game/sim/codes";
import { gameplanKeyMovesCheck } from "./cpuField";

test("Archer's computer leans on his declared spacing tools", () => {
  const check = gameplanKeyMovesCheck(Character.archer, { options: { stocks: 1, minutes: 1, stages: ["sky-deck", "frozen-throne", "hellfire"] } });
  expect(check.missingNames).toEqual([]);
}, 60000);

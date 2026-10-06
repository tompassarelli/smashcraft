import { expect, test } from "bun:test";
import { Character } from "../src/game/sim/codes";
import { gameplanKeyMovesCheck } from "./cpuField";

// #105 box 2: Uther's computer plays his spacing tools (Hammer Sweep, Low Judgment, Holy Light) among its six most-used moves.
test("Uther's computer uses his declared key moves most", () => {
  const check = gameplanKeyMovesCheck(Character.uther);
  expect(check.missingNames).toEqual([]);
}, 120_000);

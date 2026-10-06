import { expect, test } from "bun:test";
import { Character } from "../src/game/sim/codes";
import { gameplanKeyMovesCheck } from "./cpuField";

// #105 box 2: Mountain King's computer plays his spacing tools (Axe Hook, Boot and Axe, Storm Bolt) among its six most-used moves.
test("Mountain King's computer uses his declared key moves most", () => {
  const check = gameplanKeyMovesCheck(Character.mountainKing);
  expect(check.missingNames).toEqual([]);
}, 120_000);

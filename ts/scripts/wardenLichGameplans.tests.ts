// #105 box 2 for Warden and Lich: the computer playing each declared
// gameplan uses its key moves (its spacing tools) among its six most-used
// in its mirror on every soak stage.
import { expect, test } from "bun:test";
import { Character } from "../src/game/sim/codes";
import { gameplanKeyMovesCheck } from "./cpuField";

for (const [name, character] of [["Warden", Character.warden], ["Lich", Character.lich]] as const) {
  // About 3.5-4.5 s alone; a loaded host takes a test several times that, past Bun's 5 s default.
  test(`${name}'s computer uses its gameplan's key moves most`, () => {
    const check = gameplanKeyMovesCheck(character);
    expect(check.missingNames).toEqual([]);
  }, 60_000);
}

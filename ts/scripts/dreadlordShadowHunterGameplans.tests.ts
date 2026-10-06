// #105 box 2 for Dreadlord and Shadow Hunter: the computer playing each
// declared gameplan uses its key moves (its spacing tools) among its most
// used in its mirror on every soak stage (gameplanKeyMovesCheck's default:
// top 8, a margin over the four or five tools each declares).
import { expect, test } from "bun:test";
import { Character } from "../src/game/sim/codes";
import { gameplanKeyMovesCheck } from "./cpuField";

for (const [name, character] of [["Dreadlord", Character.dreadlord], ["Shadow Hunter", Character.shadowHunter]] as const) {
  test(`${name}'s computer uses his gameplan's key moves most`, () => {
    const check = gameplanKeyMovesCheck(character);
    expect(check.missingNames).toEqual([]);
  }, 60_000);
}

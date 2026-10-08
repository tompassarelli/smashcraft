// #105's key-move check for the Tavern heroes (#121): the computer playing
// each declared gameplan uses its key moves (its spacing tools) among its
// most used in its mirror on every soak stage (gameplanKeyMovesCheck's
// default: top 8).
import { expect } from "bun:test";
import { sweep } from "../test/sweep";
import { Character } from "../src/game/sim/codes";
import { gameplanKeyMovesCheck } from "./cpuField";

for (const [name, character] of [["Pit Lord", Character.pitLord], ["Beastmaster", Character.beastmaster]] as const) {
  sweep(`${name}'s computer uses his gameplan's key moves most [spec #105]`, () => {
    const check = gameplanKeyMovesCheck(character);
    expect(check.missingNames).toEqual([]);
  }, 60_000);
}

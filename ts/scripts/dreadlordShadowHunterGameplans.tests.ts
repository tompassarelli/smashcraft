// #105 box 2 for Dreadlord and Shadow Hunter: the computer playing each
// declared gameplan uses its key moves (its spacing tools) among its six
// most-used against the field.
import { expect, test } from "bun:test";
import { Character } from "../src/game/sim/codes";
import { gameplanKeyMovesCheck } from "./cpuField";

const options = { stages: ["sky-deck", "three-bridges"], stocks: 1, minutes: 2 } as const;

for (const [name, character] of [["Dreadlord", Character.dreadlord], ["Shadow Hunter", Character.shadowHunter]] as const) {
  test(`${name}'s computer uses his gameplan's key moves most`, () => {
    const check = gameplanKeyMovesCheck(character, { options });
    expect(check.missingNames).toEqual([]);
  }, 60_000);
}

// #105 box 2 for Dreadlord and Shadow Hunter: the computer playing each
// declared gameplan uses its key moves (its spacing tools) among its most
// used against the field. Every stage keeps the sample large and the top 8
// leaves a margin over the four or five tools each declares, so another
// fighter's gameplan change doesn't flip the ranking.
import { expect, test } from "bun:test";
import { Character } from "../src/game/sim/codes";
import { gameplanKeyMovesCheck } from "./cpuField";

const options = { stocks: 1, minutes: 2 } as const;

for (const [name, character] of [["Dreadlord", Character.dreadlord], ["Shadow Hunter", Character.shadowHunter]] as const) {
  test(`${name}'s computer uses his gameplan's key moves most`, () => {
    const check = gameplanKeyMovesCheck(character, { options, top: 8 });
    expect(check.missingNames).toEqual([]);
  }, 60_000);
}

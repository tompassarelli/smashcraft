// #105 box 2 for Dreadlord and Shadow Hunter: the computer playing each
// declared gameplan uses its key moves among its most
// used in its mirror on every soak stage (gameplanKeyMovesCheck's default:
// top 8, a margin over the four or five tools each declares).
import { expect } from "bun:test";
import { sweep } from "../test/sweep";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { GameplanSpecial } from "../src/game/sim/gameplan";
import { gameplanKeyMovesCheck } from "./cpuField";

for (const [name, character] of [["Dreadlord", Character.dreadlord], ["Shadow Hunter", Character.shadowHunter]] as const) {
  sweep(`${name}'s computer uses his gameplan's key moves most [spec #105]`, () => {
    // Corkscrew pounce covers the forward approach; Sleep is his setup tool.
    const check = character === Character.dreadlord
      ? gameplanKeyMovesCheck(character, { key: [GameplanSpecial.side, GameplanSpecial.down, AttackStyle.grab, AttackStyle.neutralAir] })
      : gameplanKeyMovesCheck(character);
    expect(check.missingNames).toEqual([]);
  }, 60_000);
}

import { expect } from "bun:test";
import { sweep } from "./sweep";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { GameplanSpecial } from "../src/game/sim/gameplan";
import { gameplanKeyMovesCheck } from "../scripts/cpuField";

sweep("Dreadlord's computer uses each key move above the mean move share over three seeds of mirrors on every soak stage [k3 measure #105]", () => {
  const check = gameplanKeyMovesCheck(Character.dreadlord, {
    key: [GameplanSpecial.side, GameplanSpecial.down, AttackStyle.grab, AttackStyle.neutralAir], options: { seeds: 3 } });
  const below = check.keyShares.filter(({ share }) => share < check.meanShare).map(({ name }) => name);
  expect(below).toEqual([]);
}, 120_000);

sweep("Shadow Hunter's computer uses his gameplan's key moves most [k3 measure #105]", () => {
  expect(gameplanKeyMovesCheck(Character.shadowHunter).missingNames).toEqual([]);
}, 60_000);

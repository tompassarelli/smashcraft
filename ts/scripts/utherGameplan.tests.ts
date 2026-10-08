import { expect } from "bun:test";
import { sweep } from "../test/sweep";
import { AttackStyle, Character } from "../src/game/sim/codes";
import { GameplanSpecial } from "../src/game/sim/gameplan";
import { gameplanKeyMovesCheck } from "./cpuField";

// #105's original four keys retain its top-eight rule. The #216 patch supports
// those hammer tools and has a 150-frame cooldown; it must be used, not spammed.
sweep("Uther's computer favors his four hammer tools and uses Consecration", () => {
  const check = gameplanKeyMovesCheck(Character.uther, { key: [
    AttackStyle.forwardTilt,
    GameplanSpecial.neutral,
    GameplanSpecial.side,
    AttackStyle.downTilt,
  ] });
  expect(check.missingNames).toEqual([]);
  expect(check.usage.find((use) => use.move === GameplanSpecial.down)?.count ?? 0).toBeGreaterThan(0);
}, 120_000);

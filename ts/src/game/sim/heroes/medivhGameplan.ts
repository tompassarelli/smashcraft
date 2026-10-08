import { AttackStyle } from "../codes";
import { GameplanSpecial, GameplanThrow, type FighterGameplan } from "../gameplan";

export const MEDIVH_GAMEPLAN: FighterGameplan = {
  range: { near: 100.0, far: 250.0 },
  spacing: [
    { move: GameplanSpecial.neutral, near: 125.0, far: 240.0 },
    { move: GameplanSpecial.side, near: 190.0, far: 285.0 },
    { move: AttackStyle.forwardTilt, near: 75.0, far: 125.0 },
  ],
  approach: [{ via: "jump", moves: [AttackStyle.forwardAir, AttackStyle.neutralAir], weight: 6 }, { via: "shoot", moves: [GameplanSpecial.neutral] }],
  defense: ["stance", "retreat", "shield", "roll", "jump"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.upAir, AttackStyle.forwardAir] },
    { starter: GameplanSpecial.neutral, followUps: [AttackStyle.upAir, AttackStyle.forwardAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.downTilt, GameplanSpecial.neutral] },
  ],
  kills: [{ move: AttackStyle.forwardSmash, fromPercent: 95 }, { move: AttackStyle.backAir, fromPercent: 110 }],
  recovery: { aim: "ledge", upSpecial: "last" }, avoid: ["close", "below", "edge"],
};

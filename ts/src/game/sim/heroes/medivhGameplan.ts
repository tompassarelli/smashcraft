import { AttackStyle } from "../codes";
import { GameplanSpecial, GameplanThrow, type FighterGameplan } from "../gameplan";

export const MEDIVH_GAMEPLAN: FighterGameplan = {
  range: { near: 100.0, far: 250.0 },
  spacing: [
    { move: GameplanSpecial.neutral, near: 125.0, far: 240.0 },
    { move: GameplanSpecial.side, near: 160.0, far: 240.0 },
    { move: GameplanSpecial.down, near: 0.0, far: 75.0 },
    { move: AttackStyle.forwardTilt, near: 75.0, far: 125.0 },
  ],
  approach: [{ via: "shoot", moves: [GameplanSpecial.neutral, GameplanSpecial.side] }, { via: "jump", moves: [AttackStyle.forwardAir, AttackStyle.neutralAir] }],
  defense: ["stance", "retreat", "shield", "roll", "jump"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.upAir, AttackStyle.forwardAir] },
    { starter: GameplanSpecial.neutral, followUps: [AttackStyle.upAir, AttackStyle.forwardAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.downTilt, GameplanSpecial.neutral] },
  ],
  kills: [{ move: AttackStyle.forwardSmash, fromPercent: 95 }, { move: AttackStyle.backAir, fromPercent: 110 }],
  recovery: { aim: "ledge", upSpecial: "last" }, avoid: ["close", "below", "edge"],
};

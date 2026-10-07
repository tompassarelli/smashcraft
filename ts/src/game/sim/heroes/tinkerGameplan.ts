import { AttackStyle } from "../codes";
import { GameplanSpecial, GameplanThrow, type FighterGameplan } from "../gameplan";

export const TINKER_GAMEPLAN: FighterGameplan = {
  range: { near: 75, far: 150 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 60, far: 115 },
    { move: AttackStyle.downTilt, near: 45, far: 100 },
    { move: GameplanSpecial.neutral, near: 160, far: 390 },
    { move: GameplanSpecial.side, near: 230, far: 440 },
    { move: GameplanSpecial.down, near: 70, far: 145 },
  ],
  approach: [
    { via: "shoot", moves: [GameplanSpecial.side, GameplanSpecial.neutral], weight: 3 },
    { via: "run", moves: [AttackStyle.forwardTilt, AttackStyle.downTilt, GameplanSpecial.down, AttackStyle.grab], weight: 2 },
    { via: "jump", moves: [AttackStyle.neutralAir, AttackStyle.forwardAir], weight: 1 },
  ],
  defense: ["shield", "retreat", "roll"],
  combos: [
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir] },
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardAir, AttackStyle.grab] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.dashAttack, AttackStyle.forwardTilt] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 105 },
    { move: AttackStyle.upSmash, fromPercent: 115 },
    { move: GameplanSpecial.down, fromPercent: 120 },
    { move: AttackStyle.backAir, fromPercent: 135 },
  ],
  recovery: { aim: "ledge", upSpecial: "last" }, avoid: ["edge", "close"],
};

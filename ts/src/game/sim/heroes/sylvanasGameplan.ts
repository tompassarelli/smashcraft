import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";

export const SYLVANAS_GAMEPLAN: FighterGameplan = {
  range: { near: 110, far: 190 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 80, far: 130 },
    { move: AttackStyle.downTilt, near: 55, far: 100 },
    { move: GameplanSpecial.side, near: 100, far: 170 },
    { move: GameplanSpecial.neutral, near: 190, far: 480 },
    { move: GameplanSpecial.down, near: 30, far: 85 },
  ],
  approach: [
    { via: "shoot", moves: [GameplanSpecial.neutral, GameplanSpecial.side], weight: 3 },
    { via: "run", moves: [AttackStyle.forwardTilt, AttackStyle.downTilt, AttackStyle.grab, GameplanSpecial.down], weight: 2 },
    { via: "jump", moves: [AttackStyle.forwardAir, AttackStyle.neutralAir], weight: 1 },
  ],
  defense: ["retreat", "shield", "roll"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.upAir, AttackStyle.forwardAir] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.forwardTilt, AttackStyle.grab] },
  ],
  kills: [{ move: AttackStyle.forwardSmash, fromPercent: 100 }, { move: AttackStyle.backAir, fromPercent: 120 }, { move: AttackStyle.upSmash, fromPercent: 120 }],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["edge"],
};

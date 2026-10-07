import { AttackStyle } from "../codes";
import { GameplanSpecial, GameplanThrow, type FighterGameplan } from "../gameplan";

export const CAIRNE_GAMEPLAN: FighterGameplan = {
  range: { near: 110.0, far: 165.0 },
  spacing: [{ move: AttackStyle.forwardTilt, near: 105.0, far: 180.0 },
    { move: GameplanSpecial.side, near: 70.0, far: 210.0 },
    { move: GameplanSpecial.neutral, near: 210.0, far: 450.0 }],
  approach: [{ via: "shoot", moves: [GameplanSpecial.neutral, AttackStyle.forwardTilt], weight: 2 },
    { via: "run", moves: [GameplanSpecial.side, AttackStyle.grab, AttackStyle.downTilt], weight: 2 }],
  defense: ["shield", "retreat", "shield", "jump"],
  combos: [{ starter: AttackStyle.downTilt, followUps: [AttackStyle.upTilt, AttackStyle.upAir] },
    { starter: GameplanSpecial.side, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [GameplanSpecial.side, AttackStyle.forwardTilt] }],
  kills: [{ move: AttackStyle.forwardSmash, fromPercent: 70.0 }, { move: AttackStyle.upSmash, fromPercent: 90.0 },
    { move: AttackStyle.forwardAir, fromPercent: 95.0 }, { move: GameplanThrow.back, fromPercent: 100.0 }],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["edge", "air"],
};

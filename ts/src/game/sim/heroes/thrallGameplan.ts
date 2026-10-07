import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";

export const THRALL_GAMEPLAN: FighterGameplan = {
  range: { near: 75.0, far: 140.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 70.0, far: 145.0 },
    { move: AttackStyle.downTilt, near: 30.0, far: 120.0 },
    { move: GameplanSpecial.down, near: 45.0, far: 130.0 },
    { move: GameplanSpecial.side, near: 150.0, far: 330.0 },
    { move: GameplanSpecial.neutral, near: 180.0, far: 480.0 },
  ],
  approach: [
    { via: "shoot", moves: [GameplanSpecial.neutral, GameplanSpecial.side], weight: 2 },
    { via: "run", moves: [AttackStyle.grab, AttackStyle.downTilt, AttackStyle.dashAttack, GameplanSpecial.down], weight: 2 },
  ],
  defense: ["shield", "spotDodge", "retreat"],
  combos: [
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardTilt, AttackStyle.grab] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.dashAttack, AttackStyle.upTilt] },
  ],
  kills: [{ move: AttackStyle.forwardSmash, fromPercent: 80.0 }, { move: AttackStyle.backAir, fromPercent: 90.0 }, { move: AttackStyle.upSmash, fromPercent: 90.0 }, { move: GameplanThrow.back, fromPercent: 110.0 }],
  recovery: { aim: "ledge", upSpecial: "last" }, avoid: ["edge", "air"],
};

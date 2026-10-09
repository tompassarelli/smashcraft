





import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";

export const MOUNTAIN_KING_GAMEPLAN: FighterGameplan = {
  range: { near: 80.0, far: 130.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 70.0, far: 130.0 },
    { move: AttackStyle.downTilt, near: 40.0, far: 95.0 },

    { move: GameplanSpecial.neutral, near: 200.0, far: 500.0 },
  ],
  approach: [

    { via: "shoot", moves: [GameplanSpecial.neutral], weight: 2 },
    { via: "run", moves: [AttackStyle.grab, AttackStyle.downTilt, AttackStyle.dashAttack], weight: 2 },
  ],

  defense: ["shield", "shield", "spotDodge"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.upTilt, AttackStyle.forwardTilt, AttackStyle.grab] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.upTilt, AttackStyle.upAir] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 80.0 },
    { move: AttackStyle.upSmash, fromPercent: 90.0 },
    { move: AttackStyle.backAir, fromPercent: 100.0 },
    { move: GameplanThrow.back, fromPercent: 120.0 },
  ],

  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["edge", "air"],
};

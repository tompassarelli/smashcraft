import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";

export const KOBOLD_GAMEPLAN: FighterGameplan = {
  range: { near: 60.0, far: 140.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 40.0, far: 85.0 },
    { move: AttackStyle.downTilt, near: 30.0, far: 70.0 },
    { move: GameplanSpecial.side, near: 110.0, far: 200.0 },
    { move: GameplanSpecial.neutral, near: 180.0, far: 330.0 },
    { move: GameplanSpecial.down, near: 0.0, far: 80.0 },
  ],
  approach: [
    { via: "run", moves: [AttackStyle.dashAttack, AttackStyle.downTilt, AttackStyle.grab], weight: 3 },
    { via: "jump", moves: [AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir], weight: 2 },
    { via: "shoot", moves: [GameplanSpecial.neutral], weight: 1 },
  ],
  defense: ["shield", "roll", "jump", "retreat"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.upAir, AttackStyle.forwardAir] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.dashAttack, GameplanSpecial.side] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 100.0 },
    { move: AttackStyle.upSmash, fromPercent: 110.0 },
    { move: AttackStyle.backAir, fromPercent: 120.0 },
  ],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["edge"],
};

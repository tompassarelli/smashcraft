import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";

export const ANUBARAK_GAMEPLAN: FighterGameplan = {
  range: { near: 95.0, far: 230.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 70.0, far: 145.0 },
    { move: AttackStyle.downTilt, near: 50.0, far: 135.0 },
    { move: GameplanSpecial.neutral, near: 190.0, far: 390.0 },
    { move: GameplanSpecial.side, near: 150.0, far: 240.0 },
    { move: GameplanSpecial.down, near: 190.0, far: 360.0 },
  ],
  approach: [{ via: "run", moves: [AttackStyle.downTilt, AttackStyle.forwardTilt, AttackStyle.grab], weight: 3 },
    { via: "shoot", moves: [GameplanSpecial.neutral, GameplanSpecial.down], weight: 3 },
    { via: "jump", moves: [AttackStyle.forwardAir, AttackStyle.neutralAir], weight: 1 }],
  defense: ["shield", "retreat", "roll", "jump"],
  combos: [{ starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir] },
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.dashAttack] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.forwardTilt, GameplanSpecial.neutral] }],
  kills: [{ move: AttackStyle.forwardSmash, fromPercent: 90.0 }, { move: AttackStyle.upSmash, fromPercent: 105.0 }, { move: AttackStyle.backAir, fromPercent: 115.0 }],
  recovery: { aim: "ledge", upSpecial: "last" }, avoid: ["edge"],
};

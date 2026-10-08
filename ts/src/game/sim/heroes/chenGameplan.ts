import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";
export const CHEN_GAMEPLAN: FighterGameplan = {
  range: { near: 40.0, far: 100.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 60.0, far: 130.0 },
    { move: AttackStyle.downTilt, near: 30.0, far: 105.0 },
    { move: GameplanSpecial.neutral, near: 60.0, far: 165.0 },
    { move: GameplanSpecial.side, near: 180.0, far: 350.0 },
  ],
  approach: [
    { via: "shoot", moves: [GameplanSpecial.side], weight: 1 },
    { via: "run", moves: [AttackStyle.forwardTilt, AttackStyle.grab, AttackStyle.dashAttack], weight: 5 },
    { via: "jump", moves: [AttackStyle.neutralAir, AttackStyle.forwardAir], weight: 3 },
  ],
  defense: ["stance"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.upTilt, AttackStyle.upAir] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.neutralAir] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.dashAttack, AttackStyle.forwardTilt] },
  ],
  kills: [{ move: AttackStyle.forwardSmash, fromPercent: 85.0 }, { move: AttackStyle.backAir, fromPercent: 100.0 }, { move: AttackStyle.upSmash, fromPercent: 105.0 }],
  recovery: { aim: "ledge", upSpecial: "last" }, avoid: ["below", "far"],
};

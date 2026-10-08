import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";
export const GROM_GAMEPLAN: FighterGameplan = {
  range: { near: 80.0, far: 160.0 },
  spacing: [{ move: AttackStyle.forwardTilt, near: 60.0, far: 128.0 }, { move: AttackStyle.downTilt, near: 35.0, far: 110.0 }, { move: GameplanSpecial.side, near: 140.0, far: 270.0 }, { move: GameplanSpecial.neutral, near: 0.0, far: 70.0 }],
  approach: [{ via: "run", moves: [AttackStyle.dashAttack, AttackStyle.downTilt, AttackStyle.grab, GameplanSpecial.side], weight: 3 }, { via: "jump", moves: [AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir], weight: 2 }],
  defense: ["shield", "roll", "jump"],
  combos: [{ starter: AttackStyle.downTilt, followUps: [AttackStyle.upAir, AttackStyle.forwardAir] }, { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir] }, { starter: GameplanSpecial.neutral, followUps: [AttackStyle.upAir, AttackStyle.forwardAir] }, { starter: GameplanThrow.down, followUps: [AttackStyle.dashAttack, GameplanSpecial.side] }],
  kills: [{ move: AttackStyle.forwardSmash, fromPercent: 90.0 }, { move: AttackStyle.backAir, fromPercent: 110.0 }, { move: GameplanSpecial.down, fromPercent: 85.0 }],
  recovery: { aim: "ledge", upSpecial: "last" }, avoid: ["edge"],
};

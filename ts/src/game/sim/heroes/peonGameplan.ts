import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";

export const PEON_GAMEPLAN: FighterGameplan = {
  range: { near: 160.0, far: 240.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 60.0, far: 120.0 },
    { move: AttackStyle.downTilt, near: 40.0, far: 95.0 },
    { move: GameplanSpecial.neutral, near: 160.0, far: 440.0 },
    { move: GameplanSpecial.side, near: 200.0, far: 420.0 },
  ],
  approach: [
    { via: "shoot", moves: [GameplanSpecial.side, GameplanSpecial.neutral], weight: 3 },
    { via: "run", moves: [AttackStyle.downTilt, AttackStyle.forwardTilt, AttackStyle.grab], weight: 2 },
    { via: "jump", moves: [AttackStyle.neutralAir, AttackStyle.forwardAir], weight: 1 },
  ],
  defense: ["stance", "stance", "stance", "retreat"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.upTilt, AttackStyle.forwardAir] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.forwardTilt, GameplanSpecial.neutral] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 90.0 },
    { move: AttackStyle.upSmash, fromPercent: 105.0 },
    { move: AttackStyle.forwardAir, fromPercent: 115.0 },
  ],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["close", "edge"],
};

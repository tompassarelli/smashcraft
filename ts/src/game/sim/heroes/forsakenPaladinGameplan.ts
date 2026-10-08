// Forsaken Paladin spaces a heavy hammer around a short, fixed holy patch.
import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";

export const FORSAKEN_PALADIN_GAMEPLAN: FighterGameplan = {
  range: { near: 120.0, far: 175.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 100.0, far: 170.0 },
    { move: GameplanSpecial.neutral, near: 50.0, far: 150.0 },
    { move: GameplanSpecial.down, near: 45.0, far: 130.0 },
    { move: AttackStyle.downTilt, near: 60.0, far: 110.0 },
  ],
  approach: [
    { via: "shoot", moves: [GameplanSpecial.down], weight: 1 },
    { via: "run", moves: [AttackStyle.forwardTilt, AttackStyle.grab], weight: 4 },
  ],
  defense: ["shield", "spotDodge"],
  combos: [
    { starter: GameplanSpecial.neutral, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.upTilt, AttackStyle.forwardTilt] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 80.0 },
    { move: AttackStyle.forwardAir, fromPercent: 100.0 },
    { move: AttackStyle.upSmash, fromPercent: 100.0 },
  ],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["below", "edge"],
};

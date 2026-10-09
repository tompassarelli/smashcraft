

import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";

export const BEASTMASTER_GAMEPLAN: FighterGameplan = {
  range: { near: 90.0, far: 160.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 90.0, far: 160.0 },
    { move: AttackStyle.downTilt, near: 50.0, far: 110.0 },
    { move: GameplanSpecial.side, near: 120.0, far: 260.0 },
    { move: GameplanSpecial.neutral, near: 180.0, far: 380.0 },
    { move: GameplanSpecial.down, near: 180.0, far: 400.0 },
  ],
  approach: [

    { via: "shoot", moves: [GameplanSpecial.down, GameplanSpecial.side, GameplanSpecial.up, GameplanSpecial.neutral], weight: 3 },
    { via: "run", moves: [AttackStyle.forwardTilt, AttackStyle.downTilt, AttackStyle.grab], weight: 2 },
    { via: "jump", moves: [AttackStyle.neutralAir, AttackStyle.forwardAir], weight: 1 },
  ],
  defense: ["shield", "retreat", "spotDodge"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardTilt, AttackStyle.grab, GameplanSpecial.side] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: GameplanSpecial.up, followUps: [AttackStyle.upAir, AttackStyle.forwardAir] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.forwardTilt, GameplanSpecial.side] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 90.0 },
    { move: AttackStyle.upSmash, fromPercent: 100.0 },
    { move: AttackStyle.forwardAir, fromPercent: 115.0 },
  ],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["close", "edge"],
};

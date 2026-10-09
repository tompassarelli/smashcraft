





import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";

export const PIT_LORD_GAMEPLAN: FighterGameplan = {
  range: { near: 120.0, far: 190.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 120.0, far: 195.0 },
    { move: AttackStyle.forwardTiltUp, near: 120.0, far: 190.0 },
    { move: GameplanSpecial.side, near: 150.0, far: 230.0 },
    { move: GameplanSpecial.down, near: 220.0, far: 370.0 },
  ],
  approach: [

    { via: "shoot", moves: [GameplanSpecial.down, AttackStyle.forwardTilt], weight: 2 },

    { via: "run", moves: [GameplanSpecial.side, AttackStyle.forwardTilt, AttackStyle.grab], weight: 2 },
  ],

  defense: ["shield", "shield", "retreat", "jump"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardTilt, AttackStyle.upTilt, AttackStyle.grab] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.forwardTilt, GameplanSpecial.neutral] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 70.0 },
    { move: AttackStyle.upSmash, fromPercent: 85.0 },
    { move: AttackStyle.forwardAir, fromPercent: 95.0 },
    { move: GameplanThrow.back, fromPercent: 110.0 },
  ],

  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["close", "edge", "air"],
};








import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";

export const BLADEMASTER_GAMEPLAN: FighterGameplan = {

  range: { near: 120.0, far: 190.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 110.0, far: 170.0 },
    { move: AttackStyle.downTilt, near: 80.0, far: 165.0 },
    { move: AttackStyle.forwardSmash, near: 150.0, far: 210.0 },
    { move: GameplanSpecial.side, near: 180.0, far: 260.0 },
  ],
  approach: [

    { via: "run", moves: [AttackStyle.dashAttack, AttackStyle.forwardTilt, AttackStyle.downTilt, GameplanSpecial.side], weight: 3 },
    { via: "jump", moves: [AttackStyle.forwardAir, AttackStyle.backAir], weight: 1 },
  ],
  defense: ["shield", "shield", "retreat", "roll", "spotDodge"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardTilt, AttackStyle.dashAttack, AttackStyle.grab] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upSmash] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 80.0 },
    { move: AttackStyle.backAir, fromPercent: 90.0 },
    { move: AttackStyle.upSmash, fromPercent: 100.0 },
  ],

  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["edge", "far", "below"],
};

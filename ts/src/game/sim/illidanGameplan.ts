






import { AttackStyle } from "./codes";
import { type FighterGameplan, GameplanThrow } from "./gameplan";

export const ILLIDAN_GAMEPLAN: FighterGameplan = {

  range: { near: 110.0, far: 200.0 },
  spacing: [
    { move: AttackStyle.forwardAir, near: 90.0, far: 195.0 },
    { move: AttackStyle.forwardSmash, near: 120.0, far: 215.0 },
    { move: AttackStyle.forwardTilt, near: 60.0, far: 155.0 },
  ],
  approach: [
    { via: "jump", moves: [AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.neutralAir], weight: 3 },
    { via: "run", moves: [AttackStyle.dashAttack, AttackStyle.forwardSmash, AttackStyle.grab], weight: 1 },
  ],
  defense: ["jump", "jump", "shield", "shield", "spotDodge"],
  combos: [
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.forwardAir] },
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardAir, AttackStyle.neutralAir, AttackStyle.dashAttack] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: AttackStyle.upAir, followUps: [AttackStyle.upAir] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 90.0 },
    { move: AttackStyle.backAir, fromPercent: 110.0 },
    { move: AttackStyle.upSmash, fromPercent: 100.0 },
  ],
  recovery: { aim: "mixed", upSpecial: "mixed" },
  avoid: ["close", "far"],
};

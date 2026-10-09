




import { f32 } from "wisp/src/sim/f32";
import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";

const h = (fraction: number): number => f32(HERO_REFERENCE_HEIGHT * fraction);

export const LICH_GAMEPLAN: FighterGameplan = {

  range: { near: h(f32(1.5)), far: h(f32(2.4)) },
  spacing: [

    { move: GameplanSpecial.side, near: h(f32(0.9)), far: h(f32(2.2)) },
    { move: GameplanSpecial.neutral, near: h(f32(1.2)), far: h(f32(4.0)) },

    { move: AttackStyle.forwardSmash, near: h(f32(0.9)), far: h(f32(1.5)) },
  ],

  approach: [{ via: "shoot", moves: [GameplanSpecial.neutral, GameplanSpecial.side, AttackStyle.forwardSmash] }],
  defense: ["retreat", "retreat", "shield", "roll", "stance", "jump"],
  combos: [
    { starter: GameplanSpecial.side, followUps: [AttackStyle.upAir, GameplanSpecial.neutral] },
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.upTilt, AttackStyle.forwardAir] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.upTilt, AttackStyle.forwardAir] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 85 },
    { move: AttackStyle.backAir, fromPercent: 100 },
    { move: GameplanSpecial.side, fromPercent: 120 },
  ],

  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["close", "below", "edge"],
};

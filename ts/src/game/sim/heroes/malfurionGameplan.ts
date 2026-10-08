import { f32 } from "wisp/src/sim/f32";
import { AttackStyle } from "../codes";
import { GameplanSpecial, GameplanThrow, type FighterGameplan } from "../gameplan";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";
const h = (n: number) => f32(HERO_REFERENCE_HEIGHT * f32(n));

export const MALFURION_GAMEPLAN: FighterGameplan = {
  range: { near: h(f32(1.6)), far: h(f32(2.8)) },
  spacing: [
    { move: GameplanSpecial.down, near: h(f32(1.8)), far: h(f32(4.0)) },
    { move: GameplanSpecial.side, near: 90.0, far: 230.0 },
    { move: GameplanSpecial.neutral, near: 140.0, far: 225.0 },
    { move: AttackStyle.forwardTilt, near: h(f32(0.6)), far: h(f32(1.0)) },
  ],
  approach: [{ via: "shoot", moves: [GameplanSpecial.down, GameplanSpecial.neutral, GameplanSpecial.side] }],
  defense: ["retreat", "retreat", "shield", "roll", "jump"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.upTilt, AttackStyle.forwardAir] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.forwardTilt, GameplanSpecial.side] },
  ],
  kills: [{ move: AttackStyle.forwardSmash, fromPercent: 95 }, { move: AttackStyle.backAir, fromPercent: 110 }, { move: AttackStyle.upAir, fromPercent: 120 }],
  recovery: { aim: "ledge", upSpecial: "last" }, avoid: ["close", "below", "edge"],
};

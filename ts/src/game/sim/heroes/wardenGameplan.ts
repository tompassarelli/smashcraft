// Warden's gameplan (sim/gameplan.ts, #105): precision mobility and edge
// pressure by a light fighter. She plays just outside her blades' medium
// reach, darts in with Pursuit Lunge, dash attack and Pursuer, pushes the
// target to the edge and finishes with Heel Blade or Judgment Edge. Blink's
// endpoint is punishable, so she spends her jump first and Blinks last.
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";

const h = (fraction: number): number => f32(HERO_REFERENCE_HEIGHT * fraction);

export const WARDEN_GAMEPLAN: FighterGameplan = {
  // Just past her medium reach: a step or a lunge from striking.
  range: { near: h(f32(0.7)), far: h(f32(1.4)) },
  spacing: [
    { move: GameplanSpecial.down, near: h(f32(0.65)), far: h(f32(1.3)) },
    { move: AttackStyle.forwardTilt, near: h(f32(0.4)), far: h(f32(1.0)) },
    // Pursuit Lunge travels 1.0H into a 0.8H slash.
    { move: GameplanSpecial.side, near: h(f32(0.9)), far: h(f32(1.8)) },
  ],
  approach: [
    { via: "run", moves: [AttackStyle.dashAttack, GameplanSpecial.side, AttackStyle.grab], weight: 2 },
    { via: "jump", moves: [AttackStyle.forwardAir, AttackStyle.neutralAir, AttackStyle.backAir], weight: 2 }
  ],
  defense: ["spotDodge", "roll", "jump", "shield"],
  combos: [
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upSmash] },
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardAir, AttackStyle.upTilt] },
    { starter: AttackStyle.upAir, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.forwardAir, AttackStyle.upAir] },
  ],
  kills: [
    { move: AttackStyle.backAir, fromPercent: 90 },
    { move: AttackStyle.forwardSmash, fromPercent: 95 },
    { move: AttackStyle.upSmash, fromPercent: 110 },
    // Edge pressure: Pursuer and Twin Crescent send low and outward.
    { move: AttackStyle.forwardAir, fromPercent: 120 },
    { move: AttackStyle.downSmash, fromPercent: 110 },
  ],
  recovery: { aim: "mixed", upSpecial: "last" },
  avoid: ["far", "below"],
};

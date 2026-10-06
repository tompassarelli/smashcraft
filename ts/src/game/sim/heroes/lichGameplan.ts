// Lich's gameplan (sim/gameplan.ts, #105): deliberate projectile placement
// from range by a frail, slow caster. He keeps the gap where Death and Decay's
// field lands on the target (centre 1.5H ahead, 0.75H radius) and a
// Frost Nova still flies, covers the approach with Ice Spear's XL reach, and
// backs out of close range rather than brawling with his slow normals.
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";
import { HERO_REFERENCE_HEIGHT } from "../heroMoves";

const h = (fraction: number): number => f32(HERO_REFERENCE_HEIGHT * fraction);

export const LICH_GAMEPLAN: FighterGameplan = {
  // Outside most forward tilts and dash attacks, inside the nova's far rim.
  range: { near: h(f32(1.5)), far: h(f32(2.4)) },
  spacing: [
    // Death and Decay reaches 0.75H-2.25H ahead of him, plus the target's body.
    { move: GameplanSpecial.side, near: h(f32(0.9)), far: h(f32(2.2)) },
    { move: GameplanSpecial.neutral, near: h(f32(1.2)), far: h(f32(4.0)) },
    // Ice Spear: the XL stationary spear that punishes a run-in.
    { move: AttackStyle.forwardSmash, near: h(f32(0.9)), far: h(f32(1.5)) },
  ],
  // He never runs in: he advances behind his shots.
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
  // Spectral Ascent rises far but lands helpless and exposed: jump first, ascend to the ledge.
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["close", "below", "edge"],
};

// Pit Lord's gameplan (#105; smashcraft:docs/design/roster.md, "Pit Lord"):
// the largest heavy holds the cleaver's tip spacing, makes the target act
// with Fel Spit and Ruin Charge's armor, and kills early with Annihilating
// Cleave. A fast fighter inside a missed cleave is his weakness, so he backs
// out of close range and keeps to the ground. Gaps are centre to centre: his
// XL cleaver reaches about 185 and a target's body adds about 25.
import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";

export const PIT_LORD_GAMEPLAN: FighterGameplan = {
  range: { near: 120.0, far: 190.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 120.0, far: 195.0 },
    { move: AttackStyle.forwardTiltUp, near: 120.0, far: 190.0 },
    { move: GameplanSpecial.side, near: 150.0, far: 230.0 },
    { move: GameplanSpecial.neutral, near: 220.0, far: 420.0 },
  ],
  approach: [
    // Fel Spit makes the target act; Cleaving Sweep claims the space behind it.
    { via: "shoot", moves: [GameplanSpecial.neutral, AttackStyle.forwardTilt], weight: 2 },
    // Ruin Charge's armor beats a jab or a single poke on the way in.
    { via: "run", moves: [GameplanSpecial.side, AttackStyle.forwardTilt, AttackStyle.grab], weight: 2 },
  ],
  // A huge shield, a roar to blunt the punish, then out to the cleaver's range.
  defense: ["shield", "shield", "retreat", "jump"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardTilt, AttackStyle.upTilt, AttackStyle.grab] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.forwardTilt, GameplanSpecial.down] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 70.0 },
    { move: AttackStyle.upSmash, fromPercent: 85.0 },
    { move: AttackStyle.forwardAir, fromPercent: 95.0 },
    { move: GameplanThrow.back, fromPercent: 110.0 },
  ],
  // The heaviest drift and slowest leap: he goes for the ledge with his jump first.
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["close", "edge", "air"],
};

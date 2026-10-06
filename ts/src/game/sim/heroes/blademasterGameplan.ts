// Blademaster's gameplan (#105; smashcraft:docs/design/roster.md, "Blademaster"):
// grounded sword spacing and whiff punishment. He stands just outside the
// opponent's reach at his blade's outer edge, where forward tilt and forward
// smash land their tip sweetspots, and runs in with a dash attack or a Wind Walk
// Backstab to punish a miss. Forward air is his jump-in, not his neutral.
// His weakness is an exposed recovery and weak ranged pressure, so he keeps
// the fight on the deck and away from its edges, and never camps at range.
import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";

export const BLADEMASTER_GAMEPLAN: FighterGameplan = {
  // Forward tilt's tip (L = 145 units) lands at a 120-170 gap; forward smash's (XL = 185) at 160-210.
  range: { near: 120.0, far: 190.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 110.0, far: 170.0 },
    { move: AttackStyle.downTilt, near: 80.0, far: 165.0 },
    { move: AttackStyle.forwardSmash, near: 150.0, far: 210.0 },
    { move: GameplanSpecial.side, near: 180.0, far: 260.0 },
  ],
  approach: [
    // Whiff punishment: a dash attack or a Wind Walk Backstab into the gap a missed move leaves.
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
  // Rising Blade has no intangibility: he keeps his jump and takes the ledge.
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["edge", "far", "below"],
};

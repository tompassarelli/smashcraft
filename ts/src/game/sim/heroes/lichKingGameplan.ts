// The Lich King's gameplan (#105, #167): a heavy swordsman who holds
// Frostmourne's tip spacing, makes the target act with Howling Blast and
// Defile, banks souls with clean normals, and kills with the smashes, his
// back air and a Val'kyr carry toward the ledge. Fast pressure and juggles
// are his weakness, so he backs out of close range and keeps to the ground.
// Gaps are centre to centre: his forward tilt reaches about 178 and a
// target's body adds about 25.
import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";

export const LICH_KING_GAMEPLAN: FighterGameplan = {
  range: { near: 110.0, far: 185.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 105.0, far: 190.0 },
    { move: AttackStyle.downTilt, near: 80.0, far: 150.0 },
    { move: GameplanSpecial.neutral, near: 200.0, far: 400.0 },
    { move: GameplanSpecial.side, near: 120.0, far: 260.0 },
  ],
  approach: [
    // Howling Blast makes the target act; Frostmourne Sweep claims the space behind it.
    { via: "shoot", moves: [GameplanSpecial.neutral, AttackStyle.forwardTilt], weight: 2 },
    // Defile denies the ground ahead, then the sweep or a grab punishes the jump over it.
    { via: "shoot", moves: [GameplanSpecial.down, AttackStyle.upTilt, AttackStyle.grab] },
    { via: "run", moves: [AttackStyle.dashAttack, AttackStyle.grab] },
  ],
  defense: ["shield", "retreat", "shield", "jump"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardTilt, AttackStyle.grab] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    // Harvest Soul banks a soul and starts a tech chase into Defile or the sweep.
    { starter: GameplanThrow.down, followUps: [AttackStyle.forwardTilt, GameplanSpecial.down] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 75.0 },
    { move: AttackStyle.upSmash, fromPercent: 90.0 },
    { move: AttackStyle.backAir, fromPercent: 100.0 },
    // Near the ledge the Val'kyr carries the target off it.
    { move: GameplanSpecial.side, fromPercent: 80.0 },
    { move: GameplanThrow.back, fromPercent: 120.0 },
  ],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["close", "air"],
};

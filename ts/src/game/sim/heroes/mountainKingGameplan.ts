// Mountain King's gameplan (sim/gameplan.ts, #105; smashcraft:docs/design/roster.md,
// "Mountain King"): a compact heavy who wins close reads with heavy hits and
// covers his slow approach with Storm Bolt. His weakness is limited air drift,
// so he fights on the ground (back air only as a finisher) away from the edge, where a launch leaves the
// shortest way back. Gaps are centre to centre: his medium reach is 106 and
// a target's body adds about 25.
import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";

export const MOUNTAIN_KING_GAMEPLAN: FighterGameplan = {
  range: { near: 80.0, far: 130.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 70.0, far: 130.0 },
    { move: AttackStyle.downTilt, near: 40.0, far: 95.0 },
    // Storm Bolt reaches about 580; past his reach it makes the target act.
    { move: GameplanSpecial.neutral, near: 200.0, far: 500.0 },
  ],
  approach: [
    // Storm Bolt makes the target act, then he walks in behind it.
    { via: "shoot", moves: [GameplanSpecial.neutral], weight: 2 },
    { via: "run", moves: [AttackStyle.grab, AttackStyle.downTilt, AttackStyle.dashAttack], weight: 2 },
  ],
  // A heavy shield, then the grab out of it; a spot dodge keeps him in place.
  defense: ["shield", "shield", "spotDodge"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.upTilt, AttackStyle.forwardTilt, AttackStyle.grab] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.upTilt, AttackStyle.upAir] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 80.0 },
    { move: AttackStyle.upSmash, fromPercent: 90.0 },
    { move: AttackStyle.backAir, fromPercent: 100.0 },
    { move: GameplanThrow.back, fromPercent: 120.0 },
  ],
  // The ledge needs less height than the deck; the jump's drift goes first and Thunder Leap last.
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["edge", "air"],
};

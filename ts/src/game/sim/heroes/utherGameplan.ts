// Uther's gameplan (sim/gameplan.ts, #105; smashcraft:docs/design/roster.md,
// "Uther"): a defensive paladin who holds space at his long hammer's reach and
// reads approaches. Holy Radiance makes the target come to him, Hammer Sweep meets
// it at its tip, Holy Hammer finishes, and Divine Shield answers a predictable
// strike. His weakness is a weak chase, so he never follows a target under
// it, and walks in only for a grab or Hammer Sweep. Gaps are centre to
// centre: his long reach is 145 and a target's body adds about 25.
import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";

export const UTHER_GAMEPLAN: FighterGameplan = {
  range: { near: 120.0, far: 175.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 100.0, far: 170.0 },
    { move: GameplanSpecial.neutral, near: 50.0, far: 150.0 },
    { move: GameplanSpecial.side, near: 220.0, far: 450.0 },
    { move: AttackStyle.downTilt, near: 60.0, far: 110.0 },
  ],
  approach: [
    { via: "shoot", moves: [GameplanSpecial.side], weight: 2 },
    { via: "run", moves: [AttackStyle.forwardTilt, AttackStyle.grab], weight: 2 },
  ],
  defense: ["stance", "stance", "stance", "spotDodge"],
  combos: [
    { starter: GameplanSpecial.neutral, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.upTilt, AttackStyle.forwardTilt] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 80.0 },
    { move: AttackStyle.forwardAir, fromPercent: 100.0 },
    { move: AttackStyle.upSmash, fromPercent: 100.0 },
  ],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["below", "edge"],
};

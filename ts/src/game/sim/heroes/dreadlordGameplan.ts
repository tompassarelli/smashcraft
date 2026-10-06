// Dreadlord's gameplan (#105): how his computer plays his identity, air
// movement, grabs and close pressure (smashcraft:docs/design/roster.md, "Dreadlord").
import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";

/**
 * Dreadlord's gameplan: air movement, grabs and close pressure. He closes in
 * the air (best air speed of the roster) with Batwing Turn and Talon Reach,
 * or runs in to a grab or Night Pounce, and stays close: he has no safe
 * long-range approach and his large body loses a spacing war. Sleep Orb
 * sets up a charged smash; throws start his juggles; Wing Backhand and the
 * smashes kill.
 */
export const DREADLORD_GAMEPLAN: FighterGameplan = {
  range: { near: 0, far: 130 },
  spacing: [
    { move: AttackStyle.neutralAir, near: 30, far: 125 },
    { move: AttackStyle.forwardAir, near: 90, far: 165 },
    { move: AttackStyle.grab, near: 0, far: 100 },
    { move: GameplanSpecial.side, near: 100, far: 170 },
  ],
  approach: [
    { via: "jump", moves: [AttackStyle.neutralAir, AttackStyle.forwardAir, AttackStyle.backAir], weight: 4 },
    { via: "run", moves: [AttackStyle.grab, GameplanSpecial.side, AttackStyle.dashAttack], weight: 2 },
  ],
  defense: ["shield", "shield", "jump", "spotDodge"],
  combos: [
    { starter: GameplanThrow.down, followUps: [AttackStyle.upAir, AttackStyle.neutralAir, AttackStyle.forwardAir] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: AttackStyle.neutralAir, followUps: [AttackStyle.grab, AttackStyle.upTilt] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.grab, AttackStyle.neutralAir] },
    { starter: GameplanSpecial.down, followUps: [AttackStyle.forwardSmash, AttackStyle.upSmash, AttackStyle.backAir] },
  ],
  kills: [
    { move: AttackStyle.backAir, fromPercent: 90 },
    { move: AttackStyle.forwardSmash, fromPercent: 100 },
    { move: AttackStyle.upSmash, fromPercent: 100 },
    { move: GameplanThrow.back, fromPercent: 120 },
  ],
  recovery: { aim: "mixed", upSpecial: "last" },
  avoid: ["far"],
};

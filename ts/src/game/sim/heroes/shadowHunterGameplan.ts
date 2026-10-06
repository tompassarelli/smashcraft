// Shadow Hunter's gameplan (#105): how his computer plays his identity, totem
// placement and angles (smashcraft:docs/design/roster.md, "Shadow Hunter").
import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";

/**
 * Shadow Hunter's gameplan: totem placement and angles. He sets a Serpent
 * Ward from range and fights beside it at the glaive's tip (Crescent Chop
 * and its angles, Low Crescent), with Spirit Glaive and Hex
 * from further out. He backs out of brawls and keeps off the edge: Loa
 * Vault's 0.6H drift is the shortest way back of any kit, so he avoids being
 * driven deep and returns to the ledge with his jump first.
 */
export const SHADOW_HUNTER_GAMEPLAN: FighterGameplan = {
  range: { near: 100, far: 180 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 100, far: 165 },
    { move: AttackStyle.forwardTiltUp, near: 100, far: 165 },
    { move: AttackStyle.forwardTiltDown, near: 100, far: 165 },
    { move: AttackStyle.downTilt, near: 60, far: 125 },
    { move: GameplanSpecial.side, near: 220, far: 450 },
    { move: GameplanSpecial.neutral, near: 180, far: 440 },
  ],
  approach: [
    { via: "shoot", moves: [GameplanSpecial.side, GameplanSpecial.neutral, GameplanSpecial.down], weight: 3 },
    { via: "run", moves: [AttackStyle.forwardTilt, AttackStyle.downTilt, AttackStyle.grab], weight: 2 },
    { via: "jump", moves: [AttackStyle.forwardAir, AttackStyle.neutralAir], weight: 1 },
  ],
  defense: ["retreat", "shield", "retreat", "roll"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardTilt, AttackStyle.grab, AttackStyle.forwardSmash] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.forwardTilt, AttackStyle.neutralAir] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 95 },
    { move: AttackStyle.upSmash, fromPercent: 105 },
    { move: AttackStyle.forwardAir, fromPercent: 130 },
  ],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["edge", "close"],
};

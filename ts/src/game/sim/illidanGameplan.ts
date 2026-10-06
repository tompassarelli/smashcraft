// Illidan's gameplan (#105; smashcraft:docs/gameplay-design.md, "Numerical
// identities"): the original fighter with the highest air speed and the
// longest glaives. He fights in the air at his glaives' length, forward air
// in and back air while drifting out, threatens forward smash's long reach on
// the ground and answers a committed strike with Parry Step. His hits deal
// less than the others' (forward smash 15, down tilt 7), so he wins by landing
// more of them, not by trading up close.
import { AttackStyle } from "./codes";
import { type FighterGameplan, GameplanThrow } from "./gameplan";

export const ILLIDAN_GAMEPLAN: FighterGameplan = {
  // Forward and back air reach 175 units, forward smash 195.
  range: { near: 110.0, far: 200.0 },
  spacing: [
    { move: AttackStyle.forwardAir, near: 90.0, far: 195.0 },
    { move: AttackStyle.forwardSmash, near: 120.0, far: 215.0 },
    { move: AttackStyle.forwardTilt, near: 60.0, far: 155.0 },
  ],
  approach: [
    { via: "jump", moves: [AttackStyle.forwardAir, AttackStyle.backAir, AttackStyle.neutralAir], weight: 3 },
    { via: "run", moves: [AttackStyle.dashAttack, AttackStyle.forwardSmash, AttackStyle.grab], weight: 1 },
  ],
  defense: ["stance", "stance", "jump", "shield", "spotDodge"],
  combos: [
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.forwardAir] },
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardAir, AttackStyle.neutralAir, AttackStyle.dashAttack] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: AttackStyle.upAir, followUps: [AttackStyle.upAir] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 90.0 },
    { move: AttackStyle.backAir, fromPercent: 110.0 },
    { move: AttackStyle.upSmash, fromPercent: 100.0 },
  ],
  recovery: { aim: "mixed", upSpecial: "mixed" },
  avoid: ["close", "far"],
};

// Beastmaster's gameplan (#105; smashcraft:docs/design/roster.md, "Beastmaster"):
// he fights from two places at once. He sets his bear down from range, then
// walks in behind it with the Broad Axe and Low Chop and sends the bear
// lunging, with the free Throwing Axe to make the target act. Being split
// from the bear and punished for the command is his weakness, so he keeps
// near it, out of close brawls and off the edge. Gaps are centre to centre:
// his axe reaches about 145 and a target's body adds about 25.
import { AttackStyle } from "../codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "../gameplan";

export const BEASTMASTER_GAMEPLAN: FighterGameplan = {
  range: { near: 90.0, far: 160.0 },
  spacing: [
    { move: AttackStyle.forwardTilt, near: 90.0, far: 160.0 },
    { move: AttackStyle.downTilt, near: 50.0, far: 110.0 },
    { move: GameplanSpecial.side, near: 120.0, far: 260.0 },
    { move: GameplanSpecial.neutral, near: 180.0, far: 380.0 },
  ],
  approach: [
    // The bear goes down first, then the axe makes the target act.
    { via: "shoot", moves: [GameplanSpecial.side, GameplanSpecial.neutral], weight: 3 },
    { via: "run", moves: [AttackStyle.forwardTilt, AttackStyle.downTilt, AttackStyle.grab], weight: 2 },
    { via: "jump", moves: [AttackStyle.neutralAir, AttackStyle.forwardAir], weight: 1 },
  ],
  defense: ["shield", "retreat", "spotDodge"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardTilt, AttackStyle.grab, GameplanSpecial.side] },
    { starter: AttackStyle.upTilt, followUps: [AttackStyle.upAir, AttackStyle.upTilt] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.forwardTilt, GameplanSpecial.side] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 90.0 },
    { move: AttackStyle.upSmash, fromPercent: 100.0 },
    { move: AttackStyle.forwardAir, fromPercent: 115.0 },
  ],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["close", "edge"],
};

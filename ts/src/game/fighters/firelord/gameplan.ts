import { f32 } from "wisp/src/sim/f32";
import { AttackStyle } from "../../sim/codes";
import { GameplanSpecial, GameplanThrow, type FighterGameplan } from "../../sim/gameplan";
import { STANDIN_GAMEPLAN } from "../standin/gameplan";
import { RAZE_RADIUS, RAZE_REACH } from "./specials";

export const FIRELORD_GAMEPLAN: FighterGameplan = {
  ...STANDIN_GAMEPLAN,
  spacing: [
    { move: GameplanSpecial.neutral, near: 160.0, far: 420.0 },
    { move: GameplanSpecial.down, near: f32(RAZE_REACH.near - RAZE_RADIUS), far: f32(RAZE_REACH.near + RAZE_RADIUS) },
    { move: GameplanSpecial.side, near: 60.0, far: 170.0 },
    { move: AttackStyle.forwardTilt, near: f32(79.2), far: 132.0 },
    { move: AttackStyle.downTilt, near: 66.0, far: f32(118.8) },
  ],
  approach: [
    { via: "shoot", moves: [GameplanSpecial.neutral], weight: 2 },
    { via: "run", moves: [AttackStyle.forwardTilt, AttackStyle.grab, AttackStyle.dashAttack], weight: 2 },
  ],
  defense: ["stance", "shield", "retreat", "roll", "jump"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.upTilt, AttackStyle.forwardAir] },
    { starter: GameplanThrow.up, followUps: [AttackStyle.upAir] },
    { starter: GameplanThrow.down, followUps: [AttackStyle.forwardTilt, GameplanSpecial.down] },
  ],
};

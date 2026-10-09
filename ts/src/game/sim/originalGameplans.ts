



import { AttackStyle, Character } from "./codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "./gameplan";
import { ILLIDAN_GAMEPLAN } from "./illidanGameplan";








const RIFLEMAN: FighterGameplan = {
  range: { near: 220.0, far: 520.0 },
  spacing: [
    { move: GameplanSpecial.neutral, near: 200.0, far: 700.0 },
    { move: GameplanSpecial.side, near: 120.0, far: 450.0 },
    { move: GameplanSpecial.down, near: 60.0, far: 260.0 },
    { move: AttackStyle.downTilt, near: 0.0, far: 150.0 },
  ],
  approach: [
    { via: "shoot", moves: [GameplanSpecial.neutral, GameplanSpecial.side, GameplanSpecial.down, AttackStyle.downTilt], weight: 3 },
    { via: "jump", moves: [AttackStyle.forwardAir, AttackStyle.downAir] },
  ],
  defense: ["shield", "shield", "spotDodge", "jump"],
  combos: [
    { starter: AttackStyle.downTilt, followUps: [AttackStyle.forwardAir, AttackStyle.upTilt, AttackStyle.downTilt] },
    { starter: GameplanSpecial.down, followUps: [AttackStyle.forwardSmash, AttackStyle.upSmash] },
    { starter: GameplanSpecial.side, followUps: [GameplanSpecial.neutral, AttackStyle.forwardSmash] },
  ],
  kills: [
    { move: AttackStyle.forwardSmash, fromPercent: 80.0 },
    { move: AttackStyle.upSmash, fromPercent: 95.0 },
    { move: GameplanSpecial.up, fromPercent: 100.0 },
  ],
  recovery: { aim: "ledge", upSpecial: "last" },
  avoid: ["close"],
};

export const ORIGINAL_GAMEPLANS: { readonly [character: number]: FighterGameplan | undefined } = {
  [Character.rifleman]: RIFLEMAN,
  [Character.demonHunter]: ILLIDAN_GAMEPLAN,
};

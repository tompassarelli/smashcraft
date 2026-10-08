// The original fighters' gameplans (sim/gameplan.ts, #105), by Character
// code. A fighter missing here plays the general computer. the reference body's and
// Rifleman's identities are written in smashcraft:docs/design/roster.md,
// "Original fighters"; Illidan's gameplan lives in illidanGameplan.ts.
import { AttackStyle, Character } from "./codes";
import { type FighterGameplan, GameplanSpecial, GameplanThrow } from "./gameplan";
import { ILLIDAN_GAMEPLAN } from "./illidanGameplan";

/**
 * Rifleman: slow on the ground and late off it, but floaty, a little heavier
 * and harder-hitting. He holds ground: the blaster shoots from range, the bear
 * walks ahead as cover, the freezing trap guards the gap in front of him and
 * sets up a smash, and his down tilt hits hardest of the originals. He never
 * chases and doesn't fight in close, where his slow start loses scrambles.
 */
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

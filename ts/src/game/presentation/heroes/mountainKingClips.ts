// Mountain King's presentation on the stock Warcraft III model, as plain data
// for the shared hero clip seam. The sequence table was read from the game's
// archive copy of the model (war3.w3mod:units/human/heromountainking/
// heromountainking.mdx, 286165 bytes) with war3-model; the "Alternate" (Avatar)
// sequences 13-26 are omitted because the ultimate stays off.
//
// Arm-bone rotation over each sequence identifies the weapon: Attack -1 and
// Spell Throw swing the right arm (hammer, about 173 degrees), Attack -2 and
// Attack Slam the left (axe, about 177 degrees, Attack Slam with more root
// travel), and Spell Slam is the two-handed ground slam. The model has no
// jump, hit, dodge, ledge or grab sequences, so those states reuse the nearest
// readable sequence, often only its opening.
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle } from "../../sim/codes";
import { MOUNTAIN_KING_GROUND, jabSlice, strikeClip } from "../../sim/heroes/groundNormals";
import type { HeroClip, HeroClipTable } from "../../sim/heroes/hero";

export interface StockSequence {
  readonly index: number;
  readonly seconds: number;
  readonly looping: boolean;
}

/** Sequence names exactly as the model spells them, with index and length. */
export const MOUNTAIN_KING_SEQUENCES = {
  "Stand - 1": { index: 0, seconds: 1.5, looping: true },
  "Stand Ready": { index: 1, seconds: 1.5, looping: true },
  "Stand - 2": { index: 2, seconds: f32(2.3), looping: true },
  "Stand - 3": { index: 3, seconds: f32(3.167), looping: true },
  "Stand - 4": { index: 4, seconds: f32(5.367), looping: true },
  "Attack -1": { index: 5, seconds: 1.0, looping: false },
  "Attack -2": { index: 6, seconds: 1.0, looping: false },
  "Walk": { index: 7, seconds: f32(0.834), looping: true },
  "Death": { index: 8, seconds: 2.5, looping: false },
  "Spell Throw": { index: 9, seconds: f32(1.366), looping: false },
  "Spell Slam": { index: 10, seconds: f32(0.9), looping: false },
  "Dissipate": { index: 11, seconds: 2.0, looping: false },
  "Attack Slam": { index: 12, seconds: 1.0, looping: false },
  "Attack Slam Alternate": { index: 25, seconds: 1.0, looping: false },
} as const satisfies Readonly<Record<string, StockSequence>>;

export type MountainKingSequence = keyof typeof MOUNTAIN_KING_SEQUENCES;

/** A shorter `seconds` plays only that opening of the sequence over the pose. */
const play = (sequence: MountainKingSequence, seconds?: number): HeroClip => {
  const { index, seconds: length } = MOUNTAIN_KING_SEQUENCES[sequence];
  return { index, seconds: f32(seconds ?? length) };
};

// Strike moments: where the drawn hammer or axe is farthest out (smashcraft:docs/design/tilts.md, "Animation").
const ground = (sequence: MountainKingSequence, strike: number, style: AttackStyle, frame?: number): HeroClip =>
  strikeClip(MOUNTAIN_KING_SEQUENCES[sequence], strike, MOUNTAIN_KING_GROUND, style, frame);

/** Idle, walking and every pose without its own entry. */
export const MOUNTAIN_KING_FALLBACK = play("Stand Ready");

/** Every table-selected pose (the shared hero pose names), hammer for blunt hits and axe for cuts. */
export const MOUNTAIN_KING_CLIPS = {
  idle: play("Stand Ready"),
  walk: play("Walk"),
  dash: play("Walk"),
  run: play("Walk"),
  crouch: play("Spell Slam", 0.25),
  fall: play("Stand Ready"),
  landing: play("Spell Slam", f32(0.3)),
  shield: play("Stand Ready"),
  airDodge: play("Stand - 3", f32(0.6)),
  smashCharge: play("Attack Slam", f32(0.3)),
  ko: play("Dissipate"),
  dizzy: play("Stand - 4"),
  jab: jabSlice(MOUNTAIN_KING_SEQUENCES["Attack -1"], f32(0.36)),
  jab2: jabSlice(MOUNTAIN_KING_SEQUENCES["Attack -1"], f32(0.36)),
  grab: play("Attack -2"),
  // The level axe hook, whose swing already ends low; the up angle is the overhead throw.
  forwardTilt: ground("Attack -2", f32(0.48), AttackStyle.forwardTilt),
  forwardTiltUp: ground("Spell Throw", f32(0.52), AttackStyle.forwardTiltUp),
  forwardTiltDown: ground("Attack -2", f32(0.48), AttackStyle.forwardTiltDown),
  // The hammer is highest on the scoop's second active frame.
  upTilt: ground("Attack -1", f32(0.44), AttackStyle.upTilt, 9),
  // The low hammer sweep reaches farthest along the floor at 0.57 s (drawn reach, #156).
  downTilt: ground("Attack Slam Alternate", f32(0.57), AttackStyle.downTilt),
  // Attack Slam's root travel carries the charge forward.
  dashAttack: ground("Attack Slam", f32(0.48), AttackStyle.dashAttack),
  forwardSmash: play("Attack Slam"),
  upSmash: play("Attack -1"),
  downSmash: play("Spell Slam"),
  neutralAir: play("Attack -1"),
  forwardAir: play("Attack Slam"),
  backAir: play("Attack -2"),
  upAir: play("Attack -1"),
  downAir: play("Spell Slam"),
  getUpAttack: play("Attack -2"),
  ledgeHang: play("Stand Ready"),
  ledgeClimb: play("Walk"),
  ledgeRoll: play("Walk"),
  ledgeAttack: play("Attack -2"),
  knockdown: play("Death"),
  getUp: play("Stand - 3", 1.0),
  downDamage: play("Death", f32(0.35)),
  rollForward: play("Walk"),
  rollBackward: play("Walk"),
  spotDodge: play("Spell Slam", f32(0.4)),
  jump: play("Stand - 3", f32(0.6)),
  doubleJump: play("Stand - 3", f32(0.6)),
  // The Attack Slam leap kicks off a wall; a wall tech braces with the Spell Slam crouch.
  wallJump: play("Attack Slam"),
  wallTech: play("Spell Slam", f32(0.5)),
  fallSpecial: play("Death", f32(0.3)),
  damageGround: play("Death", f32(0.35)),
  damageAir: play("Death", f32(0.35)),
  damageTumble: play("Death", f32(0.8)),
  damageShield: play("Stand Ready"),
  grabHold: play("Stand Ready"),
  grabbed: play("Death", f32(0.2)),
  pummel: play("Attack -1", 0.5),
  throwForward: play("Attack -1"),
  throwBack: play("Attack Slam"),
  throwUp: play("Spell Throw"),
  throwDown: play("Spell Slam"),
  victimPummel: play("Death", f32(0.2)),
  victimThrowForward: play("Death", f32(0.35)),
  victimThrowBack: play("Death", f32(0.35)),
  victimThrowUp: play("Death", f32(0.35)),
  victimThrowDown: play("Death", f32(0.35)),
  neutralSpecial: play("Spell Throw"),
  sideSpecial: play("Attack -1"),
  upSpecial: play("Attack Slam"),
  downSpecial: play("Spell Slam"),
  neutralSpecialAir: play("Spell Throw"),
  sideSpecialAir: play("Attack -1"),
  upSpecialAir: play("Attack Slam"),
  downSpecialAir: play("Attack -1"),
} as const satisfies HeroClipTable;

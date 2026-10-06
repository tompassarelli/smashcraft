// Warden's stock classic model and the sequence each pose plays. Sequence
// indices, names and lengths are those of the classic HeroWarden.mdx (the test
// clients run hd=0); the model has twelve sequences and no hit, jump or
// knockdown clips, so those poses reuse the nearest readable sequence.
import { f32 } from "wisp/src/sim/f32";

export const WARDEN_MODEL_FILE = "Units\\NightElf\\HeroWarden\\HeroWarden.mdx";

export interface StockClip {
  readonly index: number;
  readonly name: string;
  readonly seconds: number;
}

const clip = (index: number, name: string, seconds: number): StockClip => ({ index, name, seconds });

/** Every sequence in the classic model, by index. */
export const WARDEN_SEQUENCES = {
  stand: clip(0, "Stand - 1", f32(1.334)),
  standFidget: clip(1, "Stand - 2", f32(4.434)),
  walk: clip(2, "Walk", f32(1.166)),
  death: clip(3, "Death", 1.0),
  standReady: clip(4, "Stand Ready", 1.0),
  attack2: clip(5, "Attack - 2", f32(1.167)),
  spellSlam: clip(6, "Spell Slam", f32(1.2)),
  spell: clip(7, "Spell", f32(1.2)),
  spellThrow: clip(8, "Spell Throw", f32(0.333)),
  attack1: clip(9, "Attack - 1", f32(0.966)),
  dissipate: clip(10, "Dissipate", f32(2.667)),
  standChannel: clip(11, "Stand Channel", 2.0),
} as const;

const s = WARDEN_SEQUENCES;

/** The sequence each pose family plays; the presentation fits it to the action's frames. */
export const WARDEN_CLIPS = {
  idle: s.standReady,
  walk: s.walk,
  dash: s.walk,
  run: s.walk,
  crouch: s.standChannel,
  jump: s.standReady,
  doubleJump: s.spellThrow,
  // Spell Slam's crouch and spring pushes off a wall; a wall tech is her quick Attack - 1 flip of the blade.
  wallJump: s.spellSlam,
  wallTech: s.attack1,
  fall: s.standReady,
  fallSpecial: s.standChannel,
  landing: s.standReady,
  shield: s.standChannel,
  spotDodge: s.dissipate,
  roll: s.walk,
  airDodge: s.dissipate,
  damageGround: s.standReady,
  damageAir: s.standReady,
  damageTumble: s.death,
  damageShield: s.standChannel,
  knockdown: s.death,
  getUp: s.standReady,
  getUpAttack: s.attack2,
  dizzy: s.standFidget,
  ledgeHang: s.standChannel,
  ledgeClimb: s.spellSlam,
  ledgeAttack: s.attack2,
  ko: s.death,
  // Normals: two blade swings, an overhead slam and a two-handed cast.
  jab: s.attack1,
  forwardTilt: s.attack2,
  upTilt: s.spell,
  downTilt: s.attack1,
  dashAttack: s.attack2,
  forwardSmash: s.spellSlam,
  upSmash: s.spell,
  downSmash: s.attack2,
  neutralAir: s.attack1,
  forwardAir: s.attack2,
  backAir: s.attack1,
  upAir: s.spell,
  // Falling Knives plays her Fan of Knives cast.
  downAir: s.spell,
  grab: s.attack1,
  grabHold: s.standReady,
  grabbed: s.standReady,
  pummel: s.attack1,
  throwForward: s.attack2,
  throwBack: s.attack2,
  throwUp: s.spell,
  throwDown: s.spellSlam,
  // Specials: Shadow Strike throws, Blink is the model's own dissipate.
  shadowStrike: s.spellThrow,
  pursuitLunge: s.attack2,
  blink: s.dissipate,
  fanOfKnives: s.spell,
} as const;

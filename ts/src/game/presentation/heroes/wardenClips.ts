



import { f32 } from "wisp/src/sim/f32";
import { AttackStyle } from "../../sim/codes";
import { WARDEN_GROUND, jabSlice, strikeClip } from "../../sim/heroes/groundNormals";

export const WARDEN_MODEL_FILE = "Units\\NightElf\\HeroWarden\\HeroWarden.mdx";

export interface StockClip {
  readonly index: number;
  readonly name: string;
  readonly seconds: number;
}

const clip = (index: number, name: string, seconds: number): StockClip => ({ index, name, seconds });


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


const ground = (clip: StockClip, strike: number, style: AttackStyle, frame?: number): StockClip =>
  ({ ...clip, ...strikeClip(clip, strike, WARDEN_GROUND, style, frame) });


export const WARDEN_CLIPS = {
  idle: s.standReady,
  walk: s.walk,
  dash: s.walk,
  run: s.walk,
  crouch: s.standChannel,
  jump: s.standReady,
  doubleJump: s.spellThrow,

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



  jab: jabSlice(s.attack1, f32(0.32)),
  jab2: jabSlice(s.attack1, f32(0.32)),
  jab3: jabSlice(s.attack1, f32(0.34)),
  forwardTilt: ground(s.attack2, f32(0.52), AttackStyle.forwardTilt),
  forwardTiltUp: ground(s.spellSlam, f32(0.20), AttackStyle.forwardTiltUp),
  forwardTiltDown: ground(s.attack1, f32(0.38), AttackStyle.forwardTiltDown),
  upTilt: ground(s.spell, f32(0.56), AttackStyle.upTilt, 6),
  downTilt: ground(s.attack1, f32(0.38), AttackStyle.downTilt),
  dashAttack: ground(s.attack2, f32(0.52), AttackStyle.dashAttack),
  forwardSmash: s.spellSlam,
  upSmash: s.spell,
  downSmash: s.attack2,
  neutralAir: s.attack1,
  forwardAir: s.attack2,
  backAir: s.attack1,
  upAir: s.spell,

  downAir: s.spell,
  grab: s.attack1,
  grabHold: s.standReady,
  grabbed: s.standReady,
  pummel: s.attack1,
  throwForward: s.attack2,
  throwBack: s.attack2,
  throwUp: s.spell,
  throwDown: s.spellSlam,

  shadowStrike: s.spellThrow,
  pursuitLunge: s.attack2,
  blink: s.dissipate,
  fanOfKnives: s.spell,
} as const;

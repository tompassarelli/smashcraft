// Uther's poses on the stock classic Paladin model
// (Units\Human\HeroPaladin\HeroPaladin.mdl). Its thirteen sequences, read from
// the game's classic archive (index, name, seconds): 0 Stand - 1 3.334,
// 1 Stand - 2 6.667, 2 Stand - 3 6.667, 3 Stand Ready 1.0, 4 Attack - 1 1.0,
// 5 Attack - 2 1.166, 6 Death 1.5, 7 Stand Victory 2.666, 8 Spell 2.167,
// 9 Stand Channel 1.667, 10 Stand Hit 0.5, 11 Dissipate 2.0, 12 Walk 0.766.
// Attack - 1 swings the hammer from behind over the shoulder and down to the
// front at mid height (Hammer Sweep's path); Attack - 2 winds up high behind
// and slams to the floor in front (Final Judgment); Spell raises the hammer
// overhead; Stand Hit recoils backward. The model has no punch, kick, jump,
// roll, ledge or grab sequence, so those poses reuse the nearest readable one.
import { f32 } from "wisp/src/sim/f32";
import type { HeroClip, HeroClipTable } from "./hero";

const clip = (index: number, seconds: number): HeroClip => ({ index, seconds });
const STAND_READY = clip(3, 1.0);
const ATTACK_SWEEP = clip(4, 1.0);
const ATTACK_SLAM = clip(5, f32(1.166));
const DEATH = clip(6, 1.5);
const SPELL = clip(8, f32(2.167));
const STAND_CHANNEL = clip(9, f32(1.667));
const STAND_HIT = clip(10, 0.5);
const WALK = clip(12, f32(0.766));

export const UTHER_FALLBACK_CLIP = STAND_READY;

export const UTHER_CLIPS: HeroClipTable = {
  idle: STAND_READY,
  walk: WALK,
  jab: ATTACK_SWEEP,
  grab: ATTACK_SWEEP,
  forwardTilt: ATTACK_SWEEP,
  forwardTiltUp: ATTACK_SWEEP,
  forwardTiltDown: ATTACK_SWEEP,
  upTilt: SPELL,
  downTilt: ATTACK_SLAM,
  forwardSmash: ATTACK_SLAM,
  upSmash: SPELL,
  downSmash: ATTACK_SLAM,
  dashAttack: ATTACK_SWEEP,
  neutralAir: ATTACK_SWEEP,
  forwardAir: ATTACK_SLAM,
  backAir: STAND_HIT,
  upAir: SPELL,
  downAir: ATTACK_SLAM,
  getUpAttack: ATTACK_SWEEP,
  ledgeHang: STAND_READY,
  ledgeClimb: WALK,
  ledgeRoll: WALK,
  ledgeAttack: ATTACK_SWEEP,
  knockdown: DEATH,
  getUp: STAND_READY,
  downDamage: STAND_HIT,
  rollForward: WALK,
  rollBackward: WALK,
  spotDodge: STAND_HIT,
  jump: STAND_READY,
  doubleJump: STAND_READY,
  fallSpecial: STAND_HIT,
  damageGround: STAND_HIT,
  damageAir: STAND_HIT,
  damageTumble: STAND_HIT,
  damageShield: STAND_HIT,
  grabHold: STAND_READY,
  grabbed: STAND_HIT,
  pummel: ATTACK_SWEEP,
  throwForward: ATTACK_SWEEP,
  throwBack: ATTACK_SWEEP,
  throwUp: SPELL,
  throwDown: ATTACK_SLAM,
  victimPummel: STAND_HIT,
  victimThrowForward: STAND_HIT,
  victimThrowBack: STAND_HIT,
  victimThrowUp: STAND_HIT,
  victimThrowDown: STAND_HIT,
  neutralSpecial: SPELL,
  neutralSpecialAir: SPELL,
  sideSpecial: ATTACK_SWEEP,
  sideSpecialAir: ATTACK_SWEEP,
  upSpecial: SPELL,
  upSpecialAir: SPELL,
  downSpecial: STAND_CHANNEL,
  downSpecialAir: STAND_CHANNEL,
};

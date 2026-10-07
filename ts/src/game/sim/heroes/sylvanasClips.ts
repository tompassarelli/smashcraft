import { f32 } from "wisp/src/sim/f32";
import type { HeroClipTable } from "./hero";

const STAND = { index: 12, seconds: f32(1.133) };
const SHOT = { index: 5, seconds: f32(1.334) };
const SPELL = { index: 7, seconds: f32(1.333) };
const WALK = { index: 8, seconds: f32(0.833) };
const HIT = { index: 10, seconds: f32(0.034) };
const DEATH = { index: 4, seconds: f32(3.233) };
export const SYLVANAS_FALLBACK_CLIP = STAND;
export const SYLVANAS_CLIPS: HeroClipTable = {
  idle: STAND, walk: WALK, dash: WALK, run: WALK,
  jab: SHOT, jab2: SHOT, jab3: SHOT, grab: SPELL,
  forwardTilt: SHOT, forwardTiltUp: SHOT, forwardTiltDown: SHOT,
  upTilt: SPELL, downTilt: SHOT, dashAttack: SHOT,
  forwardSmash: SHOT, upSmash: SPELL, downSmash: SHOT,
  neutralAir: SHOT, forwardAir: SHOT, backAir: SHOT, upAir: SPELL, downAir: SHOT,
  getUpAttack: SHOT, ledgeHang: STAND, ledgeClimb: WALK, ledgeRoll: WALK, ledgeAttack: SHOT,
  knockdown: DEATH, downDamage: DEATH, getUp: STAND,
  jump: SPELL, doubleJump: SPELL, fall: STAND, fallSpecial: STAND, landing: STAND,
  crouch: STAND, shield: STAND, airDodge: HIT, smashCharge: STAND, ko: DEATH, dizzy: HIT,
  rollForward: WALK, rollBackward: WALK, spotDodge: HIT, wallJump: SPELL, wallTech: HIT,
  damageGround: HIT, damageAir: HIT, damageTumble: HIT, damageShield: HIT,
  grabHold: SPELL, grabbed: HIT, pummel: SHOT, throwForward: SPELL, throwBack: SPELL, throwUp: SPELL, throwDown: SPELL,
  victimPummel: HIT, victimThrowForward: HIT, victimThrowBack: HIT, victimThrowUp: HIT, victimThrowDown: HIT,
  neutralSpecial: SHOT, neutralSpecialAir: SHOT, sideSpecial: SPELL, sideSpecialAir: SPELL,
  upSpecial: SPELL, upSpecialAir: SPELL, downSpecial: SPELL,
};

// The Lich King's clip table (#167): every pose plays a sequence of
// LichKingFighter.mdx (Kwaliti's model with the clips
// smashcraft:tools/animations/lichking.py authors). Each attack clip lasts
// exactly its move's frames with the strike on the first active frame, so it
// plays evenly (`aligned`) instead of by a measured strike moment.
import { f32 } from "wisp/src/sim/f32";
import type { HeroClip, HeroClipTable } from "../../sim/heroes/hero";
import { LICH_KING_SEQUENCES } from "./lichKingClipInfo";

type Sequence = keyof typeof LICH_KING_SEQUENCES;

/** A sequence at one model frame per game frame. */
const clip = (name: Sequence): HeroClip => {
  const { index, frames } = LICH_KING_SEQUENCES[name];
  return { index, seconds: f32(frames / 60), aligned: true };
};

export const LICH_KING_FALLBACK = clip("Stand Ready");

export const LICH_KING_CLIPS: HeroClipTable = {
  idle: clip("Stand Ready"), walk: clip("Walk"), dash: clip("Walk Fast"), run: clip("Walk Fast"),
  turn: clip("Turn"), stop: clip("Stop"), jumpSquat: clip("Jump Squat"),
  crouch: clip("Crouch"), fall: clip("Fall"), landing: clip("Landing"), shield: clip("Shield"),
  airDodge: clip("Air Dodge"), smashCharge: clip("Smash Charge"), ko: clip("Dissipate"), dizzy: clip("Stand - 2"),
  jab: clip("Attack Jab"), jab2: clip("Attack Jab 2"), jab3: clip("Attack Jab 3"),
  // Forward tilt is one overhead sweep at every angle.
  forwardTilt: clip("Forward Tilt"), forwardTiltUp: clip("Forward Tilt"), forwardTiltDown: clip("Forward Tilt"),
  upTilt: clip("Up Tilt"), downTilt: clip("Down Tilt"), dashAttack: clip("Dash Attack"),
  forwardSmash: clip("Forward Smash"), upSmash: clip("Up Smash"), downSmash: clip("Down Smash"),
  neutralAir: clip("Aerial Neutral"), forwardAir: clip("Aerial Forward"), backAir: clip("Aerial Back"),
  upAir: clip("Aerial Up"), downAir: clip("Aerial Down"), getUpAttack: clip("Get Up Attack"),
  ledgeHang: clip("Ledge Hang"), ledgeClimb: clip("Ledge Climb"), ledgeRoll: clip("Ledge Roll"), ledgeAttack: clip("Ledge Attack"),
  knockdown: clip("Knockdown"), getUp: clip("Get Up"), downDamage: clip("Down Damage"),
  tech: clip("Tech"), techForward: clip("Tech Forward"), techBackward: clip("Tech Backward"),
  getUpRollForward: clip("Get Up Roll Forward"), getUpRollBackward: clip("Get Up Roll Backward"),
  rollForward: clip("Roll Forward"), rollBackward: clip("Roll Backward"), spotDodge: clip("Spot Dodge"),
  jump: clip("Jump"), doubleJump: clip("Double Jump"), fallSpecial: clip("Fall Special"),
  wallJump: clip("Wall Jump"), wallTech: clip("Wall Tech"),
  damageGround: clip("Damage Ground"), damageAir: clip("Damage Air"), damageTumble: clip("Damage Tumble"), damageShield: clip("Damage Shield"),
  grab: clip("Grab"), grabHold: clip("Grab Hold"), grabbed: clip("Grabbed"), pummel: clip("Pummel"),
  throwForward: clip("Throw Forward"), throwBack: clip("Throw Back"), throwUp: clip("Throw Up"), throwDown: clip("Throw Down"),
  victimPummel: clip("Grabbed"), victimThrowForward: clip("Damage Tumble"), victimThrowBack: clip("Damage Tumble"),
  victimThrowUp: clip("Damage Tumble"), victimThrowDown: clip("Damage Ground"),
  // Howling Blast retimes Spell Throw; Defile plants Frostmourne at the frame-20 pool placement.
  neutralSpecial: clip("Special Neutral"), sideSpecial: clip("Special Side"), upSpecial: clip("Special Up"), downSpecial: clip("Special Down"),
  neutralSpecialAir: clip("Special Neutral"), sideSpecialAir: clip("Special Side"), upSpecialAir: clip("Special Up"), downSpecialAir: clip("Special Down"),
};

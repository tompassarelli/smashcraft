










import { f32 } from "wisp/src/sim/f32";
import { Character } from "../codes";
import { RECOVERY_CLIPS } from "../../presentation/recoveryClipInfo";
import { BLADEMASTER_AUTHORED_CLIPS } from "../../presentation/blademasterClipInfo";
import { DOWN_AIR_CLIPS } from "../../presentation/downAirClipInfo";
import { JUMP_CLIPS } from "../../presentation/jumpClipInfo";
import type { HeroClip, HeroFollowUpPose, HeroPose } from "./hero";


export const BLADEMASTER_SEQUENCES = [
  ["Stand - 2", 3534],
  ["Stand cinematic", 5467],
  ["Attack", 1167],
  ["Attack Slam", 1133],
  ["Stand - 4", 1534],
  ["Death", 1900],
  ["Walk", 733],
  ["Stand", 1167],
  ["Attack 2", 1134],
  ["Stand Ready", 1400],
  ["Stand Victory", 3100],
  ["Dissipate", 3367],
  ["Portrait 1", 1700],
  ["Attack Walk Stand Spin", 433],
] as const;

type SequenceName = (typeof BLADEMASTER_SEQUENCES)[number][0];


function sequence(name: SequenceName, seconds?: number): HeroClip {
  const index = BLADEMASTER_SEQUENCES.findIndex(([entry]) => entry === name);
  const entry = BLADEMASTER_SEQUENCES[index];
  return { index, seconds: seconds ?? f32((entry?.[1] ?? 1000) / 1000) };
}


const THRUST = f32(0.48);
const CUT = f32(0.36);
const RISE = f32(0.38);
const SPIN_TURN = f32(0.433);


const aligned = (strike: number, firstActive: number, active: number, recovery: number) =>
  f32(f32(strike * (firstActive - 1 + active + recovery)) / (firstActive - 1));

const COMBAT_STANCE = sequence("Stand Ready");
const RECOIL = sequence("Death", f32(0.45));



export const BLADEMASTER_CLIPS: { readonly [pose in Exclude<HeroPose, Exclude<HeroFollowUpPose, "sideSpecialFollowUp" | "sideSpecialFollowUpAir" | "downSpecialFollowUp" | "downSpecialFollowUpAir"> | "jab3">]: HeroClip } = {
  idle: COMBAT_STANCE,
  walk: sequence("Walk"),
  dash: sequence("Walk"),
  run: sequence("Walk"),

  crouch: COMBAT_STANCE,
  fall: COMBAT_STANCE,
  landing: COMBAT_STANCE,
  shield: COMBAT_STANCE,
  smashCharge: COMBAT_STANCE,
  ko: sequence("Death"),
  dizzy: sequence("Stand - 2"),
  jab: BLADEMASTER_AUTHORED_CLIPS.jab,
  jab2: BLADEMASTER_AUTHORED_CLIPS.jab2,
  grab: sequence("Attack 2", aligned(THRUST, 7, 2, 22)),
  forwardTilt: BLADEMASTER_AUTHORED_CLIPS.forwardTilt,
  forwardTiltUp: BLADEMASTER_AUTHORED_CLIPS.forwardTiltUp,
  forwardTiltDown: BLADEMASTER_AUTHORED_CLIPS.forwardTiltDown,
  upTilt: BLADEMASTER_AUTHORED_CLIPS.upTilt,
  downTilt: BLADEMASTER_AUTHORED_CLIPS.downTilt,
  dashAttack: BLADEMASTER_AUTHORED_CLIPS.dashAttack,
  forwardSmash: BLADEMASTER_AUTHORED_CLIPS.forwardSmash,
  upSmash: BLADEMASTER_AUTHORED_CLIPS.upSmash,
  downSmash: BLADEMASTER_AUTHORED_CLIPS.downSmash,
  neutralAir: BLADEMASTER_AUTHORED_CLIPS.neutralAir,
  forwardAir: BLADEMASTER_AUTHORED_CLIPS.forwardAir,
  backAir: BLADEMASTER_AUTHORED_CLIPS.backAir,
  upAir: BLADEMASTER_AUTHORED_CLIPS.upAir,
  downAir: DOWN_AIR_CLIPS[Character.blademaster].downAir,
  ledgeHang: COMBAT_STANCE,

  knockdown: sequence("Death"),
  downDamage: sequence("Dissipate", f32(0.15)),
  jump: COMBAT_STANCE,
  doubleJump: JUMP_CLIPS[Character.blademaster].doubleJump,

  wallJump: sequence("Attack Slam"),
  wallTech: sequence("Stand - 4", f32(0.6)),
  fallSpecial: sequence("Stand - 2"),
  damageGround: RECOIL,
  damageAir: RECOIL,
  damageTumble: sequence("Death", f32(0.9)),
  damageShield: COMBAT_STANCE,
  grabHold: COMBAT_STANCE,
  grabbed: sequence("Death", f32(0.25)),
  pummel: sequence("Attack", aligned(CUT, 5, 1, 7)),
  throwForward: sequence("Attack 2", aligned(THRUST, 12, 1, 18)),
  throwBack: BLADEMASTER_AUTHORED_CLIPS.throwBack,
  throwUp: sequence("Stand - 4", aligned(RISE, 13, 1, 17)),
  throwDown: sequence("Attack", aligned(f32(0.39), 16, 1, 20)),
  victimPummel: RECOIL,
  victimThrowForward: RECOIL,
  victimThrowBack: RECOIL,
  victimThrowUp: RECOIL,
  victimThrowDown: RECOIL,

  neutralSpecial: sequence("Attack", aligned(CUT, 18, 1, 22)),
  neutralSpecialAir: sequence("Attack", aligned(CUT, 18, 1, 22)),

  sideSpecial: sequence("Walk"),
  sideSpecialAir: sequence("Walk"),
  sideSpecialFollowUp: sequence("Attack", aligned(CUT, 6, 3, 20)),
  sideSpecialFollowUpAir: sequence("Attack", aligned(CUT, 6, 3, 20)),
  upSpecial: sequence("Attack Walk Stand Spin", f32(2.0 * SPIN_TURN)),
  upSpecialAir: sequence("Attack Walk Stand Spin", f32(2.0 * SPIN_TURN)),

  downSpecial: sequence("Stand - 4", f32(0.6)),
  downSpecialAir: sequence("Stand - 4", f32(0.6)),

  downSpecialFollowUp: sequence("Attack 2", aligned(THRUST, 8, 3, 20)),
  downSpecialFollowUpAir: sequence("Attack 2", aligned(THRUST, 8, 3, 20)),
  ...RECOVERY_CLIPS[Character.blademaster],
};


export const BLADEMASTER_FALLBACK_CLIP = COMBAT_STANCE;

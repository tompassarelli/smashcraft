// Blademaster's presentation on the stock model units\orc\HeroBladeMaster\
// HeroBladeMaster.mdl, as plain data. The sequence list below is read from the
// classic model the clients draw (war3.w3mod, via the CascLib extractor);
// clips name a sequence and the index follows from this list.
//
// `seconds` is the clip length the pose stretches over its action, so a pose
// can play part of a sequence or line a sequence's strike up with the first
// active frame: strike time x total frames / first active frame (0-based).
// A non-looping clip then holds its final pose. Sequences with root motion
// (Attack Slam leaps about 130 units, Dissipate rises) stay off poses whose
// body the simulation keeps still, so the drawn body stays over its hurtbox.
import { f32 } from "wisp/src/sim/f32";
import { AttackStyle, Character } from "../codes";
import { RECOVERY_CLIPS } from "../../presentation/recoveryClipInfo";
import { BLADEMASTER_GROUND, jabSlice, strikeClip } from "./groundNormals";
import type { HeroClip, HeroFollowUpPose, HeroPose } from "./hero";

/** The model's sequences in index order, with their authored lengths in milliseconds. */
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

/** A named sequence played over `seconds` of clip time; the full length when omitted. */
function sequence(name: SequenceName, seconds?: number): HeroClip {
  const index = BLADEMASTER_SEQUENCES.findIndex(([entry]) => entry === name);
  const entry = BLADEMASTER_SEQUENCES[index];
  return { index, seconds: seconds ?? f32((entry?.[1] ?? 1000) / 1000) };
}

// Measured blade-tip (Shimmer helper) strike moments, in seconds of each sequence.
const THRUST = f32(0.48); // Attack 2: wind back, then a level forward thrust at chest height.
const CUT = f32(0.36); // Attack: overhead wind-up into a low forward cut that holds extended.
const RISE = f32(0.38); // Stand - 4: blade sweeps from low front to overhead and behind.
const SPIN_TURN = f32(0.433); // Attack Walk Stand Spin: one level full turn, looping.

/** Clip seconds that put `strike` on the first active frame of a brief F/A/R move. */
const aligned = (strike: number, firstActive: number, active: number, recovery: number) =>
  f32(f32(strike * (firstActive - 1 + active + recovery)) / (firstActive - 1));

// Attack's blade is farthest forward and low at 0.40 s (drawn silhouette).
const LOW_CUT = f32(0.40);
/** A ground normal's clip, its strike on the first active frame or `frame`. */
const ground = (name: SequenceName, strike: number, style: AttackStyle, frame?: number): HeroClip =>
  strikeClip(sequence(name), strike, BLADEMASTER_GROUND, style, frame);

const COMBAT_STANCE = sequence("Stand Ready");
const RECOIL = sequence("Death", f32(0.45));

/** Every table pose: original combat sequences and appended recovery actions. */
// His jab chain is two cuts: no third jab.
export const BLADEMASTER_CLIPS: { readonly [pose in Exclude<HeroPose, Exclude<HeroFollowUpPose, "sideSpecialFollowUp" | "sideSpecialFollowUpAir" | "downSpecialFollowUp" | "downSpecialFollowUpAir"> | "jab3">]: HeroClip } = {
  idle: COMBAT_STANCE,
  walk: sequence("Walk"),
  dash: sequence("Walk"),
  run: sequence("Walk"),
  // The only kneel (Stand cinematic) stands back up within its loop, so crouch keeps the stance.
  crouch: COMBAT_STANCE,
  fall: COMBAT_STANCE,
  landing: COMBAT_STANCE,
  shield: COMBAT_STANCE,
  smashCharge: COMBAT_STANCE,
  ko: sequence("Death"),
  dizzy: sequence("Stand - 2"),
  jab: jabSlice(sequence("Attack 2"), f32(0.44)),
  jab2: jabSlice(sequence("Attack 2"), f32(0.46)),
  grab: sequence("Attack 2", aligned(THRUST, 7, 2, 22)),
  // One descending cut for every angle (smashcraft:docs/design/tilts.md): its low cut lands on the last active frame.
  forwardTilt: ground("Attack", CUT, AttackStyle.forwardTilt, 9),
  forwardTiltUp: ground("Attack", CUT, AttackStyle.forwardTilt, 9),
  forwardTiltDown: ground("Attack", CUT, AttackStyle.forwardTilt, 9),
  // The arc is overhead on its middle active frame.
  // Attack 2's blade is highest and farthest toward the arc at 0.60 s (drawn reach, #156).
  upTilt: ground("Attack 2", f32(0.60), AttackStyle.upTilt, 8),
  downTilt: ground("Attack", LOW_CUT, AttackStyle.downTilt),
  // The sliding thrust: Attack 2's level thrust.
  dashAttack: ground("Attack 2", THRUST, AttackStyle.dashAttack),
  forwardSmash: sequence("Attack 2", aligned(THRUST, 17, 3, 32)),
  upSmash: sequence("Stand - 4", aligned(RISE, 15, 4, 30)),
  downSmash: sequence("Attack Walk Stand Spin", f32(2.0 * SPIN_TURN)),
  neutralAir: sequence("Attack Walk Stand Spin", f32(2.0 * SPIN_TURN)),
  forwardAir: sequence("Attack", aligned(CUT, 10, 3, 22)),
  // The spin's blade passes behind at three quarters of a turn.
  backAir: sequence("Attack Walk Stand Spin", aligned(f32(0.75 * SPIN_TURN), 8, 3, 23)),
  upAir: sequence("Stand - 4", aligned(RISE, 6, 3, 19)),
  // Bladestorm: the hero's own Bladestorm spin.
  downAir: sequence("Attack Walk Stand Spin", f32(2.0 * SPIN_TURN)),
  ledgeHang: COMBAT_STANCE,
  // Death ends lying on the stage; Dissipate starts from that pose.
  knockdown: sequence("Death"),
  downDamage: sequence("Dissipate", f32(0.15)),
  jump: COMBAT_STANCE,
  doubleJump: sequence("Attack Walk Stand Spin"),
  // Push off a wall: the Attack Slam leap, which travels away from it; spring off out of tumble with a blade spin.
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
  throwBack: sequence("Attack Walk Stand Spin", aligned(f32(0.75 * SPIN_TURN), 15, 1, 22)),
  throwUp: sequence("Stand - 4", aligned(RISE, 13, 1, 17)),
  throwDown: sequence("Attack", aligned(f32(0.39), 16, 1, 20)),
  victimPummel: RECOIL,
  victimThrowForward: RECOIL,
  victimThrowBack: RECOIL,
  victimThrowUp: RECOIL,
  victimThrowDown: RECOIL,
  // Wind Cutter's wave leaves on the cut (spawn f18, end f40).
  neutralSpecial: sequence("Attack", aligned(CUT, 18, 1, 22)),
  neutralSpecialAir: sequence("Attack", aligned(CUT, 18, 1, 22)),
  // Wind Walk walks; its Backstab (and the step out, a feinted cut) cuts.
  sideSpecial: sequence("Walk"),
  sideSpecialAir: sequence("Walk"),
  sideSpecialFollowUp: sequence("Attack", aligned(CUT, 6, 3, 20)),
  sideSpecialFollowUpAir: sequence("Attack", aligned(CUT, 6, 3, 20)),
  upSpecial: sequence("Attack Walk Stand Spin", f32(2.0 * SPIN_TURN)),
  upSpecialAir: sequence("Attack Walk Stand Spin", f32(2.0 * SPIN_TURN)),
  // Mirror Image's tell: the blade lifts before the step away (f8).
  downSpecial: sequence("Stand - 4", f32(0.6)),
  downSpecialAir: sequence("Stand - 4", f32(0.6)),
  // The image swap's slash: the thrust lands on its first active frame (f8).
  downSpecialFollowUp: sequence("Attack 2", aligned(THRUST, 8, 3, 20)),
  downSpecialFollowUpAir: sequence("Attack 2", aligned(THRUST, 8, 3, 20)),
  ...RECOVERY_CLIPS[Character.blademaster],
};

/** The idle a fighter without a mapped pose shows. */
export const BLADEMASTER_FALLBACK_CLIP = COMBAT_STANCE;

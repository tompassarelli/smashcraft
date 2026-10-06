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
import type { HeroClip, HeroPose, HeroStatePose } from "./hero";

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
  f32(strike * (firstActive - 1 + active + recovery) / (firstActive - 1));

const COMBAT_STANCE = sequence("Stand Ready");
const RECOIL = sequence("Death", f32(0.45));

/** Every table pose; the stock model has no hit, jump, roll or ledge sequences, so those reuse the nearest readable one. */
export const BLADEMASTER_CLIPS: { readonly [pose in Exclude<HeroPose, HeroStatePose>]: HeroClip } = {
  idle: COMBAT_STANCE,
  walk: sequence("Walk"),
  jab: sequence("Attack 2", aligned(THRUST, 4, 2, 13)),
  grab: sequence("Attack 2", aligned(THRUST, 7, 2, 22)),
  forwardTilt: sequence("Attack", aligned(CUT, 8, 3, 19)),
  forwardTiltUp: sequence("Attack 2", aligned(THRUST, 8, 3, 19)),
  forwardTiltDown: sequence("Attack", aligned(CUT, 8, 3, 19)),
  upTilt: sequence("Stand - 4", aligned(f32(0.25), 7, 5, 20)),
  downTilt: sequence("Attack", aligned(f32(0.39), 7, 3, 17)),
  dashAttack: sequence("Attack", aligned(CUT, 10, 4, 26)),
  forwardSmash: sequence("Attack 2", aligned(THRUST, 17, 3, 32)),
  upSmash: sequence("Stand - 4", aligned(RISE, 15, 4, 30)),
  downSmash: sequence("Attack Walk Stand Spin", f32(2.0 * SPIN_TURN)),
  neutralAir: sequence("Attack Walk Stand Spin", f32(2.0 * SPIN_TURN)),
  forwardAir: sequence("Attack", aligned(CUT, 10, 3, 22)),
  // The spin's blade passes behind at three quarters of a turn.
  backAir: sequence("Attack Walk Stand Spin", aligned(f32(0.75 * SPIN_TURN), 8, 3, 23)),
  upAir: sequence("Stand - 4", aligned(RISE, 6, 3, 19)),
  downAir: sequence("Attack", aligned(f32(0.39), 13, 4, 28)),
  getUpAttack: sequence("Attack Walk Stand Spin", f32(2.0 * SPIN_TURN)),
  ledgeHang: COMBAT_STANCE,
  ledgeClimb: COMBAT_STANCE,
  ledgeRoll: sequence("Attack Walk Stand Spin"),
  ledgeAttack: sequence("Attack Walk Stand Spin", f32(2.0 * SPIN_TURN)),
  // Death ends lying on the stage; Dissipate starts from that pose.
  knockdown: sequence("Death"),
  getUp: COMBAT_STANCE,
  downDamage: sequence("Dissipate", f32(0.15)),
  rollForward: sequence("Attack Walk Stand Spin"),
  rollBackward: sequence("Attack Walk Stand Spin"),
  // Stand cinematic's first two seconds are a crouch.
  spotDodge: sequence("Stand cinematic", 2.0),
  jump: COMBAT_STANCE,
  doubleJump: sequence("Attack Walk Stand Spin"),
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
  // Wind Walk Strike: the thrust's wind-up covers the dash, the thrust lands on the slash (f20).
  sideSpecial: sequence("Attack 2", aligned(THRUST, 20, 3, 26)),
  sideSpecialAir: sequence("Attack 2", aligned(THRUST, 20, 3, 26)),
  upSpecial: sequence("Attack Walk Stand Spin", f32(2.0 * SPIN_TURN)),
  upSpecialAir: sequence("Attack Walk Stand Spin", f32(2.0 * SPIN_TURN)),
  // Mirror Feint's tell: the blade lifts before the back step (f8).
  downSpecial: sequence("Stand - 4", f32(0.6)),
  downSpecialAir: sequence("Stand - 4", f32(0.6)),
};

/** Poses outside the attack table: movement, guard and match moments. */
export const BLADEMASTER_STATE_CLIPS = {
  idle: COMBAT_STANCE,
  walk: sequence("Walk"),
  run: sequence("Walk"),
  crouch: sequence("Stand cinematic", 2.0),
  shield: COMBAT_STANCE,
  fall: COMBAT_STANCE,
  /** Mirror Feint's requested forward slash. */
  feintSlash: sequence("Attack 2", aligned(THRUST, 10, 3, 25)),
  victory: sequence("Stand Victory"),
  defeat: sequence("Death"),
  portrait: sequence("Portrait 1"),
} as const;

/** The idle a fighter without a mapped pose shows. */
export const BLADEMASTER_FALLBACK_CLIP = COMBAT_STANCE;

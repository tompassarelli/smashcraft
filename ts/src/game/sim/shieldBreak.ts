// Shield break: launched upward, landing, standing up, then dizzy until the
// timer, shortened by mashing, runs out.
import { max } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { ShieldBreak } from "./codes";
import type { Fighter } from "./fighter";
import { applyMeleeGravity, clearMotionValue, landingAlongShift, moveMeleeVerticalVelocity, setWorldMotionValue } from "./motion";
import { type Controls, type Roster, fighterAt } from "./roster";
import { SHIELD_BREAK_RESTORED_ENERGY, clearShieldBreak, shieldBreakDizzyFrames } from "./shield";
import { surfaceZ } from "./stage";
import { checkBlastZone } from "./stocks";
import { groundedJumps } from "./itemBuffs";
import { cancelAttack, clearDownState, clearGrabLinks, clearTech, interruptJumpOrDodge } from "./transitions";

const SHIELD_BREAK_FRAME_DECAY = 1.0;
const SHIELD_BREAK_MASH_STRENGTH = 3.0;

const consumesFrame = (f: Fighter) => f.shield.breakState !== ShieldBreak.none || f.status.out;

export function beginShieldBreak(world: Roster, slot: number): void {
  const f = fighterAt(world, slot);
  const { motion, launch, shield } = f;
  clearGrabLinks(world, slot);
  interruptJumpOrDodge(f);
  clearDownState(f);
  cancelAttack(f);
  shield.breakState = ShieldBreak.air;
  shield.breakSerial++;
  shield.raised = false;
  shield.stun = 0;
  shield.heldFrames = 0;
  shield.releaseLag = 0;
  launch.hitstun = 0;
  launch.throwHitstun = false;
  f.grab.grabbedFrames = 0;
  f.landing.lag = 0;
  clearTech(f);
  launch.diPending = false;
  launch.diLaunchSpeed = 0.0;
  motion.vx = 0.0;
  motion.vz = f.tuning.physics.shieldBreakSpeed;
  launch.knockbackX = 0.0;
  launch.groundKnockbackX = 0.0;
  launch.knockbackZ = 0.0;
  shield.pushbackX = 0.0;
  shield.recoilX = 0.0;
  shield.recoilZ = 0.0;
  shield.drainResumePending = false;
  motion.grounded = false;
  motion.surface = undefined;
}

/** One frame of a shield break; true while it continues or the fighter is out, which ends the fighter's frame. */
export function advanceShieldBreak(world: Roster, slot: number, stage: number, matchFrame: number, input: Readonly<Controls>): boolean {
  checkBlastZone(world, slot, stage);
  const f = fighterAt(world, slot);
  const { motion, shield } = f;
  if (f.status.out || f.launch.hitlag > 0) return consumesFrame(f);
  f.status.invincible = max(0, f.status.invincible - 1);
  shield.breakFrame++;
  if (shield.breakState === ShieldBreak.air) {
    const oldZ = motion.z;
    applyMeleeGravity(f);
    moveMeleeVerticalVelocity(f);
    const landing = landingAlongShift(f, stage, matchFrame, motion.x, oldZ, motion.x, motion.z, true);
    if (landing !== undefined) {
      motion.z = surfaceZ(stage, landing, matchFrame);
      setWorldMotionValue(motion.meleeZ, motion.z);
      motion.surface = landing;
      motion.grounded = true;
      motion.vz = 0.0;
      clearMotionValue(motion.meleeVelocityZ);
      f.jump.remaining = groundedJumps(f);
      shield.breakState = ShieldBreak.land;
      shield.breakFrame = 0;
    }
  } else if (shield.breakState === ShieldBreak.land && shield.breakFrame >= f.tuning.shieldBreak.landFrames) {
    shield.breakState = ShieldBreak.stand;
    shield.breakFrame = 0;
  } else if (shield.breakState === ShieldBreak.stand && shield.breakFrame >= f.tuning.shieldBreak.standFrames) {
    shield.breakState = ShieldBreak.dizzy;
    shield.breakFrame = 0;
    shield.breakRemaining = shieldBreakDizzyFrames(f.status.damage);
    shield.energy = SHIELD_BREAK_RESTORED_ENERGY;
  } else if (shield.breakState === ShieldBreak.dizzy) {
    shield.energy = SHIELD_BREAK_RESTORED_ENERGY;
    const mash = input.mashPressed ? SHIELD_BREAK_MASH_STRENGTH : 0.0;
    shield.breakRemaining = max(0.0, f32(f32(shield.breakRemaining - SHIELD_BREAK_FRAME_DECAY) - mash));
    if (shield.breakRemaining <= 0) clearShieldBreak(f);
  }
  checkBlastZone(world, slot, stage);
  return consumesFrame(f);
}

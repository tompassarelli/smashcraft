// Losing a stock past the blast zone, and respawning.
import { max } from "../../runtime/numbers";
import { SurfaceContact } from "./codes";
import { PLATFORM_DROP_INPUT_WINDOW, SHIELD_MAX, SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES, WALL_JUMP_FLICK_FRAMES, WALL_TECH_JUMP_INPUT_WINDOW_FRAMES } from "./fighter";
import { clearDash } from "./groundMovement";
import { TOP_KO_MINIMUM_UPWARD_KNOCKBACK } from "./knockback";
import { clearMotionValue, setWorldMotionValue } from "./motion";
import { PARTICIPANT_CAPACITY } from "../input/participants";
import { type Roster, fighterAt } from "./roster";
import { clearShieldBreak } from "./shield";
import { at } from "wisp/src/runtime/lookup";
import {
  clearDownState,
  clearGrabLinks,
  clearLedge,
  clearOwnedFreezeTrap,
  clearSpecialOnStock,
  clearSurfaceRecovery,
  clearTech,
} from "./transitions";

export const BLAST_ZONE_SIDE = 920.0;
export const BLAST_ZONE_BOTTOM = -420.0;
export const BLAST_ZONE_TOP = 760.0;
const RESPAWN_FRAMES = 60;
const RESPAWN_HEIGHT = 280.0;
const RESPAWN_INVINCIBLE_FRAMES = 90;

/** Takes a stock from a fighter past a blast zone. The top zone needs a strong upward launch, a frozen or grounded fighter. */
export function checkBlastZone(world: Roster, slot: number): void {
  const f = fighterAt(world, slot);
  const { motion, launch, attack, dodge, status } = f;
  const topEligible = motion.grounded || status.frozenFrames > 0 || launch.knockbackZ > TOP_KO_MINIMUM_UPWARD_KNOCKBACK;
  if (!(motion.x < -BLAST_ZONE_SIDE || motion.x > BLAST_ZONE_SIDE || motion.z < BLAST_ZONE_BOTTOM || (motion.z > BLAST_ZONE_TOP && topEligible))) return;
  motion.crouching = false;
  clearGrabLinks(world, slot);
  clearDash(f);
  status.out = true;
  launch.knockbackAge = undefined;
  launch.damageLevel = 0;
  clearLedge(f);
  f.ledge.regrab = 0;
  clearShieldBreak(f);
  clearSpecialOnStock(f);
  clearOwnedFreezeTrap(f);
  status.frozenFrames = 0;
  launch.diPending = false;
  launch.diLaunchSpeed = 0.0;
  motion.vx = 0.0;
  motion.vz = 0.0;
  launch.knockbackX = 0.0;
  launch.groundKnockbackX = 0.0;
  launch.knockbackZ = 0.0;
  clearTech(f);
  status.stocks = max(0, status.stocks - 1);
  status.respawn = status.stocks > 0 ? RESPAWN_FRAMES : 0;
  attack.style = undefined;
  attack.frame = 0;
  attack.hit = false;
  attack.smashCharging = false;
  attack.smashChargeFrames = 0;
  attack.smashChargeAllowed = false;
  attack.cooldown = 0;
  dodge.groundFrame = 0;
  dodge.groundDirection = 0;
  dodge.groundEntryFacing = 0;
  clearDownState(f);
}

/** Respawns a fighter above startX: airborne, invincible and with every action and link cleared. */
export function respawnFighter(world: Roster, slot: number, startX: number): void {
  const f = fighterAt(world, slot);
  const { motion, jump, launch, shield, attack, hits, special, dodge, landing, status, surfaceRecovery: recovery } = f;
  motion.fastFalling = false;
  motion.fastFallDownHeld = false;
  motion.fastFallInputAge = PLATFORM_DROP_INPUT_WINDOW;
  motion.previousStickSide = 0;
  motion.stickSideAge = WALL_JUMP_FLICK_FRAMES;
  jump.inputAge = WALL_TECH_JUMP_INPUT_WINDOW_FRAMES;
  motion.crouching = false;
  f.ground.dashGrabWindow = 0;
  attack.dashGrab = false;
  jump.dodgeQueued = false;
  jump.dodgeX = 0;
  jump.dodgeZ = 0;
  clearGrabLinks(world, slot);
  clearSpecialOnStock(f);
  f.visuals.parry = 0;
  motion.lastAerialTapDirection = 0;
  hits.lastAttacker = undefined;
  hits.lastAttackSerial = undefined;
  hits.lastWindow = 0;
  for (let entry = 0; entry < PARTICIPANT_CAPACITY; entry++) {
    const record = at(hits.entries, entry);
    record.attacker = undefined;
    record.attackSerial = 0;
    record.window = 0;
    special.hitTargets[entry] = undefined;
  }
  clearDash(f);
  clearLedge(f);
  f.ledge.serial = 0;
  f.ledge.regrab = 0;
  clearShieldBreak(f);
  shield.breakSerial = 0;
  clearOwnedFreezeTrap(f);
  f.freezeTrap.serial = 0;
  status.frozenFrames = 0;
  f.freezeTrap.cooldown = 0;
  clearDownState(f);
  clearSurfaceRecovery(f);
  recovery.lastReflectedSurface = undefined;
  recovery.reflectCooldown = 0;
  recovery.contactKind = SurfaceContact.none;
  recovery.contactApproachSpeed = 0.0;
  recovery.contactX = 0.0;
  recovery.contactZ = 0.0;
  recovery.contactNormalX = 0.0;
  recovery.contactNormalZ = 0.0;
  recovery.wallJumpAge = undefined;
  recovery.wallJumpSide = 0;
  recovery.wallJumpsUsed = 0;
  clearTech(f);
  jump.serial = 0;
  jump.isDouble = false;
  motion.x = startX;
  motion.z = RESPAWN_HEIGHT;
  setWorldMotionValue(motion.meleeX, motion.x);
  setWorldMotionValue(motion.meleeZ, motion.z);
  clearMotionValue(motion.meleeVelocityZ);
  motion.deltaX = 0.0;
  motion.deltaZ = 0.0;
  motion.vx = 0.0;
  motion.vz = 0.0;
  launch.knockbackX = 0.0;
  launch.groundKnockbackX = 0.0;
  launch.knockbackZ = 0.0;
  shield.pushbackX = 0.0;
  shield.recoilX = 0.0;
  shield.recoilZ = 0.0;
  shield.drainResumePending = false;
  shield.triggerWasActive = false;
  shield.triggerAge = SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES;
  shield.reflectFrames = 0;
  shield.perfectFrames = 0;
  shield.perfectActionFrames = 0;
  status.damage = 0.0;
  launch.knockbackAge = undefined;
  launch.damageLevel = 0;
  launch.hitstun = 0;
  launch.hitlag = 0;
  launch.diPending = false;
  launch.diLaunchSpeed = 0.0;
  launch.diSerial = 0;
  launch.diAngleDegrees = 0.0;
  launch.sdiWasGrounded = false;
  launch.sdiLaunchesUpward = false;
  launch.sdiSerial = 0;
  launch.asdiSerial = 0;
  shield.stun = 0;
  attack.style = undefined;
  attack.frame = 0;
  attack.duration = 0;
  attack.hit = false;
  attack.smashCharging = false;
  attack.smashChargeFrames = 0;
  attack.smashChargeAllowed = false;
  attack.cooldown = 0;
  special.direction = 0;
  shield.raised = false;
  shield.energy = SHIELD_MAX;
  shield.strength = 1.0;
  jump.squat = 0;
  jump.held = false;
  status.out = false;
  motion.grounded = false;
  jump.remaining = 2;
  motion.dropTime = 0;
  dodge.airMotionFrames = 0;
  landing.lag = 0;
  dodge.airDodging = false;
  dodge.airFrame = 0;
  dodge.groundFrame = 0;
  dodge.groundDirection = 0;
  dodge.groundEntryFacing = 0;
  f.grab.grabbedFrames = 0;
  shield.heldFrames = 0;
  f.grab.serial = 0;
  shield.releaseLag = 0;
  status.invincible = RESPAWN_INVINCIBLE_FRAMES;
}

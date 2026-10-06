// Keep the complete frame order together: a later phase reads the state
// written by earlier phases, including contact and landing on the same tick.
// One fighter's frame: timers, input transitions, steering, gravity, motion,
// wall contacts and landing, in the order the retail engine applies them.
import { max, min } from "../../runtime/numbers";
import { divideFloat32, roundToFloat32, subtractFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { Character, DownState, GroundAction, LedgeState, ShieldBreak, SpecialAction, SurfaceContact } from "./codes";
import {
  SPOT_DODGE_FRAMES,
  GROUND_ROLL_FRAMES,
  WALL_TECH_STARTUP_FRAMES,
  canAttack,
  inGrabContext,
  isFloorTeching,
  isForwardGroundRoll,
  isGroundDodging,
  isTumbling,
} from "./conditions";
import {
  DOWN_ROLL_FRAMES,
  DOWN_STAND_FRAMES,
  GROUND_ROLL_MOVE_END,
  GROUND_ROLL_MOVE_START,
  GROUND_ROLL_SPEED,
  TECH_IN_PLACE_FRAMES,
  TECH_ROLL_FRAMES,
  advanceDownState,
  finishLanding,
  resolveDownGroundContact,
} from "./down";
import {
  FAST_FALL_INPUT_WINDOW,
  type Fighter,
  PLATFORM_DROP_INPUT_WINDOW,
  SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES,
  WALL_JUMP_FLICK_FRAMES,
  WALL_TECH_JUMP_INPUT_WINDOW_FRAMES,
} from "./fighter";
import { DASH_GUARD_EARLY_FRAMES, advanceGroundMovement, clearDash } from "./groundMovement";
import { AIR_DODGE_ANIMATION_FRAMES, AIR_DODGE_DECAY, beginAirDodge, beginGroundDodge, beginJump, canBeginGroundDodge } from "./jumpsAndDodges";
import { ageKnockback, applyDirectionalInfluence, decayKnockback } from "./knockback";
import { advanceLedge } from "./ledge";
import { DOWN_ATTACK_FRAMES, SMASH_MAX_CHARGE_FRAMES, attackStartupFrames, isSmashAttack } from "./moves";
import {
  addMeleeWorldValues,
  airDriftVelocity,
  ceilingImpulseDriftVelocity,
  applyMeleeGravity,
  moveMeleeVerticalVelocity,
  moveMeleeX,
  moveMeleeZ,
  totalVelocityX,
  totalVelocityZ,
} from "./motion";
import { observeActionDecision, observeActionStart } from "./observations";
import { type Controls, type Roster, fighterAt } from "./roster";
import {
  SHIELD_MIN_HOLD_FRAMES,
  SHIELD_PERFECT_ACTIVE_FRAMES,
  SHIELD_REFLECTOR_ACTIVE_FRAMES,
  SHIELD_RELEASE_LAG_FRAMES,
  advanceShieldInputClocks,
  decayShieldMotion,
  regenerateShield,
  shieldDrain,
  shieldDrainShouldResume,
} from "./shield";
import { advanceShieldBreak, beginShieldBreak } from "./shieldBreak";
import { applyAutomaticSmashDirectionalInfluence, applySmashDirectionalInfluence } from "./smashDirectionalInfluence";
import { surfaceCount, surfaceLeft, surfaceMoves, surfacePass, surfaceRight, surfaceShiftX, surfaceShiftZ, surfaceZ } from "./stage";
import { inStageCannon, windPush } from "./stageHazards";
import { stickX } from "./stick";
import { checkBlastZone, respawnFighter } from "./stocks";
import { advanceSurfaceRecovery, advanceWallJump, leaveMainDeckBody, resolveSolidSurfaceContacts } from "./surfaces";
import { forwardRollTurnFrame, rollTravel } from "../physics/rollTravel";
import { advanceTechInput, techContactWindow } from "../physics/techInput";
import { clearDownState, clearOwnedFreezeTrap, thawFighter } from "./transitions";
import { WORLD_UNITS_PER_MELEE_UNIT } from "./tuning";
import { at } from "wisp/src/runtime/lookup";

const FAST_FALL_DOWN_THRESHOLD = 0.6625000238418579;
/** Melee common +0x008: the stick crosses this sideways to count as a fresh flick. */
const STICK_SMASH_DEADZONE_X = 0.25;
/** Melee common +0x210/+0x214: tumble ends on a flick at least this far sideways, on the frame it crosses the deadzone. */
const TUMBLE_EXIT_STICK_X = 0.800000011920929;
const PLATFORM_DROP_FRAMES = 12;
/** Dash-to-guard after the early window opens a dash-grab window this long. */
const LATE_DASH_GUARD_GRAB_WINDOW = 3;
/** Action bits in decision observations. */
const GUARD_BITS = 768;
const STEERING_BITS = 16399;

/** Advances one fighter's frame and regenerates its shield; `matchFrame` places moving decks, and a stage at rest needs none. */
export function advanceFighter(world: Roster, slot: number, stage: number, input: Readonly<Controls>, respawnX: number, matchFrame = 0): void {
  advanceFighterMotion(world, slot, stage, matchFrame, input, respawnX);
  regenerateShield(fighterAt(world, slot));
}

/** Counts down a stock-out to respawn; true while the fighter is out. */
function advanceOut(world: Roster, slot: number, respawnX: number): boolean {
  const { status } = fighterAt(world, slot);
  if (!status.out) return false;
  if (status.stocks <= 0) return true;
  status.respawn--;
  if (status.respawn <= 0) respawnFighter(world, slot, respawnX);
  return true;
}

/** Freeze and trap timers; true while the fighter was frozen at the start of the frame. */
function advanceFreeze(f: Fighter): boolean {
  const { status } = f;
  const trap = f.freezeTrap;
  const wasFrozen = status.frozenFrames > 0;
  if (status.freezeImmunityFrames > 0) status.freezeImmunityFrames--;
  if (status.frozenFrames === 1) thawFighter(f);
  else if (status.frozenFrames > 1) status.frozenFrames--;
  if (trap.cooldown > 0) trap.cooldown--;
  if (trap.life > 0) {
    trap.life--;
    if (trap.arming > 0) trap.arming--;
    if (trap.life === 0) clearOwnedFreezeTrap(f);
  }
  return wasFrozen;
}

/** Ends get-up states whose animations finished. */
function endFinishedDownStates(f: Fighter): void {
  const { down } = f;
  if (isFloorTeching(f) && down.frame >= (down.state === DownState.tech ? TECH_IN_PLACE_FRAMES : TECH_ROLL_FRAMES)) clearDownState(f);
  else if (down.state === DownState.stand && down.frame >= DOWN_STAND_FRAMES) clearDownState(f);
  else if (down.state === DownState.roll && down.frame >= DOWN_ROLL_FRAMES) clearDownState(f);
  else if (down.state === DownState.attack && down.frame >= DOWN_ATTACK_FRAMES) clearDownState(f);
}

/** Smash charge and the action clocks it pauses; true when charging held the clocks this frame. */
function advanceActionClocks(f: Fighter, input: Readonly<Controls>): boolean {
  const { attack, special } = f;
  let smashChargePaused = false;
  if (attack.smashCharging) {
    if (f.motion.grounded && input.attackHeld && attack.smashChargeFrames < SMASH_MAX_CHARGE_FRAMES) {
      attack.smashChargeFrames++;
      smashChargePaused = true;
    } else {
      attack.smashCharging = false;
      attack.smashChargeAllowed = false;
    }
  } else if (f.motion.grounded && attack.style !== undefined && attack.smashChargeAllowed && isSmashAttack(attack.style)
    && input.attackHeld && attack.frame >= attackStartupFrames(attack.style) - 1) {
    attack.smashCharging = true;
    attack.smashChargeFrames = 1;
    smashChargePaused = true;
  }
  if (smashChargePaused) return true;
  attack.cooldown = max(0, attack.cooldown - 1);
  if (special.lockFrames > 0) special.lockFrames--;
  for (let action = 1; action < special.cooldowns.length; action++) special.cooldowns[action] = max(0, at(special.cooldowns, action) - 1);
  if (attack.style !== undefined) {
    attack.frame++;
    if (attack.frame >= attack.duration) {
      attack.style = undefined;
      attack.frame = 0;
      attack.hit = false;
      attack.dashGrab = false;
      attack.smashCharging = false;
      attack.smashChargeFrames = 0;
      attack.smashChargeAllowed = false;
    }
  }
  return false;
}

/** Jump squat countdown and takeoff; true on a takeoff that replaces this frame's steering and gravity. */
function advanceJumpSquat(f: Fighter, input: Readonly<Controls>, squatBeforeInput: number): boolean {
  const { jump, motion } = f;
  const physics = f.tuning.physics;
  // Illidan retains his entry-frame squat countdown and immediate jump physics.
  const illidan = f.character === Character.demonHunter;
  if (!(jump.squat > 0 && f.launch.hitlag === 0 && (illidan || squatBeforeInput > 0))) return false;
  jump.squat--;
  if (jump.squat !== 0) return false;
  motion.grounded = false;
  if (!illidan) {
    const jumpX = f32(f32(motion.vx * physics.jumpMomentum) + f32(input.direction * physics.jumpHorizontalSpeed));
    motion.vx = max(-physics.jumpHorizontalCap, min(physics.jumpHorizontalCap, jumpX));
  }
  motion.vz = jump.held ? physics.fullJumpSpeed : physics.shortJumpSpeed;
  jump.serial++;
  jump.isDouble = false;
  if (jump.dodgeQueued) {
    jump.dodgeQueued = false;
    beginAirDodge(f, jump.dodgeX, jump.dodgeZ);
    jump.dodgeX = 0;
    jump.dodgeZ = 0;
  }
  return !illidan;
}

function advanceGroundDodge(f: Fighter, groundDodgeStarted: boolean): void {
  const { dodge } = f;
  if (dodge.groundFrame <= 0 || groundDodgeStarted) return;
  dodge.groundFrame++;
  const dodgeFrames = dodge.groundDirection === 0 ? SPOT_DODGE_FRAMES : GROUND_ROLL_FRAMES;
  const turnFrame = forwardRollTurnFrame(f.character);
  if (isForwardGroundRoll(f) && dodge.groundFrame === turnFrame) f.facing = -dodge.groundEntryFacing;
  if (dodge.groundFrame > dodgeFrames) {
    if (isForwardGroundRoll(f) && turnFrame === undefined) f.facing = -dodge.groundEntryFacing;
    dodge.groundFrame = 0;
    dodge.groundDirection = 0;
    dodge.groundEntryFacing = 0;
    f.motion.vx = 0.0;
  }
}

/** Guard entry, hold and release; returns whether the fighter wants its shield this frame. */
function advanceGuard(f: Fighter, input: Readonly<Controls>, forcedShield: boolean): boolean {
  const { shield, motion, ground } = f;
  const shieldCanStart = (input.shield || input.shieldPressed) && (shield.raised || shield.energy > 0) && f.down.state === DownState.none
    && f.launch.hitstun <= 0 && motion.grounded && !isGroundDodging(f) && shield.stun <= 0 && f.landing.lag <= 0
    && shield.releaseLag <= 0 && f.attack.cooldown <= 0 && f.jump.squat <= 0;
  if (shieldCanStart) observeActionDecision(GUARD_BITS);
  let wantsShield = forcedShield;
  if (!forcedShield) {
    if (shield.raised && !input.shield && shield.heldFrames < SHIELD_MIN_HOLD_FRAMES) {
      wantsShield = true;
      shield.heldFrames++;
    } else {
      wantsShield = shieldCanStart;
      if (wantsShield) {
        shield.heldFrames++;
      } else if (shield.raised && !input.shield) {
        shield.releaseLag = SHIELD_RELEASE_LAG_FRAMES;
        shield.heldFrames = 0;
      }
    }
  }
  const lateDashGuardEntry = wantsShield && !shield.raised && motion.grounded
    && (ground.action === GroundAction.run || (ground.action === GroundAction.dash && ground.actionFrame > DASH_GUARD_EARLY_FRAMES));
  if (wantsShield && !shield.raised) shield.perfectActionFrames = 0;
  else if (wantsShield && !forcedShield && shield.perfectActionFrames > 0) shield.perfectActionFrames--;
  else if (!wantsShield && shield.releaseLag <= 0) shield.perfectActionFrames = 0;
  shield.raised = wantsShield;
  if (shieldCanStart && shield.raised) observeActionStart(GUARD_BITS);
  if (wantsShield && input.shieldPressed && shield.triggerAge < SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES
    && shield.heldFrames <= SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES && input.shieldStrength >= 1 && !forcedShield) {
    shield.reflectFrames = SHIELD_REFLECTOR_ACTIVE_FRAMES;
    shield.perfectFrames = SHIELD_PERFECT_ACTIVE_FRAMES;
  }
  if (wantsShield && input.shield && !forcedShield && !shield.drainResumePending) shield.strength = input.shieldStrength;
  if (lateDashGuardEntry) ground.dashGrabWindow = LATE_DASH_GUARD_GRAB_WINDOW;
  return wantsShield;
}

/** Horizontal displacement for the frame, rounded per channel; dodge rolls stay on their deck. */
function moveHorizontally(f: Fighter, stage: number, matchFrame: number, dashEntryDisplacementAdjustment: number): void {
  const { motion, launch, shield, dodge } = f;
  if (isGroundDodging(f) && dodge.groundDirection !== 0) {
    const proposedX = f32(motion.x + totalVelocityX(f));
    const deck = motion.surface ?? 0;
    const left = surfaceLeft(stage, deck, matchFrame);
    const right = surfaceRight(stage, deck, matchFrame);
    motion.x = max(left, min(right, proposedX));
    if ((dodge.groundDirection < 0 && motion.x === left) || (dodge.groundDirection > 0 && motion.x === right)) {
      motion.vx = 0.0;
      launch.knockbackX = 0.0;
      launch.groundKnockbackX = 0.0;
    }
    return;
  }
  if (motion.grounded) {
    moveMeleeX(f, addMeleeWorldValues(f32(motion.vx + dashEntryDisplacementAdjustment), shield.pushbackX));
  } else {
    moveMeleeX(f, motion.vx);
  }
  moveMeleeX(f, launch.knockbackX);
  moveMeleeX(f, shield.recoilX);
}

/**
 * The highest deck the frame's descent crossed within its span, if the
 * fighter is not rising toward it. A moving deck is met as it moves: the step
 * starts where the fighter was relative to the deck a frame ago, as Melee's
 * mpCheckFloorRemap moves the collision box's previous bottom with its line
 * (melee:src/melee/mp/mplib.c), except on the deck that `carried` the
 * fighter this frame, which already moved it along.
 */
function landingDeck(f: Fighter, stage: number, matchFrame: number, oldX: number, oldZ: number, carried: number | undefined): number | undefined {
  const { motion } = f;
  const rise = totalVelocityZ(f);
  let landing: number | undefined;
  let landingZ = 0.0;
  for (let i = 0; i < surfaceCount(stage); i++) {
    const platformZ = surfaceZ(stage, i, matchFrame);
    const follows = i !== carried && surfaceMoves(stage, i);
    const fromX = follows ? f32(oldX + surfaceShiftX(stage, i, matchFrame)) : oldX;
    const fromZ = follows ? f32(oldZ + surfaceShiftZ(stage, i, matchFrame)) : oldZ;
    if ((follows ? f32(rise - surfaceShiftZ(stage, i, matchFrame)) : rise) > 0) continue;
    if (!(fromZ >= platformZ && motion.z <= platformZ && !(surfacePass(stage, i) && motion.dropTime > 0))) continue;
    const fraction = fromZ === motion.z ? 1.0 : f32(f32(fromZ - platformZ) / f32(fromZ - motion.z));
    const crossingX = f32(fromX + f32(f32(motion.x - fromX) * fraction));
    const left = surfaceLeft(stage, i, matchFrame);
    const right = surfaceRight(stage, i, matchFrame);
    if (crossingX >= left && crossingX <= right && motion.x >= left && motion.x <= right) {
      if (landing === undefined || platformZ > landingZ) {
        landing = i;
        landingZ = platformZ;
      }
    }
  }
  return landing;
}

/** Advances one fighter's frame. The match step regenerates shields separately, after contact collection. */
export function advanceFighterMotion(world: Roster, slot: number, stage: number, matchFrame: number, input: Readonly<Controls>, respawnX: number): void {
  const f = fighterAt(world, slot);
  const { motion, launch, shield, attack, jump, dodge, down, status } = f;
  const physics = f.tuning.physics;
  motion.deltaX = 0.0;
  motion.deltaZ = 0.0;
  if (advanceOut(world, slot, respawnX)) return;
  if (inStageCannon(f)) return;
  // The deck this fighter stands on carried it before the frame began (carryOnMovingDecks).
  const carried = motion.grounded ? motion.surface : undefined;
  jump.inputAge =input.jumpPressed ? 0 : min(WALL_TECH_JUMP_INPUT_WINDOW_FRAMES, jump.inputAge + 1);
  if (advanceFreeze(f)) {
    checkBlastZone(world, slot, stage);
    return;
  }
  // Direction freshness is input time, including hitlag; ages beyond the window are equivalent.
  const downHeld = (input.down ? 1.0 : 0.0) >= FAST_FALL_DOWN_THRESHOLD;
  motion.fastFallInputAge = downHeld ? (motion.fastFallDownHeld ? min(PLATFORM_DROP_INPUT_WINDOW, motion.fastFallInputAge + 1) : 0) : PLATFORM_DROP_INPUT_WINDOW;
  motion.fastFallDownHeld = downHeld;
  const horizontalStick = stickX(input);
  const stickSide = horizontalStick >= STICK_SMASH_DEADZONE_X ? 1 : horizontalStick <= -STICK_SMASH_DEADZONE_X ? -1 : 0;
  const tumbleExitFlick = stickSide !== 0 && stickSide !== motion.previousStickSide && Math.abs(horizontalStick) >= TUMBLE_EXIT_STICK_X;
  motion.stickSideAge = stickSide === 0 ? WALL_JUMP_FLICK_FRAMES : stickSide === motion.previousStickSide ? min(WALL_JUMP_FLICK_FRAMES, motion.stickSideAge + 1) : 0;
  motion.previousStickSide = stickSide;
  // Expiry resumes this frame, including input gates and state countdowns.
  const hitlagBefore = launch.hitlag;
  launch.hitlag = max(0, launch.hitlag - 1);
  advanceTechInput(f.tech, input.techPressed, launch.hitlag > 0);
  f.tech.window = techContactWindow(f.tech);
  if (launch.hitlag <= 0) {
    ageKnockback(f);
    f.ledge.regrab = max(0, f.ledge.regrab - 1);
  }
  if (f.ledge.state !== LedgeState.none) {
    advanceLedge(world, slot, stage, input);
    return;
  }
  if (shield.breakState !== ShieldBreak.none && advanceShieldBreak(world, slot, stage, matchFrame, input)) return;
  // Only the guard present at the animation boundary drains; input may enter or leave guard later.
  if (launch.hitlag <= 0 && shield.raised && shieldDrainShouldResume(f, shield.stun > 0)) {
    if (input.shield) shield.strength = input.shieldStrength;
    shield.energy = subtractFloat32(shield.energy, shieldDrain(shield.strength));
    if (shield.energy < 0) {
      shield.energy = 0.0;
      beginShieldBreak(world, slot);
      checkBlastZone(world, slot, stage);
      return;
    }
  }
  if (launch.hitlag <= 0) {
    f.surfaceRecovery.reflectCooldown = max(0, f.surfaceRecovery.reflectCooldown - 1);
    endFinishedDownStates(f);
  }
  const wallJumped = advanceSurfaceRecovery(f, input);
  const wallTechStartup = f.surfaceRecovery.state === SurfaceContact.techWall && f.surfaceRecovery.frame < WALL_TECH_STARTUP_FRAMES;
  if (hitlagBefore > 0 && launch.diPending) {
    if (launch.hitlag > 0) {
      applySmashDirectionalInfluence(world, slot, stage, matchFrame, input);
    } else if (!status.out) {
      applyDirectionalInfluence(f, input);
      applyAutomaticSmashDirectionalInfluence(world, slot, stage, matchFrame, input);
    }
  }
  if (status.out) return;
  if (wallTechStartup || inGrabContext(f)) {
    if (launch.hitlag <= 0) status.invincible = max(0, status.invincible - 1);
    checkBlastZone(world, slot, stage);
    return;
  }
  let groundDodgeStarted = false;
  let smashChargePaused = false;
  if (launch.hitlag <= 0) {
    f.landing.lag = max(0, f.landing.lag - 1);
    smashChargePaused = advanceActionClocks(f, input);
  }
  if (f.grab.target !== undefined) {
    checkBlastZone(world, slot, stage);
    return;
  }
  if (launch.hitlag <= 0) launch.hitstun = max(0, launch.hitstun - 1);
  if (launch.hitstun === 0) launch.throwHitstun = false;
  const squatBeforeInput = jump.squat;
  if (input.jumpPressed && !wallJumped) beginJump(f, input.direction);
  if (jump.squat > 0 && launch.hitlag === 0 && (f.character === Character.demonHunter || squatBeforeInput !== 1)) jump.held = jump.held && input.jumpHeld;
  if (input.airDodgePressed) {
    if (motion.grounded && jump.squat > 0) {
      jump.dodgeQueued = true;
      jump.dodgeX = input.dodgeX;
      jump.dodgeZ = input.dodgeZ;
    } else {
      beginAirDodge(f, input.dodgeX, input.dodgeZ);
    }
  }
  if (jump.dodgeQueued && (input.direction !== 0 || input.verticalDirection !== 0)) {
    jump.dodgeX = input.direction;
    jump.dodgeZ = input.verticalDirection;
  }
  if (input.groundDodgePressed && input.shield && !input.jumpPressed && canBeginGroundDodge(f)) {
    beginGroundDodge(f, input.groundDodgeDirection);
    groundDodgeStarted = true;
  }
  const groundTakeoff = advanceJumpSquat(f, input, squatBeforeInput);
  if (launch.hitlag > 0) return;
  advanceShieldInputClocks(f, input);
  advanceGroundDodge(f, groundDodgeStarted);
  checkBlastZone(world, slot, stage);
  if (status.out) return;
  const downOldX = motion.x;
  const downOldZ = motion.z;
  if (advanceDownState(f, stage, matchFrame, input)) {
    resolveDownGroundContact(f, stage, matchFrame);
    motion.deltaX = f32(motion.x - downOldX);
    motion.deltaZ = f32(motion.z - downOldZ);
    checkBlastZone(world, slot, stage);
    return;
  }
  const forcedShield = shield.raised && shield.stun > 0;
  shield.stun = max(0, shield.stun - 1);
  status.invincible = max(0, status.invincible - 1);
  if (dodge.airDodging) dodge.airFrame = min(AIR_DODGE_ANIMATION_FRAMES, dodge.airFrame + 1);
  motion.dropTime = max(0, motion.dropTime - 1);
  const dodgeActive = dodge.airMotionFrames > 0;
  dodge.airMotionFrames = max(0, dodge.airMotionFrames - 1);
  shield.releaseLag = max(0, shield.releaseLag - 1);
  const wantsShield = advanceGuard(f, input, forcedShield);
  let direction = input.direction;
  if (isTumbling(f) && !motion.grounded && launch.hitstun <= 0 && launch.hitlag <= 0 && tumbleExitFlick) {
    clearDownState(f);
    motion.vx = max(-physics.airSpeed, min(physics.airSpeed, motion.vx));
  }
  let dashEntryDisplacementAdjustment = 0.0;
  const canSteer = down.state === DownState.none && launch.hitstun <= 0 && (!dodge.airDodging || !dodgeActive) && !isGroundDodging(f)
    && shield.releaseLag <= 0 && f.landing.lag <= 0 && shield.stun <= 0 && jump.squat <= 0 && !smashChargePaused
    && (!motion.grounded || attack.cooldown <= 0) && f.surfaceRecovery.state !== SurfaceContact.techWall;
  motion.crouching = input.down && input.direction === 0 && motion.grounded && canSteer && !wantsShield
    && attack.style === undefined && f.special.action === SpecialAction.none;
  if (canSteer && !motion.grounded && direction !== 0) motion.lastAerialTapDirection = direction;
  if (!canSteer || wantsShield || !motion.grounded) clearDash(f);
  if (canSteer) {
    if (!wantsShield) {
      observeActionDecision(STEERING_BITS);
      observeActionStart(STEERING_BITS);
    }
    if (wantsShield) direction = 0;
    if (motion.grounded) {
      const previousGroundVelocity = motion.vx;
      // Dash entry stores new ground velocity after this frame's displacement.
      if (advanceGroundMovement(f, direction, input.walking)) dashEntryDisplacementAdjustment = f32(previousGroundVelocity - motion.vx);
    } else if (direction !== 0 && !groundTakeoff) {
      // Air steering changes velocity, not facing; back aerials rely on a stable orientation.
      const ceilingImpulse = f.surfaceRecovery.state === SurfaceContact.techCeiling && f.surfaceRecovery.frame === f.tuning.tech.ceilingImpulseFrame;
      motion.vx = ceilingImpulse ? ceilingImpulseDriftVelocity(f, motion.vx, direction) : airDriftVelocity(f, motion.vx, direction);
    }
  }
  if (isGroundDodging(f) && dodge.groundDirection !== 0) {
    if (f.character === Character.demonHunter) {
      const moving = dodge.groundFrame >= GROUND_ROLL_MOVE_START && dodge.groundFrame <= GROUND_ROLL_MOVE_END;
      motion.vx = moving ? f32(GROUND_ROLL_SPEED * dodge.groundDirection) : 0.0;
    } else {
      motion.vx = f32(dodge.groundDirection * rollTravel(f.character, "roll", isForwardGroundRoll(f) ? "forward" : "back", dodge.groundFrame));
    }
  } else if (isGroundDodging(f)) {
    motion.vx = 0.0;
  } else if (!groundTakeoff && (!canSteer || direction === 0) && launch.hitstun <= 0 && (!dodgeActive || motion.grounded)) {
    const drag = motion.grounded ? physics.traction : physics.airFriction;
    motion.vx = motion.vx > 0 ? max(0.0, f32(motion.vx - drag)) : min(0.0, f32(motion.vx + drag));
  }
  // Melee drops only on a fresh press (ftCo_Pass.c), so landing on a deck with down held stays on it.
  if (input.down && motion.fastFallInputAge < PLATFORM_DROP_INPUT_WINDOW && !input.attackRequested && down.state === DownState.none
    && motion.grounded && motion.surface !== undefined && surfacePass(stage, motion.surface) && canAttack(f)) {
    motion.dropTime = PLATFORM_DROP_FRAMES;
    jump.remaining = min(jump.remaining, 1);
    motion.grounded = false;
    motion.vz = -2.0;
  }
  const oldX = motion.x;
  const oldZ = motion.z;
  decayKnockback(f);
  decayShieldMotion(f);
  if (dodgeActive && !motion.grounded) {
    motion.vx = f32(motion.vx * AIR_DODGE_DECAY);
    motion.vz = f32(motion.vz * AIR_DODGE_DECAY);
  }
  moveHorizontally(f, stage, matchFrame, dashEntryDisplacementAdjustment);
  if (isGroundDodging(f) || (motion.grounded && jump.squat > 0)) {
    motion.vz = 0.0;
    motion.z = surfaceZ(stage, motion.surface ?? 0, matchFrame);
  } else if ((!dodgeActive || motion.grounded) && !groundTakeoff) {
    if (!motion.grounded && !motion.fastFalling && downHeld && motion.fastFallInputAge < FAST_FALL_INPUT_WINDOW && input.direction === 0
      && down.state === DownState.none && launch.hitstun <= 0 && motion.vz < 0) {
      motion.fastFalling = true;
      motion.fastFallInputAge = PLATFORM_DROP_INPUT_WINDOW;
    }
    if (motion.fastFalling) motion.vz = -physics.fastFallSpeed;
    else applyMeleeGravity(f);
  }
  moveMeleeVerticalVelocity(f);
  moveMeleeZ(f, divideFloat32(launch.knockbackZ, WORLD_UNITS_PER_MELEE_UNIT));
  moveMeleeZ(f, divideFloat32(shield.recoilZ, WORLD_UNITS_PER_MELEE_UNIT));
  // Melee adds the wind to the position after the frame's velocities, before collision (fighter.c Fighter_procUpdate, windOffset).
  if (!isGroundDodging(f)) moveMeleeX(f, windPush(stage, matchFrame, motion.x, motion.z));
  const frameDeltaX = f32(motion.x - oldX);
  let wallSide = resolveSolidSurfaceContacts(f, stage, oldX, oldZ, input);
  const landing = landingDeck(f, stage, matchFrame, oldX, oldZ, carried);
  if (landing !== undefined) {
    finishLanding(f, stage, matchFrame, input, landing, false);
  } else {
    // Moving into a wall that leans out puts the fighter inside the body
    // rather than across a face; moved back out, it is against that wall as
    // Melee's collision reports it. One leaving a ledge's corner is not.
    const bodySide = leaveMainDeckBody(f, stage);
    if (wallSide === 0 && f32(bodySide * frameDeltaX) > 0) wallSide = bodySide;
    if (motion.grounded) jump.remaining = min(jump.remaining, 1);
    motion.grounded = false;
    motion.surface = undefined;
    clearDash(f);
  }
  if (motion.grounded) {
    f.surfaceRecovery.wallJumpsUsed = 0;
  } else {
    motion.crouching = false;
    advanceWallJump(f, wallSide, frameDeltaX, horizontalStick);
  }
  checkBlastZone(world, slot, stage);
  motion.deltaX = f32(motion.x - oldX);
  motion.deltaZ = f32(motion.z - oldZ);
}

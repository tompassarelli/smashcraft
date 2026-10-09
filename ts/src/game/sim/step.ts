



import { max, min } from "../../runtime/numbers";
import { divideFloat32, roundToFloat32, subtractFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { Character, DownState, GroundAction, LedgeState, ParryBuffer, PlatformMove, ShieldBreak, SpecialAction, SurfaceContact } from "./codes";
import {
  SPOT_DODGE_FRAMES,
  GROUND_ROLL_FRAMES,
  WALL_TECH_STARTUP_FRAMES,
  canAttack,
  canStartAttack,
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
  TURNAROUND_SPECIAL_WINDOW_FRAMES,
  WALL_JUMP_FLICK_FRAMES,
  WALL_TECH_JUMP_INPUT_WINDOW_FRAMES,
} from "./fighter";
import { DASH_GUARD_EARLY_FRAMES, advanceGroundMovement, clearDash, groundOptionOpen, wantsCrouch } from "./groundMovement";
import { GroundOption } from "./stickZones";
import { heroMotionHolds } from "./heroSpecialRules";
import { carryHeroStatus } from "./heroStatus";
import { exSpecialPressed } from "./exSpecials";
import { demonHunterGliding, demonHunterJumpOrGlideCancel } from "./specials";
import { AIR_DODGE_ANIMATION_FRAMES, AIR_DODGE_DECAY, beginAirDodge, beginGroundDodge, beginJump, canBeginGroundDodge } from "./jumpsAndDodges";
import { ageKnockback, applyDirectionalInfluence, decayKnockback } from "./knockback";
import { advanceLedge } from "./ledge";
import { EdgePass, passThroughEdge, rideWall } from "./edgeRecovery";
import { DOWN_ATTACK_FRAMES, EARLY_ASCENT_GRAB_FRAMES, SMASH_MAX_CHARGE_FRAMES, attackFall, attackStartupFrames, felLungeStep, isSmashAttack } from "./moves";
import {
  addMeleeWorldValues,
  airDriftVelocity,
  applyMeleeGravity,
  moveMeleeVerticalVelocity,
  moveMeleeX,
  moveMeleeZ,
  slopedLandingZ,
  totalVelocityX,
  totalVelocityZ,
} from "./motion";
import { observeActionDecision, observeActionStart } from "./observations";
import * as platforms from "./platformMoves";
import { type Controls, type Roster, fighterAt } from "./roster";
import { travelBeforeBodies } from "./travelStop";
import {
  SHIELD_MIN_HOLD_FRAMES,
  SHIELD_PERFECT_ACTIVE_FRAMES,
  SHIELD_REFLECTOR_ACTIVE_FRAMES,
  SHIELD_RED_PARRY_FRAMES,
  SHIELD_RELEASE_LAG_FRAMES,
  advanceShieldInputClocks,
  bufferParryOption,
  decayShieldMotion,
  regenerateShield,
  shieldDrain,
  shieldDrainShouldResume,
} from "./shield";
import { advanceShieldBreak, beginShieldBreak } from "./shieldBreak";
import { advanceShieldTilt } from "./shieldTilt";
import { applyAutomaticSmashDirectionalInfluence, applySmashDirectionalInfluence, discardPendingSmashDirectionalInfluence, renewSmashDirectionalInfluenceString } from "./smashDirectionalInfluence";
import { floorFriction, floorTraction, groundLineCosine, surfaceCount, surfaceLeft, surfaceLine, surfaceMoves, surfacePass, surfaceRight, surfaceShiftX, surfaceShiftZ, surfaceZ, surfaceZAt } from "./stage";

import { endCannonPass, inStageCannon, windPush } from "./stageHazards";
// One local for the sea: this module is near Lua's 200-local limit.
import * as sea from "./water";
import { stickX } from "./stick";
import { checkBlastZone, respawnFighter } from "./stocks";
import { advanceSurfaceRecovery, advanceWallJump, leaveMainDeckBody, resolveSolidSurfaceContacts } from "./surfaces";
import { forwardRollTurnFrame, rollTravel } from "../physics/rollTravel";
import { advanceTechInput, techContactWindow } from "../physics/techInput";
import { FREEZE_MINIMUM_FRAMES, clearDownState, clearOwnedFreezeTrap, thawFighter } from "./transitions";
import { advanceMash } from "./mash";
import { WORLD_UNITS_PER_MELEE_UNIT } from "./tuning";
import { aerialJumps, heavyFall, jumpBuffed, speedBuffed } from "./itemBuffs";

const FAST_FALL_DOWN_THRESHOLD = 0.6625000238418579;
/** Melee common +0x008: the stick crosses this sideways to count as a fresh flick. */
const STICK_SMASH_DEADZONE_X = 0.25;
/** Melee common +0x210/+0x214: tumble ends on a flick at least this far sideways, on the frame it crosses the deadzone. */
const TUMBLE_EXIT_STICK_X = 0.800000011920929;

const LATE_DASH_GUARD_GRAB_WINDOW = 3;

const GUARD_BITS = 768;
const STEERING_BITS = 16399;


function attackStartupTravel(world: Roster, slot: number): number {
  const f = fighterAt(world, slot);
  const move = f.attack.style === undefined ? undefined : f.tuning.moves?.normals[f.attack.style];
  const lunge = felLungeStep(f.character, f.attack.style, f.attack.frame, f.attack.smashCharging, f.attack.smashChargeFrames);
  if (lunge > 0.0 && f.motion.grounded) return f32(travelBeforeBodies(world, slot, lunge, true) * f.facing);
  if (move?.startupTravelX === undefined || !f.motion.grounded || f.attack.frame <= 0 || f.attack.frame > move.startupFrames) return 0.0;
  const distance = travelBeforeBodies(world, slot, f32(move.startupTravelX / move.startupFrames), move.startupStopsAtBody === true);
  return f32(distance * f.facing);
}


export function advanceFighter(world: Roster, slot: number, stage: number, input: Readonly<Controls>, respawnX: number, matchFrame = 0): void {
  advanceFighterMotion(world, slot, stage, matchFrame, input, respawnX);
  regenerateShield(fighterAt(world, slot));
}


function advanceOut(world: Roster, slot: number, respawnX: number): boolean {
  const { status } = fighterAt(world, slot);
  if (!status.out) return false;
  if (status.stocks <= 0) return true;
  status.respawn--;
  if (status.respawn <= 0) respawnFighter(world, slot, respawnX);
  return true;
}


function advanceFreeze(f: Fighter, input: Readonly<Controls>): boolean {
  const { status } = f;
  const trap = f.freezeTrap;
  const wasFrozen = status.frozenFrames > 0;
  if (status.freezeImmunityFrames > 0) status.freezeImmunityFrames--;
  if (wasFrozen) {
    const remaining = advanceMash(f.grab, input, status.frozenFrames, FREEZE_MINIMUM_FRAMES);
    if (remaining === 0) thawFighter(f);
    else status.frozenFrames = remaining;
  }
  if (trap.cooldown > 0) trap.cooldown--;
  if (trap.life > 0) {
    trap.life--;
    if (trap.arming > 0) trap.arming--;
    if (trap.life === 0) clearOwnedFreezeTrap(f);
  }
  return wasFrozen;
}


function endFinishedDownStates(f: Fighter): void {
  const { down } = f;
  if (isFloorTeching(f) && down.frame >= (down.state === DownState.tech ? TECH_IN_PLACE_FRAMES : TECH_ROLL_FRAMES)) clearDownState(f);
  else if (down.state === DownState.stand && down.frame >= DOWN_STAND_FRAMES) clearDownState(f);
  else if (down.state === DownState.roll && down.frame >= DOWN_ROLL_FRAMES) clearDownState(f);
  else if (down.state === DownState.attack && down.frame >= DOWN_ATTACK_FRAMES) clearDownState(f);
}


function advanceActionClocks(f: Fighter, input: Readonly<Controls>): boolean {
  const { attack, special } = f;
  let smashChargePaused = false;
  if (attack.smashCharging) {
    if (f.motion.grounded && input.attackHeld && attack.smashChargeFrames < (f.tuning.moves?.smashMaxChargeFrames ?? SMASH_MAX_CHARGE_FRAMES)) {
      attack.smashChargeFrames++;
      smashChargePaused = true;
    } else {
      attack.smashCharging = false;
      attack.smashChargeAllowed = false;
    }
  } else if (f.motion.grounded && attack.style !== undefined && attack.smashChargeAllowed && isSmashAttack(attack.style)
    && input.attackHeld && attack.frame >= attackStartupFrames(attack.style, f.tuning.moves) - 1) {
    attack.smashCharging = true;
    attack.smashChargeFrames = 1;
    smashChargePaused = true;
  }
  if (smashChargePaused) return true;
  attack.cooldown = max(0, attack.cooldown - 1);
  if (special.lockFrames > 0) special.lockFrames--;
  const cooldowns = special.cooldowns;
  for (let action = 1; action < cooldowns.length; action++) {

    const remaining = cooldowns[action] ?? 0;
    if (remaining !== 0) cooldowns[action] = max(0, remaining - 1);
  }
  if (attack.style !== undefined) {
    attack.frame++;
    if (attack.frame >= attack.duration) {
      attack.style = undefined;
      attack.frame = 0;
      attack.hit = false;
      attack.dashGrab = false;
      attack.pivotGrab = false;
      attack.smashCharging = false;
      attack.smashChargeFrames = 0;
      attack.smashChargeAllowed = false;
    }
  }
  return false;
}


function advanceJumpSquat(f: Fighter, input: Readonly<Controls>, squatBeforeInput: number): boolean {
  const { jump, motion } = f;
  const physics = f.tuning.physics;

  const illidan = f.character === Character.demonHunter;
  if (jump.ascent > 0) jump.ascent = motion.grounded || jump.ascent >= EARLY_ASCENT_GRAB_FRAMES ? 0 : jump.ascent + 1;
  if (!(jump.squat > 0 && f.launch.hitlag === 0 && (illidan || squatBeforeInput > 0))) return false;
  jump.squat--;
  if (jump.squat !== 0) return false;
  motion.grounded = false;
  const jumpX = f32(f32(motion.vx * physics.jumpMomentum) + f32(input.direction * physics.jumpHorizontalSpeed));
  motion.vx = max(-physics.jumpHorizontalCap, min(physics.jumpHorizontalCap, jumpX));
  motion.vz = jumpBuffed(f, jump.held ? physics.fullJumpSpeed : physics.shortJumpSpeed);
  jump.ascent = 1;
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


function advanceGuard(f: Fighter, input: Readonly<Controls>, forcedShield: boolean): boolean {
  const { shield, motion, ground } = f;
  if (!forcedShield && exSpecialPressed(input) && canStartAttack(f)) {
    shield.raised = false;
    shield.heldFrames = 0;
    shield.perfectFrames = 0;
    shield.reflectFrames = 0;
    return false;
  }
  const shieldCanStart = (input.shield || input.shieldPressed) && (shield.raised || shield.energy > 0) && f.down.state === DownState.none
    && f.launch.hitstun <= 0 && motion.grounded && !isGroundDodging(f) && shield.stun <= 0 && f.landing.lag <= 0
    && shield.releaseLag <= 0 && f.attack.cooldown <= 0 && f.jump.squat <= 0
    && (shield.raised || groundOptionOpen(f, GroundOption.shield));
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

        shield.releaseLag = shield.perfectActionFrames > 0 ? 0 : SHIELD_RELEASE_LAG_FRAMES;
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
  advanceShieldTilt(f, input);
  if (shieldCanStart && shield.raised) observeActionStart(GUARD_BITS);
  const fullPress = wantsShield && input.shieldPressed && input.shieldStrength >= 1;
  if (fullPress && !forcedShield && shield.triggerAge < SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES
    && shield.heldFrames <= SHIELD_POWERSHIELD_INPUT_WINDOW_FRAMES) {
    shield.reflectFrames = SHIELD_REFLECTOR_ACTIVE_FRAMES;
    shield.perfectFrames = SHIELD_PERFECT_ACTIVE_FRAMES;
  } else if (fullPress && forcedShield && !shield.redParryTried) {

    shield.redParryTried = true;
    shield.reflectFrames = SHIELD_RED_PARRY_FRAMES;
    shield.perfectFrames = SHIELD_RED_PARRY_FRAMES;
  }
  if (wantsShield && input.shield && !forcedShield && !shield.drainResumePending) shield.strength = input.shieldStrength;
  if (lateDashGuardEntry) ground.dashGrabWindow = LATE_DASH_GUARD_GRAB_WINDOW;
  return wantsShield;
}


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
    const ground = addMeleeWorldValues(f32(motion.vx + dashEntryDisplacementAdjustment), shield.pushbackX);

    const line = motion.surface === undefined ? undefined : surfaceLine(stage, motion.surface);
    moveMeleeX(f, line === undefined ? ground : f32(ground * groundLineCosine(line, motion.x)));
  } else {
    moveMeleeX(f, motion.vx);
  }
  moveMeleeX(f, launch.knockbackX);
  moveMeleeX(f, shield.recoilX);
}









function landingDeck(f: Fighter, stage: number, matchFrame: number, oldX: number, oldZ: number, carried: number | undefined): number | undefined {
  const { motion } = f;

  let rise: number | undefined;
  let landing: number | undefined;
  let landingZ = 0.0;
  for (let i = 0; i < surfaceCount(stage); i++) {
    const line = surfaceLine(stage, i);
    if (line !== undefined) {
      const lineZ = slopedLandingZ(line, i === carried, oldX, oldZ, motion.x, motion.z);
      if (lineZ === undefined || (landing !== undefined && lineZ <= landingZ)) continue;
      if (rise === undefined) rise = totalVelocityZ(f);
      if (rise > 0) continue;
      landing = i;
      landingZ = lineZ;
      continue;
    }
    const platformZ = surfaceZ(stage, i, matchFrame);
    const follows = i !== carried && surfaceMoves(stage, i);
    const fromZ = follows ? f32(oldZ + surfaceShiftZ(stage, i, matchFrame)) : oldZ;
    if (!(fromZ >= platformZ && motion.z <= platformZ)) continue;
    if (rise === undefined) rise = totalVelocityZ(f);
    if ((follows ? f32(rise - surfaceShiftZ(stage, i, matchFrame)) : rise) > 0) continue;
    const fromX = follows ? f32(oldX + surfaceShiftX(stage, i, matchFrame)) : oldX;
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


export function advanceFighterMotion(world: Roster, slot: number, stage: number, matchFrame: number, input: Readonly<Controls>, respawnX: number): void {
  const f = fighterAt(world, slot);
  const { motion, launch, shield, attack, jump, dodge, down, status } = f;
  const physics = f.tuning.physics;
  motion.deltaX = 0.0;
  motion.deltaZ = 0.0;
  if (advanceOut(world, slot, respawnX)) return;
  renewSmashDirectionalInfluenceString(f);
  if (inStageCannon(f)) return;

  const carried = motion.grounded ? motion.surface : undefined;
  jump.inputAge =input.jumpPressed ? 0 : min(WALL_TECH_JUMP_INPUT_WINDOW_FRAMES, jump.inputAge + 1);
  if (advanceFreeze(f, input)) {
    checkBlastZone(world, slot, stage);
    return;
  }

  const downHeld = (input.down ? 1.0 : 0.0) >= FAST_FALL_DOWN_THRESHOLD;
  motion.fastFallInputAge = downHeld ? (motion.fastFallDownHeld ? min(PLATFORM_DROP_INPUT_WINDOW, motion.fastFallInputAge + 1) : 0) : PLATFORM_DROP_INPUT_WINDOW;
  motion.fastFallDownHeld = downHeld;
  const horizontalStick = stickX(input);
  const stickSide = horizontalStick >= STICK_SMASH_DEADZONE_X ? 1 : horizontalStick <= -STICK_SMASH_DEADZONE_X ? -1 : 0;
  const tumbleExitFlick = stickSide !== 0 && stickSide !== motion.previousStickSide && Math.abs(horizontalStick) >= TUMBLE_EXIT_STICK_X;
  motion.stickSideAge = stickSide === 0 ? WALL_JUMP_FLICK_FRAMES : stickSide === motion.previousStickSide ? min(WALL_JUMP_FLICK_FRAMES, motion.stickSideAge + 1) : 0;
  platforms.trackPlatformInput(f, input);
  motion.previousStickSide = stickSide;
  if (input.direction !== 0) {
    motion.turnaroundSide = input.direction < 0 ? -1 : 1;
    motion.turnaroundAge = 0;
  } else {
    motion.turnaroundAge = min(TURNAROUND_SPECIAL_WINDOW_FRAMES + 1, motion.turnaroundAge + 1);
  }

  const hitlagBefore = launch.hitlag;
  launch.hitlag = max(0, launch.hitlag - 1);
  launch.hitlagEndAge = hitlagBefore > 0 ? 0 : min(16, launch.hitlagEndAge + 1);

  let parryOption: ParryBuffer = ParryBuffer.none;
  const parryDirection = shield.parryBufferDirection;
  if (launch.hitlag > 0) {
    if (shield.perfectActionFrames > 0) bufferParryOption(f, input);
  } else if (shield.parryBuffer !== ParryBuffer.none) {
    parryOption = shield.parryBuffer;
    shield.parryBuffer = ParryBuffer.none;
    shield.parryBufferDirection = 0;
  }
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
    } else {
      discardPendingSmashDirectionalInfluence(launch);
      if (!status.out) {
        applyDirectionalInfluence(f, input);
        applyAutomaticSmashDirectionalInfluence(world, slot, stage, matchFrame, input);
      }
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
  if (input.jumpPressed || input.attackPressed) demonHunterJumpOrGlideCancel(f, input);

  const wet = sea.wet(f, stage);
  const waterJumped = wet && (input.jumpPressed || parryOption === ParryBuffer.jump) && !wallJumped && sea.beginWaterJump(f, input.direction);
  if ((input.jumpPressed || parryOption === ParryBuffer.jump) && !wallJumped && !waterJumped) beginJump(f, input.direction, input.shortHopPressed);
  if (jump.squat > 0 && launch.hitlag === 0 && (f.character === Character.demonHunter || squatBeforeInput !== 1)) jump.held = jump.held && input.jumpHeld;
  if (input.airDodgePressed && !exSpecialPressed(input)) {
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
  const dodgePressed = input.groundDodgePressed && input.shield && !exSpecialPressed(input);
  if ((dodgePressed || parryOption === ParryBuffer.groundDodge) && !input.jumpPressed && canBeginGroundDodge(f)) {
    beginGroundDodge(f, dodgePressed ? input.groundDodgeDirection : parryDirection);
    groundDodgeStarted = true;
  }
  const groundTakeoff = advanceJumpSquat(f, input, squatBeforeInput);
  if (launch.hitlag > 0) return;
  advanceShieldInputClocks(f, input);
  advanceGroundDodge(f, groundDodgeStarted);
  checkBlastZone(world, slot, stage);
  if (status.out) return;
  if (f.platform.move !== PlatformMove.none) {
    const transitOldX = motion.x;
    const transitOldZ = motion.z;
    status.invincible = max(0, status.invincible - 1);
    platforms.advancePlatformMove(f, stage, matchFrame, input);
    motion.deltaX = f32(motion.x - transitOldX);
    motion.deltaZ = f32(motion.z - transitOldZ);
    checkBlastZone(world, slot, stage);
    return;
  }
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
  if (dodge.airDodging && dodge.airFrame >= AIR_DODGE_ANIMATION_FRAMES) {
    dodge.airDodging = false;
    dodge.airFrame = 0;
  }
  const dodgeActive = dodge.airMotionFrames > 0;
  dodge.airMotionFrames = max(0, dodge.airMotionFrames - 1);
  shield.releaseLag = max(0, shield.releaseLag - 1);
  const wantsShield = advanceGuard(f, input, forcedShield);
  let direction = input.direction;
  if (isTumbling(f) && !motion.grounded && launch.hitstun <= 0 && launch.hitlag <= 0 && tumbleExitFlick) {
    clearDownState(f);
    const airSpeed = speedBuffed(f, physics.airSpeed);
    motion.vx = max(-airSpeed, min(airSpeed, motion.vx));
  }
  let dashEntryDisplacementAdjustment = 0.0;

  const authoredMotion = carryHeroStatus(f) || heroMotionHolds(f) || demonHunterGliding(f);
  const canSteer = !authoredMotion && down.state === DownState.none && launch.hitstun <= 0 && (!dodge.airDodging || !dodgeActive) && !isGroundDodging(f)
    && shield.releaseLag <= 0 && f.landing.lag <= 0 && shield.stun <= 0 && jump.squat <= 0 && !smashChargePaused
    && (!motion.grounded || attack.cooldown <= 0) && f.surfaceRecovery.state !== SurfaceContact.techWall;
  motion.crouching = input.down && wantsCrouch(f, input, horizontalStick) && motion.grounded && canSteer && !wantsShield
    && attack.style === undefined && f.special.action === SpecialAction.none
    && groundOptionOpen(f, GroundOption.crouch);
  if (motion.crouching) direction = 0;
  if (!canSteer || wantsShield || !motion.grounded) clearDash(f);
  if (canSteer) {
    if (!wantsShield) {
      observeActionDecision(STEERING_BITS);
      observeActionStart(STEERING_BITS);
    }
    if (wantsShield) direction = 0;
    if (motion.grounded) {
      const previousGroundVelocity = motion.vx;

      if (advanceGroundMovement(f, direction, input.walking, horizontalStick, floorFriction(stage, motion))) dashEntryDisplacementAdjustment = f32(previousGroundVelocity - motion.vx);
    } else if (direction !== 0 && !groundTakeoff) {

      const driftStick = input.driftStickX ?? direction;
      motion.vx = wet ? sea.swimVelocity(motion.vx, direction) : airDriftVelocity(f, motion.vx, driftStick === 0 ? direction : driftStick);
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
  } else if (!groundTakeoff && !authoredMotion && (!canSteer || direction === 0) && launch.hitstun <= 0 && (!dodgeActive || motion.grounded)) {
    const drag = motion.grounded ? floorTraction(physics.traction, floorFriction(stage, motion)) : physics.airFriction;
    motion.vx = motion.vx > 0 ? max(0.0, f32(motion.vx - drag)) : min(0.0, f32(motion.vx + drag));
  }


  if (platforms.dropAfterPlatformLanding(f, stage, matchFrame, input)) {
    checkBlastZone(world, slot, stage);
    return;
  }
  if (input.down && !input.walking && motion.fastFallInputAge < PLATFORM_DROP_INPUT_WINDOW && !input.attackRequested && down.state === DownState.none
    && motion.grounded && motion.surface !== undefined && surfacePass(stage, motion.surface) && canAttack(f)) {
    platforms.beginPlatformDescent(f, stage, matchFrame, motion.surface);
    checkBlastZone(world, slot, stage);
    return;
  }
  const oldX = motion.x;
  const oldZ = motion.z;
  dashEntryDisplacementAdjustment = f32(dashEntryDisplacementAdjustment + attackStartupTravel(world, slot));
  decayKnockback(f, floorFriction(stage, motion));
  decayShieldMotion(f, floorFriction(stage, motion));
  if (dodgeActive && !motion.grounded) {
    motion.vx = f32(motion.vx * AIR_DODGE_DECAY);
    motion.vz = f32(motion.vz * AIR_DODGE_DECAY);
  }
  const drill = motion.grounded ? undefined : attackFall(attack.style, attack.frame, f.tuning.moves);
  let buoyant = false;
  if (drill?.speedX !== undefined) motion.vx = f32(drill.speedX * f.facing);
  moveHorizontally(f, stage, matchFrame, dashEntryDisplacementAdjustment);
  if (isGroundDodging(f) || (motion.grounded && jump.squat > 0)) {
    motion.vz = 0.0;
    motion.z = surfaceZAt(stage, motion.surface ?? 0, matchFrame, motion.x);
  } else if (wet && !waterJumped && launch.hitstun <= 0 && !dodgeActive && !authoredMotion && drill?.speedZ === undefined) {
    buoyant = true;
    sea.applyBuoyancy(f);
  } else if ((!dodgeActive || motion.grounded) && !groundTakeoff && !authoredMotion) {
    if (!motion.grounded && !motion.fastFalling && downHeld && motion.fastFallInputAge < FAST_FALL_INPUT_WINDOW && input.direction === 0
      && down.state === DownState.none && launch.hitstun <= 0 && motion.vz < 0) {
      motion.fastFalling = true;
      motion.fastFallInputAge = PLATFORM_DROP_INPUT_WINDOW;
    }
    if (drill?.speedZ !== undefined) motion.vz = drill.speedZ;
    else if (motion.fastFalling) motion.vz = -heavyFall(f, physics.fastFallSpeed);
    else applyMeleeGravity(f);
  }
  moveMeleeVerticalVelocity(f);
  moveMeleeZ(f, divideFloat32(launch.knockbackZ, WORLD_UNITS_PER_MELEE_UNIT));
  moveMeleeZ(f, divideFloat32(shield.recoilZ, WORLD_UNITS_PER_MELEE_UNIT));
  if (buoyant) sea.floatAtSurface(f);

  if (!isGroundDodging(f)) moveMeleeX(f, windPush(stage, matchFrame, motion.x, motion.z));
  const frameDeltaX = f32(motion.x - oldX);
  const frameDeltaZ = f32(motion.z - oldZ);
  const edge = passThroughEdge(world, slot, stage, oldX, oldZ);
  let wallSide = edge === EdgePass.none ? resolveSolidSurfaceContacts(f, stage, oldX, oldZ, input) : 0;
  rideWall(f, wallSide, frameDeltaX, frameDeltaZ, oldX, oldZ);

  const ascending = edge === EdgePass.none && platforms.beginPlatformAscent(f, stage, matchFrame, input);
  const landing = edge === EdgePass.land ? 0 : edge !== EdgePass.none || ascending ? undefined : landingDeck(f, stage, matchFrame, oldX, oldZ, carried);
  const contact = landing !== undefined && !motion.grounded && platforms.beginPlatformContact(f, stage, matchFrame, input, landing);
  if (landing !== undefined && !contact) {
    const touchdown = !motion.grounded;
    const airDodged = dodge.airDodging;
    finishLanding(f, stage, matchFrame, input, landing, false);
    if (touchdown) platforms.markPlatformLanding(f, stage, landing, airDodged);
  } else if (!ascending && !contact) {



    const bodySide = leaveMainDeckBody(f, stage);
    if (wallSide === 0 && f32(bodySide * frameDeltaX) > 0) wallSide = bodySide;
    if (motion.grounded) jump.remaining = min(jump.remaining, aerialJumps(f));
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
  endCannonPass(f, stage);
  checkBlastZone(world, slot, stage);
  motion.deltaX = f32(motion.x - oldX);
  motion.deltaZ = f32(motion.z - oldZ);
}

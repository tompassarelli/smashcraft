



import { max, min } from "../../runtime/numbers";
import { divideFloat32, roundToFloat32, subtractFloat32 } from "wisp/src/sim/binary32";
import { f32 } from "wisp/src/sim/f32";
import { AttackPhase, Character, DownState, GroundAction, LedgeState, ParryBuffer, PlatformMove, ShieldBreak, SpecialAction, SurfaceContact } from "./codes";
import {
  SPOT_DODGE_FRAMES,
  GROUND_ROLL_FRAMES,
  WALL_TECH_STARTUP_FRAMES,
  canAttack,
  attackPhase,
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
  clearPowershield,
} from "./shield";
import { advanceShieldBreak, beginShieldBreak } from "./shieldBreak";
import { advanceShieldTilt } from "./shieldTilt";
import { applyAutomaticSmashDirectionalInfluence, applySmashDirectionalInfluence, discardPendingSmashDirectionalInfluence, renewSmashDirectionalInfluenceString } from "./smashDirectionalInfluence";
import * as stageSurfaces from "./stage";

import { endCannonPass, inStageCannon, windPush } from "./stageHazards";
// One local for the sea: this module is near Lua's 200-local limit.
import * as sea from "./water";
import { stickX } from "./stick";
import { checkBlastZone, respawnFighter } from "./stocks";
import { advanceSurfaceRecovery, advanceWallJump, leaveMainDeckBody, resolveSolidSurfaceContacts } from "./surfaces";
import { forwardRollTurnFrame, rollTravel } from "../physics/rollTravel";
import { advanceTechInput, techContactWindow } from "../physics/techInput";
import { FREEZE_MINIMUM_FRAMES, cancelAttack, clearDownState, clearOwnedFreezeTrap, thawFighter } from "./transitions";
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


function guardCanStart(f: Fighter, input: Readonly<Controls>): boolean {
  const { shield, motion } = f;
  return (input.shield || input.shieldPressed) && (shield.raised || shield.energy > 0) && f.down.state === DownState.none
    && f.launch.hitstun <= 0 && motion.grounded && !isGroundDodging(f) && shield.stun <= 0 && f.landing.lag <= 0
    && shield.releaseLag <= 0 && f.attack.cooldown <= 0 && f.jump.squat <= 0
    && (shield.raised || groundOptionOpen(f, GroundOption.shield));
}


function armReflector(f: Fighter, input: Readonly<Controls>, wantsShield: boolean, forcedShield: boolean): void {
  const { shield } = f;
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
  const shieldCanStart = guardCanStart(f, input);
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
  armReflector(f, input, wantsShield, forcedShield);
  if (wantsShield && input.shield && !forcedShield && !shield.drainResumePending) shield.strength = input.shieldStrength;
  if (lateDashGuardEntry) ground.dashGrabWindow = LATE_DASH_GUARD_GRAB_WINDOW;
  return wantsShield;
}


function slideOffEdge(f: Fighter): void {
  const { shield, landing, launch } = f;
  if (launch.hitstun > 0 || f.down.state !== DownState.none || inGrabContext(f) || f.status.out) return;
  if (shield.raised || shield.stun > 0 || shield.pushbackX !== 0) {
    shield.raised = false;
    shield.stun = 0;
    shield.heldFrames = 0;
    shield.pushbackX = 0.0;
    shield.recoilX = 0.0;
    shield.recoilZ = 0.0;
    clearPowershield(f);
    f.special.fall = true;
    return;
  }
  landing.lag = 0;
  if (attackPhase(f) === AttackPhase.recovery) cancelAttack(f);
}

function moveHorizontally(f: Fighter, stage: number, matchFrame: number, dashEntryDisplacementAdjustment: number): void {
  const { motion, launch, shield, dodge } = f;
  if (isGroundDodging(f) && dodge.groundDirection !== 0) {
    const proposedX = f32(motion.x + totalVelocityX(f));
    const deck = motion.surface ?? 0;
    const left = stageSurfaces.surfaceLeft(stage, deck, matchFrame);
    const right = stageSurfaces.surfaceRight(stage, deck, matchFrame);
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

    const line = motion.surface === undefined ? undefined : stageSurfaces.surfaceLine(stage, motion.surface);
    moveMeleeX(f, line === undefined ? ground : f32(ground * stageSurfaces.groundLineCosine(line, motion.x)));
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
  for (let i = 0; i < stageSurfaces.surfaceCount(stage); i++) {
    const line = stageSurfaces.surfaceLine(stage, i);
    if (line !== undefined) {
      const lineZ = slopedLandingZ(line, i === carried, oldX, oldZ, motion.x, motion.z);
      if (lineZ === undefined || (landing !== undefined && lineZ <= landingZ)) continue;
      if (rise === undefined) rise = totalVelocityZ(f);
      if (rise > 0) continue;
      landing = i;
      landingZ = lineZ;
      continue;
    }
    const platformZ = stageSurfaces.surfaceZ(stage, i, matchFrame);
    const follows = i !== carried && stageSurfaces.surfaceMoves(stage, i);
    const fromZ = follows ? f32(oldZ + stageSurfaces.surfaceShiftZ(stage, i, matchFrame)) : oldZ;
    if (!(fromZ >= platformZ && motion.z <= platformZ)) continue;
    if (rise === undefined) rise = totalVelocityZ(f);
    if ((follows ? f32(rise - stageSurfaces.surfaceShiftZ(stage, i, matchFrame)) : rise) > 0) continue;
    const fromX = follows ? f32(oldX + stageSurfaces.surfaceShiftX(stage, i, matchFrame)) : oldX;
    const fraction = fromZ === motion.z ? 1.0 : f32(f32(fromZ - platformZ) / f32(fromZ - motion.z));
    const crossingX = f32(fromX + f32(f32(motion.x - fromX) * fraction));
    const left = stageSurfaces.surfaceLeft(stage, i, matchFrame);
    const right = stageSurfaces.surfaceRight(stage, i, matchFrame);
    if (crossingX >= left && crossingX <= right && motion.x >= left && motion.x <= right) {
      if (landing === undefined || platformZ > landingZ) {
        landing = i;
        landingZ = platformZ;
      }
    }
  }
  return landing;
}


/** Input clocks: fast-fall and platform-drop hold age, sideways flick age, platform input and turnaround. True on a tumble-exit flick. */
function advanceStickClocks(f: Fighter, input: Readonly<Controls>, downHeld: boolean, horizontalStick: number): boolean {
  const { motion } = f;
  motion.fastFallInputAge = downHeld ? (motion.fastFallDownHeld ? min(PLATFORM_DROP_INPUT_WINDOW, motion.fastFallInputAge + 1) : 0) : PLATFORM_DROP_INPUT_WINDOW;
  motion.fastFallDownHeld = downHeld;
  const stickSide = horizontalStick >= STICK_SMASH_DEADZONE_X ? 1 : horizontalStick <= -STICK_SMASH_DEADZONE_X ? -1 : 0;
  const tumbleExitFlick = stickSide !== 0 && stickSide !== motion.previousStickSide && Math.abs(horizontalStick) >= TUMBLE_EXIT_STICK_X;
  motion.stickSideAge = stickSide === 0 ? WALL_JUMP_FLICK_FRAMES : stickSide === motion.previousStickSide ? min(WALL_JUMP_FLICK_FRAMES, motion.stickSideAge + 1) : 0;
  platforms.trackPlatformInput(f);
  motion.previousStickSide = stickSide;
  if (input.direction !== 0) {
    motion.turnaroundSide = input.direction < 0 ? -1 : 1;
    motion.turnaroundAge = 0;
  } else {
    motion.turnaroundAge = min(TURNAROUND_SPECIAL_WINDOW_FRAMES + 1, motion.turnaroundAge + 1);
  }
  return tumbleExitFlick;
}


/** Launch phase clocks: hitlag, the parry buffer it holds, tech input and knockback age. Returns the parry option released this frame. */
export function advanceLaunchClocks(f: Fighter, input: Readonly<Controls>, hitlagBefore: number): ParryBuffer {
  const { launch, shield } = f;
  launch.hitlag = max(0, launch.hitlag - 1);
  launch.hitlagEndAge = hitlagBefore > 0 ? 0 : min(16, launch.hitlagEndAge + 1);

  let parryOption: ParryBuffer = ParryBuffer.none;
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
  return parryOption;
}


/** A raised shield drains; true when it broke this frame. */
function drainRaisedShield(world: Roster, slot: number, stage: number, input: Readonly<Controls>): boolean {
  const f = fighterAt(world, slot);
  const { launch, shield } = f;
  if (!(launch.hitlag <= 0 && shield.raised && shieldDrainShouldResume(f, shield.stun > 0))) return false;
  if (input.shield) shield.strength = input.shieldStrength;
  shield.energy = subtractFloat32(shield.energy, shieldDrain(shield.strength));
  if (!(shield.energy < 0)) return false;
  shield.energy = 0.0;
  beginShieldBreak(world, slot);
  checkBlastZone(world, slot, stage);
  return true;
}


/** The frame hitlag ends spends queued SDI, or applies DI and automatic SDI; during hitlag SDI applies. */
function resolvePendingInfluence(world: Roster, slot: number, stage: number, matchFrame: number, input: Readonly<Controls>): void {
  const f = fighterAt(world, slot);
  const { launch } = f;
  if (launch.hitlag > 0) {
    applySmashDirectionalInfluence(world, slot, stage, matchFrame, input);
  } else {
    discardPendingSmashDirectionalInfluence(launch);
    if (!f.status.out) {
      applyDirectionalInfluence(f, input);
      applyAutomaticSmashDirectionalInfluence(world, slot, stage, matchFrame, input);
    }
  }
}


/** Jump presses: a water jump when wet, else an ordinary jump; a held squat keeps the full-hop flag. True on a water jump. */
function beginJumpInput(f: Fighter, input: Readonly<Controls>, parryOption: ParryBuffer, wallJumped: boolean, wet: boolean, squatBeforeInput: number): boolean {
  const { jump, launch } = f;
  const waterJumped = wet && (input.jumpPressed || parryOption === ParryBuffer.jump) && !wallJumped && sea.beginWaterJump(f, input.direction);
  if ((input.jumpPressed || parryOption === ParryBuffer.jump) && !wallJumped && !waterJumped) beginJump(f, input.direction, input.shortHopPressed);
  if (jump.squat > 0 && launch.hitlag === 0 && (f.character === Character.demonHunter || squatBeforeInput !== 1)) jump.held = jump.held && input.jumpHeld;
  return waterJumped;
}


/** An air dodge press dodges now, or queues for jump squat's takeoff and follows the stick while queued. */
function bufferAirDodgeInput(f: Fighter, input: Readonly<Controls>): void {
  const { jump } = f;
  if (input.airDodgePressed && !exSpecialPressed(input)) {
    if (f.motion.grounded && jump.squat > 0) {
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
}


/** A shield-held dodge press or a buffered parry roll starts a ground dodge; true when one started. */
function beginGroundDodgeInput(f: Fighter, input: Readonly<Controls>, parryOption: ParryBuffer, parryDirection: number): boolean {
  const dodgePressed = input.groundDodgePressed && input.shield && !exSpecialPressed(input);
  if (!((dodgePressed || parryOption === ParryBuffer.groundDodge) && !input.jumpPressed && canBeginGroundDodge(f))) return false;
  beginGroundDodge(f, dodgePressed ? input.groundDodgeDirection : parryDirection);
  return true;
}


function advancePlatformTransit(world: Roster, slot: number, stage: number, matchFrame: number, input: Readonly<Controls>): void {
  const f = fighterAt(world, slot);
  const { motion, status } = f;
  const transitOldX = motion.x;
  const transitOldZ = motion.z;
  status.invincible = max(0, status.invincible - 1);
  platforms.advancePlatformMove(f, stage, matchFrame, input);
  motion.deltaX = f32(motion.x - transitOldX);
  motion.deltaZ = f32(motion.z - transitOldZ);
  checkBlastZone(world, slot, stage);
}


/** A knocked-down fighter moves by its down state; true when the down state took the frame. */
function advanceDownMotion(world: Roster, slot: number, stage: number, matchFrame: number, input: Readonly<Controls>): boolean {
  const f = fighterAt(world, slot);
  const { motion } = f;
  const downOldX = motion.x;
  const downOldZ = motion.z;
  if (!advanceDownState(f, stage, matchFrame, input)) return false;
  resolveDownGroundContact(f, stage, matchFrame);
  motion.deltaX = f32(motion.x - downOldX);
  motion.deltaZ = f32(motion.z - downOldZ);
  checkBlastZone(world, slot, stage);
  return true;
}


function advanceAirDodgeClock(f: Fighter): void {
  const { dodge } = f;
  if (dodge.airDodging) dodge.airFrame = min(AIR_DODGE_ANIMATION_FRAMES, dodge.airFrame + 1);
  if (dodge.airDodging && dodge.airFrame >= AIR_DODGE_ANIMATION_FRAMES) {
    dodge.airDodging = false;
    dodge.airFrame = 0;
  }
}


function exitTumbleOnFlick(f: Fighter, tumbleExitFlick: boolean): void {
  const { motion, launch } = f;
  if (isTumbling(f) && !motion.grounded && launch.hitstun <= 0 && launch.hitlag <= 0 && tumbleExitFlick) {
    clearDownState(f);
    const airSpeed = speedBuffed(f, f.tuning.physics.airSpeed);
    motion.vx = max(-airSpeed, min(airSpeed, motion.vx));
  }
}


function canSteerFighter(f: Fighter, authoredMotion: boolean, dodgeActive: boolean, smashChargePaused: boolean): boolean {
  const { motion, launch, shield, dodge } = f;
  return !authoredMotion && f.down.state === DownState.none && launch.hitstun <= 0 && (!dodge.airDodging || !dodgeActive) && !isGroundDodging(f)
    && shield.releaseLag <= 0 && f.landing.lag <= 0 && shield.stun <= 0 && f.jump.squat <= 0 && !smashChargePaused
    && (!motion.grounded || f.attack.cooldown <= 0) && f.surfaceRecovery.state !== SurfaceContact.techWall;
}


function crouchHeld(f: Fighter, input: Readonly<Controls>, horizontalStick: number, canSteer: boolean, wantsShield: boolean): boolean {
  return input.down && wantsCrouch(f, input, horizontalStick) && f.motion.grounded && canSteer && !wantsShield
    && f.attack.style === undefined && f.special.action === SpecialAction.none
    && groundOptionOpen(f, GroundOption.crouch);
}


/**
 * Ground and air phase, sideways: crouch, run, dash, air drift or swim, then a ground dodge's travel or drag.
 * Returns the dash-entry displacement adjustment this frame's ground movement made.
 */
export function steerHorizontalVelocity(f: Fighter, stage: number, input: Readonly<Controls>, horizontalStick: number, canSteer: boolean, wantsShield: boolean,
  groundTakeoff: boolean, authoredMotion: boolean, dodgeActive: boolean, wet: boolean): number {
  const { motion, launch, dodge } = f;
  let direction = input.direction;
  let dashEntryDisplacementAdjustment = 0.0;
  motion.crouching = crouchHeld(f, input, horizontalStick, canSteer, wantsShield);
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

      if (advanceGroundMovement(f, direction, input.walking, horizontalStick, stageSurfaces.floorFriction(stage, motion))) dashEntryDisplacementAdjustment = f32(previousGroundVelocity - motion.vx);
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
    const physics = f.tuning.physics;
    const drag = motion.grounded ? stageSurfaces.floorTraction(physics.traction, stageSurfaces.floorFriction(stage, motion)) : physics.airFriction;
    motion.vx = motion.vx > 0 ? max(0.0, f32(motion.vx - drag)) : min(0.0, f32(motion.vx + drag));
  }
  return dashEntryDisplacementAdjustment;
}


/** A down press drops through the platform just landed on, or descends a pass-through platform; true when either began. */
function dropThroughPlatform(f: Fighter, stage: number, matchFrame: number, input: Readonly<Controls>): boolean {
  const { motion } = f;
  if (platforms.dropAfterPlatformLanding(f, stage, matchFrame, input)) return true;
  if (!(input.down && !input.walking && motion.fastFallInputAge < PLATFORM_DROP_INPUT_WINDOW && !input.attackRequested && f.down.state === DownState.none
    && motion.grounded && motion.surface !== undefined && stageSurfaces.surfacePass(stage, motion.surface) && canAttack(f))) return false;
  platforms.beginPlatformDescent(f, stage, matchFrame, motion.surface);
  return true;
}


function decayMomentum(f: Fighter, stage: number, dodgeActive: boolean): void {
  const { motion } = f;
  decayKnockback(f, stageSurfaces.floorFriction(stage, motion));
  decayShieldMotion(f, stageSurfaces.floorFriction(stage, motion));
  if (dodgeActive && !motion.grounded) {
    motion.vx = f32(motion.vx * AIR_DODGE_DECAY);
    motion.vz = f32(motion.vz * AIR_DODGE_DECAY);
  }
}


/**
 * Air phase, vertical: a dodge or jump squat pins the body to its deck, water buoys it, otherwise an authored fall,
 * fast fall or gravity sets vz. True when the body is buoyant this frame.
 */
export function applyVerticalVelocity(f: Fighter, stage: number, matchFrame: number, input: Readonly<Controls>, drill: ReturnType<typeof attackFall>, downHeld: boolean,
  wet: boolean, waterJumped: boolean, dodgeActive: boolean, authoredMotion: boolean, groundTakeoff: boolean): boolean {
  const { motion, launch } = f;
  if (isGroundDodging(f) || (motion.grounded && f.jump.squat > 0)) {
    motion.vz = 0.0;
    motion.z = stageSurfaces.surfaceZAt(stage, motion.surface ?? 0, matchFrame, motion.x);
  } else if (wet && !waterJumped && launch.hitstun <= 0 && !dodgeActive && !authoredMotion && drill?.speedZ === undefined) {
    sea.applyBuoyancy(f);
    return true;
  } else if ((!dodgeActive || motion.grounded) && !groundTakeoff && !authoredMotion) {
    if (!motion.grounded && !motion.fastFalling && downHeld && motion.fastFallInputAge < FAST_FALL_INPUT_WINDOW && input.direction === 0
      && f.down.state === DownState.none && launch.hitstun <= 0 && motion.vz < 0) {
      motion.fastFalling = true;
      motion.fastFallInputAge = PLATFORM_DROP_INPUT_WINDOW;
    }
    if (drill?.speedZ !== undefined) motion.vz = drill.speedZ;
    else if (motion.fastFalling) motion.vz = -heavyFall(f, f.tuning.physics.fastFallSpeed);
    else applyMeleeGravity(f);
  }
  return false;
}


/**
 * Ledge and edge phase: pass a stage edge, ride or meet a wall, then land on the deck crossed, take a platform
 * contact, or leave the ground; airborne bodies may wall jump.
 */
export function resolveEdgesAndLanding(world: Roster, slot: number, stage: number, matchFrame: number, input: Readonly<Controls>,
  oldX: number, oldZ: number, carried: number | undefined, horizontalStick: number): void {
  const f = fighterAt(world, slot);
  const { motion, dodge, jump } = f;
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
    if (motion.grounded) {
      jump.remaining = min(jump.remaining, aerialJumps(f));
      slideOffEdge(f);
    }
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
}


export function advanceFighterMotion(world: Roster, slot: number, stage: number, matchFrame: number, input: Readonly<Controls>, respawnX: number): void {
  const f = fighterAt(world, slot);
  const { motion, launch, shield, attack, jump, dodge, status } = f;
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
  const horizontalStick = stickX(input);
  const tumbleExitFlick = advanceStickClocks(f, input, downHeld, horizontalStick);

  const hitlagBefore = launch.hitlag;
  const parryDirection = shield.parryBufferDirection;
  const parryOption = advanceLaunchClocks(f, input, hitlagBefore);
  if (f.ledge.state !== LedgeState.none) {
    advanceLedge(world, slot, stage, input);
    return;
  }
  if (shield.breakState !== ShieldBreak.none && advanceShieldBreak(world, slot, stage, matchFrame, input)) return;
  if (drainRaisedShield(world, slot, stage, input)) return;
  if (launch.hitlag <= 0) {
    f.surfaceRecovery.reflectCooldown = max(0, f.surfaceRecovery.reflectCooldown - 1);
    endFinishedDownStates(f);
  }
  const wallJumped = advanceSurfaceRecovery(f, input);
  const wallTechStartup = f.surfaceRecovery.state === SurfaceContact.techWall && f.surfaceRecovery.frame < WALL_TECH_STARTUP_FRAMES;
  if (hitlagBefore > 0 && launch.diPending) resolvePendingInfluence(world, slot, stage, matchFrame, input);
  if (status.out) return;
  if (wallTechStartup || inGrabContext(f)) {
    if (launch.hitlag <= 0) status.invincible = max(0, status.invincible - 1);
    checkBlastZone(world, slot, stage);
    return;
  }
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
  const waterJumped = beginJumpInput(f, input, parryOption, wallJumped, wet, squatBeforeInput);
  bufferAirDodgeInput(f, input);
  const groundDodgeStarted = beginGroundDodgeInput(f, input, parryOption, parryDirection);
  const groundTakeoff = advanceJumpSquat(f, input, squatBeforeInput);
  if (launch.hitlag > 0) return;
  advanceShieldInputClocks(f, input);
  advanceGroundDodge(f, groundDodgeStarted);
  checkBlastZone(world, slot, stage);
  if (status.out) return;
  if (f.platform.move !== PlatformMove.none) {
    advancePlatformTransit(world, slot, stage, matchFrame, input);
    return;
  }
  if (advanceDownMotion(world, slot, stage, matchFrame, input)) return;
  const forcedShield = shield.raised && shield.stun > 0;
  shield.stun = max(0, shield.stun - 1);
  status.invincible = max(0, status.invincible - 1);
  advanceAirDodgeClock(f);
  const dodgeActive = dodge.airMotionFrames > 0;
  dodge.airMotionFrames = max(0, dodge.airMotionFrames - 1);
  shield.releaseLag = max(0, shield.releaseLag - 1);
  const wantsShield = advanceGuard(f, input, forcedShield);
  exitTumbleOnFlick(f, tumbleExitFlick);

  const authoredMotion = carryHeroStatus(f) || heroMotionHolds(f) || demonHunterGliding(f);
  const canSteer = canSteerFighter(f, authoredMotion, dodgeActive, smashChargePaused);
  let dashEntryDisplacementAdjustment = steerHorizontalVelocity(f, stage, input, horizontalStick, canSteer, wantsShield, groundTakeoff, authoredMotion, dodgeActive, wet);


  if (dropThroughPlatform(f, stage, matchFrame, input)) {
    checkBlastZone(world, slot, stage);
    return;
  }
  const oldX = motion.x;
  const oldZ = motion.z;
  dashEntryDisplacementAdjustment = f32(dashEntryDisplacementAdjustment + attackStartupTravel(world, slot));
  decayMomentum(f, stage, dodgeActive);
  const drill = motion.grounded ? undefined : attackFall(attack.style, attack.frame, f.tuning.moves);
  moveHorizontally(f, stage, matchFrame, dashEntryDisplacementAdjustment);
  const buoyant = applyVerticalVelocity(f, stage, matchFrame, input, drill, downHeld, wet, waterJumped, dodgeActive, authoredMotion, groundTakeoff);
  moveMeleeVerticalVelocity(f);
  moveMeleeZ(f, divideFloat32(launch.knockbackZ, WORLD_UNITS_PER_MELEE_UNIT));
  moveMeleeZ(f, divideFloat32(shield.recoilZ, WORLD_UNITS_PER_MELEE_UNIT));
  if (buoyant) sea.floatAtSurface(f);

  if (!isGroundDodging(f)) moveMeleeX(f, windPush(stage, matchFrame, motion.x, motion.z));
  resolveEdgesAndLanding(world, slot, stage, matchFrame, input, oldX, oldZ, carried, horizontalStick);
  endCannonPass(f, stage);
  checkBlastZone(world, slot, stage);
  motion.deltaX = f32(motion.x - oldX);
  motion.deltaZ = f32(motion.z - oldZ);
}

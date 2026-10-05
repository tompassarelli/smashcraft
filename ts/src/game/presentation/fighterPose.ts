import { max, min } from "../../runtime/wurst";
import { f32 } from "waygate/src/sim/f32";
import { AttackPhase, AttackStyle, Character, DownState, GrabAction, LedgeState, ShieldBreak, SpecialAction } from "../sim/codes";
import { GROUND_ROLL_FRAMES, SPOT_DODGE_FRAMES, attackPhase, inGrabContext, isForwardGroundRoll, isGroundDodging } from "../sim/conditions";
import { DOWN_BOUND_FRAMES, DOWN_DAMAGE_FRAMES, DOWN_ROLL_FRAMES, DOWN_STAND_FRAMES, TECH_IN_PLACE_FRAMES, TECH_ROLL_FRAMES } from "../sim/down";
import type { Fighter } from "../sim/fighter";
import { AIR_DODGE_ANIMATION_FRAMES } from "../sim/jumpsAndDodges";
import { LEDGE_CLIMB_FRAMES, LEDGE_ROLL_FRAMES } from "../sim/ledge";
import { totalVelocityX } from "../sim/motion";
import { LEDGE_ATTACK_FRAMES, attackDurationFramesForGrounding, attackStartupFrames, grabActionDuration } from "../sim/moves";
import { type Controls, type Roster, fighterAt } from "../sim/roster";
import { SHIELD_RELEASE_LAG_FRAMES } from "../sim/shield";
import { INITIAL_DASH_FRAMES, SHIELD_BREAK_LAND_FRAMES, SHIELD_BREAK_STAND_FRAMES, authoredPhysics } from "../sim/tuning";
import { DamagePose, damagePose } from "./damagePose";
import * as dh from "./demonHunterAssetInfo";
import * as clips from "./fighterClips";
import {
  ESCAPE_FRAMES, IllidanLocomotion, LEDGE_CATCH_FRAMES, RESPAWN_FRAMES, TRANSITION_FRAMES, type IllidanMotion,
  advanceIllidanMotion, clearIllidanMotion, copyIllidanMotion, createIllidanMotion, firstIllidanMotionDifference,
} from "./illidanMotion";

export const FRAME_SECONDS = f32(0.016666667);
const REACTION_CLIP_FRAMES = 24;
const JUMP_CLIP_FRAMES = 24;
const DOUBLE_JUMP_CLIP_FRAMES = 30;
const CROUCH_CLIP_FRAMES = 24;
const SHIELD_RAISE_FRAMES = 4;

/**
 * Completed-frame presentation state, without engine handles. The clip clock
 * is seconds since the latest selection; the renderer owns loop and clamp
 * sampling.
 */
export interface FighterPose {
  /** The selection key: a changed key selects its clip, an unchanged one keeps it playing. */
  animation: string;
  jumpAnimationRemaining: number;
  doubleJumpAnimation: boolean;
  /** A landing keeps the rate its lag gave it on entry. */
  landingAnimationRate: number;
  readonly motion: IllidanMotion;
  /** The selected model sequence, or undefined when clipName names the clip. */
  clipIndex: number | undefined;
  clipName: string;
  clipTime: number;
  rate: number;
  /** Counts selections, so restarting the same clip is a new one. */
  selectionSerial: number;
}

export function createFighterPose(): FighterPose {
  return {
    animation: "", jumpAnimationRemaining: 0, doubleJumpAnimation: false, landingAnimationRate: 1.0,
    motion: createIllidanMotion(), clipIndex: undefined, clipName: "stand", clipTime: 0.0, rate: 1.0, selectionSerial: 0,
  };
}

export function clearFighterPose(pose: FighterPose): void {
  pose.animation = "";
  pose.jumpAnimationRemaining = 0;
  pose.doubleJumpAnimation = false;
  pose.landingAnimationRate = 1.0;
  clearIllidanMotion(pose.motion);
  pose.clipIndex = undefined;
  pose.clipName = "stand";
  pose.clipTime = 0.0;
  pose.rate = 1.0;
  pose.selectionSerial = 0;
}

/** Copies between worlds; slot references keep only participants of the source world. */
export function copyFighterPoseInto(target: FighterPose, source: Readonly<FighterPose>, sourceWorld: Readonly<Roster>): void {
  target.animation = source.animation;
  target.jumpAnimationRemaining = source.jumpAnimationRemaining;
  target.doubleJumpAnimation = source.doubleJumpAnimation;
  target.landingAnimationRate = source.landingAnimationRate;
  target.clipIndex = source.clipIndex;
  target.clipName = source.clipName;
  target.clipTime = source.clipTime;
  target.rate = source.rate;
  target.selectionSerial = source.selectionSerial;
  copyIllidanMotion(target.motion, source.motion, sourceWorld);
}

export function firstFighterPoseDifference(
  expected: Readonly<FighterPose>, actual: Readonly<FighterPose>, world: Readonly<Roster>, actualWorld: Readonly<Roster>,
): string | undefined {
  if (expected.animation !== actual.animation) return "animation";
  if (expected.jumpAnimationRemaining !== actual.jumpAnimationRemaining) return "jumpAnimationRemaining";
  if (expected.doubleJumpAnimation !== actual.doubleJumpAnimation) return "doubleJumpAnimation";
  if (expected.landingAnimationRate !== actual.landingAnimationRate) return "landingAnimationRate";
  if (expected.clipIndex !== actual.clipIndex) return "clipIndex";
  if (expected.clipName !== actual.clipName) return "clipName";
  if (expected.clipTime !== actual.clipTime) return "clipTime";
  if (expected.rate !== actual.rate) return "rate";
  if (expected.selectionSerial !== actual.selectionSerial) return "selectionSerial";
  return firstIllidanMotionDifference(expected.motion, actual.motion, world, actualWorld);
}

export function selectFighterClipIndex(pose: FighterPose, index: number): void {
  pose.clipIndex = index;
  pose.clipName = "";
  pose.clipTime = 0.0;
  pose.selectionSerial++;
}

export function selectFighterClipName(pose: FighterPose, name: string): void {
  pose.clipIndex = undefined;
  pose.clipName = name;
  pose.clipTime = 0.0;
  pose.selectionSerial++;
}

/** Selects the keyed clip unless that key is already playing. */
function playIndex(pose: FighterPose, key: string, index: number): void {
  if (pose.animation === key) return;
  selectFighterClipIndex(pose, index);
  pose.animation = key;
}

function playName(pose: FighterPose, key: string, name: string): void {
  if (pose.animation === key) return;
  selectFighterClipName(pose, name);
  pose.animation = key;
}

/** The rate that plays a clip of the given length over the given frames. */
const clipRate = (seconds: number, frames: number): number => f32(seconds / f32(frames * FRAME_SECONDS));

/**
 * Advances one executed frame. `jumped` and `attacked` report a new jump or
 * attack serial, and `hit` new damage or shield damage, during this frame.
 */
export function advanceFighterPose(
  pose: FighterPose, fighter: Readonly<Fighter>, world: Readonly<Roster>, controls: Readonly<Controls>,
  wasOut: boolean, jumped: boolean, attacked: boolean, hit: boolean,
): void {
  // Integrate the interval that just elapsed, before this frame changes the
  // selection or freezes its rate. A new selection starts at zero.
  pose.clipTime = f32(pose.clipTime + f32(pose.rate * FRAME_SECONDS));
  const phase = attackPhase(fighter);
  if (attacked && phase !== AttackPhase.none) selectAttackClip(pose, fighter);
  advanceIllidanMotion(pose.motion, fighter, controls, world);
  if (hit) {
    pose.motion.escapeRemaining = 0;
    pose.motion.respawnRemaining = 0;
  }
  if (fighter.status.out) {
    if (fighter.character === Character.demonHunter && !wasOut) {
      selectFighterClipIndex(pose, dh.DEMON_HUNTER_KO_INDEX);
      pose.rate = 1.0;
      pose.animation = "ko";
    }
    return;
  }
  if (fighter.status.frozenFrames > 0) {
    pose.rate = 0.0;
    return;
  }
  advanceJumpClip(pose, fighter, phase, wasOut, jumped);
  const rate = selectClip(pose, fighter, world, phase, hit);
  // A contact selects the victim's reaction while the attacker keeps its
  // contact pose; hitlag only stops the clock, so the held clip resumes.
  pose.rate = fighter.launch.hitlag > 0 || fighter.attack.smashCharging ? 0.0 : rate;
}

function advanceJumpClip(pose: FighterPose, f: Readonly<Fighter>, phase: AttackPhase, wasOut: boolean, jumped: boolean): void {
  const busy = f.motion.grounded || f.launch.hitstun > 0 || f.dodge.airDodging || phase !== AttackPhase.none
    || f.special.action !== SpecialAction.none || f.down.state !== DownState.none
    || f.shield.breakState !== ShieldBreak.none || f.ledge.state !== LedgeState.none;
  if (busy) pose.jumpAnimationRemaining = 0;
  else if (jumped && !wasOut) {
    pose.doubleJumpAnimation = f.jump.isDouble;
    pose.jumpAnimationRemaining = pose.doubleJumpAnimation ? DOUBLE_JUMP_CLIP_FRAMES : JUMP_CLIP_FRAMES;
    pose.animation = "";
  } else if (pose.jumpAnimationRemaining > 0 && f.launch.hitlag <= 0) pose.jumpAnimationRemaining--;
  // Illidan's rising jump clip gives way to his fall, except off a ledge.
  if (f.character === Character.demonHunter && f.motion.vz < 0 && !pose.motion.ledgeJump) pose.jumpAnimationRemaining = 0;
}

/** Knockdown states with their own clip; tumble and get-up attacks play other poses. */
const posesDown = (f: Readonly<Fighter>): boolean =>
  f.down.state !== DownState.none && f.down.state !== DownState.tumble && f.down.state !== DownState.attack;

/** Selects this frame's clip and returns its rate. Earlier states take precedence. */
function selectClip(pose: FighterPose, f: Readonly<Fighter>, world: Readonly<Roster>, phase: AttackPhase, hit: boolean): number {
  const reaction = damagePose(f);
  const rate = actionRate(pose, f, phase, reaction);
  const { character } = f;
  const illidan = character === Character.demonHunter;
  if (inGrabContext(f)) return selectGrabClip(pose, f, world);
  if (f.ledge.state !== LedgeState.none) {
    const catching = illidan && f.ledge.state === LedgeState.hang && pose.motion.ledgeCatchRemaining > 0;
    const index = catching ? dh.DEMON_HUNTER_LEDGE_CATCH_INDEX : clips.ledgeClips(f.ledge.state)[character].index;
    playIndex(pose, `ledge${f.ledge.state}${catching ? ":catch" : ""}`, index);
    if (catching) return clipRate(dh.DEMON_HUNTER_LEDGE_CATCH_SECONDS, LEDGE_CATCH_FRAMES);
    return illidan && f.ledge.state === LedgeState.hang ? 0.0 : rate;
  }
  if (f.shield.breakState !== ShieldBreak.none) {
    const key = `shieldbreak${f.shield.breakState}`;
    if (pose.animation !== key) {
      if (f.shield.breakState === ShieldBreak.land) selectFighterClipIndex(pose, clips.KNOCKDOWN[character].index);
      else if (f.shield.breakState === ShieldBreak.stand) selectFighterClipIndex(pose, clips.GET_UP[character].index);
      else if (illidan) selectFighterClipIndex(pose, dh.DEMON_HUNTER_SHIELD_BREAK_INDEX);
      else selectFighterClipName(pose, "stand hit");
      pose.animation = key;
    }
    return rate;
  }
  if (posesDown(f)) {
    const key = `down${f.down.state}`;
    // A down hit restarts its clip; waiting holds the knockdown clip except for Illidan.
    if (pose.animation !== key || (f.down.state === DownState.damage && hit)) {
      if (f.down.state !== DownState.wait) selectFighterClipIndex(pose, downClipIndex(f));
      else if (illidan) selectFighterClipIndex(pose, dh.DEMON_HUNTER_DOWN_WAIT_INDEX);
      pose.animation = key;
    }
    return rate;
  }
  if (illidan && pose.motion.escapeRemaining > 0) {
    playIndex(pose, "grab-escape", dh.DEMON_HUNTER_GRAB_ESCAPE_INDEX);
    return clipRate(dh.DEMON_HUNTER_GRAB_ESCAPE_SECONDS, ESCAPE_FRAMES);
  }
  if (reaction !== DamagePose.none) {
    const key = `damage${reaction}`;
    // Every new contact restarts the reaction.
    if (hit || pose.animation !== key) {
      selectFighterClipIndex(pose, damageClips(reaction)[character].index);
      pose.animation = key;
    }
    return rate;
  }
  if (f.special.fall) {
    playIndex(pose, "specialfall", clips.FALL_SPECIAL[character].index);
    return rate;
  }
  if (isGroundDodging(f)) {
    playIndex(pose, "dodge", groundDodgeClip(f).index);
    return rate;
  }
  if (f.special.action !== SpecialAction.none && f.launch.hitstun === 0) {
    playIndex(pose, `special${f.special.action}`, fighterSpecialClip(f).index);
    return rate;
  }
  if (illidan) {
    const illidanRate = selectIllidanAction(pose, f);
    if (illidanRate !== undefined) return illidanRate;
  }
  if (pose.jumpAnimationRemaining > 0) {
    playIndex(pose, "jump", (pose.doubleJumpAnimation ? clips.DOUBLE_JUMP : clips.JUMP)[character].index);
    return rate;
  }
  if (phase !== AttackPhase.none || f.launch.hitstun !== 0 || f.launch.hitlag !== 0) {
    pose.animation = "";
    return rate;
  }
  if (illidan) {
    const { motion } = pose.motion;
    playIndex(pose, `motion${motion}`, locomotionClipIndex(motion));
    return locomotionRate(f, motion);
  }
  const walking = f.motion.grounded && Math.abs(totalVelocityX(f)) > f32(0.1);
  playName(pose, walking ? "walk" : "stand", walking ? "walk" : "stand");
  return walking ? min(f32(1.4), max(f32(0.2), f32(Math.abs(f.motion.vx) / f.tuning.physics.runSpeed))) : rate;
}

/** Holder and victim follow the holder's action; a new action or grab serial reselects. */
function selectGrabClip(pose: FighterPose, f: Readonly<Fighter>, world: Readonly<Roster>): number {
  const ownerSlot = f.grab.owner;
  const victim = ownerSlot !== undefined;
  const owner = ownerSlot === undefined ? f : fighterAt(world, ownerSlot);
  const { action, serial } = owner.grab;
  const illidanEscape = f.character === Character.demonHunter && action === GrabAction.escape;
  const key = `grab${action}:${serial}${victim ? ":victim" : ":holder"}`;
  if (pose.animation !== key) {
    if (illidanEscape) selectFighterClipIndex(pose, dh.DEMON_HUNTER_GRAB_ESCAPE_INDEX);
    else if (action === GrabAction.escape) selectFighterClipName(pose, "stand ready");
    else selectFighterClipIndex(pose, grabClipIndex(f.character, action, victim));
    pose.animation = key;
  }
  if (illidanEscape) return clipRate(dh.DEMON_HUNTER_GRAB_ESCAPE_SECONDS, grabActionDuration(action));
  // Both sides play at the holder clip's rate.
  const actionClips = clips.grabActionClips(action);
  return actionClips === undefined ? 0.0 : clipRate(actionClips.holder[f.character].seconds, grabActionDuration(action));
}

/** Illidan's own clips for dodges, landings, shielding, smash charges, respawns and ledge jumps. */
function selectIllidanAction(pose: FighterPose, f: Readonly<Fighter>): number | undefined {
  const { dodge, jump, motion, landing, shield, attack } = f;
  if (dodge.airDodging) {
    playIndex(pose, "air-dodge", dh.DEMON_HUNTER_AIR_DODGE_INDEX);
    return clipRate(dh.DEMON_HUNTER_AIR_DODGE_SECONDS, AIR_DODGE_ANIMATION_FRAMES);
  }
  if (jump.squat > 0) {
    playIndex(pose, "jump-squat", dh.DEMON_HUNTER_JUMP_SQUAT_INDEX);
    return clipRate(dh.DEMON_HUNTER_JUMP_SQUAT_SECONDS, authoredPhysics(f.character).jumpSquatFrames);
  }
  if (motion.grounded && landing.lag > 0) {
    if (pose.animation !== "landing") {
      const special = pose.animation === "specialfall" || pose.animation === "air-dodge";
      selectFighterClipIndex(pose, special ? dh.DEMON_HUNTER_LAND_SPECIAL_INDEX : dh.DEMON_HUNTER_LAND_INDEX);
      pose.landingAnimationRate = clipRate(special ? dh.DEMON_HUNTER_LAND_SPECIAL_SECONDS : dh.DEMON_HUNTER_LAND_SECONDS, landing.lag);
      pose.animation = "landing";
    }
    return pose.landingAnimationRate;
  }
  if (shield.raised) {
    const raising = shield.heldFrames <= SHIELD_RAISE_FRAMES;
    playIndex(pose, raising ? "shield-raise" : "shield-hold", raising ? dh.DEMON_HUNTER_SHIELD_RAISE_INDEX : dh.DEMON_HUNTER_SHIELD_HOLD_INDEX);
    return raising ? clipRate(dh.DEMON_HUNTER_SHIELD_RAISE_SECONDS, SHIELD_RAISE_FRAMES) : 0.0;
  }
  if (shield.releaseLag > 0) {
    playIndex(pose, "shield-release", dh.DEMON_HUNTER_SHIELD_RELEASE_INDEX);
    return clipRate(dh.DEMON_HUNTER_SHIELD_RELEASE_SECONDS, SHIELD_RELEASE_LAG_FRAMES);
  }
  const { style } = attack;
  if (attack.smashCharging) {
    playIndex(pose, "smash-charge", clips.illidanSmashClips(style).charge.index);
    return 0.0;
  }
  // A released charge plays its release over the rest of the attack.
  if (style !== undefined && (pose.animation === "smash-charge" || pose.animation === "smash-release")) {
    const release = clips.illidanSmashClips(style).release;
    if (pose.animation === "smash-charge") {
      selectFighterClipIndex(pose, release.index);
      pose.animation = "smash-release";
    }
    return clipRate(release.seconds, attack.duration - attackStartupFrames(style));
  }
  if (pose.motion.respawnRemaining > 0) {
    playIndex(pose, "respawn", dh.DEMON_HUNTER_RESPAWN_INDEX);
    return clipRate(dh.DEMON_HUNTER_RESPAWN_SECONDS, RESPAWN_FRAMES);
  }
  if (pose.motion.ledgeJump && pose.jumpAnimationRemaining > 0) {
    playIndex(pose, "ledge-jump", dh.DEMON_HUNTER_LEDGE_JUMP_INDEX);
    return clipRate(dh.DEMON_HUNTER_LEDGE_JUMP_SECONDS, JUMP_CLIP_FRAMES);
  }
  return undefined;
}

/** An attack's start selects its clip; Illidan's smash charge may later replace it. */
function selectAttackClip(pose: FighterPose, f: Readonly<Fighter>): void {
  const { style } = f.attack;
  if (f.character === Character.demonHunter) {
    pose.animation = "";
    const own = clips.illidanAttackClip(style);
    if (own !== undefined) {
      selectFighterClipIndex(pose, own.index);
      return;
    }
  }
  const shared = clips.attackClips(style);
  if (shared === undefined) selectFighterClipName(pose, "attack");
  else selectFighterClipIndex(pose, shared[f.character].index);
}

/** The rate that fits the current action's clip to the action's frames; 1 without one. */
function actionRate(pose: Readonly<FighterPose>, f: Readonly<Fighter>, phase: AttackPhase, reaction: DamagePose): number {
  const { character } = f;
  if (f.ledge.state === LedgeState.climb) return clipRate(clips.LEDGE_CLIMB[character].seconds, LEDGE_CLIMB_FRAMES);
  if (f.ledge.state === LedgeState.roll) return clipRate(clips.LEDGE_ROLL[character].seconds, LEDGE_ROLL_FRAMES);
  if (f.ledge.state === LedgeState.attack) return clipRate(clips.LEDGE_ATTACK[character].seconds, LEDGE_ATTACK_FRAMES);
  if (f.shield.breakState === ShieldBreak.land) return clipRate(clips.KNOCKDOWN[character].seconds, SHIELD_BREAK_LAND_FRAMES);
  if (f.shield.breakState === ShieldBreak.stand) return clipRate(clips.GET_UP[character].seconds, SHIELD_BREAK_STAND_FRAMES);
  if (posesDown(f)) return downRate(f);
  if (reaction !== DamagePose.none) return clipRate(damageClips(reaction)[character].seconds, REACTION_CLIP_FRAMES);
  if (f.special.fall) return 0.0;
  if (isGroundDodging(f)) return clipRate(groundDodgeClip(f).seconds, f.dodge.groundDirection === 0 ? SPOT_DODGE_FRAMES : GROUND_ROLL_FRAMES);
  if (f.special.action !== SpecialAction.none && f.launch.hitstun === 0) return clipRate(fighterSpecialClip(f).seconds, f.special.duration);
  if (pose.jumpAnimationRemaining > 0) {
    return pose.doubleJumpAnimation
      ? clipRate(clips.DOUBLE_JUMP[character].seconds, DOUBLE_JUMP_CLIP_FRAMES)
      : clipRate(clips.JUMP[character].seconds, JUMP_CLIP_FRAMES);
  }
  return attackRate(f, phase);
}

function attackRate(f: Readonly<Fighter>, phase: AttackPhase): number {
  if (phase === AttackPhase.none) return 1.0;
  const { style, duration } = f.attack;
  if (f.character === Character.demonHunter) {
    const own = clips.illidanAttackClip(style);
    if (own !== undefined) return clipRate(own.seconds, duration);
  }
  // A ledge attack's clip spans the ledge option, not the attack's duration.
  if (style === AttackStyle.ledgeAttack) return clipRate(clips.GET_UP_ATTACK[f.character].seconds, LEDGE_ATTACK_FRAMES);
  const shared = clips.attackClips(style);
  return shared === undefined ? 1.0 : clipRate(shared[f.character].seconds, duration);
}

function downClipIndex(f: Readonly<Fighter>): number {
  const { state, direction } = f.down;
  const forward = direction === f.facing;
  if (f.character === Character.demonHunter) {
    if (state === DownState.tech) return dh.DEMON_HUNTER_TECH_NEUTRAL_INDEX;
    if (state === DownState.techRoll) return forward ? dh.DEMON_HUNTER_TECH_FORWARD_INDEX : dh.DEMON_HUNTER_TECH_BACK_INDEX;
    if (state === DownState.roll) return forward ? dh.DEMON_HUNTER_GET_UP_ROLL_FORWARD_INDEX : dh.DEMON_HUNTER_GET_UP_ROLL_BACK_INDEX;
  }
  switch (state) {
    case DownState.damage: return clips.DOWN_DAMAGE[f.character].index;
    case DownState.bound:
    case DownState.wait: return clips.KNOCKDOWN[f.character].index;
    case DownState.stand:
    case DownState.tech: return clips.GET_UP[f.character].index;
    default: return (forward ? clips.ROLL_FORWARD : clips.ROLL_BACKWARD)[f.character].index;
  }
}

function downRate(f: Readonly<Fighter>): number {
  const { state, direction } = f.down;
  const forward = direction === f.facing;
  if (f.character === Character.demonHunter) {
    if (state === DownState.tech) return clipRate(dh.DEMON_HUNTER_TECH_NEUTRAL_SECONDS, TECH_IN_PLACE_FRAMES);
    if (state === DownState.techRoll) return clipRate(forward ? dh.DEMON_HUNTER_TECH_FORWARD_SECONDS : dh.DEMON_HUNTER_TECH_BACK_SECONDS, TECH_ROLL_FRAMES);
    if (state === DownState.roll) return clipRate(forward ? dh.DEMON_HUNTER_GET_UP_ROLL_FORWARD_SECONDS : dh.DEMON_HUNTER_GET_UP_ROLL_BACK_SECONDS, DOWN_ROLL_FRAMES);
  }
  switch (state) {
    case DownState.damage: return clipRate(clips.DOWN_DAMAGE[f.character].seconds, DOWN_DAMAGE_FRAMES);
    case DownState.wait: return 0.0;
    case DownState.bound: return clipRate(clips.KNOCKDOWN[f.character].seconds, DOWN_BOUND_FRAMES);
    case DownState.stand: return clipRate(clips.GET_UP[f.character].seconds, DOWN_STAND_FRAMES);
    case DownState.tech: return clipRate(clips.GET_UP[f.character].seconds, TECH_IN_PLACE_FRAMES);
    default: {
      const roll = (forward ? clips.ROLL_FORWARD : clips.ROLL_BACKWARD)[f.character];
      return clipRate(roll.seconds, state === DownState.techRoll ? TECH_ROLL_FRAMES : DOWN_ROLL_FRAMES);
    }
  }
}

function groundDodgeClip(f: Readonly<Fighter>): clips.Clip {
  if (f.dodge.groundDirection === 0) return clips.SPOT_DODGE[f.character];
  return (isForwardGroundRoll(f) ? clips.ROLL_FORWARD : clips.ROLL_BACKWARD)[f.character];
}

function fighterSpecialClip(f: Readonly<Fighter>): clips.Clip {
  const aerialShot = f.special.duration === attackDurationFramesForGrounding(AttackStyle.shot, false);
  return clips.specialClip(f.special.action, f.motion.grounded, aerialShot);
}

function damageClips(reaction: DamagePose): clips.CharacterClips {
  switch (reaction) {
    case DamagePose.ground: return clips.DAMAGE_GROUND;
    case DamagePose.tumble: return clips.DAMAGE_TUMBLE;
    case DamagePose.shield: return clips.DAMAGE_SHIELD;
    default: return clips.DAMAGE_AIR;
  }
}

function grabClipIndex(character: Character, action: GrabAction, victim: boolean): number {
  const actionClips = clips.grabActionClips(action);
  if (actionClips !== undefined) return (victim ? actionClips.victim : actionClips.holder)[character].index;
  return (victim ? clips.GRABBED : clips.GRAB_HOLD)[character].index;
}

function locomotionClipIndex(motion: IllidanLocomotion): number {
  switch (motion) {
    case IllidanLocomotion.walk: return dh.DEMON_HUNTER_WALK_FORWARD_INDEX;
    case IllidanLocomotion.run: return dh.DEMON_HUNTER_RUN_FORWARD_INDEX;
    case IllidanLocomotion.dash: return dh.DEMON_HUNTER_DASH_START_INDEX;
    case IllidanLocomotion.turn: return dh.DEMON_HUNTER_TURNAROUND_INDEX;
    case IllidanLocomotion.stop: return dh.DEMON_HUNTER_STOP_INDEX;
    case IllidanLocomotion.crouch: return dh.DEMON_HUNTER_CROUCH_INDEX;
    case IllidanLocomotion.fastFall: return dh.DEMON_HUNTER_FAST_FALL_INDEX;
    case IllidanLocomotion.fall: return dh.DEMON_HUNTER_FALL_INDEX;
    default: return dh.DEMON_HUNTER_COMBAT_IDLE_INDEX;
  }
}

/** Walking and running follow ground speed, never slower than a fifth of the clip. */
function locomotionRate(f: Readonly<Fighter>, motion: IllidanLocomotion): number {
  switch (motion) {
    case IllidanLocomotion.dash: return clipRate(dh.DEMON_HUNTER_DASH_START_SECONDS, INITIAL_DASH_FRAMES);
    case IllidanLocomotion.turn: return clipRate(dh.DEMON_HUNTER_TURNAROUND_SECONDS, TRANSITION_FRAMES);
    case IllidanLocomotion.stop: return clipRate(dh.DEMON_HUNTER_STOP_SECONDS, TRANSITION_FRAMES);
    case IllidanLocomotion.crouch: return clipRate(dh.DEMON_HUNTER_CROUCH_SECONDS, CROUCH_CLIP_FRAMES);
    case IllidanLocomotion.fall:
    case IllidanLocomotion.fastFall: return 0.0;
    case IllidanLocomotion.walk: return max(f32(0.2), f32(Math.abs(f.motion.vx) / f.tuning.physics.walkSpeed));
    case IllidanLocomotion.run: return max(f32(0.2), f32(Math.abs(f.motion.vx) / f.tuning.physics.runSpeed));
    default: return 1.0;
  }
}

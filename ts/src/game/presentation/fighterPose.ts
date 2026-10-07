// HeroClip selection and its completed-frame clock stay together: the chosen clip
// determines whether the elapsed interval advances, freezes or restarts.
import { max, min } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { AttackPhase, AttackStyle, Character, DownState, GrabAction, LedgeState, PlatformMove, ShieldBreak, SpecialAction, HeroStatusKind, SurfaceContact } from "../sim/codes";
import { FOLLOW_UP_FORM, SpecialForm } from "../sim/heroSpecials";

import { GROUND_ROLL_FRAMES, SPOT_DODGE_FRAMES, WALL_TECH_STARTUP_FRAMES, attackPhase, inGrabContext, isForwardGroundRoll, isGroundDodging } from "../sim/conditions";
import { DOWN_BOUND_FRAMES, DOWN_DAMAGE_FRAMES, DOWN_ROLL_FRAMES, DOWN_STAND_FRAMES, TECH_IN_PLACE_FRAMES, TECH_ROLL_FRAMES } from "../sim/down";
import type { Fighter } from "../sim/fighter";
import { AIR_DODGE_ANIMATION_FRAMES } from "../sim/jumpsAndDodges";
import { LEDGE_CLIMB_FRAMES, LEDGE_ROLL_FRAMES } from "../sim/ledge";
import { totalVelocityX } from "../sim/motion";
import { LEDGE_ATTACK_FRAMES, RIFLEMAN_BLASTER_AIR_FRAMES, attackStartupFrames, characterAttackActiveFrames, grabActionDuration, grabContactFrame } from "../sim/moves";
import { type Controls, type Roster, fighterAt } from "../sim/roster";
import { SHIELD_RELEASE_LAG_FRAMES } from "../sim/shield";
import { INITIAL_DASH_FRAMES, SHIELD_BREAK_LAND_FRAMES, SHIELD_BREAK_STAND_FRAMES, authoredPhysics } from "../sim/tuning";
import { DamagePose, contactDamageClip, damagePose } from "./damagePose";
import * as dh from "./demonHunterAssetInfo";
import type { HeroClip, HeroClipTable, HeroPose } from "../sim/heroes/hero";
import * as clips from "./fighterClips";
import { groundLocomotionClip, groundLocomotionRate } from "./fighterLocomotion";
import { HERO_STRIKE_MOMENTS } from "./heroStrikeMomentInfo";
import { SPECIAL_KEY } from "./heroStrikeMomentKeys";
import { heroCueWindows } from "./specialCues";
import { runningHeroSpecial } from "../sim/heroSpecialRules";
import {
  ESCAPE_FRAMES, IllidanLocomotion, LEDGE_CATCH_FRAMES, RESPAWN_FRAMES, TRANSITION_FRAMES, type IllidanMotion,
  advanceIllidanMotion, clearIllidanMotion, copyIllidanMotion, createIllidanMotion, firstIllidanMotionDifference,
} from "./illidanMotion";

/** A follow-up or a recall plays the special's follow-up pose where the table maps one. */
const playsFollowUpPose = (f: Readonly<Fighter>): boolean => f.special.form >= FOLLOW_UP_FORM || f.special.form === SpecialForm.recall;

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
    const ko = fighter.character === Character.demonHunter ? dh.DEMON_HUNTER_KO_INDEX : clips.characterClips(fighter.character).ko?.index;
    if (ko !== undefined && !wasOut) {
      selectFighterClipIndex(pose, ko);
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
    || f.shield.breakState !== ShieldBreak.none || f.ledge.state !== LedgeState.none || f.platform.move !== PlatformMove.none;
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
  const table = clips.characterClips(character);
  if (inGrabContext(f)) return selectGrabClip(pose, f, world);
  if (f.ledge.state !== LedgeState.none) {
    const catching = illidan && f.ledge.state === LedgeState.hang && pose.motion.ledgeCatchRemaining > 0;
    const index = catching ? dh.DEMON_HUNTER_LEDGE_CATCH_INDEX : clips.clipFor(character, clips.ledgePose(f.ledge.state)).index;
    playIndex(pose, `ledge${f.ledge.state}${catching ? ":catch" : ""}`, index);
    if (catching) return clipRate(dh.DEMON_HUNTER_LEDGE_CATCH_SECONDS, LEDGE_CATCH_FRAMES);
    return illidan && f.ledge.state === LedgeState.hang ? 0.0 : rate;
  }
  if (f.platform.move !== PlatformMove.none) {
    // The whole clip plays over the move, which lasts the jump squat.
    const platformClip = clips.platformClip(character, f.platform.move);
    playIndex(pose, `platform${f.platform.move}`, platformClip.index);
    return clipRate(platformClip.seconds, f.platform.duration);
  }
  if (f.shield.breakState !== ShieldBreak.none) {
    const key = `shieldbreak${f.shield.breakState}`;
    if (pose.animation !== key) {
      if (f.shield.breakState === ShieldBreak.land) selectFighterClipIndex(pose, clips.clipFor(character, "knockdown").index);
      else if (f.shield.breakState === ShieldBreak.stand) selectFighterClipIndex(pose, clips.clipFor(character, "getUp").index);
      else if (illidan) selectFighterClipIndex(pose, dh.DEMON_HUNTER_SHIELD_BREAK_INDEX);
      else if (table.dizzy !== undefined) selectFighterClipIndex(pose, table.dizzy.index);
      else selectFighterClipName(pose, "stand hit");
      pose.animation = key;
    }
    return rate;
  }
  // Mana Burn's stun plays the shield-break dizzy once the hit's flinch ends (#116).
  if (f.status.condition === HeroStatusKind.stun && f.launch.hitlag <= 0 && f.launch.hitstun <= 0) {
    if (pose.animation !== "stunned") {
      if (illidan) selectFighterClipIndex(pose, dh.DEMON_HUNTER_SHIELD_BREAK_INDEX);
      else if (table.dizzy !== undefined) selectFighterClipIndex(pose, table.dizzy.index);
      else selectFighterClipName(pose, "stand hit");
      pose.animation = "stunned";
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
  // A wall jump or wall tech plays its own clip over the wall hang and push-off (#144).
  if (f.surfaceRecovery.state === SurfaceContact.techWall) {
    const jumping = f.surfaceRecovery.wallJumpQueued;
    const wall = clips.clipFor(character, jumping ? "wallJump" : "wallTech");
    playIndex(pose, jumping ? "walljump" : "walltech", wall.index);
    return clipRate(wall.seconds, WALL_TECH_STARTUP_FRAMES + (jumping ? f.tuning.tech.wallJumpAnimationEndFrame : f.tuning.tech.wallAnimationEndFrame));
  }
  if (illidan && pose.motion.escapeRemaining > 0) {
    playIndex(pose, "grab-escape", dh.DEMON_HUNTER_GRAB_ESCAPE_INDEX);
    return clipRate(dh.DEMON_HUNTER_GRAB_ESCAPE_SECONDS, ESCAPE_FRAMES);
  }
  if (reaction !== DamagePose.none) {
    const contact = reaction !== DamagePose.shield && (f.launch.hitlag > 0 || reaction !== DamagePose.tumble);
    const key = contact ? `damage-contact${f.visuals.hitHeight}:${f.visuals.hitStrength}` : `damage${reaction}`;
    // Every new contact restarts the reaction.
    if (hit || pose.animation !== key) {
      selectFighterClipIndex(pose, (contact ? contactDamageClip(f) : clips.clipFor(character, damageClipPose(reaction))).index);
      pose.animation = key;
    }
    return contact ? clipRate(contactDamageClip(f).seconds, REACTION_CLIP_FRAMES) : rate;
  }
  if (f.special.fall) {
    playIndex(pose, "specialfall", clips.clipFor(character, "fallSpecial").index);
    return rate;
  }
  if (isGroundDodging(f)) {
    playIndex(pose, "dodge", groundDodgeClip(f).index);
    return rate;
  }
  if (f.special.action !== SpecialAction.none && f.launch.hitstun === 0) {
    // A follow-up replaces the action's remaining frames, so its clip starts over.
    playIndex(pose, `special${f.special.action}${playsFollowUpPose(f) ? "+" : ""}`, fighterSpecialClip(f).index);
    return rate;
  }
  const stateRate = illidan ? selectIllidanAction(pose, f) : selectTableAction(pose, f, table);
  if (stateRate !== undefined) return stateRate;
  if (pose.jumpAnimationRemaining > 0) {
    playIndex(pose, "jump", clips.clipFor(character, pose.doubleJumpAnimation ? "doubleJump" : "jump").index);
    return rate;
  }
  // A jab slice's recovery returns to the stance (HeroClip.until).
  if (phase === AttackPhase.recovery && f.launch.hitlag === 0 && attackClip(f)?.until !== undefined) {
    if (table.idle === undefined) playName(pose, "jab-return", "stand ready");
    else playIndex(pose, "jab-return", table.idle.index);
    return 1.0;
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
  const groundClip = groundLocomotionClip(character, pose.motion.motion);
  if (groundClip !== undefined) {
    playIndex(pose, `motion${pose.motion.motion}`, groundClip.index);
    return groundLocomotionRate(f, pose.motion.motion);
  }
  const moving = tableLocomotion(table, pose.motion.motion);
  if (moving !== undefined) {
    playIndex(pose, `motion${pose.motion.motion}`, moving.index);
    return pose.motion.motion === IllidanLocomotion.run ? locomotionRate(f, pose.motion.motion) : tableLocomotionRate(moving, pose.motion.motion);
  }
  const walking = f.motion.grounded && Math.abs(totalVelocityX(f)) > f32(0.1);
  // A table that maps locomotion plays it by index; the originals play named clips.
  const locomotion = table[walking ? "walk" : "idle"];
  if (locomotion === undefined) playName(pose, walking ? "walk" : "stand", walking ? "walk" : "stand");
  else playIndex(pose, walking ? "walk" : "stand", locomotion.index);
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
    else if (action === GrabAction.escape) {
      // A table that maps a stance plays it by index; the originals play the named clip.
      const stance = clips.characterClips(f.character).idle;
      if (stance === undefined) selectFighterClipName(pose, "stand ready");
      else selectFighterClipIndex(pose, stance.index);
    } else selectFighterClipIndex(pose, grabClipIndex(f.character, action, victim));
    pose.animation = key;
  }
  if (illidanEscape) return clipRate(dh.DEMON_HUNTER_GRAB_ESCAPE_SECONDS, grabActionDuration(action, f.tuning.moves));
  const poses = clips.grabActionPoses(action);
  if (poses === undefined) return 0.0;
  const clip = clips.clipFor(f.character, victim ? poses.victim : poses.holder);
  const duration = grabActionDuration(action, owner.tuning.moves);
  if (clip.contact === undefined) return clipRate(clip.seconds, duration);
  const contact = grabContactFrame(action, owner.tuning.moves);
  const heldSlot = owner.grab.target;
  const frozen = owner.launch.hitlag > 0 || (heldSlot !== undefined && fighterAt(world, heldSlot).launch.hitlag > 0);
  // Both bodies reach their contact pose on the owner's actual action frame,
  // including unlike kits and a restored or hitstop-paused grab.
  if (owner.grab.frame < contact) {
    const rate = clipRate(clip.contact, contact);
    pose.clipTime = f32(f32(owner.grab.frame * FRAME_SECONDS) * rate);
    return frozen ? 0.0 : rate;
  }
  const rate = clipRate(f32(clip.seconds - clip.contact), duration - contact);
  pose.clipTime = f32(clip.contact + f32(f32((owner.grab.frame - contact) * FRAME_SECONDS) * rate));
  return frozen ? 0.0 : rate;
}

/**
 * Tables supply the fighter's action clips; Illidan selects his authored
 * variants separately.
 */
function selectTableAction(pose: FighterPose, f: Readonly<Fighter>, table: Readonly<HeroClipTable>): number | undefined {
  const { dodge, jump, motion, landing, shield, attack } = f;
  if (dodge.airDodging && table.airDodge !== undefined) {
    playIndex(pose, "air-dodge", table.airDodge.index);
    return clipRate(table.airDodge.seconds, AIR_DODGE_ANIMATION_FRAMES);
  }
  if (jump.squat > 0 && table.jumpSquat !== undefined) {
    playIndex(pose, "jump-squat", table.jumpSquat.index);
    return clipRate(table.jumpSquat.seconds, authoredPhysics(f.character).jumpSquatFrames);
  }
  if (motion.grounded && landing.lag > 0 && table.landing !== undefined) {
    if (pose.animation !== "landing") {
      selectFighterClipIndex(pose, table.landing.index);
      pose.landingAnimationRate = clipRate(table.landing.seconds, landing.lag);
      pose.animation = "landing";
    }
    return pose.landingAnimationRate;
  }
  if ((shield.raised || shield.releaseLag > 0) && table.shield !== undefined) {
    playIndex(pose, "shield", table.shield.index);
    return 1.0;
  }
  const { style } = attack;
  if (attack.smashCharging && table.smashCharge !== undefined) {
    playIndex(pose, "smash-charge", table.smashCharge.index);
    return 0.0;
  }
  // A released charge replays the smash's own clip over the rest of the attack.
  const release = clips.ownAttackClip(f.character, style);
  if (style !== undefined && release !== undefined && (pose.animation === "smash-charge" || pose.animation === "smash-release")) {
    if (pose.animation === "smash-charge") {
      selectFighterClipIndex(pose, release.index);
      pose.animation = "smash-release";
    }
    return clipRate(release.seconds, attack.duration - attackStartupFrames(style, f.tuning.moves));
  }
  return undefined;
}

/** A table's locomotion clip for Illidan's locomotion states; undefined where it maps none. */
function tableLocomotion(table: Readonly<HeroClipTable>, motion: IllidanLocomotion): HeroClip | undefined {
  switch (motion) {
    case IllidanLocomotion.dash: return table.dash;
    case IllidanLocomotion.run: return table.run;
    case IllidanLocomotion.turn: return table.turn;
    case IllidanLocomotion.stop: return table.stop;
    case IllidanLocomotion.crouch: return table.crouch;
    case IllidanLocomotion.fall:
    case IllidanLocomotion.fastFall: return table.fall;
    default: return undefined;
  }
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
    return clipRate(release.seconds, attack.duration - attackStartupFrames(style, f.tuning.moves));
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

/** The clip the fighter's current attack plays: its own, or its pose's; none for an attack without one. */
function attackClip(f: Readonly<Fighter>): HeroClip | undefined {
  const { style } = f.attack;
  const own = clips.ownAttackClip(f.character, style);
  const shared = clips.attackPose(style);
  return own ?? (shared === undefined ? undefined : clips.clipFor(f.character, shared));
}

/** An attack's start selects its clip; Illidan's smash charge may later replace it. */
function selectAttackClip(pose: FighterPose, f: Readonly<Fighter>): void {
  const { style } = f.attack;
  if (f.character === Character.demonHunter) pose.animation = "";
  const clip = attackClip(f);
  if (clip === undefined) {
    selectFighterClipName(pose, "attack");
    return;
  }
  selectFighterClipIndex(pose, clip.index);
  // Pooled clips start past a wind-up the startup cannot play; a unit plays its sequence from the start.
  if (style !== undefined) pose.clipTime = strikeStart(f.character, style, clip, attackStartupFrames(style, f.tuning.moves));
}

/** The rate that fits the current action's clip to the action's frames; 1 without one. */
function actionRate(pose: Readonly<FighterPose>, f: Readonly<Fighter>, phase: AttackPhase, reaction: DamagePose): number {
  const { character } = f;
  if (f.ledge.state === LedgeState.climb) return clipRate(clips.clipFor(character, "ledgeClimb").seconds, LEDGE_CLIMB_FRAMES);
  if (f.ledge.state === LedgeState.roll) return clipRate(clips.clipFor(character, "ledgeRoll").seconds, LEDGE_ROLL_FRAMES);
  if (f.ledge.state === LedgeState.attack) return clipRate(clips.clipFor(character, "ledgeAttack").seconds, LEDGE_ATTACK_FRAMES);
  if (f.shield.breakState === ShieldBreak.land) return clipRate(clips.clipFor(character, "knockdown").seconds, SHIELD_BREAK_LAND_FRAMES);
  if (f.shield.breakState === ShieldBreak.stand) return clipRate(clips.clipFor(character, "getUp").seconds, SHIELD_BREAK_STAND_FRAMES);
  if (posesDown(f)) return downRate(f);
  if (reaction !== DamagePose.none) return clipRate(clips.clipFor(character, damageClipPose(reaction)).seconds, REACTION_CLIP_FRAMES);
  if (f.special.fall) return 0.0;
  if (isGroundDodging(f)) return clipRate(groundDodgeClip(f).seconds, f.dodge.groundDirection === 0 ? SPOT_DODGE_FRAMES : GROUND_ROLL_FRAMES);
  if (f.special.action !== SpecialAction.none && f.launch.hitstun === 0) return specialRate(f);
  if (pose.jumpAnimationRemaining > 0) {
    return pose.doubleJumpAnimation
      ? clipRate(clips.clipFor(character, "doubleJump").seconds, DOUBLE_JUMP_CLIP_FRAMES)
      : clipRate(clips.clipFor(character, "jump").seconds, JUMP_CLIP_FRAMES);
  }
  return attackRate(f, phase);
}

/** A measured strike earlier than this is the clip's first pose, not a swing. */
const EARLIEST_STRIKE = f32(0.034);
/** Bounds on an aligned swing's rate: a wind-up plays at most this much faster, and never slower than the floor. */
const FASTEST_SWING = 4.0;
const SLOWEST_SWING = f32(0.35);
/** After the strike the clip plays on through its table length, or at least this much follow-through. */
const FOLLOW_THROUGH = f32(0.4);

/** The clip seconds a swing starts at: past the wind-up a startup could not play even at the fastest swing rate. */
const strikeSkip = (strike: number, startup: number): number => max(0.0, f32(strike - f32(FASTEST_SWING * f32(startup * FRAME_SECONDS))));

/** Where a hero swing's clip starts, so a long wind-up still strikes on the first active frame; 0 plays it from its start. */
export function strikeStart(character: number, style: number, clip: Readonly<HeroClip>, startup: number): number {
  const moment = HERO_STRIKE_MOMENTS[character]?.[style];
  return moment === undefined || clip.aligned === true || moment.clip !== clip.index || moment.seconds < EARLIEST_STRIKE || startup <= 0 ? 0.0 : strikeSkip(moment.seconds, startup);
}

/**
 * A hero swing's rate where its strike moment is measured
 * (heroStrikeMomentInfo.ts, #144): the startup plays the wind-up so the clip's
 * farthest reach lands on the first active frame, a wind-up too long for the
 * startup catches up over the active frames, and recovery plays the
 * follow-through. Undefined plays the clip evenly.
 */
export function strikeAlignedRate(character: number, style: number, clip: Readonly<HeroClip>, startup: number, active: number, duration: number, phase: AttackPhase): number | undefined {
  const moment = HERO_STRIKE_MOMENTS[character]?.[style];
  const recovery = duration - startup - active;
  if (moment === undefined || clip.aligned === true || moment.clip !== clip.index || moment.seconds < EARLIEST_STRIKE || startup <= 0 || active <= 0 || recovery <= 0) return undefined;
  const bounded = (seconds: number, frames: number): number => min(FASTEST_SWING, max(SLOWEST_SWING, f32(seconds / f32(frames * FRAME_SECONDS))));
  const skip = strikeSkip(moment.seconds, startup);
  const windUp = bounded(f32(moment.seconds - skip), startup);
  if (phase === AttackPhase.startup) return windUp;
  const atActive = f32(skip + f32(windUp * f32(startup * FRAME_SECONDS)));
  const strike = atActive < moment.seconds ? bounded(f32(moment.seconds - atActive), active) : bounded(FOLLOW_THROUGH, active + recovery);
  if (phase === AttackPhase.active) return strike;
  const atRecovery = f32(atActive + f32(strike * f32(active * FRAME_SECONDS)));
  const end = max(clip.seconds, min(moment.end, f32(moment.seconds + FOLLOW_THROUGH)));
  return min(FASTEST_SWING, max(0.0, f32(f32(end - atRecovery) / f32(recovery * FRAME_SECONDS))));
}

function attackRate(f: Readonly<Fighter>, phase: AttackPhase): number {
  if (phase === AttackPhase.none) return 1.0;
  const { style, duration } = f.attack;
  const aligned = (clip: Readonly<HeroClip>): number => clip.until !== undefined && style !== undefined
    ? phase === AttackPhase.startup ? clipRate(clip.until, max(1, attackStartupFrames(style, f.tuning.moves))) : phase === AttackPhase.active ? 0.0 : 1.0
    : (style === undefined ? undefined : strikeAlignedRate(f.character, style, clip, attackStartupFrames(style, f.tuning.moves), characterAttackActiveFrames(f.character, style, f.tuning.moves), duration, phase))
    ?? clipRate(clip.seconds, duration);
  const own = clips.ownAttackClip(f.character, style);
  if (own !== undefined) return aligned(own);
  // A ledge attack's clip spans the ledge option, not the attack's duration.
  if (style === AttackStyle.ledgeAttack) return clipRate(clips.clipFor(f.character, "getUpAttack").seconds, LEDGE_ATTACK_FRAMES);
  const shared = clips.attackPose(style);
  return shared === undefined ? 1.0 : aligned(clips.clipFor(f.character, shared));
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
    case DownState.damage: return clips.clipFor(f.character, "downDamage").index;
    case DownState.bound:
    case DownState.wait: return clips.clipFor(f.character, "knockdown").index;
    case DownState.stand: return clips.clipFor(f.character, "getUp").index;
    case DownState.tech: return clips.clipFor(f.character, "tech").index;
    case DownState.techRoll: return clips.clipFor(f.character, forward ? "techForward" : "techBackward").index;
    default: return clips.clipFor(f.character, forward ? "getUpRollForward" : "getUpRollBackward").index;
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
    case DownState.damage: return clipRate(clips.clipFor(f.character, "downDamage").seconds, DOWN_DAMAGE_FRAMES);
    case DownState.wait: return 0.0;
    case DownState.bound: return clipRate(clips.clipFor(f.character, "knockdown").seconds, DOWN_BOUND_FRAMES);
    case DownState.stand: return clipRate(clips.clipFor(f.character, "getUp").seconds, DOWN_STAND_FRAMES);
    case DownState.tech: return clipRate(clips.clipFor(f.character, "tech").seconds, TECH_IN_PLACE_FRAMES);
    default: {
      const roll = clips.clipFor(f.character, state === DownState.techRoll
        ? forward ? "techForward" : "techBackward"
        : forward ? "getUpRollForward" : "getUpRollBackward");
      return clipRate(roll.seconds, state === DownState.techRoll ? TECH_ROLL_FRAMES : DOWN_ROLL_FRAMES);
    }
  }
}

function groundDodgeClip(f: Readonly<Fighter>): HeroClip {
  if (f.dodge.groundDirection === 0) return clips.clipFor(f.character, "spotDodge");
  return clips.clipFor(f.character, isForwardGroundRoll(f) ? "rollForward" : "rollBackward");
}

function fighterSpecialClip(f: Readonly<Fighter>): HeroClip {
  const aerialShot = f.special.duration === RIFLEMAN_BLASTER_AIR_FRAMES;
  return clips.specialClip(f.character, f.special.action, f.motion.grounded, aerialShot, playsFollowUpPose(f));
}

function damageClipPose(reaction: DamagePose): HeroPose {
  switch (reaction) {
    case DamagePose.ground: return "damageGround";
    case DamagePose.tumble: return "damageTumble";
    case DamagePose.shield: return "damageShield";
    default: return "damageAir";
  }
}

function grabClipIndex(character: Character, action: GrabAction, victim: boolean): number {
  const poses = clips.grabActionPoses(action);
  if (poses !== undefined) return clips.clipFor(character, victim ? poses.victim : poses.holder).index;
  return clips.clipFor(character, victim ? "grabbed" : "grabHold").index;
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

/** Transient movement clips span their action; crouch spans its entry, and fall holds. */
function tableLocomotionRate(clip: HeroClip, motion: IllidanLocomotion): number {
  if (motion === IllidanLocomotion.dash) return clipRate(clip.seconds, INITIAL_DASH_FRAMES);
  if (motion === IllidanLocomotion.turn || motion === IllidanLocomotion.stop) return clipRate(clip.seconds, TRANSITION_FRAMES);
  if (motion === IllidanLocomotion.crouch) return clipRate(clip.seconds, CROUCH_CLIP_FRAMES);
  return 0.0;
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
    case IllidanLocomotion.walk:
    case IllidanLocomotion.run: return groundLocomotionRate(f, motion);
    default: return 1.0;
  }
}

/**
 * A special's clip rate: a hero special's measured strike (heroStrikeMomentInfo.ts)
 * lands on its first active frame, as a swing's does; other specials and
 * follow-ups play their clip evenly over the action.
 */
function specialRate(f: Readonly<Fighter>): number {
  const clip = fighterSpecialClip(f);
  const even = clipRate(clip.seconds, f.special.duration);
  const { action, frame } = f.special;
  const move = playsFollowUpPose(f) ? undefined : runningHeroSpecial(f);
  if (move === undefined) return even;
  const { active } = heroCueWindows(move, 1);
  const phase = frame < active.first ? AttackPhase.startup : frame <= active.last ? AttackPhase.active : AttackPhase.recovery;
  const slot = action - SpecialAction.heroNeutral;
  return strikeAlignedRate(f.character, SPECIAL_KEY + slot, clip, active.first - 1, active.last - active.first + 1, f.special.duration, phase) ?? even;
}

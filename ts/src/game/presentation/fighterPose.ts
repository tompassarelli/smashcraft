import { f32 } from "../../sim/f32";
import type { Fighter } from "../sim/fighter";
import type { Controls, Roster } from "../sim/roster";
import { copyIllidanMotionInto, createIllidanMotion, type IllidanMotion } from "./illidanMotion";

export const FRAME_SECONDS = f32(0.016666667);

/** Completed-frame presentation state. It contains no engine handles. */
export interface FighterPose {
  animation: string;
  jumpAnimationRemaining: number;
  doubleJumpAnimation: boolean;
  landingAnimationRate: number;
  motion: IllidanMotion;
  clipIndex: number;
  clipName: string;
  clipTime: number;
  rate: number;
  selectionSerial: number;
}

export function createFighterPose(): FighterPose {
  return {
    animation: "", jumpAnimationRemaining: 0, doubleJumpAnimation: false, landingAnimationRate: 1.0,
    motion: createIllidanMotion(), clipIndex: -1, clipName: "stand", clipTime: 0.0, rate: 1.0, selectionSerial: 0,
  };
}

export function clearFighterPose(pose: FighterPose): void {
  pose.animation = "";
  pose.jumpAnimationRemaining = 0;
  pose.doubleJumpAnimation = false;
  pose.landingAnimationRate = 1.0;
  const cleanMotion = createIllidanMotion();
  copyIllidanMotionInto(pose.motion, cleanMotion);
  pose.clipIndex = -1;
  pose.clipName = "stand";
  pose.clipTime = 0.0;
  pose.rate = 1.0;
  pose.selectionSerial = 0;
}

export function copyFighterPoseInto(target: FighterPose, source: Readonly<FighterPose>): void {
  target.animation = source.animation;
  target.jumpAnimationRemaining = source.jumpAnimationRemaining;
  target.doubleJumpAnimation = source.doubleJumpAnimation;
  target.landingAnimationRate = source.landingAnimationRate;
  copyIllidanMotionInto(target.motion, source.motion);
  target.clipIndex = source.clipIndex;
  target.clipName = source.clipName;
  target.clipTime = source.clipTime;
  target.rate = source.rate;
  target.selectionSerial = source.selectionSerial;
}

export function selectFighterClipIndex(pose: FighterPose, index: number): void {
  pose.clipIndex = index;
  pose.clipName = "";
  pose.clipTime = 0.0;
  pose.selectionSerial++;
}

export function selectFighterClipName(pose: FighterPose, name: string): void {
  pose.clipIndex = -1;
  pose.clipName = name;
  pose.clipTime = 0.0;
  pose.selectionSerial++;
}

/** Advance the already-selected clip by one completed simulation frame. */
export function advanceFighterPose(pose: FighterPose, _fighter: Readonly<Fighter>, _world: Readonly<Roster>, _input: Readonly<Controls>, _wasOut: boolean, _jumped: boolean, _attacked: boolean, _hit: boolean): void {
  pose.clipTime = f32(pose.clipTime + f32(pose.rate * FRAME_SECONDS));
}

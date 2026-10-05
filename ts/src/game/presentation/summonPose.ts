import { min, toInt } from "../../runtime/wurst";
import { f32 } from "../../sim/f32";
import { summonClip } from "./summonClipInfo";

/** A native animation queue as data: the playing clip, its elapsed time and the clip queued after it. */
export interface SummonPose {
  active: boolean;
  clipIndex: number | undefined;
  queuedClip: number | undefined;
  clipTime: number;
}

export function createSummonPose(): SummonPose {
  return { active: false, clipIndex: undefined, queuedClip: undefined, clipTime: 0.0 };
}

export function clearSummonPose(pose: SummonPose): void {
  pose.active = false;
  pose.clipIndex = undefined;
  pose.queuedClip = undefined;
  pose.clipTime = 0.0;
}

export function selectSummonPose(pose: SummonPose, clip: number, next: number | undefined): void {
  pose.active = true;
  pose.clipIndex = clip;
  pose.queuedClip = next;
  pose.clipTime = 0.0;
}

/** Plays forward; a finished clip hands its overflow to the queued clip, which then loops or holds its end. */
export function advanceSummonPose(pose: SummonPose, summon: number, seconds: number): void {
  if (!pose.active || pose.clipIndex === undefined) return;
  pose.clipTime = f32(pose.clipTime + seconds);
  const playing = summonClip(summon, pose.clipIndex);
  const duration = f32(playing.endSeconds - playing.startSeconds);
  if (pose.queuedClip !== undefined && pose.clipTime >= duration) {
    pose.clipTime = f32(pose.clipTime - duration);
    pose.clipIndex = pose.queuedClip;
    pose.queuedClip = undefined;
  }
  const selected = summonClip(summon, pose.clipIndex);
  const selectedDuration = f32(selected.endSeconds - selected.startSeconds);
  if (selectedDuration <= 0.0) pose.clipTime = 0.0;
  else if (selected.looping) pose.clipTime = f32(pose.clipTime - f32(toInt(f32(pose.clipTime / selectedDuration)) * selectedDuration));
  else pose.clipTime = min(pose.clipTime, selectedDuration);
}

export function copySummonPoseInto(target: SummonPose, source: Readonly<SummonPose>): void {
  target.active = source.active;
  target.clipIndex = source.clipIndex;
  target.queuedClip = source.queuedClip;
  target.clipTime = source.clipTime;
}

export function firstSummonPoseDifference(expected: Readonly<SummonPose>, actual: Readonly<SummonPose>): string | undefined {
  if (expected.active !== actual.active) return "active";
  if (expected.clipIndex !== actual.clipIndex) return "clipIndex";
  if (expected.queuedClip !== actual.queuedClip) return "queuedClip";
  if (expected.clipTime !== actual.clipTime) return "clipTime";
  return undefined;
}

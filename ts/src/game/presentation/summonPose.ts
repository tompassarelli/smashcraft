import { f32 } from "../../sim/f32";
import { summonClip } from "./summonClipInfo";

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

export function advanceSummonPose(pose: SummonPose, summon: number, seconds: number): void {
  if (!pose.active || pose.clipIndex === undefined) return;
  pose.clipTime = f32(pose.clipTime + seconds);
  const clip = summonClip(summon, pose.clipIndex);
  const duration = f32(clip.endSeconds - clip.startSeconds);
  if (pose.queuedClip !== undefined && pose.clipTime >= duration) {
    pose.clipTime = f32(pose.clipTime - duration);
    pose.clipIndex = pose.queuedClip;
    pose.queuedClip = undefined;
  }
  const selected = summonClip(summon, pose.clipIndex);
  const selectedDuration = f32(selected.endSeconds - selected.startSeconds);
  if (selectedDuration > 0.0) {
    if (selected.looping) {
      const loops = Math.trunc(f32(pose.clipTime / selectedDuration));
      pose.clipTime = f32(pose.clipTime - f32(loops * selectedDuration));
    } else pose.clipTime = Math.min(pose.clipTime, selectedDuration);
  } else pose.clipTime = 0.0;
}

export function copySummonPose(source: Readonly<SummonPose>): SummonPose {
  return { active: source.active, clipIndex: source.clipIndex, queuedClip: source.queuedClip, clipTime: source.clipTime };
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

import { f32 } from "wisp/src/sim/f32";

interface SummonOriginalClip {
  valid: boolean;
  modelPath: string;
  startSeconds: number;
  endSeconds: number;
  looping: boolean;
}

export const SUMMON_BEAR = 0;
export const SUMMON_BEAR_WALK = 0;
export const SUMMON_BEAR_ATTACK = 1;
const SUMMON_CLIP_CAPACITY = 2;

// Generated from original model intervals by wc3-melee:tools/animations/export-summon-clips.ts.
const BEAR_CLIPS: readonly SummonOriginalClip[] = [
  { valid: true, modelPath: "war3mapImported\\BearOriginalClip2-dc33c2ee5ed2a21be58d7b0d76f3bf9f9678a2f7b460fed64c85fbeabea80c6c.mdx", startSeconds: f32(210.333), endSeconds: f32(211.267), looping: true },
  { valid: true, modelPath: "war3mapImported\\BearOriginalClip6-7a4f638b845da28f5cc81b896c4f3be0f8ecd7b5573d869a0f1b82d2743667b8.mdx", startSeconds: f32(234.167), endSeconds: 235.5, looping: false },
];

export function summonClip(summon: number, clipIndex: number): SummonOriginalClip {
  if (summon === SUMMON_BEAR) {
    const clip = BEAR_CLIPS[clipIndex];
    if (clip !== undefined) return clip;
  }
  return { valid: false, modelPath: "", startSeconds: 0.0, endSeconds: 0.0, looping: false };
}

export function summonClipCount(summon: number): number {
  return summon === SUMMON_BEAR ? SUMMON_CLIP_CAPACITY : 0;
}

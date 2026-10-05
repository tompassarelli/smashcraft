import { PARTICIPANT_CAPACITY } from "../input/participants";
import { f32 } from "../../sim/f32";
import type { Fighter } from "../sim/fighter";
import { advanceSummonPose, clearSummonPose, copySummonPoseInto, createSummonPose, firstSummonPoseDifference, selectSummonPose, type SummonPose } from "./summonPose";
import { SUMMON_BEAR, SUMMON_BEAR_ATTACK, SUMMON_BEAR_WALK } from "./summonClipInfo";

export interface SummonProjection {
  visible: boolean;
  clipIndex: number | undefined;
  seconds: number;
  x: number;
  z: number;
  yaw: number;
  scale: number;
}

export interface SummonState {
  bears: SummonPose[];
  bearHitSerial: number[];
}

export function createSummonState(): SummonState {
  return {
    bears: Array.from({ length: PARTICIPANT_CAPACITY }, () => createSummonPose()),
    bearHitSerial: Array.from({ length: PARTICIPANT_CAPACITY }, () => 0),
  };
}

export function copySummonState(source: Readonly<SummonState>): SummonState {
  const target = createSummonState();
  copySummonStateInto(target, source);
  return target;
}

export function copySummonStateInto(target: SummonState, source: Readonly<SummonState>): void {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    const targetPose = target.bears[slot];
    const sourcePose = source.bears[slot];
    if (targetPose !== undefined && sourcePose !== undefined) copySummonPoseInto(targetPose, sourcePose);
    target.bearHitSerial[slot] = source.bearHitSerial[slot] ?? 0;
  }
}

export function clearSummonState(state: SummonState): void {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    const pose = state.bears[slot];
    if (pose !== undefined) clearSummonPose(pose);
    state.bearHitSerial[slot] = 0;
  }
}

export function firstSummonDifference(expected: Readonly<SummonState>, actual: Readonly<SummonState>): string | undefined {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    const expectedPose = expected.bears[slot];
    const actualPose = actual.bears[slot];
    if (expectedPose === undefined || actualPose === undefined) {
      if (expectedPose !== actualPose) return `slot[${slot}].pose`;
      continue;
    }
    const field = firstSummonPoseDifference(expectedPose, actualPose);
    if (field !== undefined) return `slot[${slot}].${field}`;
    if (expected.bearHitSerial[slot] !== actual.bearHitSerial[slot]) return `slot[${slot}].bearHitSerial`;
  }
  return undefined;
}

export function advanceSummons(state: SummonState, fighter: Readonly<Fighter> | undefined, slot: number): void {
  const pose = state.bears[slot];
  if (pose === undefined) return;
  if (fighter === undefined) {
    clearSummonPose(pose);
    state.bearHitSerial[slot] = 0;
    return;
  }
  if (fighter.status.out || fighter.bear.life <= 0) clearSummonPose(pose);
  else if (fighter.bear.hitSerial !== (state.bearHitSerial[slot] ?? 0)) selectSummonPose(pose, SUMMON_BEAR_ATTACK, SUMMON_BEAR_WALK);
  else if (!pose.active) selectSummonPose(pose, SUMMON_BEAR_WALK, undefined);
  else advanceSummonPose(pose, SUMMON_BEAR, 1.0 / 60.0);
  state.bearHitSerial[slot] = fighter.bear.hitSerial;
}

export function projectBear(state: Readonly<SummonState>, fighter: Readonly<Fighter> | undefined, slot: number): SummonProjection {
  const pose = state.bears[slot];
  if (fighter === undefined || fighter.status.out || fighter.bear.life <= 0 || pose === undefined || !pose.active || pose.clipIndex === undefined) {
    return { visible: false, clipIndex: undefined, seconds: 0.0, x: 0.0, z: 0.0, yaw: 0.0, scale: 0.0 };
  }
  return {
    visible: true,
    clipIndex: pose.clipIndex,
    seconds: pose.clipTime,
    x: fighter.bear.x,
    z: fighter.bear.z,
    yaw: fighter.bear.velocityX >= 0.0 ? 0.0 : f32(3.141592654),
    scale: f32(0.8),
  };
}

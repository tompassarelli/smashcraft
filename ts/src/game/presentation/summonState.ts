import { f32 } from "waygate/src/sim/f32";
import { PARTICIPANT_SLOTS, type ParticipantSlot, type Slots } from "../input/participants";
import type { Fighter } from "../sim/fighter";
import { SUMMON_BEAR, SUMMON_BEAR_ATTACK, SUMMON_BEAR_WALK } from "./summonClipInfo";
import { type SummonPose, advanceSummonPose, clearSummonPose, copySummonPoseInto, createSummonPose, firstSummonPoseDifference, selectSummonPose } from "./summonPose";

const FRAME_SECONDS = f32(1.0 / 60.0);

export interface SummonProjection {
  visible: boolean;
  clipIndex: number | undefined;
  seconds: number;
  x: number;
  z: number;
  yaw: number;
  scale: number;
}

/** Each participant's bear clip, and the bear hit serial its last swipe answered. */
export interface SummonState {
  readonly bears: Slots<SummonPose>;
  readonly bearHitSerial: Slots<number>;
}

export function createSummonState(): SummonState {
  return {
    bears: [createSummonPose(), createSummonPose(), createSummonPose(), createSummonPose()],
    bearHitSerial: [0, 0, 0, 0],
  };
}

export function copySummonStateInto(target: SummonState, source: Readonly<SummonState>): void {
  for (const slot of PARTICIPANT_SLOTS) {
    copySummonPoseInto(target.bears[slot], source.bears[slot]);
    target.bearHitSerial[slot] = source.bearHitSerial[slot];
  }
}

export function clearSummonState(state: SummonState): void {
  for (const slot of PARTICIPANT_SLOTS) {
    clearSummonPose(state.bears[slot]);
    state.bearHitSerial[slot] = 0;
  }
}

export function firstSummonDifference(expected: Readonly<SummonState>, actual: Readonly<SummonState>): string | undefined {
  for (const slot of PARTICIPANT_SLOTS) {
    const field = firstSummonPoseDifference(expected.bears[slot], actual.bears[slot]);
    if (field !== undefined) return `slot[${slot}].${field}`;
    if (expected.bearHitSerial[slot] !== actual.bearHitSerial[slot]) return `slot[${slot}].bearHitSerial`;
  }
  return undefined;
}

/**
 * Advances one executed frame, hitlag included; a paused match executes none.
 * An absent fighter clears its slot. A new bear hit plays the swipe, then walks.
 */
export function advanceSummons(state: SummonState, fighter: Readonly<Fighter> | undefined, slot: ParticipantSlot): void {
  const pose = state.bears[slot];
  if (fighter === undefined) {
    clearSummonPose(pose);
    state.bearHitSerial[slot] = 0;
    return;
  }
  const { bear } = fighter;
  if (fighter.status.out || bear.life <= 0) clearSummonPose(pose);
  else if (bear.hitSerial !== state.bearHitSerial[slot]) selectSummonPose(pose, SUMMON_BEAR_ATTACK, SUMMON_BEAR_WALK);
  else if (!pose.active) selectSummonPose(pose, SUMMON_BEAR_WALK, undefined);
  else advanceSummonPose(pose, SUMMON_BEAR, FRAME_SECONDS);
  state.bearHitSerial[slot] = bear.hitSerial;
}

export function projectBear(state: Readonly<SummonState>, fighter: Readonly<Fighter> | undefined, slot: number): SummonProjection {
  const pose = state.bears[slot];
  if (fighter === undefined || pose === undefined || fighter.status.out || fighter.bear.life <= 0 || !pose.active) {
    return { visible: false, clipIndex: undefined, seconds: 0.0, x: 0.0, z: 0.0, yaw: 0.0, scale: 0.0 };
  }
  const { bear } = fighter;
  return {
    visible: true,
    clipIndex: pose.clipIndex,
    seconds: pose.clipTime,
    x: bear.x,
    z: bear.z,
    yaw: bear.velocityX >= 0.0 ? 0.0 : f32(3.141592654),
    scale: f32(0.8),
  };
}

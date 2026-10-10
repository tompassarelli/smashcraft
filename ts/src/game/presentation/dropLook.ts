import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { DROP_TELEGRAPH_FRAMES, type MatchMeterDrops, dropTelegraphFrames } from "../match/meterDrops";

export interface DropCueObservation {
  telegraphFrame: number;
  spawnSerial: number;
  pickupSerial: number;
}

export const createDropCueObservation = (): DropCueObservation => ({ telegraphFrame: 0, spawnSerial: 0, pickupSerial: 0 });

export function observeDropCues(before: DropCueObservation, drops: Readonly<MatchMeterDrops>, frame: number): void {
  before.telegraphFrame = dropTelegraphFrames(drops, frame) === undefined ? 0 : drops.nextSpawnFrame;
  before.spawnSerial = drops.spawnSerial;
  before.pickupSerial = drops.pickupSerial;
}

export function confirmedDropCues(before: Readonly<DropCueObservation>, drops: Readonly<MatchMeterDrops>, frame: number): number {
  let cues = 0;
  if (dropTelegraphFrames(drops, frame) !== undefined && before.telegraphFrame !== drops.nextSpawnFrame) cues |= 1;
  if (before.spawnSerial !== drops.spawnSerial) cues |= 2;
  if (before.pickupSerial !== drops.pickupSerial) cues |= 4;
  return cues;
}

export const DROP_MARKER_SCALE_START = f32(0.2);
export const DROP_MARKER_SCALE_END = f32(0.45);
export const DROP_ORB_SCALE = f32(0.8);
export const DEFINITIVE_DROP_MARKER_SCALE = f32(2.5);
export const DEFINITIVE_DROP_ORB_SCALE = f32(2.0);
export const DROP_PULSE_FRAMES = 30;

export function dropMarkerScale(left: number, definitive = false): number {
  const progress = f32(f32(DROP_TELEGRAPH_FRAMES - left) / DROP_TELEGRAPH_FRAMES);
  const scale = f32(DROP_MARKER_SCALE_START + f32(f32(DROP_MARKER_SCALE_END - DROP_MARKER_SCALE_START) * progress));
  return definitive ? f32(f32(scale / DROP_MARKER_SCALE_END) * DEFINITIVE_DROP_MARKER_SCALE) : scale;
}

export function dropMarkerAlpha(left: number): number {
  const phase = floorMod(left, DROP_PULSE_FRAMES);
  return phase < DROP_PULSE_FRAMES / 2 ? 255 : 140;
}

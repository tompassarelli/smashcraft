import { itemWarningFrames } from "../match/centreItem";
import type { MatchItems } from "../match/items";

export interface ItemCueObservation {
  warningFrame: number;
  spawnSerial: number;
  pickupSerial: number;
}

export const createItemCueObservation = (): ItemCueObservation => ({ warningFrame: 0, spawnSerial: 0, pickupSerial: 0 });

export function observeItemCues(before: ItemCueObservation, items: Readonly<MatchItems>, frame: number): void {
  before.warningFrame = itemWarningFrames(items, frame) === undefined ? 0 : items.nextSpawnFrame;
  before.spawnSerial = items.spawnSerial;
  before.pickupSerial = items.pickupSerial;
}

/** Bit 1 warning, bit 2 spawn, bit 4 pickup; read only after a confirmed frame. */
export function confirmedItemCues(before: Readonly<ItemCueObservation>, items: Readonly<MatchItems>, frame: number): number {
  let cues = 0;
  if (itemWarningFrames(items, frame) !== undefined && before.warningFrame !== items.nextSpawnFrame) cues |= 1;
  if (before.spawnSerial !== items.spawnSerial) cues |= 2;
  if (before.pickupSerial !== items.pickupSerial) cues |= 4;
  return cues;
}

import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { itemWarningFrames } from "../match/centreItem";
import type { MatchItems } from "../match/items";
import { ItemKind } from "../sim/codes";

export function itemName(kind: number): string {
  switch (kind) {
    case ItemKind.speed: return "Speed";
    case ItemKind.extraJump: return "Extra Jump";
    case ItemKind.heavy: return "Heavy";
    default: return "";
  }
}

export const itemSeconds = (frames: number): number => floorDiv(Math.max(0, frames) + 59, 60);

export function nextItemText(items: Readonly<MatchItems>, frame: number): string {
  const seconds = itemSeconds(items.nextSpawnFrame - frame);
  const part = floorMod(seconds, 60);
  return items.nextSpawnFrame === 0 ? "" : `Next item ${floorDiv(seconds, 60)}:${part < 10 ? "0" : ""}${part}`;
}

export function centreItemText(items: Readonly<MatchItems>, frame: number): string {
  const warning = itemWarningFrames(items, frame);
  const pickup = items.kind === ItemKind.none ? "" : `${itemName(items.kind)} · Attack / Grab`;
  const next = warning === undefined ? "" : `${itemName(items.nextKind)} in ${itemSeconds(warning)}`;
  return pickup === "" ? next : next === "" ? pickup : `${next}\n${pickup}`;
}

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

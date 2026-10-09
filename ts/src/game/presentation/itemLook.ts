import { f32 } from "wisp/src/sim/f32";
import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { ITEM_WARNING_FRAMES, itemWarningFrames } from "../match/centreItem";
import { ItemKind } from "../sim/codes";
import type { Fighter } from "../sim/fighter";
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


export function confirmedItemCues(before: Readonly<ItemCueObservation>, items: Readonly<MatchItems>, frame: number): number {
  let cues = 0;
  if (itemWarningFrames(items, frame) !== undefined && before.warningFrame !== items.nextSpawnFrame) cues |= 1;
  if (before.spawnSerial !== items.spawnSerial) cues |= 2;
  if (before.pickupSerial !== items.pickupSerial) cues |= 4;
  return cues;
}


export interface ItemColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

export const SPEED_COLOR: ItemColor = { red: 70, green: 230, blue: 255 };
export const HEAVY_COLOR: ItemColor = { red: 255, green: 170, blue: 40 };
const SPEED_BODY: ItemColor = { red: 150, green: 235, blue: 255 };
const HEAVY_BODY: ItemColor = { red: 95, green: 100, blue: 120 };

export const ITEM_ENDING_FRAMES = 120;
const BLINK_FRAMES = 8;

export const itemColor = (kind: number): ItemColor => kind === ItemKind.heavy ? HEAVY_COLOR : SPEED_COLOR;

export const itemEnding = (buffFrames: number): boolean => buffFrames > 0 && buffFrames <= ITEM_ENDING_FRAMES;

export const itemBlinkOff = (buffFrames: number): boolean => itemEnding(buffFrames) && floorMod(floorDiv(buffFrames, BLINK_FRAMES), 2) === 0;


export function itemBodyTint(fighter: Readonly<Fighter>): ItemColor | undefined {
  const { buff, buffFrames, out } = fighter.status;
  if (out || buffFrames <= 0 || itemBlinkOff(buffFrames)) return undefined;
  return buff === ItemKind.heavy ? HEAVY_BODY : buff === ItemKind.speed ? SPEED_BODY : undefined;
}


export const HEAVY_SHEEN: ItemColor = { red: 185, green: 192, blue: 215 };
export const HEAVY_SHEEN_ALPHA = 150;

export const heavySheen = (fighter: Readonly<Fighter>): boolean =>
  fighter.status.buff === ItemKind.heavy && itemBodyTint(fighter) !== undefined;


export function itemTelegraphScale(left: number): number {
  const progress = f32(f32(ITEM_WARNING_FRAMES - left) / ITEM_WARNING_FRAMES);
  return f32(f32(0.8) + f32(f32(0.8) * progress));
}

export const itemTelegraphAlpha = (left: number): number => floorMod(left, 60) < 30 ? 255 : 120;


export const ITEM_MODELS = {
  speedPickup: "Abilities\\Spells\\Other\\Tornado\\TornadoElementalSmall.mdx",
  heavyPickup: "Abilities\\Spells\\Human\\Defend\\DefendCaster.mdx",
  glow: "Abilities\\Spells\\Other\\GeneralAuraTarget\\GeneralAuraTarget.mdl",
  burst: "Abilities\\Spells\\Human\\HolyBolt\\HolyBoltSpecialArt.mdx",
  speedTrail: "Abilities\\Spells\\Undead\\Cripple\\CrippleTarget.mdx",
  end: "Abilities\\Spells\\NightElf\\Blink\\BlinkCaster.mdx",
} as const;

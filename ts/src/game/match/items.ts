



import { ALL_ITEMS_MASK, ItemKind } from "../sim/codes";

export interface MatchItems {

  on: boolean;

  enabledMask: number;

  kind: number;

  nextSpawnFrame: number;

  nextKind: number;

  draws: number;

  spawnSerial: number;
  pickupSerial: number;

  lastTaker: number;
}

export function createMatchItems(): MatchItems {
  return { on: true, enabledMask: ALL_ITEMS_MASK, kind: ItemKind.none, nextSpawnFrame: 0, nextKind: ItemKind.none, draws: 0, spawnSerial: 0, pickupSerial: 0, lastTaker: -1 };
}

export function copyMatchItems(target: MatchItems, source: Readonly<MatchItems>): void {
  target.on = source.on;
  target.enabledMask = source.enabledMask;
  target.kind = source.kind;
  target.nextSpawnFrame = source.nextSpawnFrame;
  target.nextKind = source.nextKind;
  target.draws = source.draws;
  target.spawnSerial = source.spawnSerial;
  target.pickupSerial = source.pickupSerial;
  target.lastTaker = source.lastTaker;
}


export function resetMatchItems(items: MatchItems): void {
  items.kind = ItemKind.none;
  items.nextSpawnFrame = 0;
  items.nextKind = ItemKind.none;
  items.draws = 0;
  items.spawnSerial = 0;
  items.pickupSerial = 0;
  items.lastTaker = -1;
}


export function firstItemsDifference(e: Readonly<MatchItems>, a: Readonly<MatchItems>): string | undefined {
  if (e.on !== a.on) return "match.items.on";
  if (e.enabledMask !== a.enabledMask) return "match.items.enabledMask";
  if (e.kind !== a.kind) return "match.items.kind";
  if (e.nextSpawnFrame !== a.nextSpawnFrame) return "match.items.nextSpawnFrame";
  if (e.nextKind !== a.nextKind) return "match.items.nextKind";
  if (e.draws !== a.draws) return "match.items.draws";
  if (e.spawnSerial !== a.spawnSerial) return "match.items.spawnSerial";
  if (e.pickupSerial !== a.pickupSerial) return "match.items.pickupSerial";
  if (e.lastTaker !== a.lastTaker) return "match.items.lastTaker";
  return undefined;
}





export function writeMatchItems(items: Readonly<MatchItems>, int: (name: string, value: number) => void, bool: (name: string, value: boolean) => void): void {
  if (!items.on) bool("match.items.on", false);
  if (items.enabledMask !== ALL_ITEMS_MASK) int("match.items.enabledMask", items.enabledMask);
  if (items.draws === 0 && items.nextSpawnFrame === 0 && items.kind === ItemKind.none) return;
  int("match.items.kind", items.kind);
  int("match.items.nextSpawnFrame", items.nextSpawnFrame);
  int("match.items.nextKind", items.nextKind);
  int("match.items.draws", items.draws);
  int("match.items.spawnSerial", items.spawnSerial);
  int("match.items.pickupSerial", items.pickupSerial);
  int("match.items.lastTaker", items.lastTaker);
}

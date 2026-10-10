






import { floorDiv, floorMod } from "wisp/src/sim/intMath";
import { f32 } from "wisp/src/sim/f32";
import { hasPendingAttack, takeAttack } from "../input/attackBuffer";
import { PARTICIPANT_SLOTS } from "../input/participants";
import { ALL_ITEMS_MASK, AttackStyle, ITEM_KINDS, ItemKind, itemBit } from "../sim/codes";
import { canStartAttackStyle, inGrabContext } from "../sim/conditions";
import type { Fighter } from "../sim/fighter";
import { applyItemBuff } from "../sim/itemBuffs";
import { type Roster, fighterAt, isActive } from "../sim/roster";
import { mainDeckZAt } from "../sim/stage";
import { bodyTop } from "../sim/surfaces";
import { melee } from "../sim/tuning";
import type { FrameControls } from "./controls";
import { type MatchItems, resetMatchItems } from "./items";
import type { MatchState } from "./rules";

const FRAMES_PER_SECOND = 60;
export const ITEM_INTERVAL_MIN_SECONDS = 30;
export const ITEM_INTERVAL_MAX_SECONDS = 60;

export const ITEM_WARNING_FRAMES = 10 * FRAMES_PER_SECOND;

const ITEM_REACH = melee(8.0);

export const ITEM_HEIGHT = melee(8.0);

// This prime's square fits Lua32 integers, keeping squaring exact across runtimes.
const HASH_PRIME = 46337;
const DRAW_STEP = 7919;
const INTERVAL_SALT = 1;
const KIND_SALT = 2;

function scramble(value: number): number {
  const square = floorMod(value * value + 12345, HASH_PRIME);
  return floorMod(square ^ floorDiv(square, 32), HASH_PRIME);
}


export function itemDraw(seed: number, draw: number, salt: number, count: number): number {
  const step = floorMod(floorMod(draw + 1, HASH_PRIME) * DRAW_STEP + salt, HASH_PRIME);
  const mixed = scramble(floorMod(scramble(floorMod(seed, HASH_PRIME)) + step, HASH_PRIME));
  return floorMod(floorDiv(scramble(mixed), 3), count);
}

const enabledKinds = (mask: number): number => ITEM_KINDS.filter(kind => (mask & itemBit(kind)) !== 0).length;


function enabledKind(mask: number, index: number): ItemKind {
  let left = index;
  for (const kind of ITEM_KINDS) {
    if ((mask & itemBit(kind)) === 0) continue;
    if (left === 0) return kind;
    left--;
  }
  return ItemKind.none;
}


const matchHasItems = (game: Readonly<MatchState>): boolean =>
  game.items.on && !game.training && (game.items.enabledMask & ALL_ITEMS_MASK) !== 0;


function scheduleNext(items: MatchItems, seed: number, from: number): void {
  const mask = items.enabledMask & ALL_ITEMS_MASK;
  const seconds = ITEM_INTERVAL_MIN_SECONDS + itemDraw(seed, items.draws, INTERVAL_SALT, ITEM_INTERVAL_MAX_SECONDS - ITEM_INTERVAL_MIN_SECONDS + 1);
  items.nextKind = enabledKind(mask, itemDraw(seed, items.draws, KIND_SALT, enabledKinds(mask)));
  items.nextSpawnFrame = from + seconds * FRAMES_PER_SECOND;
  items.draws++;
}


export function scheduleMatchItems(game: MatchState): void {
  resetMatchItems(game.items);
  if (matchHasItems(game)) scheduleNext(game.items, game.matchSeed, game.startHold + 1);
}


export function itemWarningFrames(items: Readonly<MatchItems>, matchFrame: number): number | undefined {
  if (items.nextSpawnFrame === 0) return undefined;
  const left = items.nextSpawnFrame - matchFrame;
  return left > 0 && left <= ITEM_WARNING_FRAMES ? left : undefined;
}


function itemKindOf(code: number): ItemKind {
  switch (code) {
    case ItemKind.speed: return ItemKind.speed;
    case ItemKind.heavy: return ItemKind.heavy;
    default: return ItemKind.none;
  }
}


function requestedStyle(style: number | undefined): AttackStyle | undefined {
  switch (style) {
    case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7: case 8: case 9: case 10: return style;
    default: return undefined;
  }
}


function touchesItem(f: Readonly<Fighter>, deckZ: number): boolean {
  const { x, z } = f.motion;
  return x >= -ITEM_REACH && x <= ITEM_REACH && z <= f32(deckZ + ITEM_HEIGHT) && z >= f32(deckZ - melee(bodyTop(f.character)));
}






export function advanceItems(game: MatchState, world: Roster, controls: FrameControls, frame: number): void {
  const { items } = game;
  if (items.nextSpawnFrame !== 0 && game.matchFrame >= items.nextSpawnFrame) {
    items.kind = items.nextKind;
    items.spawnSerial++;
    scheduleNext(items, game.matchSeed, game.matchFrame);
  }
  if (items.kind === ItemKind.none) return;
  const deckZ = mainDeckZAt(game.stageChoice, 0.0);
  for (const slot of PARTICIPANT_SLOTS) {
    if (!isActive(world, slot)) continue;
    const f = fighterAt(world, slot);
    if (f.status.out || f.status.frozenFrames > 0 || inGrabContext(f)) continue;
    const commands = controls.commands[slot];
    const pending = commands.pending;
    if (pending === undefined || !hasPendingAttack(commands, frame) || !canStartAttackStyle(f, requestedStyle(pending.style)) || !touchesItem(f, deckZ)) continue;
    takeAttack(commands, frame, true);
    applyItemBuff(f, itemKindOf(items.kind));
    items.kind = ItemKind.none;
    items.pickupSerial++;
    items.lastTaker = slot;
    return;
  }
}

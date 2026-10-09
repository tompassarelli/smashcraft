






import { f32 } from "wisp/src/sim/f32";
import { ItemKind } from "./codes";
import type { Fighter } from "./fighter";


export const ITEM_BUFF_FRAMES = 600;


export const SPEED_BUFF_SCALE = f32(1.3);

export const SPEED_BUFF_JUMP_SCALE = f32(1.1);

export const HEAVY_BUFF_WEIGHT_SCALE = 1.5;

export const HEAVY_BUFF_FALL_SCALE = f32(1.3);


const GROUNDED_JUMPS = 2;
const AERIAL_JUMPS = 1;


export function speedBuffed(f: Readonly<Fighter>, speed: number): number {
  return f.status.buff === ItemKind.speed ? f32(speed * SPEED_BUFF_SCALE) : speed;
}


export function jumpBuffed(f: Readonly<Fighter>, speed: number): number {
  return f.status.buff === ItemKind.speed ? f32(speed * SPEED_BUFF_JUMP_SCALE) : speed;
}


export function knockbackWeight(f: Readonly<Fighter>): number {
  const { weight } = f.tuning.physics;
  return f.status.buff === ItemKind.heavy ? f32(weight * HEAVY_BUFF_WEIGHT_SCALE) : weight;
}


export function heavyFall(f: Readonly<Fighter>, value: number): number {
  return f.status.buff === ItemKind.heavy ? f32(value * HEAVY_BUFF_FALL_SCALE) : value;
}

export function groundedJumps(_f: Readonly<Fighter>): number {
  return GROUNDED_JUMPS;
}


export function aerialJumps(_f: Readonly<Fighter>): number {
  return AERIAL_JUMPS;
}


export function applyItemBuff(f: Fighter, kind: ItemKind): void {
  applyItemBuffFor(f, kind, ITEM_BUFF_FRAMES);
}


export function applyItemBuffFor(f: Fighter, kind: number, frames: number): void {
  if (kind !== ItemKind.speed && kind !== ItemKind.heavy) return;
  f.status.buff = kind;
  f.status.buffFrames = frames;
}


export function endItemBuff(f: Fighter): void {
  f.status.buff = ItemKind.none;
  f.status.buffFrames = 0;
}


export function advanceItemBuff(f: Fighter): void {
  if (f.status.buffFrames <= 0) return;
  f.status.buffFrames--;
  if (f.status.buffFrames === 0) endItemBuff(f);
}

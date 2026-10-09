






import { min } from "../../runtime/numbers";
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

const extraJumps = (f: Readonly<Fighter>): number => f.status.buff === ItemKind.extraJump ? 1 : 0;


export function groundedJumps(f: Readonly<Fighter>): number {
  return GROUNDED_JUMPS + extraJumps(f);
}


export function aerialJumps(f: Readonly<Fighter>): number {
  return AERIAL_JUMPS + extraJumps(f);
}


function jumpLimit(f: Readonly<Fighter>): number {
  return f.motion.grounded && f.jump.squat <= 0 ? groundedJumps(f) : aerialJumps(f);
}


export function applyItemBuff(f: Fighter, kind: ItemKind): void {
  if (kind === ItemKind.none) return;
  f.status.buff = kind;
  f.status.buffFrames = ITEM_BUFF_FRAMES;
  f.jump.remaining = min(kind === ItemKind.extraJump ? f.jump.remaining + 1 : f.jump.remaining, jumpLimit(f));
}


export function endItemBuff(f: Fighter): void {
  f.status.buff = ItemKind.none;
  f.status.buffFrames = 0;
  f.jump.remaining = min(f.jump.remaining, jumpLimit(f));
}


export function advanceItemBuff(f: Fighter): void {
  if (f.status.buffFrames <= 0) return;
  f.status.buffFrames--;
  if (f.status.buffFrames === 0) endItemBuff(f);
}

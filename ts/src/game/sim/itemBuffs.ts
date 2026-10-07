// Item buffs (#196; smashcraft:docs/gameplay-design.md, "Items"): a pickup
// gives its taker one temporary buff, at most 10 seconds. One at a time: a new
// pickup replaces the running one, and a knockout ends it. As sim/chill.ts
// does, this module only scales the values the shared movement, jump and
// knockback code reads from a fighter's tuning, so every fighter and every
// state that uses that physics gets the buff, and specials keep their own
// authored motion.
import { min } from "../../runtime/numbers";
import { f32 } from "wisp/src/sim/f32";
import { ItemKind } from "./codes";
import type { Fighter } from "./fighter";

/** Every buff's length: Tom decided 7 Oct that no item lasts longer than 10 seconds. */
export const ITEM_BUFF_FRAMES = 600;

/** Speed: walk, dash, run and air-drift top speeds (and the ground speed cap that would clip them). */
export const SPEED_BUFF_SCALE = f32(1.3);
/** Speed: ground and midair jump launch speeds, about 1.2 times the height. */
export const SPEED_BUFF_JUMP_SCALE = f32(1.1);
/** Heavy: the weight knockback reads. */
export const HEAVY_BUFF_WEIGHT_SCALE = 1.5;
/** Heavy: gravity, the maximum fall speed and the fast-fall speed. */
export const HEAVY_BUFF_FALL_SCALE = f32(1.3);

/** Jumps a fighter holds standing on a deck (the ground jump and one midair jump), and in the air. */
const GROUNDED_JUMPS = 2;
const AERIAL_JUMPS = 1;

/** A top speed: raised while Speed runs. */
export function speedBuffed(f: Readonly<Fighter>, speed: number): number {
  return f.status.buff === ItemKind.speed ? f32(speed * SPEED_BUFF_SCALE) : speed;
}

/** A jump's launch speed: raised while Speed runs. */
export function jumpBuffed(f: Readonly<Fighter>, speed: number): number {
  return f.status.buff === ItemKind.speed ? f32(speed * SPEED_BUFF_JUMP_SCALE) : speed;
}

/** The weight knockback reads: raised while Heavy runs. */
export function knockbackWeight(f: Readonly<Fighter>): number {
  const { weight } = f.tuning.physics;
  return f.status.buff === ItemKind.heavy ? f32(weight * HEAVY_BUFF_WEIGHT_SCALE) : weight;
}

/** Gravity, a maximum fall speed or the fast-fall speed: raised while Heavy runs. */
export function heavyFall(f: Readonly<Fighter>, value: number): number {
  return f.status.buff === ItemKind.heavy ? f32(value * HEAVY_BUFF_FALL_SCALE) : value;
}

const extraJumps = (f: Readonly<Fighter>): number => f.status.buff === ItemKind.extraJump ? 1 : 0;

/** Jumps refilled on a deck: the ground jump and every midair jump. */
export function groundedJumps(f: Readonly<Fighter>): number {
  return GROUNDED_JUMPS + extraJumps(f);
}

/** The most midair jumps an airborne fighter holds. */
export function aerialJumps(f: Readonly<Fighter>): number {
  return AERIAL_JUMPS + extraJumps(f);
}

/** The most jumps `f` may hold right now: on a deck before jump squat, or otherwise. */
function jumpLimit(f: Readonly<Fighter>): number {
  return f.motion.grounded && f.jump.squat <= 0 ? groundedJumps(f) : aerialJumps(f);
}

/** Gives `f` the buff of `kind`, replacing any running one. Extra Jump also grants its jump at once. */
export function applyItemBuff(f: Fighter, kind: ItemKind): void {
  if (kind === ItemKind.none) return;
  f.status.buff = kind;
  f.status.buffFrames = ITEM_BUFF_FRAMES;
  f.jump.remaining = min(kind === ItemKind.extraJump ? f.jump.remaining + 1 : f.jump.remaining, jumpLimit(f));
}

/** Ends the running buff; jumps beyond the normal limit go with Extra Jump. */
export function endItemBuff(f: Fighter): void {
  f.status.buff = ItemKind.none;
  f.status.buffFrames = 0;
  f.jump.remaining = min(f.jump.remaining, jumpLimit(f));
}

/** One match frame of the running buff. */
export function advanceItemBuff(f: Fighter): void {
  if (f.status.buffFrames <= 0) return;
  f.status.buffFrames--;
  if (f.status.buffFrames === 0) endItemBuff(f);
}

// Item buffs (#196; smashcraft:docs/gameplay-design.md, "Items"): a pickup
// gives its taker one temporary buff, at most 10 seconds. One at a time: a new
// pickup replaces the running one, and a knockout ends it.
import { ItemKind } from "./codes";
import type { Fighter } from "./fighter";

/** Every buff's length: Tom decided 7 Oct that no item lasts longer than 10 seconds. */
export const ITEM_BUFF_FRAMES = 600;

/** Gives `f` the buff of `kind`, replacing any running one. */
export function applyItemBuff(f: Fighter, kind: ItemKind): void {
  if (kind === ItemKind.none) return;
  f.status.buff = kind;
  f.status.buffFrames = ITEM_BUFF_FRAMES;
}

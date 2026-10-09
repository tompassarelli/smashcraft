



import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { PARTICIPANT_CAPACITY, participantActive } from "../input/participants";
import { type RosterGrid, type RosterTile, cellRect, tileAt } from "./selectionGrid";

export type { RosterTile };

export interface RosterChip {

  choice: number;

  placed: boolean;
}


export interface Roster {

  grid: RosterGrid;

  selectable: number;

  chips: readonly RosterChip[];
}

export interface SelectionDrag {

  held: number | undefined;

  hover: RosterTile | undefined;

  dragging: number | undefined;

  down: boolean;
}


export interface Placement {
  readonly slot: number;
  readonly tile: RosterTile;
}


export function decodeCpuPlacement(data: string, count: number): Placement | undefined {
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    for (let tile = 0; tile < count; tile++) {
      if (data === `${slot}${tile}`) return { slot, tile };
    }
  }
  return undefined;
}


export function chipX(grid: RosterGrid, slot: number, choice: number): number {
  return cellRect(grid, choice).left + (f32(0.004) + floorMod(slot, 2) * f32(0.056)) * grid.scale;
}


export function chipY(grid: RosterGrid, slot: number, choice: number): number {
  return cellRect(grid, choice).top - (slot < 2 ? f32(0.01) : f32(0.066)) * grid.scale;
}

export function cardX(slot: number): number {
  return 0.054999999701976776 + slot * 0.17499999701976776;
}


function onChip(grid: RosterGrid, slot: number, choice: number, x: number, y: number): boolean {
  const dx = x - (chipX(grid, slot, choice) + f32(0.024) * grid.scale);
  const dy = y - (chipY(grid, slot, choice) - f32(0.024) * grid.scale);
  return dx * dx + dy * dy <= f32(0.000576) * grid.scale * grid.scale;
}


export function cardSlot(x: number, y: number, selectable: number): number | undefined {
  if (y < f32(0.11) || y > 0.24199999868869781) return undefined;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    const left = cardX(slot);
    if (x >= left && x <= left + 0.1599999964237213 && participantActive(selectable, slot)) return slot;
  }
  return undefined;
}

export function selectionDrag(): SelectionDrag {
  return { held: undefined, hover: undefined, dragging: undefined, down: false };
}


export function clearSelectionDrag(drag: SelectionDrag): void {
  drag.held = undefined;
  drag.hover = undefined;
  drag.dragging = undefined;
  drag.down = false;
}






function pickUp(drag: SelectionDrag, { grid, selectable, chips }: Readonly<Roster>, x: number, y: number): number | undefined {
  let picked = cardSlot(x, y, selectable);
  if (picked === undefined) {
    for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
      const chip = chips[slot];
      if (chip?.placed === true && participantActive(selectable, slot) && onChip(grid, slot, chip.choice, x, y)) picked = slot;
    }
  }
  if (picked !== undefined) drag.held = picked;
  return picked ?? (drag.hover === undefined ? undefined : drag.held);
}


export function updateSelectionDrag(drag: SelectionDrag, roster: Readonly<Roster>, down: boolean, x: number, y: number): Placement | undefined {

  if (drag.held !== undefined && !participantActive(roster.selectable, drag.held)) drag.held = undefined;
  if (drag.dragging !== undefined && !participantActive(roster.selectable, drag.dragging)) drag.dragging = undefined;
  drag.hover = tileAt(roster.grid, x, y);
  let placement: Placement | undefined;
  if (down && !drag.down) {
    drag.dragging = pickUp(drag, roster, x, y);
  } else if (!down && drag.down) {
    if (drag.dragging !== undefined && drag.hover !== undefined) placement = { slot: drag.dragging, tile: drag.hover };
    drag.dragging = undefined;
  }
  drag.down = down;
  return placement;
}


export function placeHovered({ held, hover }: Readonly<SelectionDrag>): Placement | undefined {
  return held === undefined || hover === undefined ? undefined : { slot: held, tile: hover };
}


export const HAND_SIZE = f32(0.04);

export const handLeft = (x: number): number => x - f32(0.203125) * HAND_SIZE;

export const handTop = (y: number): number => y + f32(0.1640625) * HAND_SIZE;

export const carriedChipLeft = (x: number, size: number): number => x - size * f32(0.5);

export const carriedChipTop = (y: number, size: number): number => y + size * f32(0.06);

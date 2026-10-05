// Drag and drop on the character panel. Each participant slot has a card along
// the bottom and a chip that sits on its card until placed on a roster tile.
// Coordinates are UI frame units (pointer.ts). The state belongs to the local
// cursor: a placement crosses a player sync event before it changes a fighter.
import { floorMod } from "../../sim/intMath";
import { PARTICIPANT_CAPACITY, participantActive } from "../input/participants";

/** Roster tiles left to right; a tile's number is the fighter it chooses. */
export type RosterTile = 0 | 1 | 2;

export interface RosterChip {
  /** The roster tile the slot chose. */
  choice: number;
  /** Whether the chip sits on that tile rather than on the slot's card. */
  placed: boolean;
}

/** The panel as this player sees it this frame. */
export interface Roster {
  /** Slots whose chips this player may move: their own fighter and computers they may choose for. */
  selectable: number;
  /** One chip per participant slot. */
  chips: readonly RosterChip[];
}

export interface SelectionDrag {
  /** The chip that a press on a tile, or the attack key, places: the player's own, or the last one picked up. */
  held: number | undefined;
  /** The roster tile under the pointer. */
  hover: RosterTile | undefined;
  /** The slot whose chip follows the pointer until the button comes up. */
  dragging: number | undefined;
  /** The button state at the last update. */
  down: boolean;
}

/** A chip dropped on a tile: the choice to synchronize. */
export interface Placement {
  readonly slot: number;
  readonly tile: RosterTile;
}

export function rosterTile(x: number, y: number): RosterTile | undefined {
  if (y < 0.2919999957084656 || y > 0.42399999499320984) return undefined;
  if (x >= 0.25999999046325684 && x <= 0.3720000088214874) return 0;
  if (x >= 0.4399999976158142 && x <= 0.5519999861717224) return 1;
  if (x >= 0.6200000047683716 && x <= 0.7319999933242798) return 2;
  return undefined;
}

/** The left edge of a placed chip; slots share a tile in two columns. */
export function chipX(slot: number, choice: number): number {
  const tileLeft = choice === 0 ? 0.2720000147819519 : choice === 1 ? 0.4519999921321869 : 0.6320000290870667;
  return tileLeft + floorMod(slot, 2) * 0.050999999046325684;
}

/** The top edge of a placed chip; slots share a tile in two rows. */
export function chipY(slot: number): number {
  return slot < 2 ? 0.3659999966621399 : 0.32600000500679016;
}

export function cardX(slot: number): number {
  return 0.054999999701976776 + slot * 0.17499999701976776;
}

/** Chips are 0.04 square; a press within 0.02 of the center picks one up. */
function onChip(slot: number, choice: number, x: number, y: number): boolean {
  const dx = x - (chipX(slot, choice) + 0.019999999552965164);
  const dy = y - (chipY(slot) - 0.019999999552965164);
  return dx * dx + dy * dy <= 0.00039999998989515007;
}

/** The selectable slot whose card is under the pointer; the slot-mode labels above the cards are not part of them. */
export function cardSlot(x: number, y: number, selectable: number): number | undefined {
  if (y < 0.07500000298023224 || y > 0.24199999868869781) return undefined;
  for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
    const left = cardX(slot);
    if (x >= left && x <= left + 0.1599999964237213 && participantActive(selectable, slot)) return slot;
  }
  return undefined;
}

export function selectionDrag(): SelectionDrag {
  return { held: undefined, hover: undefined, dragging: undefined, down: false };
}

/** The panel closed: nothing stays held, hovered or dragged. */
export function clearSelectionDrag(drag: SelectionDrag): void {
  drag.held = undefined;
  drag.hover = undefined;
  drag.dragging = undefined;
  drag.down = false;
}

/**
 * The chip a press picks up: a selectable card's, then a placed selectable
 * chip's (the last slot wins where chips overlap), then the held chip when the
 * press is on a tile. Picking up a chip also holds it.
 */
function pickUp(drag: SelectionDrag, { selectable, chips }: Readonly<Roster>, x: number, y: number): number | undefined {
  let picked = cardSlot(x, y, selectable);
  if (picked === undefined) {
    for (let slot = 0; slot < PARTICIPANT_CAPACITY; slot++) {
      const chip = chips[slot];
      if (chip?.placed === true && participantActive(selectable, slot) && onChip(slot, chip.choice, x, y)) picked = slot;
    }
  }
  if (picked !== undefined) drag.held = picked;
  return picked ?? (drag.hover === undefined ? undefined : drag.held);
}

/** One frame of the pointer while the panel is open; returns a chip dropped on a tile. */
export function updateSelectionDrag(drag: SelectionDrag, roster: Readonly<Roster>, down: boolean, x: number, y: number): Placement | undefined {
  // A chip that stopped being selectable leaves the hand.
  if (drag.held !== undefined && !participantActive(roster.selectable, drag.held)) drag.held = undefined;
  if (drag.dragging !== undefined && !participantActive(roster.selectable, drag.dragging)) drag.dragging = undefined;
  drag.hover = rosterTile(x, y);
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

/** Places the held chip on the hovered tile, as the attack key does. */
export function placeHovered({ held, hover }: Readonly<SelectionDrag>): Placement | undefined {
  return held === undefined || hover === undefined ? undefined : { slot: held, tile: hover };
}

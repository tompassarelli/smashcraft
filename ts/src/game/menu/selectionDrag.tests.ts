import { assertEquals, assertNear, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { floorMod } from "wisp/src/sim/intMath";
import { at as lookup } from "wisp/src/runtime/lookup";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { createMatchState, selectCpuCharacter, setParticipants } from "../match/rules";
import { pointerX, pointerY } from "./pointer";
import { cellRect, rosterGrid, tileAt } from "./selectionGrid";
import {
  type Placement, type Roster, type RosterChip, type SelectionDrag, cardSlot, cardX, chipX, chipY, clearSelectionDrag, placeHovered,
  decodeCpuPlacement, selectionDrag, updateSelectionDrag,
} from "./selectionDrag";

/** UI frame units from thousandths, the same binary32 value in both runtimes. */
const at = (thousandths: number) => f32(thousandths / 1000);

const UNPLACED: RosterChip = { choice: 0, placed: false };
const GRID = rosterGrid(3);
/** The center of a tile on the three-fighter grid. */
const tx = (tile: number) => (cellRect(GRID, tile).left + cellRect(GRID, tile).right) / 2;
const ty = (cellRect(GRID, 0).top + cellRect(GRID, 0).bottom) / 2;

/** The local player in slot 0 and an opponent in slot 1 whose chip they may or may not move. */
function board(own: RosterChip, opponent: RosterChip, opponentSelectable: boolean): Roster {
  return { grid: GRID, selectable: opponentSelectable ? 3 : 1, chips: [own, opponent, UNPLACED, UNPLACED] };
}

function press(drag: SelectionDrag, roster: Roster, x: number, y: number): void {
  assertEquals(updateSelectionDrag(drag, roster, true, x, y), undefined, "a press places nothing");
}

const release = (drag: SelectionDrag, roster: Roster, x: number, y: number) => updateSelectionDrag(drag, roster, false, x, y);

test("a dragged computer token selects every fighter through the synchronized drop", () => {
  const grid = rosterGrid(SELECTABLE_CHARACTERS.length);
  for (let slot = 1; slot < 4; slot++) {
    for (let tile = 0; tile < SELECTABLE_CHARACTERS.length; tile++) {
      const game = createMatchState();
      setParticipants(game, 1, 14);
      const drag = selectionDrag();
      const roster: Roster = { grid, selectable: 15, chips: [UNPLACED, UNPLACED, UNPLACED, UNPLACED] };
      press(drag, roster, cardX(slot) + at(80), at(180));
      const rect = cellRect(grid, tile);
      const placement = release(drag, roster, (rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
      assertPlacement(placement, slot, tile);
      const received = decodeCpuPlacement(`${slot}${tile}`, grid.count);
      assertPlacement(received, slot, tile);
      if (received !== undefined) selectCpuCharacter(game, 0, received.slot, lookup(SELECTABLE_CHARACTERS, received.tile));
      assertEquals(game.characterChoices[slot], lookup(SELECTABLE_CHARACTERS, tile));
      assertEquals(game.characterReadiness[slot], true);
    }
  }
});

function assertPlacement(placement: Placement | undefined, slot: number, tile: number): void {
  assertEquals(placement?.slot, slot, "placed slot");
  assertEquals(placement?.tile, tile, "placed tile");
}

test("screen pixels map to a centered 4:3 frame", () => {
  assertNear(pointerX(960, 1920, 1080), at(400), at(1) / 1000);
  assertNear(pointerY(540, 1080), at(300), at(1) / 1000);
  assertNear(pointerX(240, 1920, 1080), 0.0, at(1) / 1000);
  assertNear(pointerX(0, 1440, 1080), 0.0, at(1) / 1000);
});

test("hovering shows the held chip but does not place it until asked", () => {
  const drag = selectionDrag();
  const roster = board({ choice: 0, placed: false }, { choice: 1, placed: false }, false);
  release(drag, roster, tx(0), ty);
  assertEquals(drag.hover, 0);
  assertEquals(placeHovered(drag), undefined);
  drag.held = 0;
  release(drag, roster, tx(0), ty);
  assertPlacement(placeHovered(drag), 0, 0);
});

test("a click on a tile places the held chip, which stays held for a recall", () => {
  const drag = selectionDrag();
  const roster = board({ choice: 0, placed: false }, { choice: 1, placed: false }, false);
  drag.held = 0;
  press(drag, roster, tx(0), ty);
  assertPlacement(release(drag, roster, tx(0), ty), 0, 0);
  assertEquals(drag.held, 0);
});

test("a placed chip can be dragged to another tile", () => {
  const drag = selectionDrag();
  const roster = board({ choice: 0, placed: true }, { choice: 1, placed: false }, false);
  drag.held = 0;
  press(drag, roster, tx(0), ty);
  press(drag, roster, tx(1), ty);
  assertPlacement(release(drag, roster, tx(1), ty), 0, 1);
});

test("a computer can choose the same fighter as a human", () => {
  const drag = selectionDrag();
  const roster = board({ choice: 0, placed: false }, { choice: 1, placed: false }, true);
  drag.held = 1;
  press(drag, roster, tx(0), ty);
  assertPlacement(release(drag, roster, tx(0), ty), 1, 0);
});

test("only a placed opponent chip can be picked up", () => {
  const drag = selectionDrag();
  const roster = board({ choice: 0, placed: false }, { choice: 1, placed: false }, true);
  press(drag, roster, at(523), at(346));
  assertEquals(drag.dragging, undefined);
  assertEquals(release(drag, roster, tx(1), ty), undefined);
});

test("closing the panel clears the hover and the held chip", () => {
  const drag = selectionDrag();
  drag.held = 0;
  release(drag, board(UNPLACED, UNPLACED, false), tx(0), ty);
  clearSelectionDrag(drag);
  assertEquals(drag.hover, undefined);
  assertEquals(placeHovered(drag), undefined);
});

test("cards answer only for selectable slots, and not at the slot-mode labels above them", () => {
  assertEquals(cardSlot(at(300), at(160), 3), 1);
  assertEquals(cardSlot(at(300), at(160), 1), undefined);
  assertEquals(cardSlot(at(120), at(160), 1), 0);
  assertEquals(cardSlot(at(120), at(160), 3), 0);
  assertEquals(cardSlot(at(120), at(160), 2), undefined);
  assertEquals(cardSlot(at(300), at(310), 3), undefined);
  for (let slot = 0; slot < 4; slot++) {
    assertEquals(cardSlot(cardX(slot) + at(80), at(260), 15), undefined);
    assertEquals(cardSlot(cardX(slot) + at(80), at(200), 15), slot);
  }
});

test("unplaced human and computer chips drag from their cards onto the roster", () => {
  for (let slot = 0; slot < 2; slot++) {
    const drag = selectionDrag();
    const roster = board(UNPLACED, { choice: 1, placed: false }, true);
    drag.held = 0;
    press(drag, roster, at(135 + slot * 175), at(180));
    assertEquals(drag.dragging, slot);
    assertPlacement(release(drag, roster, tx(1), ty), slot, 1);
  }
});

test("either chip can choose the Illidan tile and leave it again", () => {
  assertEquals(tileAt(GRID, tx(2), ty), 2);
  assertEquals(tileAt(GRID, at(740), ty), undefined);
  assertEquals(tileAt(GRID, tx(2), at(280)), undefined);
  for (let slot = 0; slot < 2; slot++) {
    const drag = selectionDrag();
    const unplaced = board({ choice: 0, placed: false }, { choice: 1, placed: false }, true);
    drag.held = slot;
    press(drag, unplaced, tx(2), ty);
    assertPlacement(release(drag, unplaced, tx(2), ty), slot, 2);
    const placed = board({ choice: 2, placed: true }, { choice: 2, placed: true }, true);
    press(drag, placed, chipX(GRID, slot, 2) + at(20), chipY(GRID, slot, 2) - at(20));
    assertEquals(drag.dragging, slot);
    assertPlacement(release(drag, placed, tx(0), ty), slot, 0);
  }
});

test("the third and fourth cards and chips keep their own slots", () => {
  assertEquals(cardSlot(at(480), at(200), 4), 2);
  assertEquals(cardSlot(at(650), at(200), 8), 3);
  assertEquals(cardSlot(at(480), at(200), 8), undefined);
  assertEquals(cardSlot(at(120), at(200), 9), 0);
  assertEquals(cardSlot(cardX(2) + at(80), at(200), 9), undefined);
  const drag = selectionDrag();
  drag.held = 3;
  drag.hover = 2;
  assertPlacement(placeHovered(drag), 3, 2);
  const roster: Roster = { grid: GRID, selectable: 15, chips: [0, 1, 2, 3].map((slot) => ({ choice: floorMod(slot, 3), placed: true })) };
  for (let slot = 1; slot < 4; slot++) {
    press(drag, roster, chipX(GRID, slot, floorMod(slot, 3)) + at(20), chipY(GRID, slot, floorMod(slot, 3)) - at(20));
    assertEquals(drag.dragging, slot);
    assertPlacement(release(drag, roster, tx(2), at(400)), slot, 2);
  }
  assertEquals(drag.held, 3);
});

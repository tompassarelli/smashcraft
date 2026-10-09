import { assertEquals, assertNear, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { at as lookup } from "wisp/src/runtime/lookup";
import { SELECTABLE_CHARACTERS } from "../sim/heroes/registry";
import { createMatchState, selectCpuCharacter, setParticipants } from "../match/rules";
import { pointerX, pointerY } from "./pointer";
import { cellRect, rosterGrid } from "./selectionGrid";
import {
  type Placement, type Roster, type RosterChip, type SelectionDrag, cardX,
  decodeCpuPlacement, selectionDrag, updateSelectionDrag,
} from "./selectionDrag";


const at = (thousandths: number) => f32(thousandths / 1000);

const UNPLACED: RosterChip = { choice: 0, placed: false };

function press(drag: SelectionDrag, roster: Roster, x: number, y: number): void {
  assertEquals(updateSelectionDrag(drag, roster, true, x, y), undefined, "a press places nothing");
}

const release = (drag: SelectionDrag, roster: Roster, x: number, y: number) => updateSelectionDrag(drag, roster, false, x, y);

test("a dragged computer token selects every fighter through the synchronized drop [repro #209]", () => {
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

test("screen pixels map to a centered 4:3 frame [provisional]", () => {
  assertNear(pointerX(960, 1920, 1080), at(400), at(1) / 1000);
  assertNear(pointerY(540, 1080), at(300), at(1) / 1000);
  assertNear(pointerX(240, 1920, 1080), 0.0, at(1) / 1000);
  assertNear(pointerX(0, 1440, 1080), 0.0, at(1) / 1000);
});

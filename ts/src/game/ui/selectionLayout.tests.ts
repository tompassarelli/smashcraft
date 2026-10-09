


import { assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import type { TextBox } from "./hudLayout";
import { MOVES_BODY_BOX, MOVES_BUTTON_HEIGHT, MOVES_BUTTON_TOP, MOVES_TITLE_BOX, SELECTION_HEADER_FLOOR, selectionTitleBox } from "./selectionLayout";

const overlaps = (a: TextBox, b: TextBox): boolean =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top - a.height < b.top && b.top - b.height < a.top;

test("the Moves page stays below the selection header and its parts keep apart [repro #150]", () => {
  for (const box of [MOVES_TITLE_BOX, MOVES_BODY_BOX]) {
    assertTrue(box.top <= SELECTION_HEADER_FLOOR);
    assertTrue(box.top - box.height >= MOVES_BUTTON_TOP);
  }
  assertTrue(!overlaps(MOVES_TITLE_BOX, MOVES_BODY_BOX));
  assertTrue(MOVES_BUTTON_TOP - MOVES_BUTTON_HEIGHT >= 0.0);
});

test("the mode label sits inside the header's title box on 4:3, 16:10, 16:9 and 21:9 screens [repro #150]", () => {
  for (const aspect of [4.0 / 3.0, 16.0 / 10.0, 16.0 / 9.0, 21.0 / 9.0]) {
    const box = selectionTitleBox(aspect);
    assertTrue(box.width > f32(0.2) && box.height >= f32(0.025));
    assertTrue(box.top - box.height > SELECTION_HEADER_FLOOR && box.top < f32(0.6));
    assertTrue(!overlaps(box, MOVES_TITLE_BOX) && !overlaps(box, MOVES_BODY_BOX));
  }
});

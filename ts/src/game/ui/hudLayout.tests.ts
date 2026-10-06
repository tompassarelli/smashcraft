// Training's readout, the help line and the notice never overlap (#120: the
// readout's Combo line drew over the help line).
import { assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { MATCH_HELP_BOX, MATCH_NOTICE_BOX, TRAINING_READOUT_BOX, type TextBox } from "./hudLayout";

const overlaps = (a: TextBox, b: TextBox): boolean =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top - a.height < b.top && b.top - b.height < a.top;

test("training's readout, the help line and the notice keep apart", () => {
  assertTrue(!overlaps(TRAINING_READOUT_BOX, MATCH_HELP_BOX));
  assertTrue(!overlaps(TRAINING_READOUT_BOX, MATCH_NOTICE_BOX));
  assertTrue(!overlaps(MATCH_HELP_BOX, MATCH_NOTICE_BOX));
  // Inside the 0.8 x 0.6 UI.
  for (const box of [TRAINING_READOUT_BOX, MATCH_HELP_BOX, MATCH_NOTICE_BOX]) assertTrue(box.left >= 0.0 && box.top <= f32(0.6) && box.top - box.height >= 0.0);
});

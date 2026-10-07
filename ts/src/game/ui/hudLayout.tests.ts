// Training's readout, the help line and the notice never overlap (#120: the
// readout's Combo line drew over the help line).
import { assertTrue, test } from "wisp/src/runtime/testing";
import { f32 } from "wisp/src/sim/f32";
import { MATCH_HELP_BOX, MATCH_NOTICE_BOX, TRAINING_READOUT_BOX, TRAINING_READOUT_PANEL, TRAINING_READOUT_PANEL_ALPHA, type TextBox } from "./hudLayout";

const overlaps = (a: TextBox, b: TextBox): boolean =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top - a.height < b.top && b.top - b.height < a.top;

test("training's readout, the help line and the notice keep apart", () => {
  assertTrue(!overlaps(TRAINING_READOUT_BOX, MATCH_HELP_BOX));
  assertTrue(!overlaps(TRAINING_READOUT_BOX, MATCH_NOTICE_BOX));
  assertTrue(!overlaps(MATCH_HELP_BOX, MATCH_NOTICE_BOX));
  // Inside the 0.8 x 0.6 UI.
  for (const box of [TRAINING_READOUT_BOX, MATCH_HELP_BOX, MATCH_NOTICE_BOX]) assertTrue(box.left >= 0.0 && box.top <= f32(0.6) && box.top - box.height >= 0.0);
});

const linear = (grey: number): number => (grey <= f32(0.04045) ? grey / f32(12.92) : ((grey + f32(0.055)) / f32(1.055)) ** f32(2.4));

test("training's readout panel stays clear of the help and the notice and keeps white text at 4.5:1 over white sky", () => {
  assertTrue(!overlaps(TRAINING_READOUT_PANEL, MATCH_HELP_BOX));
  assertTrue(!overlaps(TRAINING_READOUT_PANEL, MATCH_NOTICE_BOX));
  const panel = TRAINING_READOUT_PANEL;
  const box = TRAINING_READOUT_BOX;
  assertTrue(panel.left <= box.left && panel.top >= box.top && panel.left + panel.width >= box.left + box.width && panel.top - panel.height <= box.top - box.height);
  // A black panel blended over white sky; text measured at 0.92 grey natively.
  const backing = linear(1.0 - TRAINING_READOUT_PANEL_ALPHA / 255);
  assertTrue((linear(f32(0.92)) + f32(0.05)) / (backing + f32(0.05)) >= 4.5);
});

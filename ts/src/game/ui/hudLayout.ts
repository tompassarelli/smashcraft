// The match's top-left text boxes, in UI units (left, top, width, height): the
// help line, training's readout (#120) and the centre notice. Kept apart so
// none draws over another (hudLayout.tests.ts).
import { f32 } from "wisp/src/sim/f32";

/** The menus' and HUD's font file. */
export const MENU_FONT = "Fonts\\FRIZQT__.TTF";

export interface TextBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Two lines of help at font 0.01. */
export const MATCH_HELP_BOX: TextBox = { left: f32(0.06), top: f32(0.54), width: f32(0.58), height: f32(0.055) };
/** Waiting, smash charge and result notices at font 0.019. */
export const MATCH_NOTICE_BOX: TextBox = { left: f32(0.26), top: f32(0.47), width: f32(0.42), height: f32(0.07) };
/** Training's readout at font 0.011: under the help, left of the notice, room for its lines to wrap. */
export const TRAINING_READOUT_BOX: TextBox = { left: f32(0.02), top: f32(0.48), width: f32(0.23), height: f32(0.08) };
/** The dark panel behind training's readout: its box with a margin, still clear of the help and the notice. */
const READOUT_MARGIN = f32(0.004);
export const TRAINING_READOUT_PANEL: TextBox = {
  left: TRAINING_READOUT_BOX.left - READOUT_MARGIN,
  top: TRAINING_READOUT_BOX.top + READOUT_MARGIN,
  width: TRAINING_READOUT_BOX.width + 2 * READOUT_MARGIN,
  height: TRAINING_READOUT_BOX.height + 2 * READOUT_MARGIN,
};
/**
 * The panel's opacity out of 255. The readout's white text stood on sky as
 * bright as 0.76 grey (1.5:1); at 204 a near-black panel keeps it above 4.5:1
 * even over a white sky.
 */
export const TRAINING_READOUT_PANEL_ALPHA = 204;

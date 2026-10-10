


import { f32 } from "wisp/src/sim/f32";


export const MENU_FONT = "Fonts\\FRIZQT__.TTF";
/** The dark tooltip backing behind every menu panel, readout and meter. */
export const PANEL_TEXTURE = "UI\\Widgets\\ToolTips\\Human\\human-tooltip-background.blp";

export interface TextBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}


export const MATCH_HELP_BOX: TextBox = { left: f32(0.06), top: f32(0.54), width: f32(0.58), height: f32(0.055) };

export const MATCH_NOTICE_BOX: TextBox = { left: f32(0.06), top: f32(0.47), width: f32(0.34), height: f32(0.07) };

export const TRAINING_READOUT_BOX: TextBox = { left: f32(0.02), top: f32(0.48), width: f32(0.23), height: f32(0.08) };

const READOUT_MARGIN = f32(0.004);
export const TRAINING_READOUT_PANEL: TextBox = {
  left: TRAINING_READOUT_BOX.left - READOUT_MARGIN,
  top: TRAINING_READOUT_BOX.top + READOUT_MARGIN,
  width: TRAINING_READOUT_BOX.width + 2 * READOUT_MARGIN,
  height: TRAINING_READOUT_BOX.height + 2 * READOUT_MARGIN,
};





export const TRAINING_READOUT_PANEL_ALPHA = 204;

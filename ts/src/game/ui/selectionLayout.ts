import { f32 } from "wisp/src/sim/f32";
import type { TextBox } from "./hudLayout";

const SELECTION_HEADER_FLOOR = f32(0.49);

export function selectionTitleBox(_aspect: number): TextBox {
  return { left: f32(0.055), top: f32(0.552), width: f32(0.285), height: f32(0.025) };
}


export const MOVES_TITLE_BOX: TextBox = { left: f32(0.12), top: f32(0.44), width: f32(0.56), height: f32(0.03) };
export const MOVES_BODY_BOX: TextBox = { left: f32(0.12), top: f32(0.4), width: f32(0.56), height: f32(0.3) };
export const MOVES_BUTTON_TOP = f32(0.075);
export const MOVES_BUTTON_HEIGHT = f32(0.032);

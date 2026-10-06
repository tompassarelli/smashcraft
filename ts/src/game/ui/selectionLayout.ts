// Fighter selection's header and Moves page, in UI units (left, top, width,
// height). The backdrop (smashcraft:tools/selection/art/SelectionBackdrop.svg,
// 1920x1080) is stretched over the whole screen (frames.ts coverScreen), so its
// header band and title box land where these functions put them for the
// client's aspect ratio. The Moves page stays below the header
// (selectionLayout.tests.ts).
import { f32 } from "wisp/src/sim/f32";
import type { TextBox } from "./hudLayout";

const ART_WIDTH = 1920.0;
const ART_HEIGHT = 1080.0;
/** The header band's lowest art row: its rail's lower highlight. */
const HEADER_BOTTOM = 252.0;
/** The title box's inner panel in art pixels. */
const TITLE_LEFT = 507.0;
const TITLE_RIGHT = 1251.0;
const TITLE_TOP = 78.0;
const TITLE_BOTTOM = 154.0;

const artY = (row: number): number => f32(0.6 * (1.0 - row / ART_HEIGHT));

/** UI x of an art column on a screen `aspect` (width over height) wide: the backdrop is centred at 0.4 and 0.6 tall. */
const artX = (column: number, aspect: number): number => {
  const width = aspect * 0.6;
  return f32(0.4 - width / 2.0 + (column / ART_WIDTH) * width);
};

/** The UI height below which the header band ends; nothing else on the page draws above it. */
export const SELECTION_HEADER_FLOOR = artY(HEADER_BOTTOM);

/** The header's title box, where the mode label (VERSUS, TRAINING) is drawn. */
export function selectionTitleBox(aspect: number): TextBox {
  const left = artX(TITLE_LEFT, aspect);
  return { left, top: artY(TITLE_TOP), width: f32(artX(TITLE_RIGHT, aspect) - left), height: f32(artY(TITLE_TOP) - artY(TITLE_BOTTOM)) };
}

/** The Moves page's title, its move lines and its row of buttons, all below the header. */
export const MOVES_TITLE_BOX: TextBox = { left: f32(0.12), top: f32(0.44), width: f32(0.56), height: f32(0.03) };
export const MOVES_BODY_BOX: TextBox = { left: f32(0.12), top: f32(0.4), width: f32(0.56), height: f32(0.3) };
export const MOVES_BUTTON_TOP = f32(0.075);
export const MOVES_BUTTON_HEIGHT = f32(0.032);

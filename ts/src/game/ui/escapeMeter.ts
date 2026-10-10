


import { f32 } from "wisp/src/sim/f32";
import { idiv } from "wisp/src/sim/intMath";
import { ESCAPE_METER_BORDER, ESCAPE_METER_HEIGHT, ESCAPE_METER_SEGMENT_FRAMES, type EscapeMeterView, escapeMeterFill } from "../presentation/escapeMeter";
import { GRAB_HOLD_FRAMES } from "../sim/moves";
import { createBackdrop, consoleUi } from "./frames";
import { PANEL_TEXTURE } from "./hudLayout";

const WIDTH = f32(0.07);
const HEIGHT = f32(ESCAPE_METER_HEIGHT);
const BORDER = f32(ESCAPE_METER_BORDER);
const LINE_WIDTH = f32(0.0006);
const MARK_WIDTH = f32(0.0016);
const MARK_HEIGHT = f32(0.014);
const SEGMENTS = idiv(GRAB_HOLD_FRAMES, ESCAPE_METER_SEGMENT_FRAMES);
const FILL = "ReplaceableTextures\\TeamColor\\TeamColor04.blp";
const MARK = "ReplaceableTextures\\TeamColor\\TeamColor00.blp";

export class EscapeMeter {
  private readonly back: framehandle;
  private readonly fill: framehandle;
  private readonly lines: readonly framehandle[];
  private readonly mark: framehandle;
  private visible = false;
  private markVisible = false;

  constructor(slot: number) {

    const parent = consoleUi();
    const context = 1100 + slot * 20;
    this.back = createBackdrop(`EscapeMeterBack${I2S(slot)}`, parent, context);
    this.fill = createBackdrop(`EscapeMeterFill${I2S(slot)}`, parent, context + 1);
    const lines: framehandle[] = [];
    for (let line = 1; line < SEGMENTS; line++) lines.push(createBackdrop(`EscapeMeterLine${I2S(slot)}`, parent, context + 1 + line));
    this.lines = lines;
    this.mark = createBackdrop(`EscapeMeterMark${I2S(slot)}`, parent, context + 1 + SEGMENTS);
    BlzFrameSetTexture(this.back, PANEL_TEXTURE, 0, true);
    BlzFrameSetTexture(this.fill, FILL, 0, true);
    for (const line of lines) BlzFrameSetTexture(line, PANEL_TEXTURE, 0, true);
    BlzFrameSetTexture(this.mark, MARK, 0, true);
    BlzFrameSetSize(this.back, WIDTH + 2 * BORDER, HEIGHT + 2 * BORDER);
    for (const line of lines) BlzFrameSetSize(line, LINE_WIDTH, HEIGHT);
    BlzFrameSetSize(this.mark, MARK_WIDTH, MARK_HEIGHT);
    for (const [index, frame] of [this.back, this.fill, ...lines, this.mark].entries()) {
      BlzFrameSetEnable(frame, false);
      BlzFrameSetVisible(frame, false);
      BlzFrameSetLevel(frame, 8 + (index === 0 ? 0 : index === 1 ? 1 : 2));
    }
  }


  update(view: Readonly<EscapeMeterView>, column: number, row: number, aspect: number): void {
    const shown = view.shown && column >= 0.0 && column <= 1.0 && row >= 0.0 && row <= 1.0;
    if (shown !== this.visible) {
      this.visible = shown;
      BlzFrameSetVisible(this.back, shown);
      BlzFrameSetVisible(this.fill, shown);
      for (const line of this.lines) BlzFrameSetVisible(line, shown);
    }
    const markShown = shown && view.pummel >= 0;
    if (markShown !== this.markVisible) {
      this.markVisible = markShown;
      BlzFrameSetVisible(this.mark, markShown);
    }
    if (!shown) return;
    const centerX = f32(0.4) + (column - 0.5) * aspect * f32(0.6);
    const centerY = (1.0 - row) * f32(0.6);
    const left = centerX - WIDTH / 2.0;
    BlzFrameSetAbsPoint(this.back, FRAMEPOINT_CENTER, centerX, centerY);
    BlzFrameSetSize(this.fill, Math.max(LINE_WIDTH, WIDTH * escapeMeterFill(view)), HEIGHT);
    BlzFrameSetAbsPoint(this.fill, FRAMEPOINT_LEFT, left, centerY);
    this.lines.forEach((line, index) => {
      BlzFrameSetAbsPoint(line, FRAMEPOINT_CENTER, left + (WIDTH * (index + 1)) / SEGMENTS, centerY);
    });
    if (markShown) BlzFrameSetAbsPoint(this.mark, FRAMEPOINT_CENTER, left + WIDTH * Math.min(1.0, view.pummel / view.full), centerY);
  }

  destroy(): void {
    for (const frame of [this.back, this.fill, ...this.lines, this.mark]) BlzDestroyFrame(frame);
  }
}

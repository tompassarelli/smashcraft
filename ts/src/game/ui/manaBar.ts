




import { f32 } from "wisp/src/sim/f32";
import {
  MANA_BAR_SEGMENTS, type ManaFeedback, advanceManaFeedback, manaFeedback, manaFill, manaDrainLit, manaFlashLit, manaGlowLit,
} from "../presentation/manaBar";
import { createBackdrop } from "./frames";

const LINE_WIDTH = f32(0.0006);
const DARK = "UI\\Widgets\\ToolTips\\Human\\human-tooltip-background.blp";
const FILL = "ReplaceableTextures\\TeamColor\\TeamColor01.blp";
const FLASH = "ReplaceableTextures\\TeamColor\\TeamColor00.blp";
const GLOW = "ReplaceableTextures\\TeamColor\\TeamColor04.blp";

const DRAIN = "ReplaceableTextures\\TeamColor\\TeamColor03.blp";

export class ManaBar {
  private readonly back: framehandle;
  private readonly fill: framehandle;
  private readonly glow: framehandle;
  private readonly lines: readonly framehandle[];
  private readonly flash: framehandle;
  private readonly drain: framehandle;
  private readonly feedback: ManaFeedback = manaFeedback();
  private width = -1.0;
  private left = -1.0;
  private centerY = -1.0;
  private visible = false;
  private flashShown = false;
  private glowShown = false;
  private drainShown = false;
  private shownFill = -1.0;


  constructor(name: string, slot: number, parent: framehandle, context: number, private readonly height: number, private readonly border: number) {
    const suffix = `${name}${I2S(slot)}`;
    this.back = createBackdrop(`ManaBarBack${suffix}`, parent, context);
    this.fill = createBackdrop(`ManaBarFill${suffix}`, parent, context + 1);
    this.glow = createBackdrop(`ManaBarGlow${suffix}`, parent, context + 2);
    const lines: framehandle[] = [];
    for (let line = 1; line < MANA_BAR_SEGMENTS; line++) lines.push(createBackdrop(`ManaBarLine${suffix}`, parent, context + 2 + line));
    this.lines = lines;
    this.flash = createBackdrop(`ManaBarFlash${suffix}`, parent, context + 2 + MANA_BAR_SEGMENTS);
    this.drain = createBackdrop(`ManaBarDrain${suffix}`, parent, context + 3 + MANA_BAR_SEGMENTS);
    BlzFrameSetTexture(this.back, DARK, 0, true);
    BlzFrameSetTexture(this.fill, FILL, 0, true);
    BlzFrameSetTexture(this.glow, GLOW, 0, true);
    for (const line of lines) BlzFrameSetTexture(line, DARK, 0, true);
    BlzFrameSetTexture(this.flash, FLASH, 0, true);
    BlzFrameSetTexture(this.drain, DRAIN, 0, true);
    BlzFrameSetAlpha(this.drain, 210);
    BlzFrameSetAlpha(this.glow, 150);
    BlzFrameSetAlpha(this.flash, 190);
    for (const line of lines) BlzFrameSetSize(line, LINE_WIDTH, height);
    BlzFrameSetPoint(this.fill, FRAMEPOINT_LEFT, this.back, FRAMEPOINT_LEFT, border, 0.0);
    BlzFrameSetPoint(this.glow, FRAMEPOINT_CENTER, this.back, FRAMEPOINT_CENTER, 0.0, 0.0);
    BlzFrameSetPoint(this.flash, FRAMEPOINT_CENTER, this.back, FRAMEPOINT_CENTER, 0.0, 0.0);
    BlzFrameSetPoint(this.drain, FRAMEPOINT_CENTER, this.back, FRAMEPOINT_CENTER, 0.0, 0.0);
    this.frames().forEach((frame, index) => {
      BlzFrameSetEnable(frame, false);
      BlzFrameSetVisible(frame, false);
      BlzFrameSetLevel(frame, 8 + (index === 0 ? 0 : index <= 2 ? 1 : 2));
    });
  }

  private frames(): framehandle[] {
    return [this.back, this.fill, this.glow, ...this.lines, this.flash, this.drain];
  }





  place(left: number, centerY: number, width: number): void {
    if (width !== this.width) {
      this.width = width;
      this.shownFill = -1.0;
      BlzFrameSetSize(this.back, width + 2 * this.border, this.height + 2 * this.border);
      BlzFrameSetSize(this.glow, width, this.height);
      BlzFrameSetSize(this.flash, width, this.height);
      BlzFrameSetSize(this.drain, width + 2 * this.border, this.height + 2 * this.border);
      this.lines.forEach((line, index) => {
        BlzFrameSetPoint(line, FRAMEPOINT_CENTER, this.back, FRAMEPOINT_LEFT, this.border + (width * (index + 1)) / MANA_BAR_SEGMENTS, 0.0);
      });
    }
    if (left === this.left && centerY === this.centerY) return;
    this.left = left;
    this.centerY = centerY;
    BlzFrameSetAbsPoint(this.back, FRAMEPOINT_CENTER, left + width / 2.0, centerY);
  }


  update(shown: boolean, points: number, denials: number, drains: number): void {
    advanceManaFeedback(this.feedback, points, denials, drains);
    if (shown !== this.visible) {
      this.visible = shown;
      for (const frame of [this.back, this.fill, ...this.lines]) BlzFrameSetVisible(frame, shown);
    }
    const flash = shown && manaFlashLit(this.feedback);
    if (flash !== this.flashShown) {
      this.flashShown = flash;
      BlzFrameSetVisible(this.flash, flash);
    }
    const drain = shown && manaDrainLit(this.feedback);
    if (drain !== this.drainShown) {
      this.drainShown = drain;
      BlzFrameSetVisible(this.drain, drain);
    }
    const glow = shown && manaGlowLit(this.feedback);
    if (glow !== this.glowShown) {
      this.glowShown = glow;
      BlzFrameSetVisible(this.glow, glow);
    }
    if (!shown) return;
    const fill = manaFill(points);
    if (fill === this.shownFill) return;
    this.shownFill = fill;
    BlzFrameSetSize(this.fill, Math.max(LINE_WIDTH, this.width * fill), this.height);
  }

  destroy(): void {
    for (const frame of this.frames()) BlzDestroyFrame(frame);
  }
}

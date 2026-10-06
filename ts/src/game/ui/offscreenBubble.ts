// Every client creates the same handles; only their drawn position and
// visibility depend on the local camera. No frame receives input focus.
import { f32 } from "wisp/src/sim/f32";
import { createBackdrop, createText, gameUi, MENU_FONT } from "./frames";
import { Character } from "../sim/codes";

export function bubblePosition(column: number, row: number): { readonly column: number; readonly row: number; readonly arrow: string } {
  const dx = column - 0.5;
  const dy = row - 0.5;
  // ifmagnify.c's 252.7/640 by 162.7/480 inset; bottom stays above our HUD.
  const extent = Math.max(Math.abs(dx) / f32(252.7 / 640.0), Math.abs(dy) / f32(162.7 / 480.0));
  const scale = 1.0 / Math.max(1.0, extent);
  const arrow = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? ">" : "<" : dy > 0 ? "v" : "^";
  return { column: 0.5 + dx * scale, row: Math.min(f32(0.72), 0.5 + dy * scale), arrow };
}

export class OffscreenBubble {
  private readonly portrait: framehandle;
  private readonly arrow: framehandle;
  private visible = false;
  private character: Character | undefined;

  constructor(slot: number) {
    this.portrait = createBackdrop(`OffscreenPortrait${I2S(slot)}`, gameUi(), 920 + slot * 2);
    this.arrow = createText(`OffscreenArrow${I2S(slot)}`, gameUi(), 921 + slot * 2);
    BlzFrameSetSize(this.portrait, f32(0.046), f32(0.046));
    BlzFrameSetSize(this.arrow, f32(0.027), f32(0.027));
    BlzFrameSetFont(this.arrow, MENU_FONT, f32(0.021), 0);
    for (const frame of [this.portrait, this.arrow]) {
      BlzFrameSetEnable(frame, false);
      BlzFrameSetVisible(frame, false);
      BlzFrameSetLevel(frame, 10);
    }
  }

  update(visible: boolean, character: Character, column: number, row: number, aspect: number): void {
    if (visible !== this.visible) {
      this.visible = visible;
      BlzFrameSetVisible(this.portrait, visible);
      BlzFrameSetVisible(this.arrow, visible);
    }
    if (!visible) return;
    if (this.character !== character) {
      this.character = character;
      const art = character === Character.demonHunter ? "DemonHunter" : character === Character.archer ? "Archer" : "Rifleman";
      BlzFrameSetTexture(this.portrait, `war3mapImported\\${art}Portrait.tga`, 0, true);
    }
    const position = bubblePosition(column, row);
    const x = f32(0.4) + (position.column - 0.5) * aspect * f32(0.6);
    const y = (1.0 - position.row) * f32(0.6);
    BlzFrameSetAbsPoint(this.portrait, FRAMEPOINT_CENTER, x, y);
    const arrowX = Math.abs(column - 0.5) > Math.abs(row - 0.5) ? (column > 0.5 ? f32(0.032) : -f32(0.032)) : 0.0;
    const arrowY = arrowX === 0 ? (row > 0.5 ? -f32(0.032) : f32(0.032)) : 0.0;
    BlzFrameSetAbsPoint(this.arrow, FRAMEPOINT_CENTER, x + arrowX, y + arrowY);
    BlzFrameSetText(this.arrow, position.arrow);
  }
}

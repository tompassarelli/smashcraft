// A fighter's passive pips (#148, smashcraft:docs/design/passives.md,
// "Presentation"): a short row of squares above its overhead mana bar, dim
// while charging, lit per stack, all bright when the passive is ready. Every
// client creates the same handles; only drawn position and visibility are local.
import { f32 } from "wisp/src/sim/f32";
import { createBackdrop, consoleUi } from "./frames";

/** The most pips any passive shows. */
const PASSIVE_PIP_CAPACITY = 3;
const PASSIVE_PIP_SIZE = f32(0.006);
const PIP_GAP = f32(0.002);
/** From the top of the mana bar's border to the pips' centre. */
export const PASSIVE_PIP_LIFT = f32(0.003) + PASSIVE_PIP_SIZE / 2.0;
const DIM = "UI\\Widgets\\ToolTips\\Human\\human-tooltip-background.blp";
const LIT = "ReplaceableTextures\\TeamColor\\TeamColor04.blp";
const READY = "ReplaceableTextures\\TeamColor\\TeamColor05.blp";

interface PassivePipsView {
  readonly lit: number;
  readonly of: number;
  readonly ready: boolean;
}

export const NO_PIPS: PassivePipsView = { lit: 0, of: 0, ready: false };

export class PassivePips {
  private readonly pips: readonly framehandle[];
  /** What each pip last drew: -1 hidden, 0 dim, 1 lit, 2 ready. */
  private readonly drawn: number[] = [];
  /** Where the row was last placed, so a still fighter moves no frames. */
  private placedX = -1.0;
  private placedY = -1.0;

  constructor(slot: number) {
    const parent = consoleUi();
    const context = 1180 + slot * 4;
    const pips: framehandle[] = [];
    for (let index = 0; index < PASSIVE_PIP_CAPACITY; index++) {
      const pip = createBackdrop(`PassivePip${I2S(slot)}_${I2S(index)}`, parent, context + index);
      BlzFrameSetSize(pip, PASSIVE_PIP_SIZE, PASSIVE_PIP_SIZE);
      BlzFrameSetEnable(pip, false);
      BlzFrameSetVisible(pip, false);
      BlzFrameSetLevel(pip, 10);
      pips.push(pip);
      this.drawn.push(-1);
    }
    this.pips = pips;
  }

  /** `centerX` and `centerY` place the row's centre in UI units; `visible` is false off screen. Allocates nothing: it runs every rendered frame. */
  update(visible: boolean, view: Readonly<PassivePipsView>, centerX: number, centerY: number): void {
    const shown = visible && view.of > 0;
    const step = PASSIVE_PIP_SIZE + PIP_GAP;
    const left = centerX - (step * (view.of - 1)) / 2.0;
    const moved = shown && (centerX !== this.placedX || centerY !== this.placedY);
    if (moved) {
      this.placedX = centerX;
      this.placedY = centerY;
    }
    for (let index = 0; index < PASSIVE_PIP_CAPACITY; index++) {
      const pip = this.pips[index];
      if (pip === undefined) continue;
      const state = !shown || index >= view.of ? -1 : view.ready ? 2 : index < view.lit ? 1 : 0;
      if (state !== this.drawn[index]) {
        if (state < 0) BlzFrameSetVisible(pip, false);
        else {
          BlzFrameSetTexture(pip, state === 2 ? READY : state === 1 ? LIT : DIM, 0, true);
          BlzFrameSetVisible(pip, true);
        }
        this.drawn[index] = state;
        if (state >= 0) BlzFrameSetAbsPoint(pip, FRAMEPOINT_CENTER, left + step * index, centerY);
      } else if (state >= 0 && moved) BlzFrameSetAbsPoint(pip, FRAMEPOINT_CENTER, left + step * index, centerY);
    }
  }

  destroy(): void {
    for (const pip of this.pips) BlzDestroyFrame(pip);
  }
}

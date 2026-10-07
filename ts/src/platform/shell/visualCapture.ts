import { readChunk } from "wisp/src/platform/fileio";
import { Phase } from "../../game/match/rules";
import { clearVisualCapture, heldVisualFrame, holdVisualFrame, releaseVisualFrame, visualCapture, visualReleaseFile } from "../../game/shell/visualCapture";
import { drawnFrame } from "./drawnFrame";
import { type ShellState, localSlot } from "./state";
import { lockArenaCamera, pauseMatchPresentation, renderPersistentPresentation, renderUi } from "./view";

/** The FileIO result controls existing local visuals only, never the synchronized match. */
export function serviceVisualCapture(s: ShellState): void {
  const slot = localSlot();
  const state = visualCapture(slot);
  const held = state?.held;
  if (state === undefined || held === undefined) return;
  state.ticks++;
  if (s.game.phase !== Phase.match || state.ticks >= 600 || readChunk(visualReleaseFile(state.token, slot, held.frame)) === state.token) {
    releaseVisualFrame(slot);
    if (s.game.phase !== Phase.match) clearVisualCapture(slot);
    pauseMatchPresentation(s, s.session.paused);
  }
}

/** The per-frame observer can present a requested pose inside a multi-frame catch-up callback. */
export function holdPresentedCapture(s: ShellState): void {
  if (!s.build.responseProbe || s.game.phase !== Phase.match || heldVisualFrame(localSlot()) !== undefined) return;
  const { epoch, frame } = drawnFrame(s);
  if (holdVisualFrame(localSlot(), epoch, frame)) {
    renderPersistentPresentation(s);
    lockArenaCamera(s);
    renderUi(s);
    pauseMatchPresentation(s, true);
  }
}

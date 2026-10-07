// The frame this client has drawn, for host tools that act on what the player
// sees: `bun wisp pad` takes a script's `capture` once its client has drawn
// the capture's frame, not when the helper's clock reaches it; under load the
// drawn (predicted) match runs many frames behind that clock. Integrity builds
// only, local to this client, written only when the frame changes.
import { writeLine } from "wisp/src/platform/fileio";
import { Phase } from "../../game/match/rules";
import { drawnFrameFile, drawnFrameLine } from "../../runtime/gameFiles";
import { type ShellState, activeRollback, localSlot } from "./state";
import { heldVisualFrame } from "../../game/shell/visualCapture";

/** The last line written, per local slot: simulated clients can share this module. */
const written = new Map<number, string>();

/** The frame the match on screen shows: the predicted match's in a rollback match, else the match's own. */
export function drawnFrame(s: Readonly<ShellState>): { readonly epoch: number; readonly frame: number } {
  const held = heldVisualFrame(localSlot());
  if (held !== undefined) return held;
  const rollback = activeRollback(s);
  return rollback === undefined ? { epoch: 0, frame: s.runtime.simulationFrame } : { epoch: rollback.epoch, frame: rollback.speculative.runtime.simulationFrame };
}

/** After a callback drew the match: rewrites the file when its frame moved. */
export function writeDrawnFrame(s: Readonly<ShellState>): void {
  if (!s.build.responseProbe || s.game.phase !== Phase.match) return;
  const { epoch, frame } = drawnFrame(s);
  const slot = localSlot();
  const line = drawnFrameLine(s.build.id, epoch, frame);
  if (written.get(slot) === line) return;
  written.set(slot, line);
  writeLine(drawnFrameFile(s.build.id, slot), line);
}

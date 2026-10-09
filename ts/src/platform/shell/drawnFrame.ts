




import { writeLine } from "wisp/src/platform/fileio";
import { Phase } from "../../game/match/rules";
import { drawnFrameFile, drawnFrameLine } from "../../runtime/gameFiles";
import { type ShellState, activeRollback, localSlot } from "./state";
import { heldVisualFrame } from "../../game/shell/visualCapture";


const written = new Map<number, string>();


export function drawnFrame(s: Readonly<ShellState>): { readonly epoch: number; readonly frame: number } {
  const held = heldVisualFrame(localSlot());
  if (held !== undefined) return held;
  const rollback = activeRollback(s);
  return rollback === undefined ? { epoch: 0, frame: s.runtime.simulationFrame } : { epoch: rollback.epoch, frame: rollback.speculative.runtime.simulationFrame };
}


export function writeDrawnFrame(s: Readonly<ShellState>): void {
  if (!s.build.responseProbe || s.game.phase !== Phase.match) return;
  const { epoch, frame } = drawnFrame(s);
  const slot = localSlot();
  const line = drawnFrameLine(s.build.id, epoch, frame);
  if (written.get(slot) === line) return;
  written.set(slot, line);
  writeLine(drawnFrameFile(s.build.id, slot), line);
}

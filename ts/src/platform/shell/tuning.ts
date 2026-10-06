import { applyAuthoredTuning } from "../../game/sim/tuning";
import { shellState } from "./state";

/**
 * install() runs on the same synchronized frame on every client, so a reload
 * that changed authored tuning reaches every fighter at once: the confirmed
 * match's and, under rollback, the speculative match's and the history's,
 * which a correction replays from.
 */
export function installTuning(): void {
  const s = shellState();
  if (s === undefined) return;
  applyAuthoredTuning(s.world);
  const rollback = s.rollback;
  if (rollback === undefined) return;
  applyAuthoredTuning(rollback.speculative.world);
  applyAuthoredTuning(rollback.seed.world);
  rollback.playback.visitWorlds(applyAuthoredTuning);
}

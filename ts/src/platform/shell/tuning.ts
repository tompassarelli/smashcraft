import { applyAuthoredTuning } from "../../game/sim/tuning";
import { shellState } from "./state";







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

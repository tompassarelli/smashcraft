import { InputBatch } from "../netcode/inputBatch";
import type { ShadowInputSchedule } from "../netcode/shadowSchedule";


export function queueLocalRows(batch: InputBatch, schedule: ShadowInputSchedule, epoch: number, firstFrame: number): number | false {
  const before = batch.size();
  while (batch.size() < 2) {
    const frame = firstFrame + batch.size();
    const row = schedule.pending(epoch, frame);
    if (row === undefined) break;
    if (!batch.append(epoch, frame, row)) return false;
  }
  return batch.size() - before;
}

import type { BindingLoadResult } from "../../game/ui/bindingSettings";

interface PendingLoad {
  readonly owner: number;
  readonly complete: (this: void, result: BindingLoadResult) => void;
  received: string;
}

export interface PlayerFileQueue {
  /** Every client requests the same loads in the same order. */
  readonly queue: PendingLoad[];
  departedMask?: number;
}

type SendFile = (owner: number) => void;

export function enqueuePlayerFile(files: PlayerFileQueue, owner: number, complete: (result: BindingLoadResult) => void, send: SendFile): void {
  if (((files.departedMask ?? 0) & (1 << owner)) !== 0) {
    complete({ kind: "unavailable" });
    return;
  }
  files.queue.push({ owner, complete, received: "" });
  if (files.queue.length === 1) send(owner);
}

export function receivePlayerFileChunk(files: PlayerFileQueue, owner: number, text: string, last: boolean, send: SendFile): void {
  const pending = files.queue[0];
  if (pending === undefined || pending.owner !== owner) return;
  pending.received += text;
  if (!last) return;
  files.queue.shift();
  const next = files.queue[0];
  pending.complete(pending.received === "" ? { kind: "empty" } : { kind: "loaded", encoded: pending.received });
  // A callback may enqueue into an empty queue and start that new head itself.
  if (next !== undefined && files.queue[0] === next) send(next.owner);
}

export function departPlayerFiles(files: PlayerFileQueue, owner: number, send: SendFile): void {
  files.departedMask = (files.departedMask ?? 0) | (1 << owner);
  const previous = files.queue[0];
  const removed: PendingLoad[] = [];
  for (let index = 0; index < files.queue.length;) {
    const pending = files.queue[index];
    if (pending?.owner !== owner) {
      index++;
      continue;
    }
    removed.push(pending);
    files.queue.splice(index, 1);
  }
  const next = files.queue[0];
  // Remove every abandoned request before completion callbacks can enqueue.
  for (const pending of removed) pending.complete({ kind: "unavailable" });
  if (next !== undefined && next !== previous && files.queue[0] === next) send(next.owner);
}

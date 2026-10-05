// The headless capture's pad writes, in their own thread (headless.ts). An
// edge is stamped just before its uinput write; a pause between the two, as
// in the thread that runs the headless clients, lets the helper publish the
// stamped frame first and stop on the late edge. The main thread owns the
// pads; file descriptors are the process's, so this thread writes to them
// directly.
import { type Pad, inject } from "./linux";
import type { SourceEdge } from "./linuxInput";

declare const self: Worker;

self.onmessage = (event: MessageEvent<{ readonly pad: Pad; readonly edge: SourceEdge }>) => {
  try {
    self.postMessage({ injection: inject(event.data.pad, event.data.edge) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};

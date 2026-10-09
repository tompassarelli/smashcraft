





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

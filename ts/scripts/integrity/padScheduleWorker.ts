// `bun wisp pad --headless`: a pad script's edges written in their own
// thread, each a fifth into its frame on its helper's clock (padScript.ts,
// frameWriteNs), while the main thread runs the headless clients. A spin on
// the main thread would hold their frames back.
import { type Pad, inject, monotonicNs } from "./linux";
import type { SourceEdge } from "./linuxInput";
import { frameWriteNs } from "./padScript";

declare const self: Worker;

export interface ScheduledEdge {
  readonly slot: 0 | 1;
  readonly frame: number;
  readonly edge: SourceEdge;
  readonly line: number;
  readonly text: string;
}

export interface Schedule {
  readonly pads: readonly [Pad, Pad];
  readonly epochs: readonly [number, number];
  readonly edges: readonly ScheduledEdge[];
}

export type ScheduleReply =
  | { readonly kind: "sent"; readonly line: number; readonly text: string; readonly slot: 0 | 1; readonly planned: number; readonly injectedNs: number }
  | { readonly kind: "done" }
  | { readonly kind: "error"; readonly error: string };

self.onmessage = (event: MessageEvent<Schedule>) => {
  const { pads, epochs, edges } = event.data;
  try {
    for (const item of edges) {
      const target = frameWriteNs(epochs[item.slot], item.frame);
      const coarse = (target - monotonicNs()) / 1e6 - 5;
      if (coarse > 0) Bun.sleepSync(coarse);
      while (monotonicNs() < target) { /* spin the last 5 ms */ }
      const injection = inject(pads[item.slot], item.edge);
      self.postMessage({ kind: "sent", line: item.line, text: item.text, slot: item.slot, planned: item.frame, injectedNs: injection.injectedNs } satisfies ScheduleReply);
    }
    self.postMessage({ kind: "done" } satisfies ScheduleReply);
  } catch (error) {
    self.postMessage({ kind: "error", error: error instanceof Error ? error.message : String(error) } satisfies ScheduleReply);
  }
};

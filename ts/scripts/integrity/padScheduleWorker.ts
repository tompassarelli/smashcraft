



import { Effect, Queue, Schema } from "effect";
import { type Pad, inject, monotonicNs } from "./linux";
import type { SourceEdge } from "./linuxInput";
import { deadlineOrder, frameWriteNs } from "./padScript";

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

const PadSchema = Schema.Struct({ fd: Schema.Int, device: Schema.String });
const ScheduleSchema = Schema.Struct({
  pads: Schema.Tuple([PadSchema, PadSchema]),
  epochs: Schema.Tuple([Schema.Finite, Schema.Finite]),
  edges: Schema.Array(Schema.Struct({
    slot: Schema.Literals([0, 1]), frame: Schema.Int,
    edge: Schema.Struct({ type: Schema.Int, code: Schema.Int, value: Schema.Int }),
    line: Schema.Int, text: Schema.String,
  })),
});

const send = Effect.fn("sendPadSchedule")(function*(data: unknown) {
  const { pads, epochs, edges } = yield* Schema.decodeUnknownEffect(ScheduleSchema)(data);
  for (const item of deadlineOrder(edges, epochs)) {
    const target = frameWriteNs(epochs[item.slot], item.frame);
    const coarse = (target - monotonicNs()) / 1e6 - 5;
    if (coarse > 0) yield* Effect.sleep(coarse);
    yield* Effect.sync(() => {
      while (monotonicNs() < target) { }
      const injection = inject(pads[item.slot], item.edge);
      self.postMessage({ kind: "sent", line: item.line, text: item.text, slot: item.slot, planned: item.frame, injectedNs: injection.injectedNs } satisfies ScheduleReply);
    });
  }
  self.postMessage({ kind: "done" } satisfies ScheduleReply);
});

const schedules = Effect.runSync(Queue.unbounded<unknown>());
Effect.runFork(Effect.forever(Effect.gen(function*() {
  const data = yield* Queue.take(schedules);
  yield* send(data).pipe(Effect.catchCause((cause) => Effect.sync(() => {
    self.postMessage({ kind: "error", error: String(cause) } satisfies ScheduleReply);
  })));
})));
self.onmessage = (event: MessageEvent<unknown>) => {
  Queue.offerUnsafe(schedules, event.data);
};

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { expect, test } from "bun:test";
import {
  DevCommandReceipt,
  InputTrace,
  InputTraceStart,
  MeleeReady,
} from "../scripts/wisp/boundary";

const fixture = (name: string) => readFileSync(join(import.meta.dir, "fixtures/wisp", name), "utf8");

test("each game-written file kind decodes its native Preload fixture [native]", async () => {
  expect(await Effect.runPromise(MeleeReady.decode("ready.txt", fixture("melee-ready.pld"))))
    .toEqual({ build: "ts-shell-r1", input: "input-v4", presentation: "pose-v6", scenario: "default", bindings: "standard", humans: 2, fighters: 2, slotBindings: ["BINDINGS0 HUMAN", "BINDINGS1 HUMAN"] });
  expect(await Effect.runPromise(DevCommandReceipt.decode("dev.txt", fixture("dev-command-receipt.pld"))))
    .toEqual({
      build: "ts-shell-r1", receipt: 1, epoch: 0, rollback: 6, delay: 0, batch: 2, rematchSeconds: 5,
      phase: 0, humanFighters: 3, computers: 0, characters: "1,2,3,1", stocks: 1, minutes: 7, automaticRematch: 0, stage: 2,
    });
  expect(await Effect.runPromise(InputTraceStart.decode("trace-start.txt", fixture("input-trace-start.pld"))))
    .toEqual({ build: "ts-shell-r1" });
  expect(await Effect.runPromise(InputTrace.decode("trace.txt", fixture("input-trace.pld"))))
    .toEqual({ lines: ["confirmed frame 301 state 8821", "confirmed frame 302 state 8837"], dropped: 0, ticks: 300, seconds: 4.996 });
});

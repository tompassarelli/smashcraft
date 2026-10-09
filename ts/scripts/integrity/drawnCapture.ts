






import { existsSync, readFileSync } from "node:fs";
import { Effect } from "effect";
import { preloadLines } from "wisp/scripts/wisp/boundary";
import { IntegrityFailure } from "./evidence";
import type { PadStep } from "./padScript";

export const visualCaptureToken = (time = Date.now(), pid = process.pid): string => `${time.toString(36)}-${pid.toString(36)}`;


export function visualCaptureCommand(command: string, token: string, steps: readonly PadStep[]): string {
  const frames = [0, 1].map(slot => {
    const sorted = [...new Set(steps.filter(step => step.kind === "capture" && step.slot === slot).map(step => step.frame))].sort((a, b) => a - b);
    return sorted.map((frame, index) => frame - (sorted[index - 1] ?? 0)).join(",") || "-";
  });
  const text = `${command} |capture ${token} ${frames.join(" ")}`;
  if (text.length > 127) throw new Error("visual capture schedule exceeds Warcraft's 127-character chat command; split this visual fixture");
  return text;
}

export interface Drawn {
  readonly epoch: number;
  readonly frame: number;
}


export function parseDrawn(text: string): Drawn | undefined {
  for (const line of preloadLines(text) ?? []) {
    const match = /^SMASHCRAFT DRAWN v=1 build=\S+ epoch=(\d+) frame=(\d+)/.exec(line);
    if (match !== null) return { epoch: Number(match[1]), frame: Number(match[2]) };
  }
  return undefined;
}

export const drawnFrom = (path: string) => (): Drawn | undefined => {
  try {
    return existsSync(path) ? parseDrawn(readFileSync(path, "latin1")) : undefined;
  } catch {
    return undefined;
  }
};

export interface DrawnShot<A> {
  readonly shot: A;

  readonly before: number;
  readonly after: number;
  readonly waitedMs: number;
}


export const captureWhenDrawn = <A, E>(read: () => Drawn | undefined, epoch: number, frame: number, timeoutMs: number, shoot: Effect.Effect<A, E>, where: string) =>
  Effect.gen(function*() {
    const started = performance.now();
    for (;;) {
      const drawn = read();
      if (drawn !== undefined && drawn.epoch === epoch && drawn.frame >= frame) {
        if (drawn.frame !== frame) return yield* new IntegrityFailure({ operation: `capture frame ${frame}`, path: where, cause: `INVALID: request boundary missed match ${epoch} frame ${frame}; observed frame ${drawn.frame}` });
        const waitedMs = performance.now() - started;
        const shot = yield* shoot;
        const after = read();
        if (after === undefined || after.epoch !== epoch || after.frame !== frame) {
          const seen = after === undefined ? "no drawn-frame receipt" : `match ${after.epoch} frame ${after.frame}`;
          return yield* new IntegrityFailure({ operation: `capture frame ${frame}`, path: where, cause: `INVALID: completion boundary expected match ${epoch} frame ${frame}; observed ${seen}` });
        }
        return { shot, before: drawn.frame, after: after.frame, waitedMs } satisfies DrawnShot<A>;
      }
      if (performance.now() - started > timeoutMs) {
        const seen = drawn === undefined ? "no drawn frame" : `epoch ${drawn.epoch} frame ${drawn.frame}`;
        return yield* new IntegrityFailure({ operation: `capture frame ${frame}`, path: where, cause: `INVALID: drawn-clock boundary: the client hadn't drawn match ${epoch} frame ${frame} within ${timeoutMs} ms (${seen})` });
      }
      yield* Effect.sleep("2 millis");
    }
  });

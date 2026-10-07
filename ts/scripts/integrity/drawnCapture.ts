// A pad script's `capture` on the frame it names. The helper's clock gives
// each edge its frame, but under load a client draws its (predicted) match
// many frames behind that clock: on 7 Oct, #156's captures taken on the clock
// showed client A 6 to 88 frames before the move. The integrity build writes
// the frame it drew (smashcraft:ts/src/platform/shell/drawnFrame.ts); a
// capture waits until that file names the capture's frame, then takes the
// screen and records the frames drawn just before and after it.
import { existsSync, readFileSync } from "node:fs";
import { Effect } from "effect";
import { preloadLines } from "wisp/scripts/wisp/boundary";
import { IntegrityFailure } from "./evidence";

export interface Drawn {
  readonly epoch: number;
  readonly frame: number;
}

/** The drawn-frame file's epoch and frame; undefined while missing, partly written or another build's. */
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
  /** The frame the client had drawn when the capture began, and when it ended. */
  readonly before: number;
  readonly after: number;
  readonly waitedMs: number;
}

/** Both receipts must identify the requested frame; a later frame or absent completion is invalid. */
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

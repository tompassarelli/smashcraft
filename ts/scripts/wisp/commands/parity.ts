// `wisp parity`: numeric Lua parity and issue #26 native capture/result, or
// its capture and result through the real helper into headless clients.
// Capture and reconciliation call the harness APIs directly so they remain
// part of Wisp's traced Effect program.
import { Effect, Schema } from "effect";
import { runNumericParity } from "../../numericParity";
import { luaRuntimes } from "../luaRuntimes";
import { tsDirectory } from "../project";
import { onHealthyClients } from "../doctor";
import { captureMatches, parseCaptureArguments } from "../../integrity/capture";
import { IntegrityFailure, reconcileCapture, tryIntegrityPromise } from "../../integrity/evidence";
import { captureHeadless, parseHeadlessArguments } from "../../integrity/headless";
import { captureScreen, screenCaptureArguments } from "../../integrity/screenCapture";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { step } from "wisp/scripts/wisp/timings";

import { tapes } from "./tapes";
import { reconcileFourFighters } from "../../fourFighters";
import { reconcilePlayable } from "../../playable";
import { join } from "node:path";
const Session = Schema.Struct({ four_fighters: Schema.optionalKey(Schema.Boolean), playable: Schema.optionalKey(Schema.Boolean) });
const sessionResult = (directory: string) => Effect.gen(function*() {
  const path = join(directory, "capture.json");
  const raw = yield* tryIntegrityPromise("read capture kind", path, () => Bun.file(path).json());
  const kind = yield* Schema.decodeUnknownEffect(Session)(raw).pipe(Effect.mapError(cause => new IntegrityFailure({ operation: "read capture kind", path, cause: String(cause) })));
  return yield* (kind.playable ? reconcilePlayable(directory) : kind.four_fighters ? reconcileFourFighters(directory) : reconcileCapture(directory));
});

const reconciled = (directory: string) =>
  sessionResult(directory).pipe(
    Effect.flatMap((passed) => passed
      ? Effect.void
      : Effect.fail(new IntegrityFailure({ operation: "reconcile input integrity", path: directory, cause: "the integrity table contains a failed gate" }))),
  );

export const parity: Command = ([mode, ...args]) => {
  switch (mode) {
    case "numeric": {
      // Supplied native results need no Lua; otherwise the corpus runs in a stock and a toward-zero Lua32.
      const luas: Effect.Effect<readonly (readonly [string, string])[], string> = args.length > 0
        ? Effect.succeed([])
        : luaRuntimes(tsDirectory).pipe(Effect.map(({ nearest, towardZero }) => [["stock Lua32", nearest], ["toward-zero Lua32", towardZero]]));
      return luas.pipe(
        Effect.mapError((cause) => new IntegrityFailure({ operation: "find the 32-bit Luas", path: "LUA, TOWARD_ZERO_LUA", cause })),
        Effect.flatMap((runtimes) => Effect.tryPromise({
          try: () => runNumericParity(args, runtimes),
          catch: (cause) => new IntegrityFailure({ operation: "run numeric parity", path: "TypeScriptToLua/Lua", cause: describeCause(cause) }),
        })),
        Effect.flatMap((passed) => passed
          ? Effect.void
          : Effect.fail(new IntegrityFailure({ operation: "run numeric parity", path: "TypeScriptToLua/Lua", cause: "the numeric corpus was empty or had mismatches" }))),
        step("numeric Lua parity"),
      );
    }
    case "tapes": return tapes(args);
    default: return Effect.fail(new UsageFailure({ problem: "parity takes numeric or tapes" }));
  }
};

export const integrity: Command = ([mode, ...args]) => {
  switch (mode) {
    case "capture":
      if (args.includes("--screen")) return Effect.try({
        try: () => screenCaptureArguments(args),
        catch: cause => new IntegrityFailure({ operation: "parse screen capture arguments", path: "wisp integrity capture --screen", cause }),
      }).pipe(Effect.flatMap(captureScreen), step("native screen acquisition sample"));
      return Effect.try({
        try: () => parseCaptureArguments(args),
        catch: (cause) => new IntegrityFailure({ operation: "parse capture arguments", path: "wisp integrity capture", cause: describeCause(cause) }),
      }).pipe(
        // Doctor heals the clients before a capture (bot sessions included) and once after a
        // failure; a capture writes its own folder, so its failure stands (wisp:docs/doctor.md).
        Effect.flatMap((options) => onHealthyClients(captureMatches(options), { retry: false, ...(options.clients === undefined ? {} : { clientsFile: options.clients }) })),
        step("native input-integrity capture"),
      );
    case "result": {
      const [directory, ...rest] = args;
      if (directory === undefined || rest.length > 0) return Effect.fail(new UsageFailure({ problem: "integrity result takes one capture directory" }));
      return reconciled(directory).pipe(step("native input-integrity result"));
    }
    case "headless":
      return Effect.try({
        try: () => parseHeadlessArguments(args),
        catch: (cause) => new IntegrityFailure({ operation: "parse headless arguments", path: "wisp integrity headless", cause: describeCause(cause) }),
      }).pipe(
        Effect.flatMap((options) => captureHeadless(options).pipe(
          step("headless input-integrity capture"),
          Effect.andThen(reconciled(options.out).pipe(step("headless input-integrity result"))),
        )),
      );
    default:
      return Effect.fail(new UsageFailure({ problem: "integrity takes capture, result or headless" }));
  }
};

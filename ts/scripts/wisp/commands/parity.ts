// `wisp parity`: numeric Lua parity and issue #26 native capture/result, or
// its capture and result through the real helper into headless clients.
// Capture and reconciliation call the harness APIs directly so they remain
// part of Wisp's traced Effect program.
import { Effect } from "effect";
import { runNumericParity } from "../../numericParity";
import { luaRuntimes } from "../luaRuntimes";
import { tsDirectory } from "../project";
import { captureMatches, parseCaptureArguments } from "../../integrity/capture";
import { IntegrityFailure, reconcileCapture } from "../../integrity/evidence";
import { captureHeadless, parseHeadlessArguments } from "../../integrity/headless";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { step } from "wisp/scripts/wisp/timings";

const usage = "parity numeric [RESULT_FILE ...] | parity capture CAPTURE_OPTIONS | parity result CAPTURE_DIR | parity headless --helper BINARY --out DIR";

const reconciled = (directory: string) =>
  reconcileCapture(directory).pipe(
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
    case "capture":
      return Effect.try({
        try: () => parseCaptureArguments(args),
        catch: (cause) => new IntegrityFailure({ operation: "parse capture arguments", path: "wisp parity capture", cause: describeCause(cause) }),
      }).pipe(
        Effect.flatMap(captureMatches),
        step("native input-integrity capture"),
      );
    case "result": {
      const [directory, ...rest] = args;
      if (directory === undefined || rest.length > 0) return Effect.fail(new UsageFailure({ problem: "parity result takes one capture directory" }));
      return reconciled(directory).pipe(step("native input-integrity result"));
    }
    case "headless":
      return Effect.try({
        try: () => parseHeadlessArguments(args),
        catch: (cause) => new IntegrityFailure({ operation: "parse headless arguments", path: "wisp parity headless", cause: describeCause(cause) }),
      }).pipe(
        Effect.flatMap((options) => captureHeadless(options).pipe(
          step("headless input-integrity capture"),
          Effect.andThen(reconciled(options.out).pipe(step("headless input-integrity result"))),
        )),
      );
    default:
      return Effect.fail(new UsageFailure({ problem: `parity requires numeric, capture or result; usage: wisp ${usage}` }));
  }
};

/** The input-integrity spelling remains convenient while all execution shares the Wisp entrypoint. */
export const integrity: Command = ([mode, ...args]) => parity([mode === "capture" || mode === "result" || mode === "headless" ? mode : "", ...args]);

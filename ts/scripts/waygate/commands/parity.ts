// `waygate parity`: numeric Lua parity and issue #26 native capture/result.
// Capture and reconciliation call the harness APIs directly so they remain
// part of Waygate's traced Effect program.
import { Effect } from "effect";
import { runNumericParity } from "../../numericParity";
import { captureMatches, parseCaptureArguments } from "../../integrity/capture";
import { IntegrityFailure, reconcileCapture } from "../../integrity/evidence";
import { type Command, UsageFailure, describeCause } from "waygate/scripts/waygate/command";
import { step } from "waygate/scripts/waygate/timings";

const usage = "parity numeric [RESULT_FILE ...] | parity capture CAPTURE_OPTIONS | parity result CAPTURE_DIR";

export const parity: Command = ([mode, ...args]) => {
  switch (mode) {
    case "numeric":
      return Effect.tryPromise({
        try: () => runNumericParity(args),
        catch: (cause) => new IntegrityFailure({ operation: "run numeric parity", path: "TypeScriptToLua/Lua", cause: describeCause(cause) }),
      }).pipe(
        Effect.flatMap((passed) => passed
          ? Effect.void
          : Effect.fail(new IntegrityFailure({ operation: "run numeric parity", path: "TypeScriptToLua/Lua", cause: "the numeric corpus was empty or had mismatches" }))),
        step("numeric Lua parity"),
      );
    case "capture":
      return Effect.try({
        try: () => parseCaptureArguments(args),
        catch: (cause) => new IntegrityFailure({ operation: "parse capture arguments", path: "waygate parity capture", cause: describeCause(cause) }),
      }).pipe(
        Effect.flatMap(captureMatches),
        step("native input-integrity capture"),
      );
    case "result": {
      const [directory, ...rest] = args;
      if (directory === undefined || rest.length > 0) return Effect.fail(new UsageFailure({ problem: "parity result takes one capture directory" }));
      return reconcileCapture(directory).pipe(
        Effect.flatMap((passed) => passed
          ? Effect.void
          : Effect.fail(new IntegrityFailure({ operation: "reconcile input integrity", path: directory, cause: "the integrity table contains a failed gate" }))),
        step("native input-integrity result"),
      );
    }
    default:
      return Effect.fail(new UsageFailure({ problem: `parity requires numeric, capture or result; usage: waygate ${usage}` }));
  }
};

/** The input-integrity spelling remains convenient while all execution shares the Waygate entrypoint. */
export const integrity: Command = ([mode, ...args]) => parity([mode === "capture" || mode === "result" ? mode : "", ...args]);

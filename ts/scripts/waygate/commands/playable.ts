import { Effect } from "effect";
import { type Command, UsageFailure, describeCause } from "waygate/scripts/waygate/command";
import { step } from "waygate/scripts/waygate/timings";
import { captureMatches, parseCaptureArguments } from "../../integrity";
import { IntegrityFailure } from "../../integrity/evidence";
import { reconcilePlayable } from "../../playable";

/** A playable candidate's native one-stock match and rematch, using the existing capture services. */
export const playable: Command = ([mode, ...args]) => {
  if (mode === "capture") return Effect.try({
    try: () => {
      const options = parseCaptureArguments(args);
      if (options.sweep.length > 0 || options.fourFighters) throw new Error("playable capture takes one two-player match and rematch");
      return { ...options, workload: "playable" as const };
    },
    catch: (cause) => new IntegrityFailure({ operation: "parse playable arguments", path: "waygate playable capture", cause: describeCause(cause) }),
  }).pipe(Effect.flatMap(captureMatches), step("native playable match and rematch"));
  if (mode === "result" && args.length === 1 && args[0] !== undefined) {
    const root = args[0];
    return reconcilePlayable(root).pipe(
      Effect.flatMap((passed) => passed ? Effect.void : Effect.fail(new IntegrityFailure({ operation: "reconcile playable", path: root, cause: "the match/rematch gate failed" }))),
      step("native playable result"),
    );
  }
  return Effect.fail(new UsageFailure({ problem: "playable requires capture CAPTURE_OPTIONS or result CAPTURE_DIR" }));
};

import { Effect } from "effect";
import { type Command, UsageFailure, describeCause } from "waygate/scripts/waygate/command";
import { step } from "waygate/scripts/waygate/timings";
import { captureMatches, parseCaptureArguments } from "../../integrity";
import { IntegrityFailure } from "../../integrity/evidence";
import { reconcileFourFighters } from "../../fourFighters";

/** #17's bounded native four-fighter journey, using the existing capture services. */
export const fourFighters: Command = ([mode, ...args]) => {
  if (mode === "capture") return Effect.try({
    try: () => {
      const options = parseCaptureArguments([...args, "--four-fighters"]);
      if (options.sweep.length > 0) throw new Error("four-fighters capture takes one match/rematch pair");
      return { ...options, workload: "match" as const };
    },
    catch: (cause) => new IntegrityFailure({ operation: "parse four-fighter arguments", path: "waygate four-fighters capture", cause: describeCause(cause) }),
  }).pipe(Effect.flatMap(captureMatches), step("native four-fighter match and rematch"));
  if (mode === "result" && args.length === 1 && args[0] !== undefined) {
    const root = args[0];
    return reconcileFourFighters(root).pipe(
      Effect.flatMap((passed) => passed ? Effect.void : Effect.fail(new IntegrityFailure({ operation: "reconcile four fighters", path: root, cause: "the match/rematch gate failed" }))),
      step("native four-fighter result"),
    );
  }
  return Effect.fail(new UsageFailure({ problem: "four-fighters requires capture CAPTURE_OPTIONS or result CAPTURE_DIR" }));
};

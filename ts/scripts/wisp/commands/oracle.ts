// `wisp oracle`: plays the Melee behaviour oracle's scenarios for every
// fighter (smashcraft:ts/scripts/meleeOracle.ts) and prints each outcome
// beside the value cited from the decompilation. Fails on a mismatch that
// isn't known, or a known one that now passes.
import { Console, Effect, Schema } from "effect";
import { type Command, UsageFailure } from "wisp/scripts/wisp/command";
import { step } from "wisp/scripts/wisp/timings";
import { formatOracle, oracleProblems, runOracle } from "../../meleeOracle";

class OracleFailure extends Schema.TaggedError<OracleFailure>()("OracleFailure", { problems: Schema.Array(Schema.String) }) {
  override get message(): string {
    return this.problems.join("\n");
  }
}

export const oracle: Command = (args) => {
  if (args.length > 0) return Effect.fail(new UsageFailure({ problem: "oracle takes no arguments" }));
  return Effect.sync(runOracle).pipe(
    step("Melee oracle scenarios"),
    Effect.tap((rows) => Console.log(formatOracle(rows))),
    Effect.flatMap((rows) => {
      const problems = oracleProblems(rows);
      return problems.length === 0 ? Effect.void : Effect.fail(new OracleFailure({ problems }));
    }),
  );
};

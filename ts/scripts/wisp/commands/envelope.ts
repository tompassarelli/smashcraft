import { parseArgs } from "node:util";
import { Console, Effect, Schema } from "effect";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { FIELDS, type Outlier, outliers } from "../../genreEnvelope";
import { genreReference, rosterRows } from "../../genreEnvelopeData";

class EnvelopeFailure extends Schema.TaggedError<EnvelopeFailure>()("EnvelopeFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

const describe = (outlier: Outlier): string =>
  `${outlier.distance.toFixed(2)}  ${outlier.fighter} ${outlier.move} (${outlier.moveClass}${outlier.tier === "normal" ? "" : `, ${outlier.tier}`}): ${outlier.misses.map((miss) =>
    `${miss.field} ${Number.isFinite(miss.value) ? miss.value : "no KO"} vs ${miss.range.low}..${miss.range.high} ±${Math.round(miss.allowance)}`).join("; ")}`;

export const envelope: Command = (args) => Effect.gen(function*() {
  const { values } = yield* Effect.try({
    try: () => parseArgs({ args: [...args], options: { ranges: { type: "boolean" }, json: { type: "boolean" }, top: { type: "string" } }, strict: true }),
    catch: (cause) => new UsageFailure({ problem: describeCause(cause) }),
  });
  const reference = yield* Effect.try({ try: genreReference, catch: (cause) => new EnvelopeFailure({ problem: describeCause(cause) }) });
  if (values.ranges === true) {
    for (const [moveClass, fields] of Object.entries(reference.envelope)) {
      yield* Console.log(`${moveClass}: ${FIELDS.flatMap((field) => { const range = fields[field]; return range === undefined ? [] : [`${field} ${range.low}..${range.high}`]; }).join(", ")}`);
    }
    yield* Console.log(`sources: ${Object.values(reference.sources).map((source) => `${source.game} <${source.url}>`).join("; ")}`);
    return;
  }
  const rows = yield* Effect.try({ try: rosterRows, catch: (cause) => new EnvelopeFailure({ problem: describeCause(cause) }) });
  const found = outliers(rows, reference.envelope, reference.tolerances);
  if (values.json === true) {
    yield* Console.log(JSON.stringify({ moves: rows.length, outliers: found }));
    return;
  }
  const top = values.top === undefined ? found.length : Number(values.top);
  const t = reference.tolerances;
  yield* Console.log(`Genre envelope (advisory): ${found.length} of ${rows.length} moves outside their class envelope. Tolerance ±${t.frames} frames, ±${t.shieldAdvantage} on shield, ±${Math.round(100 * t.killPercentShare)}% kill percent; specials ±${t.special.frames}/±${t.special.shieldAdvantage}/±${Math.round(100 * t.special.killPercentShare)}%, EX ±${t.ex.frames}/±${t.ex.shieldAdvantage}/±${Math.round(100 * t.ex.killPercentShare)}%. Distance is the excess over the allowance; above 1 is outside.`);
  for (const outlier of found.slice(0, top)) yield* Console.log(describe(outlier));
});

// Smashcraft's selection, developer-command and input-trace records.
import { Schema } from "effect";
import { preloadRecord, Count, Seconds } from "waygate/scripts/waygate/boundary";

/** wc3-melee-ready.txt: the build and match setup when the local player reaches character selection. */
export const MeleeReady = preloadRecord(
  {
    head: ["BUILD {build}", "INPUT {input} PRESENTATION {presentation}", "SCENARIO {scenario}", "BINDINGS {bindings}", "HUMANS {humans} FIGHTERS {fighters}"],
    rest: "slotBindings",
  },
  Schema.Struct({
    build: Schema.NonEmptyString,
    input: Schema.NonEmptyString,
    presentation: Schema.NonEmptyString,
    scenario: Schema.NonEmptyString,
    bindings: Schema.NonEmptyString,
    humans: Count,
    fighters: Count,
    /** `BINDINGSn KEYS` or `BINDINGSn BOT` for each active slot n. */
    slotBindings: Schema.Array(Schema.String.check(Schema.isPattern(/^BINDINGS\d+ \S+$/))),
  }),
);

/** smashcraft-dev-BUILD-pN.txt: confirmation a client handled a developer chat command. */
export const DevCommandReceipt = preloadRecord(
  { head: ["SMASHCRAFT DEV v=1 build={build} receipt={receipt} epoch={epoch} rb={rollback} delay={delay} batch={batch} "] },
  Schema.Struct({
    build: Schema.NonEmptyString,
    receipt: Count.check(Schema.isGreaterThanOrEqualTo(1)),
    epoch: Count,
    rollback: Count.check(Schema.isGreaterThanOrEqualTo(1)),
    delay: Count,
    batch: Count.check(Schema.isGreaterThanOrEqualTo(1)).check(Schema.isLessThanOrEqualTo(2)),
  }),
);

/** wc3-melee-input-start.txt: the developer input trace started. */
export const InputTraceStart = preloadRecord(
  { head: ["TRACE START {build}"] },
  Schema.Struct({ build: Schema.NonEmptyString }),
);

/**
 * wc3-melee-input-trace.txt: the developer input trace. Its lines stay text
 * for the tools that read particular ones; the summary is decoded.
 */
export const InputTrace = preloadRecord(
  { rest: "lines", tail: ["dropped {dropped}", "{ticks} {seconds} end"] },
  Schema.Struct({ lines: Schema.Array(Schema.String), dropped: Count, ticks: Count, seconds: Seconds }),
);

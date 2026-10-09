



import { join } from "node:path";
import { parseArgs } from "node:util";
import { Effect, Schema } from "effect";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { makeSoak } from "wisp/scripts/wisp/commands/soak";
import { step } from "wisp/scripts/wisp/timings";
import { SOAK_OUT } from "../soak";
import { soakMemory } from "./soakMemory";

class HelperSoakFailure extends Schema.TaggedError<HelperSoakFailure>()("HelperSoakFailure", {
  problem: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {
  override get message(): string {
    return this.cause === undefined ? this.problem : `${this.problem}: ${describeCause(this.cause)}`;
  }
}


const MAX_HELPER_MATCHES = 20;
const MAX_HELPER_SECONDS = 90;

const headless = makeSoak({ project: join(import.meta.dir, "../soak.ts"), out: SOAK_OUT });


const throughHelper: Command = (args) => Effect.gen(function*() {
  const parsed = yield* Effect.try({
    try: () => parseArgs({ args: [...args], options: { helper: { type: "string" }, matches: { type: "string" }, seconds: { type: "string" }, seed: { type: "string" }, out: { type: "string" } }, strict: true }).values,
    catch: (cause) => new UsageFailure({ problem: describeCause(cause) }),
  });
  const whole = (text: string | undefined, fallback: number, high: number) => {
    const value = text === undefined ? fallback : Number(text);
    return Number.isInteger(value) && value >= 1 && value <= high ? value : undefined;
  };
  const matches = whole(parsed.matches, 4, MAX_HELPER_MATCHES);
  const seconds = whole(parsed.seconds, 30, MAX_HELPER_SECONDS);
  const seed = whole(parsed.seed, 1, 2147483646);
  if (parsed.helper === undefined || matches === undefined || seconds === undefined || seed === undefined) {
    return yield* new UsageFailure({ problem: `--helper takes the wc3-journal binary, at most ${MAX_HELPER_MATCHES} matches and ${MAX_HELPER_SECONDS} seconds a match` });
  }
  const out = parsed.out ?? join(SOAK_OUT, `helper-${new Date().toISOString().replaceAll(":", "-").replace(/\.\d+Z$/, "")}`);

  const module: unknown = yield* Effect.tryPromise({
    try: () => import(join(import.meta.dir, "../../../test/soak/helper.ts")),
    catch: (cause) => new HelperSoakFailure({ problem: "loading the helper soak", cause }),
  });
  const run = typeof module === "object" && module !== null && "default" in module ? module.default : undefined;
  if (typeof run !== "function") return yield* new HelperSoakFailure({ problem: "test/soak/helper.ts exports no soak" });
  const found: unknown = yield* Effect.flatten(Effect.try({
    try: (): Effect.Effect<unknown, unknown> => run({ helper: parsed.helper, out, matches, seconds, seed }),
    catch: (cause) => new HelperSoakFailure({ problem: "starting the helper soak", cause }),
  })).pipe(Effect.mapError((cause) => new HelperSoakFailure({ problem: "soak through the helpers", cause })), step(`${matches} matches through the helpers`));
  if (found !== 0) return yield* new HelperSoakFailure({ problem: `${String(found)} matches found something; their folders are in ${out}` });
});

export const soak: Command = (args) => (args[0] === "memory" ? soakMemory(args.slice(1)) : args.includes("--helper") ? throughHelper(args) : headless(args));

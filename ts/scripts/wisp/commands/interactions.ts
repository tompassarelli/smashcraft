// `wisp interactions`: plays every situation of the interaction graph for each
// fighter (smashcraft:ts/scripts/interactions.ts, one worker thread a fighter)
// and writes its rows and pages to smashcraft:tools/move-data/interactions/.
// `--check` compares a fresh graph with those files and lists what changed;
// `--move FIGHTER:MOVE` prints one move's place in its fighter's fresh graph
// and what changed there since the files were written.
import { join } from "node:path";
import { Console, Effect, Schema } from "effect";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { step } from "wisp/scripts/wisp/timings";
import { FIGHTERS, type Row, fighterNamed, fighterPage, moveProfile, parseRows, rowChanges } from "../../interactions";

const directory = join(import.meta.dir, "../../../../tools/move-data/interactions");
const rowsFile = join(directory, "interactions.jsonl");
const pageFile = (slug: string): string => join(directory, `${slug}.md`);

class InteractionsFailure extends Schema.TaggedError<InteractionsFailure>()("InteractionsFailure", { problems: Schema.Array(Schema.String) }) {
  override get message(): string {
    return this.problems.join("\n");
  }
}

const failure = (cause: unknown): InteractionsFailure => new InteractionsFailure({ problems: [describeCause(cause)] });

/** Each named fighter's rows, every fighter on its own worker thread. */
const playFighters = (names: readonly string[]): Effect.Effect<Row[][], InteractionsFailure> =>
  Effect.tryPromise({
    try: () => Promise.all(names.map((name) => new Promise<Row[]>((resolve, reject) => {
      const worker = new Worker(new URL("../../interactionsWorker.ts", import.meta.url).href);
      worker.onmessage = (event: MessageEvent<Row[]>) => {
        resolve(event.data);
        worker.terminate();
      };
      worker.onerror = (event) => {
        reject(new Error(`${name}: ${event.message}`));
        worker.terminate();
      };
      worker.postMessage(name);
    }))),
    catch: failure,
  });

const jsonl = (rows: readonly Row[]): string => rows.map((row) => JSON.stringify(row)).join("\n") + "\n";

const committedRows = Effect.tryPromise({ try: async () => parseRows(await Bun.file(rowsFile).text()), catch: failure });

const write = (rows: readonly Row[][]) =>
  Effect.tryPromise({
    try: async () => {
      await Bun.write(rowsFile, jsonl(rows.flat()));
      for (const [index, entry] of FIGHTERS.entries()) await Bun.write(pageFile(entry.slug), fighterPage(entry, rows[index] ?? []) + "\n");
    },
    catch: failure,
  });

const check = (rows: readonly Row[][]) =>
  Effect.gen(function* () {
    const changes = rowChanges(yield* committedRows, rows.flat());
    const stalePages = yield* Effect.tryPromise({
      try: async () => {
        const stale: string[] = [];
        for (const [index, entry] of FIGHTERS.entries()) {
          if ((await Bun.file(pageFile(entry.slug)).text()) !== fighterPage(entry, rows[index] ?? []) + "\n") stale.push(`page ${entry.slug}.md differs from its rows`);
        }
        return stale;
      },
      catch: failure,
    });
    const problems = [...changes, ...stalePages];
    if (problems.length > 0) return yield* Effect.fail(new InteractionsFailure({ problems: [...problems, `${problems.length} differences from ${rowsFile}; inspect them, then run bun wisp interactions to write the new graph`] }));
    yield* Console.log(`The fresh graph matches ${rowsFile} and its pages`);
  });

const profile = (spec: string) =>
  Effect.gen(function* () {
    const [name = "", move = ""] = spec.split(":");
    const entry = fighterNamed(name);
    if (entry === undefined || move === "") return yield* Effect.fail(new UsageFailure({ problem: `--move takes FIGHTER:MOVE, a fighter of ${FIGHTERS.map((fighter) => fighter.slug).join(", ")}` }));
    const moveName = move.replaceAll("-", " ");
    const [rows = []] = yield* playFighters([entry.name]).pipe(step(`${entry.name}'s situations`));
    const lines = moveProfile(rows, moveName);
    yield* Console.log(lines.length === 0 ? `${moveName} takes part in none of ${entry.name}'s situations` : [`${entry.name} ${moveName}:`, ...lines.map((line) => `  ${line}`)].join("\n"));
    const committed = (yield* committedRows).filter((row) => row.fighter === entry.name);
    const changes = rowChanges(committed, rows);
    yield* Console.log(changes.length === 0 ? `${entry.name}'s graph is unchanged from ${rowsFile}` : [`Changes in ${entry.name}'s graph from ${rowsFile}:`, ...changes.map((line) => `  ${line}`)].join("\n"));
  });

export const interactions: Command = (args) => {
  if (args.length === 2 && args[0] === "--move") return profile(args[1] ?? "");
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) return Effect.fail(new UsageFailure({ problem: "interactions takes --check or --move FIGHTER:MOVE" }));
  return playFighters(FIGHTERS.map((entry) => entry.name)).pipe(
    step("every fighter's situations"),
    Effect.flatMap((rows) => (args[0] === "--check" ? check(rows) : write(rows).pipe(Effect.tap(() => Console.log(`Wrote ${rowsFile} and ${FIGHTERS.length} pages`))))),
  );
};

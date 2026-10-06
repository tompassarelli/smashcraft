// `wisp interactions`: plays every situation of the interaction graph for each
// fighter (smashcraft:ts/scripts/interactions.ts, one worker thread a fighter)
// and writes its rows and pages to smashcraft:tools/move-data/interactions/,
// which Git ignores: each checkout derives its own graph, so lanes that change
// moves in parallel never merge, or land, a graph played from another tree.
// Every selectable fighter's throw roles (smashcraft:ts/scripts/throwRoles.ts)
// go to throws.jsonl and throws.md beside them.
// `--check` compares a fresh graph with the files this checkout last wrote and
// lists what changed; `--move FIGHTER:MOVE` prints one move's place in its
// fighter's fresh graph and what changed there since the files were written.
import { join } from "node:path";
import { Console, Effect, Schema } from "effect";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { step } from "wisp/scripts/wisp/timings";
import { FIGHTERS, type Row, fighterNamed, fighterPage, moveProfile, parseRows, rowChanges } from "../../interactions";
import { type ComboRow, comboPage } from "../../comboTrees";
import { THROW_FIGHTERS, type ThrowRoleRow, throwRolePage } from "../../throwRoles";

const directory = join(import.meta.dir, "../../../../tools/move-data/interactions");
const rowsFile = join(directory, "interactions.jsonl");
const pageFile = (slug: string): string => join(directory, `${slug}.md`);
const combosFile = join(directory, "combos.jsonl");
const comboPageFile = (slug: string): string => join(directory, `combos-${slug}.md`);
const throwsFile = join(directory, "throws.jsonl");
const throwsPage = join(directory, "throws.md");
/** Throw-role workers at once: each fighter's rows take about a minute. */
const THROW_WORKERS = 3;

interface FighterRows {
  readonly interactions: readonly Row[];
  readonly combos: readonly ComboRow[];
}

class InteractionsFailure extends Schema.TaggedError<InteractionsFailure>()("InteractionsFailure", { problems: Schema.Array(Schema.String) }) {
  override get message(): string {
    return this.problems.join("\n");
  }
}

const failure = (cause: unknown): InteractionsFailure => new InteractionsFailure({ problems: [describeCause(cause)] });

/** Each named fighter's rows, every fighter on its own worker thread. */
const playFighters = (names: readonly string[], combos = true): Effect.Effect<FighterRows[], InteractionsFailure> =>
  Effect.tryPromise({
    try: () => Promise.all(names.map((name) => new Promise<FighterRows>((resolve, reject) => {
      const worker = new Worker(new URL("../../interactionsWorker.ts", import.meta.url).href);
      worker.onmessage = (event: MessageEvent<FighterRows>) => {
        resolve(event.data);
        worker.terminate();
      };
      worker.onerror = (event) => {
        reject(new Error(`${name}: ${event.message}`));
        worker.terminate();
      };
      worker.postMessage({ fighter: name, combos });
    }))),
    catch: failure,
  });

/** Every selectable fighter's throw-role rows, THROW_WORKERS fighters at a time, in roster order. */
const playThrowRoles: Effect.Effect<ThrowRoleRow[], InteractionsFailure> = Effect.tryPromise({
  try: async () => {
    const results: ThrowRoleRow[][] = [];
    let next = 0;
    const runner = async () => {
      while (next < THROW_FIGHTERS.length) {
        const index = next++;
        const entry = THROW_FIGHTERS[index];
        if (entry === undefined) return;
        results[index] = await new Promise<ThrowRoleRow[]>((resolve, reject) => {
          const worker = new Worker(new URL("../../interactionsWorker.ts", import.meta.url).href);
          worker.onmessage = (event: MessageEvent<ThrowRoleRow[]>) => {
            resolve(event.data);
            worker.terminate();
          };
          worker.onerror = (event) => {
            reject(new Error(`${entry.name} throw roles: ${event.message}`));
            worker.terminate();
          };
          worker.postMessage({ throwRoles: entry.name });
        });
      }
    };
    await Promise.all(Array.from({ length: THROW_WORKERS }, runner));
    return results.flat();
  },
  catch: failure,
});

const jsonl = (rows: readonly (Row | ComboRow | ThrowRoleRow)[]): string => rows.map((row) => JSON.stringify(row)).join("\n") + "\n";

const notWritten = `no graph is written in ${directory}: run bun wisp interactions first (before a change, to see what it moves)`;

const writtenRows = Effect.tryPromise({
  try: async () => {
    if (!(await Bun.file(rowsFile).exists())) throw new Error(notWritten);
    return parseRows(await Bun.file(rowsFile).text());
  },
  catch: failure,
});

const graphWritten = Effect.promise(() => Bun.file(rowsFile).exists());

/** A written file's text, or undefined when this checkout hasn't written it. */
const writtenText = async (file: string): Promise<string | undefined> => ((await Bun.file(file).exists()) ? Bun.file(file).text() : undefined);

const write = (rows: readonly FighterRows[], throws: readonly ThrowRoleRow[]) =>
  Effect.tryPromise({
    try: async () => {
      await Bun.write(throwsFile, jsonl(throws));
      await Bun.write(throwsPage, throwRolePage(throws) + "\n");
      await Bun.write(rowsFile, jsonl(rows.flatMap((row) => row.interactions)));
      await Bun.write(combosFile, jsonl(rows.flatMap((row) => row.combos)));
      for (const [index, entry] of FIGHTERS.entries()) {
        await Bun.write(pageFile(entry.slug), fighterPage(entry, rows[index]?.interactions ?? []) + "\n");
        await Bun.write(comboPageFile(entry.slug), comboPage(entry, rows[index]?.combos ?? []) + "\n");
      }
    },
    catch: failure,
  });

const check = (rows: readonly FighterRows[], throws: readonly ThrowRoleRow[]) =>
  Effect.gen(function* () {
    const changes = rowChanges(yield* writtenRows, rows.flatMap((row) => row.interactions));
    const stalePages = yield* Effect.tryPromise({
      try: async () => {
        const stale: string[] = [];
        for (const [index, entry] of FIGHTERS.entries()) {
          if ((await writtenText(pageFile(entry.slug))) !== fighterPage(entry, rows[index]?.interactions ?? []) + "\n") stale.push(`page ${entry.slug}.md differs from its rows`);
          if ((await writtenText(comboPageFile(entry.slug))) !== comboPage(entry, rows[index]?.combos ?? []) + "\n") stale.push(`page combos-${entry.slug}.md differs from its rows`);
        }
        if ((await writtenText(combosFile)) !== jsonl(rows.flatMap((row) => row.combos))) stale.push(`${combosFile} differs from the freshly played combo trees`);
        if ((await writtenText(throwsFile)) !== jsonl(throws)) stale.push(`${throwsFile} differs from the freshly played throw roles`);
        if ((await writtenText(throwsPage)) !== throwRolePage(throws) + "\n") stale.push("page throws.md differs from its rows");
        return stale;
      },
      catch: failure,
    });
    const problems = [...changes, ...stalePages];
    if (problems.length > 0) return yield* Effect.fail(new InteractionsFailure({ problems: [...problems, `${problems.length} differences from ${rowsFile}; inspect them, then run bun wisp interactions to write the new graph`] }));
    yield* Console.log(`The fresh interaction graph, combo trees and throw roles match ${directory}`);
  });

const profile = (spec: string) =>
  Effect.gen(function* () {
    const [name = "", move = ""] = spec.split(":");
    const entry = fighterNamed(name);
    if (entry === undefined || move === "") return yield* Effect.fail(new UsageFailure({ problem: `--move takes FIGHTER:MOVE, a fighter of ${FIGHTERS.map((fighter) => fighter.slug).join(", ")}` }));
    const moveName = move.replaceAll("-", " ");
    const [played] = yield* playFighters([entry.name], false).pipe(step(`${entry.name}'s situations`));
    const rows = played?.interactions ?? [];
    const lines = moveProfile(rows, moveName);
    yield* Console.log(lines.length === 0 ? `${moveName} takes part in none of ${entry.name}'s situations` : [`${entry.name} ${moveName}:`, ...lines.map((line) => `  ${line}`)].join("\n"));
    if (!(yield* graphWritten)) return yield* Console.log(notWritten);
    const written = (yield* writtenRows).filter((row) => row.fighter === entry.name);
    const changes = rowChanges(written, rows);
    yield* Console.log(changes.length === 0 ? `${entry.name}'s graph is unchanged from ${rowsFile}` : [`Changes in ${entry.name}'s graph from ${rowsFile}:`, ...changes.map((line) => `  ${line}`)].join("\n"));
  });

export const interactions: Command = (args) => {
  if (args.length === 2 && args[0] === "--move") return profile(args[1] ?? "");
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) return Effect.fail(new UsageFailure({ problem: "interactions takes --check or --move FIGHTER:MOVE" }));
  return Effect.gen(function* () {
    if (args[0] === "--check" && !(yield* graphWritten)) return yield* Effect.fail(new InteractionsFailure({ problems: [notWritten] }));
    const rows = yield* playFighters(FIGHTERS.map((entry) => entry.name)).pipe(step("every fighter's situations"));
    const throws = yield* playThrowRoles.pipe(step("every selectable fighter's throw roles"));
    if (args[0] === "--check") return yield* check(rows, throws);
    yield* write(rows, throws);
    yield* Console.log(`Wrote interaction, combo and throw-role rows, with ${FIGHTERS.length * 2 + 1} pages, to ${directory}`);
  });
};

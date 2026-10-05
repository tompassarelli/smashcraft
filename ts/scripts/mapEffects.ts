// Effect operations for building and rebuilding map files: typed failures,
// child processes that stop when their step is interrupted, a staged map file
// that never replaces the old one unless every step passed, bounded archive
// verification, and the TypeScript toolchain lock.
import { copyFileSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Effect, Schema } from "effect";

export class MapBuildFailure extends Schema.TaggedError<MapBuildFailure>()("MapBuildFailure", {
  operation: Schema.String,
  path: Schema.String,
  cause: Schema.Unknown,
}) {
  override get message(): string {
    return `${this.operation} failed for ${this.path}`;
  }
}

export const tryMapPromise = <A>(operation: string, path: string, run: () => PromiseLike<A>) =>
  Effect.tryPromise({ try: run, catch: (cause) => new MapBuildFailure({ operation, path, cause }) });

export const tryMapSync = <A>(operation: string, path: string, run: () => A) =>
  Effect.try({ try: run, catch: (cause) => new MapBuildFailure({ operation, path, cause }) });

/** Runs a command to completion; interrupting the step kills the process. */
export const runProcess = (operation: string, path: string, command: readonly string[]) =>
  Effect.acquireUseRelease(
    tryMapSync(operation, path, () => Bun.spawn([...command], { stdin: "ignore", stdout: "ignore", stderr: "pipe" })),
    (child) => Effect.gen(function*() {
      const [code, stderr] = yield* tryMapPromise(operation, path, () => Promise.all([child.exited, new Response(child.stderr).text()]));
      if (code !== 0) return yield* new MapBuildFailure({ operation, path, cause: `${command[0]} exited with ${code}: ${stderr.trim()}` });
    }),
    (child) => Effect.sync(() => {
      if (child.exitCode === null) child.kill();
    }),
  );

/** smashcraft:map-pack.c: extracts or replaces one archive entry, war3map.lua by default. */
export function mapPack(packager: string) {
  return {
    extract: (archive: string, file: string, entry = "war3map.lua") =>
      runProcess(`extract ${entry}`, archive, [packager, "extract", archive, file, entry]),
    replace: (archive: string, file: string, entry = "war3map.lua") =>
      runProcess(`replace ${entry}`, archive, [packager, "replace", archive, file, entry]),
  };
}

/** A temporary directory under `parent`, removed with its scope. */
export const workDirectory = (parent: string) =>
  Effect.acquireRelease(
    tryMapSync("create work directory", parent, () => mkdtempSync(join(parent, "ts-map."))),
    (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
  );

/**
 * Copies `source` to `destination.next`, lets `edit` change and verify the
 * copy, then renames it over `destination`. A failed or interrupted edit
 * removes the copy and leaves `destination` as it was.
 */
export const stageMap = <E>(source: string, destination: string, edit: (staged: string) => Effect.Effect<void, E>) =>
  Effect.acquireUseRelease(
    tryMapSync("stage map", destination, () => {
      copyFileSync(source, `${destination}.next`);
      return `${destination}.next`;
    }),
    (staged) => edit(staged).pipe(Effect.andThen(tryMapSync("publish map", destination, () => renameSync(staged, destination)))),
    (staged) => Effect.sync(() => rmSync(staged, { force: true })),
  );

export interface ArchiveEntry {
  readonly entry: string;
  /** The file whose bytes the archive entry must equal. */
  readonly source: string;
}

/** Extracts every entry, four at a time, and compares it with its source file. */
export const verifyArchive = (packager: string, archive: string, entries: readonly ArchiveEntry[], scratch: string) =>
  Effect.forEach(entries, ({ entry, source }, index) => Effect.gen(function*() {
    const extracted = join(scratch, `verify-${index}`);
    yield* mapPack(packager).extract(archive, extracted, entry);
    const [actual, expected] = yield* tryMapPromise("compare archive entry", entry, () =>
      Promise.all([Bun.file(extracted).bytes(), Bun.file(source).bytes()]));
    if (Buffer.compare(actual, expected) !== 0) return yield* new MapBuildFailure({ operation: "compare archive entry", path: entry, cause: `differs from ${source}` });
  }), { concurrency: 4, discard: true });


const decode = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S, path: string, value: unknown) =>
  Schema.decodeUnknownEffect(schema)(value).pipe(Effect.mapError((cause) => new MapBuildFailure({ operation: "decode", path, cause })));

/** A JSON file decoded with `schema`. */
export const readJson = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S, path: string) =>
  tryMapPromise("read JSON", path, () => Bun.file(path).json()).pipe(Effect.flatMap((json) => decode(schema, path, json)));

const ToolchainLock = Schema.Struct({
  sourceLanguage: Schema.Literal("TypeScript"),
  bun: Schema.String,
  typescriptCompilerApi: Schema.String,
  typescriptChecker: Schema.String,
  typescriptToLua: Schema.String,
  effect: Schema.String,
  effectTsgo: Schema.String,
});
const ProjectPackage = Schema.Struct({
  packageManager: Schema.String,
  devDependencies: Schema.Record(Schema.String, Schema.String),
});
const InstalledPackage = Schema.Struct({ version: Schema.String });

/**
 * Checks Bun and the declared and installed TypeScript packages against
 * smashcraft:typescript-toolchain.lock, as build.sh checks the Wurst lock.
 */
export const verifyToolchain = (lockPath: string, packageDirectory: string) => Effect.gen(function*() {
  const text = yield* tryMapPromise("read toolchain lock", lockPath, () => Bun.file(lockPath).text());
  const lock = yield* decode(ToolchainLock, lockPath, yield* tryMapSync("parse toolchain lock", lockPath, () => Bun.TOML.parse(text)));
  const project = yield* readJson(ProjectPackage, join(packageDirectory, "package.json"));
  const installed = (name: string) =>
    readJson(InstalledPackage, join(packageDirectory, "node_modules", name, "package.json")).pipe(Effect.map(({ version }) => version));
  const checks: readonly (readonly [string, string | undefined, string])[] = [
    ["running Bun", Bun.version, lock.bun],
    ["packageManager", project.packageManager, `bun@${lock.bun}`],
    ["declared typescript", project.devDependencies["typescript"], lock.typescriptCompilerApi],
    ["installed typescript", yield* installed("typescript"), lock.typescriptCompilerApi],
    ["declared typescript-native", project.devDependencies["typescript-native"], `npm:typescript@${lock.typescriptChecker}`],
    ["installed typescript-native", yield* installed("typescript-native"), lock.typescriptChecker],
    ["declared typescript-to-lua", project.devDependencies["typescript-to-lua"], lock.typescriptToLua],
    ["installed typescript-to-lua", yield* installed("typescript-to-lua"), lock.typescriptToLua],
    ["declared effect", project.devDependencies["effect"], lock.effect],
    ["installed effect", yield* installed("effect"), lock.effect],
    ["declared @effect/tsgo", project.devDependencies["@effect/tsgo"], lock.effectTsgo],
    ["installed @effect/tsgo", yield* installed("@effect/tsgo"), lock.effectTsgo],
  ];
  const mismatches = checks.filter(([, actual, expected]) => actual !== expected).map(([name, actual, expected]) => `${name} ${actual} (locked ${expected})`);
  if (mismatches.length > 0) return yield* new MapBuildFailure({ operation: "verify TypeScript toolchain lock", path: lockPath, cause: mismatches.join("; ") });
});

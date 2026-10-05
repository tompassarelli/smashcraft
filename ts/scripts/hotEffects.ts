import { renameSync, watch, type FSWatcher } from "node:fs";
import { Effect, Option, Schema } from "effect";

export class HotToolFailure extends Schema.TaggedError<HotToolFailure>()("HotToolFailure", {
  operation: Schema.String,
  path: Schema.String,
  cause: Schema.Unknown,
}) {}

const DataDirectories = Schema.NonEmptyArray(Schema.String.check(Schema.isMinLength(1))).check(Schema.isUnique());
const FileSystemFailure = Schema.Struct({ code: Schema.String });
const Acknowledgement = Schema.Struct({
  version: Schema.FiniteFromString.check(Schema.isInt()).check(Schema.isGreaterThanOrEqualTo(0)),
  elapsed: Schema.FiniteFromString.check(Schema.isGreaterThanOrEqualTo(0)),
});
const transientFileErrors = new Set(["EAGAIN", "EBUSY"]);

function isTransientFileFailure(failure: HotToolFailure): boolean {
  const decoded = Schema.decodeUnknownOption(FileSystemFailure)(failure.cause);
  return Option.isSome(decoded) && transientFileErrors.has(decoded.value.code);
}

function retryTransient<A>(effect: Effect.Effect<A, HotToolFailure>) {
  return Effect.retry(effect, { times: 2, while: isTransientFileFailure });
}

export const validateDataDirectories = (input: readonly string[]) =>
  Schema.decodeUnknownEffect(DataDirectories)(input).pipe(
    Effect.mapError((cause) => new HotToolFailure({ operation: "validate client directories", path: "--data", cause })),
  );

export function acknowledgementVersion(contents: string): number | undefined {
  const match = /^call Preload\( "applied (\d+) at ([^"]+)" \)$/.exec(contents.trim());
  if (match === null) return undefined;
  const decoded = Schema.decodeUnknownOption(Acknowledgement)({ version: match[1], elapsed: match[2] });
  return Option.isSome(decoded) ? decoded.value.version : undefined;
}

export const forEachHotClient = <A>(
  directories: readonly string[],
  publish: (directory: string) => Effect.Effect<A, HotToolFailure>,
) => Effect.forEach(directories, publish, { concurrency: 2, discard: true });

export const writeHotFile = (path: string, contents: string | Blob) => retryTransient(Effect.tryPromise({
    try: async () => {
      await Bun.write(path, contents);
    },
    catch: (cause) => new HotToolFailure({ operation: "write hot-reload file", path, cause }),
  }));

export const renameHotFile = (from: string, to: string) =>
  retryTransient(Effect.try({
    try: () => renameSync(from, to),
    catch: (cause) => new HotToolFailure({ operation: "publish hot-reload manifest", path: to, cause }),
  }));

export const runHotWatch = (onChange: () => void, onPoll: () => void) =>
  Effect.scoped(
    Effect.gen(function*() {
      const watcher: FSWatcher = yield* Effect.acquireRelease(
        Effect.try({
          try: () => watch("src", { recursive: true }, onChange),
          catch: (cause) => new HotToolFailure({ operation: "watch source tree", path: "src", cause }),
        }),
        (resource) => Effect.sync(() => resource.close()),
      );
      void watcher;

      yield* Effect.acquireRelease(
        Effect.sync(() => setInterval(onPoll, 50)),
        (timer) => Effect.sync(() => clearInterval(timer)),
      );

      yield* Effect.callback<void>((resume) => {
        const stop = () => resume(Effect.void);
        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
        return Effect.sync(() => {
          process.removeListener("SIGINT", stop);
          process.removeListener("SIGTERM", stop);
        });
      });
    }),
  );

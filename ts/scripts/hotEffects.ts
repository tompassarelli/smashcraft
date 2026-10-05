import { renameSync, watch, type FSWatcher } from "node:fs";
import { Effect, Option, Queue, Schema } from "effect";

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

export const tryHotPromise = <A>(operation: string, path: string, run: () => PromiseLike<A>) =>
  Effect.tryPromise({ try: run, catch: (cause) => new HotToolFailure({ operation, path, cause }) });

export const tryHotSync = <A>(operation: string, path: string, run: () => A) =>
  Effect.try({ try: run, catch: (cause) => new HotToolFailure({ operation, path, cause }) });

export const validateDataDirectories = (input: readonly string[]) =>
  Schema.decodeUnknownEffect(DataDirectories)(input).pipe(
    Effect.mapError((cause) => new HotToolFailure({ operation: "validate client directories", path: "--data", cause })),
  );

export function acknowledgementVersion(contents: string): number | undefined {
  const match = /^\s*call Preload\( "applied (\d+) at ([^"\r\n]+)" \)[\t ]*\r?$/m.exec(contents);
  if (match === null) return undefined;
  const decoded = Schema.decodeUnknownOption(Acknowledgement)({ version: match[1], elapsed: match[2] });
  return Option.isSome(decoded) ? decoded.value.version : undefined;
}

export const forEachHotClient = <A>(
  directories: readonly string[],
  publish: (directory: string) => Effect.Effect<A, HotToolFailure>,
) => Effect.forEach(directories, publish, { concurrency: 2, discard: true });

export const writeHotFile = (path: string, contents: string | Blob) => retryTransient(tryHotPromise(
  "write hot-reload file",
  path,
  async () => {
    await Bun.write(path, contents);
  },
));

export const renameHotFile = (from: string, to: string) =>
  retryTransient(tryHotSync("publish hot-reload manifest", to, () => renameSync(from, to)));

function waitForProcessStop(): Effect.Effect<void> {
  return Effect.callback<void>((resume) => {
    const stop = () => resume(Effect.void);
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    return Effect.sync(() => {
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
    });
  });
}

export const runHotWatch = (
  onChange: Effect.Effect<void, HotToolFailure>,
  onPoll: Effect.Effect<void, HotToolFailure>,
  stop: Effect.Effect<void> = waitForProcessStop(),
) =>
  Effect.scoped(
    Effect.gen(function*() {
      const sourceEvents = yield* Effect.acquireRelease(
        Queue.unbounded<void>(),
        (events) => Queue.shutdown(events),
      );
      const pollEvents = yield* Effect.acquireRelease(
        Queue.unbounded<void>(),
        (events) => Queue.shutdown(events),
      );
      let sourcePending = false;
      let pollPending = false;
      const watcher: FSWatcher = yield* Effect.acquireRelease(
        Effect.try({
          try: () => watch("src", { recursive: true }, () => {
            if (sourcePending) return;
            sourcePending = true;
            Queue.offerUnsafe(sourceEvents, undefined);
          }),
          catch: (cause) => new HotToolFailure({ operation: "watch source tree", path: "src", cause }),
        }),
        (resource) => Effect.sync(() => resource.close()),
      );
      void watcher;

      yield* Effect.acquireRelease(
        Effect.sync(() => setInterval(() => {
          if (pollPending) return;
          pollPending = true;
          Queue.offerUnsafe(pollEvents, undefined);
        }, 50)),
        (timer) => Effect.sync(() => clearInterval(timer)),
      );

      const sourceWorker = Effect.forever(Effect.gen(function*() {
        yield* Queue.take(sourceEvents);
        yield* Effect.sleep("10 millis");
        sourcePending = false;
        yield* onChange.pipe(Effect.catch((failure) => Effect.sync(() => console.error(failure))));
      }));
      const pollWorker = Effect.forever(Effect.gen(function*() {
        yield* Queue.take(pollEvents);
        pollPending = false;
        yield* onPoll.pipe(Effect.catch((failure) => Effect.sync(() => console.error(failure))));
      }));
      yield* Effect.forkScoped(sourceWorker);
      yield* Effect.forkScoped(pollWorker);
      yield* stop;
    }),
  );

// Running a program to completion from a host tool (docs/typescript.md, "Host
// tools"). Start long-lived children with `ChildProcess.make(...)` directly.
import { Effect, Schema, Stream } from "effect";
import type { ChildProcess } from "effect/process";

/** A program that couldn't start, was killed, or exited nonzero. */
export class ProcessFailure extends Schema.TaggedError<ProcessFailure>()("ProcessFailure", {
  command: Schema.String,
  problem: Schema.String,
}) {
  override get message(): string {
    return `${this.command} ${this.problem}`;
  }
}

/**
 * Runs `command` in its own scope and returns its trimmed stdout.
 * Effect's spawner returns output without failing on a nonzero exit; host tools need that failure.
 */
export const runProcess = (command: ChildProcess.StandardCommand) => {
  const name = [command.command, ...command.args].slice(0, 3).join(" ");
  return Effect.scoped(Effect.gen(function*() {
    const handle = yield* command;
    const [stdout, stderr, code] = yield* Effect.all(
      [Stream.mkString(Stream.decodeText(handle.stdout)), Stream.mkString(Stream.decodeText(handle.stderr)), handle.exitCode],
      { concurrency: "unbounded" },
    );
    if (code !== 0) return yield* new ProcessFailure({ command: name, problem: `exited ${code}${stderr.trim() === "" ? "" : `: ${stderr.trim()}`}` });
    return stdout.trim();
  })).pipe(Effect.catchTag("PlatformError", (cause) => Effect.fail(new ProcessFailure({ command: name, problem: cause.message }))));
};

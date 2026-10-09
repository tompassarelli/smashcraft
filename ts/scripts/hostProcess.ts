

import { Effect, Schema, Stream } from "effect";
import type { ChildProcess } from "effect/process";


export const stopBunProcess = (child: Pick<Bun.Subprocess, "exitCode" | "kill" | "exited">) => Effect.gen(function*() {
  if (child.exitCode !== null) return;
  child.kill("SIGCONT");
  child.kill("SIGINT");
  const stopped = yield* Effect.promise(() => child.exited).pipe(Effect.timeoutOption("1 second"));
  if (stopped._tag === "None") {
    child.kill("SIGKILL");
    yield* Effect.promise(() => child.exited);
  }
});


export const runMeasuredProcess = (command: readonly string[], cwd: string, env: Record<string, string | undefined>) =>
  Effect.acquireUseRelease(
    Effect.try({
      try: () => Bun.spawn([...command], { cwd, env, stdout: "inherit", stderr: "inherit" }),
      catch: (cause) => new ProcessFailure({ command: command[0] ?? "", problem: `could not start: ${String(cause)}` }),
    }),
    (child) => Effect.promise(() => child.exited).pipe(Effect.map((code) => {
      const usage = child.resourceUsage()?.cpuTime;
      return { code, cpu: usage === undefined ? 0 : (Number(usage.user) + Number(usage.system)) / 1e6 };
    })),
    stopBunProcess,
  );


export class ProcessFailure extends Schema.TaggedError<ProcessFailure>()("ProcessFailure", {
  command: Schema.String,
  problem: Schema.String,
}) {
  override get message(): string {
    return `${this.command} ${this.problem}`;
  }
}


export const startInputProcess = (command: readonly string[], options: {
  readonly env: Record<string, string | undefined>;
  readonly stdout?: string;
  readonly stderr: string;
}) => Effect.acquireRelease(
  Effect.try({
    try: () => Bun.spawn([...command], {
      env: options.env, stdin: "pipe", stdout: options.stdout === undefined ? "ignore" : Bun.file(options.stdout), stderr: Bun.file(options.stderr),
    }),
    catch: cause => new ProcessFailure({ command: command[0] ?? "", problem: `could not start: ${String(cause)}` }),
  }),
  stopBunProcess,
).pipe(Effect.map(child => ({
  child,
  write: (line: string) => Effect.tryPromise({
    try: async () => { child.stdin.write(`${line}\n`); await child.stdin.flush(); },
    catch: cause => new ProcessFailure({ command: command[0] ?? "", problem: `could not write input: ${String(cause)}` }),
  }),
})));





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

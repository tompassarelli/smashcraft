



import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cause, Effect } from "effect";
import { runBatchProcess } from "../scripts/wisp/padBatch";
import { pollUntil } from "../scripts/hostPoll";

test("batch children preserve completion and failure and cancellation leaves no child [spec #240]", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pad-batch-process-"));
  const pidPath = join(dir, "pid");
  try {
    const success = await Effect.runPromiseExit(runBatchProcess(process.execPath, ["-e", "console.log('finished')"], join(dir, "success.log")));
    expect(success._tag).toBe("Success");
    expect(readFileSync(join(dir, "success.log"), "utf8")).toBe("finished\n");
    const failure = await Effect.runPromiseExit(runBatchProcess(process.execPath, ["-e", "console.error('broken'); process.exit(7)"], join(dir, "failure.log")));
    expect(failure._tag).toBe("Failure");
    if (failure._tag === "Failure") expect(Cause.pretty(failure.cause)).toContain("exited 7");
    expect(readFileSync(join(dir, "failure.log.err"), "utf8")).toBe("broken\n");
    const stopped = await Effect.runPromiseExit(runBatchProcess(process.execPath, ["-e", `process.on('SIGTERM', () => {}); require('node:fs').writeFileSync(${JSON.stringify(pidPath)}, String(process.pid)); setInterval(() => {}, 1000);`], join(dir, "cancel.log")).pipe(
      Effect.raceFirst(pollUntil(Effect.sync(() => existsSync(pidPath) ? true : undefined), { every: "5 millis", within: "3 seconds", orElse: () => Effect.die("child never started") }).pipe(Effect.andThen(Effect.fail("cancelled")))),
    ));
    expect(stopped._tag).toBe("Failure");
    if (stopped._tag === "Failure") expect(Cause.pretty(stopped.cause)).toContain("cancelled");
    const pid = Number(readFileSync(pidPath, "utf8"));
    expect(() => process.kill(pid, 0)).toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

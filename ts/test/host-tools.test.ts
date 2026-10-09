

import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect, Exit } from "effect";
import { ChildProcess } from "effect/process";
import { runProcess } from "../scripts/hostProcess";
import { startPadCutProducer } from "../scripts/nativePadCut233";
import { calibrateCursor } from "../scripts/analogNative";
import { pollUntil } from "../scripts/hostPoll";

const wispEntry = resolve(import.meta.dir, "../scripts/wisp.ts");


const stub = (bin: string, name: string, body: string) => {
  const path = join(bin, name);
  writeFileSync(path, `#!${process.execPath}\nconst { appendFileSync, writeFileSync } = require("node:fs");\nconst { execFileSync } = require("node:child_process");\nconst args = process.argv.slice(2);\n${body}\n`);
  chmodSync(path, 0o755);
};


const leftovers = (pids: readonly number[]) => pids.filter((pid) => {
  try {
    return !/^\d+ \(.*\) Z/.test(readFileSync(`/proc/${pid}/stat`, "utf8"));
  } catch {
    return false;
  }
});

test("pad cut producer feeds stdin and reaps a paused helper on cancellation [repro #240]", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pad-cut-process-"));
  try {
    const pidFile = join(dir, "producer.pid");
    const inputFile = join(dir, "input.txt");
    stub(dir, "helper", `writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
process.on("SIGINT", () => {});
process.stdin.on("data", data => { appendFileSync(${JSON.stringify(inputFile)}, data); if (data.toString().includes("quit")) process.exit(3); });`);
    const producer = () => startPadCutProducer({ helper: join(dir, "helper"), client: { x11: { DISPLAY: ":77" }, wayland: {}, window: "123" }, pid: 123, single: false, appId: "fixture", out: dir, slot: 0 });
    const complete = await Effect.runPromise(Effect.scoped(Effect.gen(function*() {
      const handle = yield* producer();
      yield* handle.write("axis leftx 32767");
      yield* handle.write("quit");
      return yield* Effect.promise(() => handle.child.exited);
    })));
    expect(complete).toBe(3);
    expect(readFileSync(inputFile, "utf8")).toBe("axis leftx 32767\nquit\n");
    expect(leftovers([Number(readFileSync(pidFile, "utf8"))])).toEqual([]);
    let cancelledPid = 0;
    const cancelled = await Effect.runPromiseExit(Effect.scoped(Effect.gen(function*() {
      const handle = yield* producer();
      cancelledPid = handle.child.pid;
      yield* handle.write("axis leftx 0");
      yield* pollUntil(Effect.sync(() => readFileSync(inputFile, "utf8").endsWith("axis leftx 0\n") ? true : undefined), {
        every: "10 millis", within: "2 seconds", orElse: () => Effect.die("fixture did not read input"),
      });
      handle.child.kill("SIGSTOP");
      yield* Effect.interrupt;
    })));
    expect(Exit.isFailure(cancelled)).toBe(true);
    expect(leftovers([cancelledPid])).toEqual([]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 20_000);

test("cursor calibration publishes its native clock and stops the child on success, exit, timeout and cancellation [repro #240]", async () => {
  const dir = mkdtempSync(join(tmpdir(), "analog-calibration-"));
  try {
    const pidFile = join(dir, "calibration.pid");
    const receipt = join(dir, "calibration.txt");
    const body = `writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));\n`;
    const calibration = (name: string) => calibrateCursor({ args: [join(dir, name)], env: { ...Bun.env }, path: receipt, log: join(dir, "helper.log"), corner: "start" });
    const preload = 'function PreloadFiles takes nothing returns nothing\n  call Preload( "corner start native-seconds 2.5 mouse-events 4 sync-events 6" )\nendfunction\n';
    stub(dir, "success", body + `writeFileSync(${JSON.stringify(receipt)}, ${JSON.stringify(preload)}); setInterval(() => {}, 1000);`);
    const anchor = await Effect.runPromise(calibration("success"));
    expect([anchor.nativeSeconds, anchor.mouseEvents, anchor.syncEvents]).toEqual([2.5, 4, 6]);
    expect(leftovers([Number(readFileSync(pidFile, "utf8"))])).toEqual([]);
    rmSync(receipt);
    stub(dir, "early", body + "process.exit(3);");
    await expect(Effect.runPromise(calibration("early"))).rejects.toThrow("exited 3 before publishing start");
    stub(dir, "waiting", body + "setInterval(() => {}, 1000);");
    await expect(Effect.runPromise(calibration("waiting"))).rejects.toThrow("did not observe the start cursor calibration");
    expect(leftovers([Number(readFileSync(pidFile, "utf8"))])).toEqual([]);
    await Effect.runPromise(calibration("waiting").pipe(Effect.timeoutOrElse({ duration: "200 millis", orElse: () => Effect.void })));
    expect(leftovers([Number(readFileSync(pidFile, "utf8"))])).toEqual([]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 20_000);

test("SIGTERM to bun wisp stops the helper process its command started [spec wisp:docs/host-tools.md]", async () => {
  const dir = mkdtempSync(join(tmpdir(), "host-tools-signal-"));
  try {
    const bin = join(dir, "bin");
    mkdirSync(bin);
    const pidFile = join(dir, "helper.pid");
    stub(bin, "gh", `writeFileSync(${JSON.stringify(`${pidFile}.pending`)}, String(process.pid));
require("node:fs").renameSync(${JSON.stringify(`${pidFile}.pending`)}, ${JSON.stringify(pidFile)});
setInterval(() => {}, 1000);`);
    const wisp = Bun.spawn([process.execPath, wispEntry, "farm", "pads"], { cwd: dir, env: { ...process.env, PATH: `${bin}:${process.env["PATH"] ?? ""}` }, stdout: "ignore", stderr: "pipe" });
    for (let waited = 0; !existsSync(pidFile) && waited < 10_000; waited += 20) await Bun.sleep(20);
    const helper = Number(readFileSync(pidFile, "utf8"));
    expect(helper).toBeGreaterThan(0);
    expect(leftovers([helper])).toEqual([helper]);
    wisp.kill("SIGTERM");
    expect(await wisp.exited).toBe(130);
    expect(leftovers([helper])).toEqual([]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 20_000);

test("runProcess returns a program's output, fails on a nonzero exit, and stops it when interrupted [spec wisp:docs/host-tools.md]", async () => {
  const dir = mkdtempSync(join(tmpdir(), "host-tools-run-"));
  try {
    const pidFile = join(dir, "child.pid");
    const script = (body: string) => ChildProcess.make(process.execPath, ["-e", body]);
    const run = <A, E>(effect: Effect.Effect<A, E, ChildProcess.ChildProcessSpawner>) => Effect.runPromiseExit(effect.pipe(Effect.provide(BunServices.layer)));
    expect(await run(runProcess(script("console.log(' out ')")))).toEqual(Exit.succeed("out"));
    const failed = await run(runProcess(script("console.error('broke'); process.exit(3)")));
    expect(Exit.isFailure(failed) && String(failed.cause)).toContain("exited 3: broke");
    const timedOut = await run(runProcess(script(`require("node:fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000);`)).pipe(
      Effect.timeoutOrElse({ duration: "1 second", orElse: () => Effect.succeed("timed out") })));
    expect(timedOut).toEqual(Exit.succeed("timed out"));
    const child = Number(readFileSync(pidFile, "utf8"));
    expect(leftovers([child])).toEqual([]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 20_000);

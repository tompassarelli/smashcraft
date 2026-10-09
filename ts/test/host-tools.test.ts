

import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect, Exit } from "effect";
import { ChildProcess } from "effect/process";
import { runProcess } from "../scripts/hostProcess";

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

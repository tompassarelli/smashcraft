import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readdirSync, rmSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { Effect, Fiber } from "effect";
import { replayInLua } from "../scripts/waygate/commands/tapes";

async function fixture(source: string) {
  const build = join(import.meta.dir, "../build");
  mkdirSync(build, { recursive: true });
  const directory = mkdtempSync(join(build, "tape-process-"));
  const executable = join(directory, "lua");
  await Bun.write(executable, `#!${process.execPath}\n${source}`);
  chmodSync(executable, 0o700);
  return { directory, executable };
}

async function started(directory: string, count: number): Promise<number[]> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const paths = readdirSync(directory).filter((name) => name.endsWith(".pid"));
    if (paths.length >= count) {
      const pids = await Promise.all(paths.map(async (path) => Number(await Bun.file(join(directory, path)).text())));
      if (pids.every((pid) => Number.isInteger(pid) && pid > 0)) return pids;
    }
    await Bun.sleep(10);
  }
  throw new Error(`expected ${count} replay children to start`);
}

test("Lua replay cancellation reaps two active children and never starts the queued tape", async () => {
  const { directory, executable } = await fixture(`
    await Bun.write(process.env.TAPE_FILE + ".pid", String(process.pid));
    setInterval(() => {}, 1000);
  `);
  const files = ["first", "second", "queued"].map((name) => join(directory, name));
  const fiber = Effect.runFork(replayInLua(files, executable));
  let pids: number[] = [];
  try {
    pids = await started(directory, 2);
    expect(pids).toHaveLength(2);
    expect(await Bun.file(files[2] + ".pid").exists()).toBe(false);
    await Effect.runPromise(Fiber.interrupt(fiber));
    for (const pid of pids) expect(() => process.kill(pid, 0)).toThrow();
    expect(readdirSync(directory).filter((name) => name.endsWith(".pid"))).toHaveLength(2);
  } finally {
    await Effect.runPromise(Fiber.interrupt(fiber));
    pids = await Promise.all(readdirSync(directory).filter((name) => name.endsWith(".pid"))
      .map(async (name) => Number(await Bun.file(join(directory, name)).text())));
    for (const pid of pids) {
      if (Number.isInteger(pid) && pid > 0) {
        try { process.kill(pid, "SIGKILL"); } catch { /* The checked children have exited. */ }
      }
    }
    rmSync(directory, { recursive: true });
  }
});

test("Lua replay keeps partial records and stderr from a nonzero child in tape order", async () => {
  const { directory, executable } = await fixture(`
    console.log(process.env.TAPE_FILE + " frame complete state");
    if (process.env.TAPE_FILE === "failed") {
      console.error("replay failed on fixture");
      process.exit(7);
    }
    process.exit(0);
  `);
  try {
    expect(await Effect.runPromise(replayInLua(["failed", "succeeded"], executable))).toEqual([
      { records: ["failed frame complete state"], error: "replay failed on fixture" },
      { records: ["succeeded frame complete state"], error: undefined },
    ]);
  } finally {
    rmSync(directory, { recursive: true });
  }
});

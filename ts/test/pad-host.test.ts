import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Exit, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { collect, freshGame, nativeScript, type NativeSession } from "../scripts/wisp/commands/pad";
import { TRACE_FILE } from "../scripts/integrity/padParity";
import { sceneFile } from "wisp/src/runtime/scene";
import { nativeChatFile } from "../src/runtime/gameFiles";
import { parsePadScript } from "../scripts/integrity/padScript";
import { SMASHCRAFT_HEADLESS } from "../scripts/wisp/headless";

test("pad collection retains fresh traces and scenes and fails when a client's trace never arrives [repro #240]", async () => {
  const root = mkdtempSync(join(tmpdir(), "pad-collect-"));
  const data = [join(root, "a"), join(root, "b")] as const;
  const out = join(root, "out");
  try {
    [...data, out].forEach(dir => mkdirSync(dir));
    data.forEach((dir, slot) => {
      writeFileSync(join(dir, TRACE_FILE), `trace ${slot}`);
      writeFileSync(join(dir, sceneFile(slot, SMASHCRAFT_HEADLESS.filePrefix)), `scene ${slot}`);
    });
    expect(await Effect.runPromiseExit(collect(data, out, 0))).toEqual(Exit.succeed(undefined));
    expect(readFileSync(join(out, "trace-a.txt"), "utf8")).toBe("trace 0");
    expect(readFileSync(join(out, "trace-b.txt"), "utf8")).toBe("trace 1");
    expect(readFileSync(join(out, "scene-b.txt"), "utf8")).toBe("scene 1");
    rmSync(join(data[1], TRACE_FILE));
    rmSync(join(out, "trace-b.txt"));
    const missing = await Effect.runPromise(Effect.gen(function*() {
      const fiber = yield* Effect.forkChild(Effect.exit(collect(data, out, 0)), { startImmediately: true });
      yield* TestClock.adjust("2 minutes");
      return yield* Fiber.join(fiber);
    }).pipe(Effect.provide(TestClock.layer())));
    expect(Exit.isFailure(missing) && String(missing.cause)).toContain("no input trace written since the run began");
    expect(readFileSync(join(out, "trace-a.txt"), "utf8")).toBe("trace 0");
    expect(existsSync(join(out, "trace-b.txt"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("pad fresh-game child preserves exit failures and stops on interruption [repro #240]", async () => {
  const root = mkdtempSync(join(tmpdir(), "pad-fresh-"));
  const oldPath = process.env.PATH;
  const pidFile = join(root, "child.pid");
  try {
    const binary = join(root, "bun");
    writeFileSync(binary, `#!${process.execPath}\nconst { writeFileSync } = require('node:fs');\nconst map = process.argv[4];\nif (map === 'ok') process.exit(0);\nif (map === 'bad') process.exit(7);\nwriteFileSync(${JSON.stringify(pidFile)}, String(process.pid));\nsetInterval(() => {}, 1000);\n`);
    chmodSync(binary, 0o755);
    process.env.PATH = `${root}:${oldPath ?? ""}`;
    expect(await Effect.runPromiseExit(freshGame("ok", "clients.json"))).toEqual(Exit.succeed(undefined));
    const failed = await Effect.runPromiseExit(freshGame("bad", "clients.json"));
    expect(Exit.isFailure(failed) && String(failed.cause)).toContain("start a new game failed for bad: bun wisp fresh exited 7");
    const interrupted = await Effect.runPromiseExit(freshGame("wait", "clients.json").pipe(
      Effect.timeoutOrElse({ duration: "1 second", orElse: () => Effect.succeed("interrupted") }),
    ));
    expect(interrupted).toEqual(Exit.succeed("interrupted"));
    const pid = Number(readFileSync(pidFile, "utf8"));
    expect(existsSync(`/proc/${pid}`)).toBe(false);
  } finally {
    if (oldPath === undefined) delete process.env.PATH;
    else process.env.PATH = oldPath;
    rmSync(root, { recursive: true, force: true });
  }
}, 15_000);

test("native setup failure retains INVALID at the selected chat boundary without starting the pad timeline [spec AGENTS.md]", async () => {
  const root = mkdtempSync(join(tmpdir(), "smashcraft-setup-"));
  const data = [join(root, "a"), join(root, "b")] as const;
  data.forEach(dir => mkdirSync(dir));
  const client = (name: string) => ({ name, documents: root, window: "0", x11: {}, wayland: {}, tools: { grim: "/unreachable", xdotool: "/unreachable", wlrctl: "/unreachable", tesseract: "/unreachable" } });
  const session = { clients: [client("lan2a"), client("lan2b")], data, pads: [], build: "test", logs: () => ["", ""], startedMs: 0 } satisfies NativeSession;
  const out = join(root, "out");
  writeFileSync(join(data[0], nativeChatFile("test", 0)), 'function PreloadFiles takes nothing returns nothing\ncall Preload( "SMASHCRAFT CHAT v=1 revision=1 available=0 open=0" )\nendfunction\n');
  try {
    const result = await Effect.runPromise(Effect.gen(function*() {
      const fiber = yield* Effect.forkChild(nativeScript(session, { scriptPath: "unreached.pad", steps: parsePadScript("150 a press A"), helper: "/unreachable", build: "test", out, chat: "-dev quick hero rifleman" }), { startImmediately: true });
      yield* TestClock.adjust("2 seconds");
      return yield* Fiber.join(fiber);
    }).pipe(Effect.provide(TestClock.layer())));
    expect(result).toBe("invalid");
    const recorded = JSON.parse(readFileSync(join(out, "result.json"), "utf8"));
    expect(recorded.status).toBe("INVALID");
    expect(recorded.invalid[0]).toContain("open chat entry");
    expect(recorded.invalid[0]).toContain("lan2a");
    expect(recorded.edges).toEqual([]);
    expect(existsSync(join(out, "producer.jsonl"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

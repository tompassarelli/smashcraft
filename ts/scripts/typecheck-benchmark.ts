

import { readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect, Stream } from "effect";
import { ChildProcess } from "effect/process";

const project = resolve(import.meta.dir, "..");
const source = resolve(project, "src/runtime/gameFiles.ts");
const original = readFileSync(source, "utf8");
const body = '`smashcraft-dev-${build}-p${slot}.txt`';
const signature = "export const devCommandReceiptFile = (build: string, slot: number)";
const targetMs = 1000;
let currentSource = original;

const check = Effect.fn("check")(function*(name: string) {
  const started = performance.now();
  const result = yield* Effect.scoped(Effect.gen(function*() {
    const child = yield* ChildProcess.make(process.execPath, ["run", "check"], { cwd: project });
    const [stdout, stderr, exitCode] = yield* Effect.all([
      Stream.mkString(Stream.decodeText(child.stdout)), Stream.mkString(Stream.decodeText(child.stderr)), child.exitCode,
    ], { concurrency: "unbounded" });
    return { stdout, stderr, exitCode };
  }));
  const elapsedMs = performance.now() - started;
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  console.log(`${name}: ${elapsedMs.toFixed(0)} ms (exit ${result.exitCode})`);
  return { ...result, elapsedMs };
});

function requireSuccess(result: { readonly exitCode: number }): void {
  if (result.exitCode !== 0) {
    process.exitCode ||= result.exitCode;
    throw new Error(`full project check failed with exit code ${result.exitCode}`);
  }
}

function edit(text: string): void {
  if (text === currentSource) throw new Error("type-check benchmark edit did not change the source");
  if (readFileSync(source, "utf8") !== currentSource) throw new Error("source changed by another writer; left it untouched");
  writeFileSync(source, text);
  currentSource = text;
  const now = Date.now() / 1000;
  utimesSync(source, now, now);
}

const main = Effect.gen(function*() {
  yield* Effect.acquireRelease(Effect.void, () => Effect.gen(function*() {
    if (currentSource !== original) {
      edit(original);
      requireSuccess(yield* check("restored full type-check"));
    }
  }).pipe(Effect.orDie));
  if (!original.includes(body) || !original.includes(signature)) {
    throw new Error("shared developer receipt function changed; inspect it before benchmarking");
  }
  for (const cache of ["build/typecheck-host.tsbuildinfo", "build/typecheck-game.tsbuildinfo"]) {
    rmSync(resolve(project, cache), { force: true });
  }
  requireSuccess(yield* check("cold full type-check (reported)"));

  edit(original.replace(body, '`smashcraft-dev-probe-${build}-p${slot}.txt`'));
  const edited = yield* check("full type-check after shared implementation edit (target ≤1 s)");
  requireSuccess(edited);
  if (edited.elapsedMs > targetMs) {
    const message = `full type-check after shared implementation edit exceeded ${targetMs} ms`;
    if (process.env.CI_TIMING === "report") console.log(`${message} (reported, not gated: CI_TIMING=report)`);
    else {
      console.error(message);
      process.exitCode ||= 1;
    }
  }

  edit(currentSource.replace(signature, "export const devCommandReceiptFile = (build: number, slot: number)"));
  const invalid = yield* check("invalid shared signature");
  if (invalid.exitCode === 0
    || !/scripts\/wisp\/commands\/fresh\.ts\(\d+,\d+\): error TS2345/.test(invalid.stdout)
    || !/src\/game\/shell\/journalFiles\.ts\(\d+,\d+\): error TS2345/.test(invalid.stdout)) {
    throw new Error("changed shared signature did not fail at both host and game consumers");
  }
  console.log("changed shared signature rejected by host and game consumers");
});

BunRuntime.runMain(main.pipe(Effect.scoped, Effect.provide(BunServices.layer)));

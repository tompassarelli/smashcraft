// Measure the full project check after a real shared implementation edit.
// The cold check establishes dependency state; its duration is reported separately.
import { readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const project = resolve(import.meta.dir, "..");
const source = resolve(project, "src/runtime/gameFiles.ts");
const original = readFileSync(source, "utf8");
const body = '`smashcraft-dev-${build}-p${slot}.txt`';
const signature = "export const devCommandReceiptFile = (build: string, slot: number)";
const targetMs = 1000;
let currentSource = original;

function check(name: string) {
  const started = performance.now();
  const child = Bun.spawnSync([process.execPath, "run", "check"], {
    cwd: project,
    stdout: "pipe",
    stderr: "pipe",
  });
  const elapsedMs = performance.now() - started;
  const stdout = new TextDecoder().decode(child.stdout);
  process.stdout.write(stdout);
  process.stderr.write(child.stderr);
  console.log(`${name}: ${elapsedMs.toFixed(0)} ms (exit ${child.exitCode})`);
  return { exitCode: child.exitCode, elapsedMs, stdout };
}

function requireSuccess(result: ReturnType<typeof check>): void {
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

try {
  if (!original.includes(body) || !original.includes(signature)) {
    throw new Error("shared developer receipt function changed; inspect it before benchmarking");
  }
  for (const cache of ["build/typecheck-host.tsbuildinfo", "build/typecheck-game.tsbuildinfo"]) {
    rmSync(resolve(project, cache), { force: true });
  }
  requireSuccess(check("cold full type-check (reported)"));

  edit(original.replace(body, '`smashcraft-dev-probe-${build}-p${slot}.txt`'));
  const edited = check("full type-check after shared implementation edit (target ≤1 s)");
  requireSuccess(edited);
  if (edited.elapsedMs > targetMs) {
    console.error(`full type-check after shared implementation edit exceeded ${targetMs} ms`);
    process.exitCode ||= 1;
  }

  edit(currentSource.replace(signature, "export const devCommandReceiptFile = (build: number, slot: number)"));
  const invalid = check("invalid shared signature");
  if (invalid.exitCode === 0
    || !/scripts\/wisp\/commands\/fresh\.ts\(\d+,\d+\): error TS2345/.test(invalid.stdout)
    || !/src\/game\/shell\/journalFiles\.ts\(\d+,\d+\): error TS2345/.test(invalid.stdout)) {
    throw new Error("changed shared signature did not fail at both host and game consumers");
  }
  console.log("changed shared signature rejected by host and game consumers");
} catch (error) {
  console.error(error);
  process.exitCode ||= 1;
} finally {
  if (currentSource !== original) {
    edit(original);
    requireSuccess(check("restored full type-check"));
  }
}

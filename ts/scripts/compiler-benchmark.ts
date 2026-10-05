// Measures the first and repeated body-edit compiles in one compiler process,
// then compares the last incremental bundle with a fresh full compile.
import { readFileSync, writeFileSync, utimesSync } from "node:fs";
import { resolve } from "node:path";
import { mapCompiler, report } from "./compiler";

const project = resolve(import.meta.dir, "..");
const source = resolve(project, "src/platform/shell/diagnostics.ts");
const bundle = resolve(project, "build/map.lua");
const sourceMap = `${bundle}.map`;
const original = readFileSync(source, "utf8");
const needle = '`confirmed frame ${s.runtime.simulationFrame} state ${state}`';
if (!original.includes(needle)) throw new Error("trace statement changed; inspect it before benchmarking");

function compile(run: () => readonly import("typescript").Diagnostic[]): void {
  const diagnostics = run();
  if (diagnostics.length > 0) throw new Error(report(diagnostics));
}

function bytes(): readonly [Buffer, Buffer] {
  return [readFileSync(bundle), readFileSync(sourceMap)];
}

function same(left: readonly [Buffer, Buffer], right: readonly [Buffer, Buffer]): boolean {
  return left[0].equals(right[0]) && left[1].equals(right[1]);
}

const incremental = mapCompiler(resolve(project, "tsconfig.map.json"));
const markers = ["compile-latency-a", "compile-latency-b", "compile-latency-c"];
const timings: number[] = [];
let incrementalOutput: readonly [Buffer, Buffer] | undefined;
let currentSource = original;
function edit(marker: string): void {
  const edited = original.replace(needle, needle.slice(0, -1) + ` ${marker}` + "`");
  if (edited === original) throw new Error("benchmark edit did not change the source");
  writeFileSync(source, edited);
  currentSource = edited;
  const now = Date.now() / 1000;
  utimesSync(source, now, now);
}
try {
  compile(incremental); // cold compiler state: establish the full output and validation baseline
  for (const marker of markers) {
    edit(marker);
    const started = performance.now();
    compile(incremental);
    timings.push(performance.now() - started);
    incrementalOutput = bytes();
  }
  const fullCompile = Bun.spawnSync([
    process.execPath,
    "--bun",
    resolve(project, "node_modules/typescript-to-lua/dist/tstl.js"),
    "-p",
    resolve(project, "tsconfig.map.json"),
  ], { cwd: project, stdout: "pipe", stderr: "pipe" });
  if (fullCompile.exitCode !== 0) throw new Error(new TextDecoder().decode(fullCompile.stderr));
  if (incrementalOutput === undefined || !same(incrementalOutput, bytes())) throw new Error("incremental bundle differs from full TSTL compile");

  const signatureEdit = currentSource.replace(
    "export function traceParticipant(s: ShellState, slot: number, entry: string): void {",
    "export function traceParticipant(s: ShellState, slot: number, entry: string, requiredProbe: number): void {",
  );
  if (signatureEdit === currentSource) throw new Error("signature validation probe no longer matches the source");
  writeFileSync(source, signatureEdit);
  currentSource = signatureEdit;
  const signatureDiagnostics = incremental();
  if (!signatureDiagnostics.some((diagnostic) => diagnostic.code === 2554 && diagnostic.file?.fileName.endsWith("/platform/shell/view.ts"))) {
    throw new Error("changed exported signature did not report the dependent call-site error");
  }
} finally {
  if (readFileSync(source, "utf8") === currentSource && currentSource !== original) {
    writeFileSync(source, original);
    const now = Date.now() / 1000;
    utimesSync(source, now, now);
  } else if (readFileSync(source, "utf8") !== original) {
    throw new Error("source changed by another writer; left it untouched");
  }
}

console.log(`edited compile ms: ${timings.map((time) => time.toFixed(0)).join(", ")}`);

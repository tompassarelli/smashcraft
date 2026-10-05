// Development hot reload (#36): compiles the map bundle and hands it to running
// clients through CustomMapData, then reports how long the change took to run
// in every client. Versions continue from the newest manifest on disk, so the
// tool and the match can each restart without losing track.
// Usage: bun scripts/hot.ts --data DIR [--data DIR ...] [--watch]
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { FILE_IO_ABILITY, PAYLOAD_FILE_BYTES, ackFile, errorFile, formatManifest, manifestFile, payloadFile, payloadKey } from "../src/runtime/hotFiles";
import { checksum } from "../src/runtime/payload";
import { mapCompiler, report } from "./compiler";
import { acknowledgementVersion, forEachHotClient, renameHotFile, runHotWatch, validateDataDirectories, writeHotFile } from "./hotEffects";
import { longBrackets } from "./lua";
import { keepSourceMap, toTypeScript } from "./sourceMaps";

const ACK_TIMEOUT_MS = 10_000;

const args = process.argv.slice(2);
const dataDirs = await Effect.runPromise(validateDataDirectories(
  args.flatMap((arg, i) => (arg === "--data" && args[i + 1] !== undefined ? [args[i + 1]!] : [])),
));

/** A Preload file whose execution stores one short line in the FileIO tooltip. */
function preloadFile(line: string): string {
  return `function PreloadFiles takes nothing returns nothing\ncall BlzSetAbilityTooltip('$wsl', "${line}", 0)\nendfunction\n`;
}

/**
 * A Preload file of raw Lua (Warcraft passes a usercode block through) that
 * stores the bytes verbatim in one tooltip, with no encoding to undo in game.
 */
function payloadPreloadFile(bytes: Uint8Array): Blob {
  const [open, close] = longBrackets(new TextDecoder().decode(bytes));
  // Lua drops the newline right after an opening long bracket.
  return new Blob([`//!beginusercode\nBlzSetAbilityTooltip(${FILE_IO_ABILITY}, ${open}\n`, bytes, `${close}, 0)\n//!endusercode\n`]);
}

/** Pieces of at most PAYLOAD_FILE_BYTES, cut before an ASCII byte so no character is split. */
function payloadPieces(bytes: Uint8Array): Uint8Array[] {
  const pieces: Uint8Array[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + PAYLOAD_FILE_BYTES, bytes.length);
    while (end < bytes.length && bytes[end]! >= 0x80) end--;
    pieces.push(bytes.subarray(start, end));
    start = end;
  }
  return pieces;
}

function latestVersion(dir: string): number {
  const versions = readdirSync(dir).map((name) => /^smashcraft-hot-manifest-(\d+)\.pld$/.exec(name)?.[1]);
  return Math.max(0, ...versions.filter((version) => version !== undefined).map(Number));
}

/** Payload files of other bundles than these; manifests stay, as the map relies on them. */
function removePayloadsExcept(dir: string, keep: readonly string[]): void {
  const kept = new Set(keep.map((key) => payloadFile(key, 0).replace(/-0\.pld$/, "")));
  for (const name of readdirSync(dir)) {
    const payload = /^(smashcraft-hot-\d+-\d+)-\d+\.pld$/.exec(name)?.[1];
    if (payload !== undefined && !kept.has(payload)) rmSync(join(dir, name));
  }
}

/** Written whole: a reader sees the old file or the new one. */
function writeAtomically(path: string, text: string) {
  return Effect.gen(function*() {
    yield* writeHotFile(`${path}.next`, text);
    yield* renameHotFile(`${path}.next`, path);
  });
}

const compile = mapCompiler("tsconfig.map.json");
let version = Math.max(...dataDirs.map(latestVersion));
// The previous payload stays until the next publish: a client may still be reading it.
let previousChecksum = "";

async function publish(): Promise<void> {
  const started = performance.now();
  const diagnostics = compile();
  if (diagnostics.length > 0) {
    console.error(report(diagnostics));
    return;
  }
  const compiled = performance.now();
  const bytes = new Uint8Array(await Bun.file("build/map.lua").arrayBuffer());
  const pieces = payloadPieces(bytes);
  const files = pieces.length;
  const payloadChecksum = checksum(bytes.length, (index) => bytes[index]!);
  keepSourceMap("build/map.lua", payloadKey(payloadChecksum));
  version++;
  await Effect.runPromise(forEachHotClient(dataDirs, (dir) => Effect.gen(function*() {
    for (const [index, piece] of pieces.entries()) yield* writeHotFile(join(dir, payloadFile(payloadChecksum, index)), payloadPreloadFile(piece));
    // The manifest follows the payload: a client that reads it can read every payload file.
    yield* writeAtomically(join(dir, manifestFile(version)), preloadFile(formatManifest({ version, files, checksum: payloadChecksum })));
    yield* Effect.sync(() => removePayloadsExcept(dir, [payloadChecksum, previousChecksum]));
  })));
  previousChecksum = payloadChecksum;
  const published = performance.now();
  const pending = new Set(dataDirs);
  while (pending.size > 0 && performance.now() - published < ACK_TIMEOUT_MS) {
    for (const dir of [...pending]) {
      for (const slot of [0, 1, 2, 3]) {
        const file = Bun.file(join(dir, ackFile(slot)));
        if ((await file.exists()) && (acknowledgementVersion(await file.text()) ?? 0) >= version) pending.delete(dir);
      }
    }
    await Bun.sleep(5);
  }
  const done = performance.now();
  const outcome = pending.size === 0 ? `running in ${dataDirs.length} client(s)` : `NOT acknowledged by ${[...pending].join(", ")}`;
  console.log(`v${version}: compile ${(compiled - started).toFixed(0)} ms, publish ${(published - compiled).toFixed(0)} ms (${bytes.length} bytes, ${files} files), ${outcome} after ${(done - published).toFixed(0)} ms; total ${(done - started).toFixed(0)} ms`);
}

// One publish at a time; edits during a publish start one more afterwards.
let running = false;
let again = false;
async function request(): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    do {
      again = false;
      await publish();
    } while (again);
  } finally {
    running = false;
  }
}

/** Prints each new in-game error report with TypeScript lines, and how long after the game wrote it. */
const seenErrors = new Map<string, string>();
async function checkErrors(announce: boolean): Promise<void> {
  for (const dir of dataDirs) {
    for (const slot of [0, 1, 2, 3]) {
      const path = join(dir, errorFile(slot));
      const file = Bun.file(path);
      if (!(await file.exists())) continue;
      const text = await file.text();
      if (seenErrors.get(path) === text) continue;
      seenErrors.set(path, text);
      if (!announce) continue;
      const lines = [...text.matchAll(/call Preload\( "(.*)" \)/g)].map((match) => match[1]!);
      const mapped = await toTypeScript(lines.slice(1).join("\n"));
      console.error(`p${slot} ${lines[0]} (${(Date.now() - file.lastModified).toFixed(0)} ms after the game wrote it)\n${mapped}`);
    }
  }
}

// Reports from before this tool started are old news.
await checkErrors(false);
await request();
if (!args.includes("--watch")) process.exit(0);
let debounce: ReturnType<typeof setTimeout> | undefined;
console.log("watching src/ for changes");
await Effect.runPromise(runHotWatch(() => {
  clearTimeout(debounce);
  debounce = setTimeout(() => void request().catch((cause: unknown) => console.error(cause)), 10);
}, () => void checkErrors(true).catch((cause: unknown) => console.error(cause))));
clearTimeout(debounce);

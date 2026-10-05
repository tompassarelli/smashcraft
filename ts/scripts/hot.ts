// Development hot reload (#36): compiles the map bundle and hands it to running
// clients through CustomMapData, then reports how long the change took to run
// in every client. Versions continue from the newest manifest on disk, so the
// tool and the match can each restart without losing track.
// Usage: bun scripts/hot.ts --data DIR [--data DIR ...] [--watch]
import { readdirSync, renameSync, rmSync, watch } from "node:fs";
import { join } from "node:path";
import { CHUNK_LENGTH, CHUNKS_PER_FILE, ackFile, chunkFile, errorFile, formatManifest, manifestFile, payloadKey } from "../src/runtime/hotFiles";
import { checksum, encodeBase64 } from "../src/runtime/payload";
import { mapCompiler, report } from "./compiler";
import { keepSourceMap, toTypeScript } from "./sourceMaps";

const ACK_TIMEOUT_MS = 10_000;

const args = process.argv.slice(2);
const dataDirs = args.flatMap((arg, i) => (arg === "--data" && args[i + 1] !== undefined ? [args[i + 1]!] : []));
if (dataDirs.length === 0) throw new Error("usage: bun scripts/hot.ts --data DIR [--data DIR ...] [--watch]");

/** A Preload file whose execution stores each chunk in a FileIO tooltip level. */
function preloadFile(chunks: readonly string[]): string {
  const lines = chunks.map((chunk, level) => `call BlzSetAbilityTooltip('$wsl', "${chunk}", ${level})`);
  return ["function PreloadFiles takes nothing returns nothing", ...lines, "endfunction", ""].join("\n");
}

function latestVersion(dir: string): number {
  const versions = readdirSync(dir).map((name) => /^smashcraft-hot-manifest-(\d+)\.pld$/.exec(name)?.[1]);
  return Math.max(0, ...versions.filter((version) => version !== undefined).map(Number));
}

/** Chunk files of other payloads than these; manifests stay, as the map relies on them. */
function removeChunksExcept(dir: string, keep: readonly string[]): void {
  const kept = new Set(keep.map((key) => chunkFile(key, 0).replace(/-0\.pld$/, "")));
  for (const name of readdirSync(dir)) {
    const payload = /^(smashcraft-hot-\d+-\d+)-\d+\.pld$/.exec(name)?.[1];
    if (payload !== undefined && !kept.has(payload)) rmSync(join(dir, name));
  }
}

/** Written whole: a reader sees the old file or the new one. */
async function writeAtomically(path: string, text: string): Promise<void> {
  await Bun.write(`${path}.next`, text);
  renameSync(`${path}.next`, path);
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
  const bytes = [...new Uint8Array(await Bun.file("build/map.lua").arrayBuffer())];
  const encoded = encodeBase64(bytes);
  const chunks = Array.from({ length: Math.ceil(encoded.length / CHUNK_LENGTH) }, (_, i) => encoded.slice(i * CHUNK_LENGTH, (i + 1) * CHUNK_LENGTH));
  const files = Math.ceil(chunks.length / CHUNKS_PER_FILE);
  const payloadChecksum = checksum(bytes);
  keepSourceMap("build/map.lua", payloadKey(payloadChecksum));
  version++;
  for (const dir of dataDirs) {
    for (let index = 0; index < files; index++) {
      await Bun.write(join(dir, chunkFile(payloadChecksum, index)), preloadFile(chunks.slice(index * CHUNKS_PER_FILE, (index + 1) * CHUNKS_PER_FILE)));
    }
    // The manifest follows the chunks: a client that reads it can read every chunk file.
    await writeAtomically(join(dir, manifestFile(version)), preloadFile([formatManifest({ version, files, checksum: payloadChecksum })]));
    removeChunksExcept(dir, [payloadChecksum, previousChecksum]);
  }
  previousChecksum = payloadChecksum;
  const published = performance.now();
  const pending = new Set(dataDirs);
  while (pending.size > 0 && performance.now() - published < ACK_TIMEOUT_MS) {
    for (const dir of [...pending]) {
      for (const slot of [0, 1, 2, 3]) {
        const file = Bun.file(join(dir, ackFile(slot)));
        if ((await file.exists()) && Number(/applied (\d+)/.exec(await file.text())?.[1]) >= version) pending.delete(dir);
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
  do {
    again = false;
    await publish();
  } while (again);
  running = false;
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
setInterval(() => void checkErrors(true), 50);
await request();
if (args.includes("--watch")) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  watch("src", { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => void request(), 10);
  });
  console.log("watching src/ for changes");
}

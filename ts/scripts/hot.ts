// Development hot reload (#36): compiles the map bundle and hands it to running
// clients through CustomMapData, then reports how long the change took to run
// in every client. Versions continue from the manifest already on disk, so the
// tool and the match can each restart without losing track.
// Usage: bun scripts/hot.ts --data DIR [--data DIR ...] [--watch]
import { readdirSync, renameSync, rmSync, watch } from "node:fs";
import { join } from "node:path";
import { CHUNK_LENGTH, CHUNKS_PER_FILE, MANIFEST_FILE, ackFile, chunkFile, formatManifest, parseManifest } from "../src/runtime/hotFiles";
import { checksum, encodeBase64 } from "../src/runtime/payload";
import { mapCompiler, report } from "./compiler";

const ACK_TIMEOUT_MS = 10_000;

const args = process.argv.slice(2);
const dataDirs = args.flatMap((arg, i) => (arg === "--data" && args[i + 1] !== undefined ? [args[i + 1]!] : []));
if (dataDirs.length === 0) throw new Error("usage: bun scripts/hot.ts --data DIR [--data DIR ...] [--watch]");

/** A Preload file whose execution stores each chunk in a FileIO tooltip level. */
function preloadFile(chunks: readonly string[]): string {
  const lines = chunks.map((chunk, level) => `call BlzSetAbilityTooltip('$wsl', "${chunk}", ${level})`);
  return ["function PreloadFiles takes nothing returns nothing", ...lines, "endfunction", ""].join("\n");
}

async function publishedVersion(dir: string): Promise<number> {
  const file = Bun.file(join(dir, MANIFEST_FILE));
  if (!(await file.exists())) return 0;
  const line = /BlzSetAbilityTooltip\('\$wsl', "([^"]*)", 0\)/.exec(await file.text());
  return (line === null ? undefined : parseManifest(line[1]!))?.version ?? 0;
}

/** Chunk files older than the previous version; a client may still be reading that one. */
function removeStaleChunks(dir: string, version: number): void {
  for (const name of readdirSync(dir)) {
    const match = /^smashcraft-hot-(\d+)-\d+\.pld$/.exec(name);
    if (match !== null && Number(match[1]) < version - 1) rmSync(join(dir, name));
  }
}

const compile = mapCompiler("tsconfig.map.json");
let version = Math.max(...(await Promise.all(dataDirs.map(publishedVersion))));

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
  version++;
  for (const dir of dataDirs) {
    for (let index = 0; index < files; index++) {
      await Bun.write(join(dir, chunkFile(version, index)), preloadFile(chunks.slice(index * CHUNKS_PER_FILE, (index + 1) * CHUNKS_PER_FILE)));
    }
    // The manifest goes last and whole: a client that reads it can read every chunk file.
    const manifest = join(dir, MANIFEST_FILE);
    await Bun.write(`${manifest}.next`, preloadFile([formatManifest({ version, files, checksum: checksum(bytes) })]));
    renameSync(`${manifest}.next`, manifest);
    removeStaleChunks(dir, version);
  }
  const published = performance.now();
  const pending = new Set(dataDirs);
  while (pending.size > 0 && performance.now() - published < ACK_TIMEOUT_MS) {
    for (const dir of [...pending]) {
      for (const slot of [0, 1, 2, 3]) {
        const file = Bun.file(join(dir, ackFile(slot)));
        if ((await file.exists()) && (await file.text()).includes(`applied ${version}"`)) pending.delete(dir);
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

await request();
if (args.includes("--watch")) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  watch("src", { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => void request(), 10);
  });
  console.log("watching src/ for changes");
}

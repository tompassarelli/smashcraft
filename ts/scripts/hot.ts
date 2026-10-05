// Development hot reload (#36): compiles the map bundle and hands it to running
// clients through CustomMapData, then reports how long the change took to run
// in every client. Start it before loading the map; it clears old payloads.
// Usage: bun scripts/hot.ts --data DIR [--data DIR ...] [--watch]
import { readdirSync, rmSync, watch } from "node:fs";
import { join } from "node:path";
import { CHUNK_LENGTH, CHUNKS_PER_FILE, ackFile, chunkFile, manifestFile } from "../src/runtime/hotFiles";
import { checksum, encodeBase64 } from "../src/runtime/payload";

const ACK_TIMEOUT_MS = 10_000;

const args = process.argv.slice(2);
const dataDirs = args.flatMap((arg, i) => (arg === "--data" && args[i + 1] !== undefined ? [args[i + 1]!] : []));
if (dataDirs.length === 0) throw new Error("usage: bun scripts/hot.ts --data DIR [--data DIR ...] [--watch]");

/** A Preload file whose execution stores each chunk in a FileIO tooltip level. */
function preloadFile(chunks: readonly string[]): string {
  const lines = chunks.map((chunk, level) => `call BlzSetAbilityTooltip('$wsl', "${chunk}", ${level})`);
  return ["function PreloadFiles takes nothing returns nothing", ...lines, "endfunction", ""].join("\n");
}

for (const dir of dataDirs) {
  for (const name of readdirSync(dir)) if (name.startsWith("smashcraft-hot-")) rmSync(join(dir, name));
}

let version = 0;

async function publish(): Promise<void> {
  const started = performance.now();
  const compile = Bun.spawnSync(["bun", "--bun", "node_modules/typescript-to-lua/dist/tstl.js", "-p", "tsconfig.map.json"], { stderr: "pipe" });
  if (compile.exitCode !== 0) {
    console.error(compile.stderr.toString());
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
  }
  // The manifest goes last: a client that sees it can read every chunk file.
  for (const dir of dataDirs) await Bun.write(join(dir, manifestFile(version)), preloadFile([`${version} ${files} ${checksum(bytes)}`]));
  const published = performance.now();
  const pending = new Set(dataDirs);
  while (pending.size > 0 && performance.now() - published < ACK_TIMEOUT_MS) {
    for (const dir of [...pending]) {
      for (const slot of [0, 1, 2, 3]) {
        const file = Bun.file(join(dir, ackFile(slot)));
        if ((await file.exists()) && (await file.text()).includes(`applied ${version}"`)) pending.delete(dir);
      }
    }
    await Bun.sleep(10);
  }
  const done = performance.now();
  const outcome = pending.size === 0 ? `running in ${dataDirs.length} client(s)` : `NOT acknowledged by ${[...pending].join(", ")}`;
  console.log(`v${version}: compile ${(compiled - started).toFixed(0)} ms, publish ${(published - compiled).toFixed(0)} ms (${bytes.length} bytes, ${files} files), ${outcome} after ${(done - published).toFixed(0)} ms; total ${(done - started).toFixed(0)} ms`);
}

await publish();
if (args.includes("--watch")) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  watch("src", { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => void publish(), 30);
  });
  console.log("watching src/ for changes");
}

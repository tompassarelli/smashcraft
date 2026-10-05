// Map script assembly and the fast rebuild for TypeScript changes (#36).
// build.sh packages assets and the Wurst script once and keeps that script next
// to the map as MAP.base.lua; a TypeScript change then only recompiles the
// bundle and replaces war3map.lua in a copy of the packaged map.
// Usage: bun scripts/map.ts compose BASE_LUA OUT_LUA [BUNDLE_LUA]   (build.sh)
//        bun scripts/map.ts rebuild MAP.w3x
import { copyFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { payloadKey } from "../src/runtime/hotFiles";
import { checksum } from "../src/runtime/payload";
import { keepSourceMap } from "./sourceMaps";

const packager = join(import.meta.dir, "../../build/tools/map-pack");

/** A Lua long string holding text verbatim; the newline after its opening bracket is dropped. */
function longString(text: string): string {
  let level = "";
  while (text.includes(`]${level}]`)) level += "=";
  return `[${level}[\n${text}]${level}]`;
}

/**
 * The base map's and Wurst's script, then the bundle, started after Wurst. The
 * bundle loads as chunk `map-KEY`, like hot reloads, so its error positions
 * are bundle lines that scripts/sourceMaps.ts maps to TypeScript.
 */
async function compose(base: string, bundlePath: string | undefined): Promise<string> {
  let typescript = "";
  if (bundlePath !== undefined) {
    const bytes = new Uint8Array(await Bun.file(bundlePath).arrayBuffer());
    const key = payloadKey(checksum([...bytes]));
    keepSourceMap(bundlePath, key);
    typescript = `\nsmashcraftTs = assert(load(${longString(new TextDecoder().decode(bytes))}, "=map-${key}"))()\n`;
  }
  return `${base}${typescript}
function main()
    baseMain()
    wurstMain()
    if smashcraftTs ~= nil then
        smashcraftTs.start()
    end
end

function config()
    wurstConfig()
end
`;
}

function pack(...args: string[]): void {
  const run = Bun.spawnSync([packager, ...args], { stderr: "inherit" });
  if (run.exitCode !== 0) throw new Error(`map-pack ${args[0]} failed for ${args[1]}`);
}

async function rebuild(map: string): Promise<void> {
  const started = performance.now();
  // Imported here so build.sh can compose without installed packages.
  const { transpileProject } = await import("typescript-to-lua");
  const result = transpileProject(join(import.meta.dir, "../tsconfig.map.json"));
  if (result.diagnostics.length > 0) {
    for (const diagnostic of result.diagnostics) console.error(diagnostic.messageText);
    process.exit(1);
  }
  const compiled = performance.now();
  const script = await compose(await Bun.file(`${map}.base.lua`).text(), join(import.meta.dir, "../build/map.lua"));
  const scriptPath = `${map}.lua`;
  await Bun.write(scriptPath, script);
  const next = `${map}.next`;
  copyFileSync(map, next);
  pack("replace", next, scriptPath);
  // Read the script back, as build.sh does, before the map replaces the old one.
  pack("extract", next, `${scriptPath}.verify`);
  if ((await Bun.file(`${scriptPath}.verify`).text()) !== script) throw new Error("packaged script differs from the composed one");
  renameSync(next, map);
  const done = performance.now();
  console.log(`rebuilt ${map}: compile ${(compiled - started).toFixed(0)} ms, package ${(done - compiled).toFixed(0)} ms, total ${(done - started).toFixed(0)} ms`);
}

const [command, ...rest] = process.argv.slice(2);
if (command === "compose" && rest.length >= 2) {
  const [basePath, outPath, bundlePath] = rest as [string, string, string | undefined];
  await Bun.write(outPath, await compose(await Bun.file(basePath).text(), bundlePath === "" ? undefined : bundlePath));
} else if (command === "rebuild" && rest.length === 1) {
  await rebuild(rest[0]!);
} else {
  throw new Error("usage: bun scripts/map.ts compose BASE_LUA OUT_LUA [BUNDLE_LUA] | rebuild MAP.w3x");
}

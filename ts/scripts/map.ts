// Map script assembly and the fast rebuild for TypeScript changes (#36).
// build.sh packages assets and the Wurst script once and keeps that script next
// to the map as MAP.base.lua; a TypeScript change then only recompiles the
// bundle and replaces war3map.lua in a copy of the packaged map.
// Usage: bun scripts/map.ts compose BASE_LUA OUT_LUA [BUNDLE_LUA]   (build.sh)
//        bun scripts/map.ts rebuild MAP.w3x
import { copyFileSync, renameSync } from "node:fs";
import { join } from "node:path";

const packager = join(import.meta.dir, "../../build/tools/map-pack");

/** The base map's and Wurst's script, then the bundle, started after Wurst. */
function compose(base: string, bundle: string | undefined): string {
  // A function wrapper keeps the bundle's trailing return inside it.
  const typescript = bundle === undefined ? "" : `\nsmashcraftTs = (function(...)\n${bundle}\nend)()\n`;
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
  const bundle = await Bun.file(join(import.meta.dir, "../build/map.lua")).text();
  const script = compose(await Bun.file(`${map}.base.lua`).text(), bundle);
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
  const bundle = bundlePath === undefined || bundlePath === "" ? undefined : await Bun.file(bundlePath).text();
  await Bun.write(outPath, compose(await Bun.file(basePath).text(), bundle));
} else if (command === "rebuild" && rest.length === 1) {
  await rebuild(rest[0]!);
} else {
  throw new Error("usage: bun scripts/map.ts compose BASE_LUA OUT_LUA [BUNDLE_LUA] | rebuild MAP.w3x");
}

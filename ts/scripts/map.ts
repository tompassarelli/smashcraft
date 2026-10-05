// Map files: script assembly for build.sh, the TypeScript-only build and the
// fast rebuild for TypeScript changes (#35, #36). A map built by build.sh or
// by `build` keeps its base script next to it as MAP.base.lua, so `rebuild`
// only recompiles the bundle and replaces war3map.lua in a copy of the map.
// Usage: bun scripts/map.ts compose BASE_LUA OUT_LUA [BUNDLE_LUA]   (build.sh)
//        bun scripts/map.ts build --base BASE.w3m --container MAP.w3x --assets DIR --summon DIR --name NAME --out OUT.w3x [--packager PATH]
//        bun scripts/map.ts rebuild MAP.w3x
import { composeScript, loadBundle } from "./mapScript";

const [command, ...rest] = process.argv.slice(2);
if (command === "compose" && (rest.length === 2 || rest.length === 3)) {
  const [basePath, outPath, bundlePath] = rest as [string, string, string | undefined];
  const bundle = bundlePath === undefined || bundlePath === "" ? undefined : loadBundle(bundlePath);
  await Bun.write(outPath, composeScript(await Bun.file(basePath).text(), bundle));
} else if ((command === "rebuild" && rest.length === 1) || command === "build") {
  // Imported here so build.sh can compose without the compiler and Effect.
  const { Effect } = await import("effect");
  const { buildTypescriptMap, decodeBuildOptions, rebuildMap, runMapCommand } = await import("./mapBuild");
  await runMapCommand(command === "rebuild" ? rebuildMap(rest[0]!) : decodeBuildOptions(rest).pipe(Effect.flatMap(buildTypescriptMap)));
} else {
  throw new Error("usage: bun scripts/map.ts compose BASE_LUA OUT_LUA [BUNDLE_LUA] | build --base ... --out OUT.w3x | rebuild MAP.w3x");
}

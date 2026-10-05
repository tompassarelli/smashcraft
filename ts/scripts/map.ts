// Map script assembly: the base script plus the TypeScript bundle.
// The packaged map commands are `waygate build` and `waygate rebuild`.
// Usage: bun scripts/map.ts compose BASE_LUA OUT_LUA BUNDLE_LUA
import { composeScript, loadBundle } from "waygate/scripts/mapScript";

const [command, ...rest] = process.argv.slice(2);
if (command !== "compose" || rest.length !== 3) throw new Error("usage: bun scripts/map.ts compose BASE_LUA OUT_LUA BUNDLE_LUA");
const [basePath, outPath, bundlePath] = rest as [string, string, string];
import { sourceMapDirectory } from "./waygate/project";
const bundle = loadBundle(bundlePath, sourceMapDirectory);
await Bun.write(outPath, composeScript(await Bun.file(basePath).text(), bundle, "smashcraftTs"));

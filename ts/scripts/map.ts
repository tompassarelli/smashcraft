// Map script assembly for build.sh: the base script plus the optional
// TypeScript bundle. Kept free of Effect and the compiler so build.sh can run
// it under any Bun; the map commands are `waygate build` and `waygate rebuild`.
// Usage: bun scripts/map.ts compose BASE_LUA OUT_LUA [BUNDLE_LUA]
import { composeScript, loadBundle } from "./mapScript";

const [command, ...rest] = process.argv.slice(2);
if (command !== "compose" || (rest.length !== 2 && rest.length !== 3)) throw new Error("usage: bun scripts/map.ts compose BASE_LUA OUT_LUA [BUNDLE_LUA]");
const [basePath, outPath, bundlePath] = rest as [string, string, string | undefined];
const bundle = bundlePath === undefined || bundlePath === "" ? undefined : loadBundle(bundlePath);
await Bun.write(outPath, composeScript(await Bun.file(basePath).text(), bundle));

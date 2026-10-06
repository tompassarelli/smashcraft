// Stamps a map bundle with its source version: the global SMASHCRAFT_SOURCE
// (smashcraft:ts/src/game/shell/sourceVersion.ts), set on the bundle's first
// line so every Lua line keeps its number for the source map.
import { join } from "node:path";
import type * as tstl from "typescript-to-lua";
import { sourceVersion } from "../scripts/sourceVersion";

const plugin = (): tstl.Plugin => ({
  beforeEmit(_program, _options, _host, result) {
    const stamp = `SMASHCRAFT_SOURCE = "${sourceVersion(join(import.meta.dir, ".."))}"; `;
    for (const file of result) file.code = stamp + file.code;
  },
});

export default plugin;

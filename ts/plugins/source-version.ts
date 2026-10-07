// Stamps a map bundle with its source version: the text of SOURCE_STAMP in
// smashcraft:ts/src/game/shell/sourceVersion.ts becomes the version, in the
// emitted bundle only. Wisp's incremental compiler runs beforeEmit on every
// compile, so the development map is stamped as the playable one is, and a
// full TypeScriptToLua compile gives the same bundle.
import { join } from "node:path";
import type * as tstl from "typescript-to-lua";
import { SOURCE_STAMP_TEXT, sourceVersion } from "../scripts/sourceVersion";

const plugin = (): tstl.Plugin => ({
  beforeEmit(_program, _options, _host, files) {
    const version = sourceVersion(join(import.meta.dir, ".."));
    for (const file of files) file.code = file.code.replaceAll(SOURCE_STAMP_TEXT, `"${version}"`);
  },
});

export default plugin;

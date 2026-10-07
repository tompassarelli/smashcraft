// viewer.lua for the client (smashcraft:client/src-tauri/src/mapsim.rs): the
// replay viewer's two modules compiled as the maps compile them, taken out of
// their bundle so the client can add them to any map's own modules. A chunk
// returning { [module name] = module function }; their `require` is the map's.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const VIEWER_MODULES = ["game.replay.viewer", "game.replay.viewerDriver"] as const;

/** The named modules' functions out of a TypeScriptToLua bundle, as a chunk returning them by name. */
export function viewerModules(bundle: string, names: readonly string[] = VIEWER_MODULES): string {
  const entries = names.map((name) => {
    const head = `\n["${name}"] = function(...)`;
    const start = bundle.indexOf(head);
    if (start < 0) throw new Error(`the bundle has no module ${name}`);
    const next = bundle.indexOf('\n["', start + head.length);
    const end = next < 0 ? bundle.indexOf("\n}\n", start) : next;
    return bundle.slice(start + 1, end).replace(/,\s*$/, "");
  });
  return `return {\n${entries.join(",\n")},\n}\n`;
}

/** Compiles the viewer driver as the maps compile code (tsconfig.viewer-lua.json) and returns viewer.lua's text. */
export function buildViewerLua(ts: string): string {
  const compiled = Bun.spawnSync([process.execPath, "--bun", join(ts, "node_modules/typescript-to-lua/dist/tstl.js"), "-p", join(ts, "tsconfig.viewer-lua.json")], { cwd: ts, stdout: "pipe", stderr: "pipe" });
  if (compiled.exitCode !== 0) throw new Error(`compiling the viewer for maps: ${compiled.stdout.toString()}${compiled.stderr.toString()}`);
  return viewerModules(readFileSync(join(ts, "build/viewer-lua/viewer.lua"), "utf8"));
}

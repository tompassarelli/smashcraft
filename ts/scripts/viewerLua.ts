



import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { ChildProcess } from "effect/process";
import { runProcess } from "./hostProcess";

const VIEWER_MODULES = ["game.replay.viewer", "game.replay.viewerDriver"] as const;


function viewerModules(bundle: string, names: readonly string[] = VIEWER_MODULES): string {
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


export const buildViewerLua = Effect.fn("buildViewerLua")(function*(ts: string) {
  yield* runProcess(ChildProcess.make(process.execPath, ["--bun", join(ts, "node_modules/typescript-to-lua/dist/tstl.js"), "-p", join(ts, "tsconfig.viewer-lua.json")], { cwd: ts }));
  return yield* Effect.try(() => viewerModules(readFileSync(join(ts, "build/viewer-lua/viewer.lua"), "utf8")));
});

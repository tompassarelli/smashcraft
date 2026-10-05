// Map script (war3map.lua) assembly. A map keeps the script it was built from
// next to it as MAP.base.lua: the base map's script and either Wurst's
// compiled script (build.sh) or the TypeScript map's config (scripts/build.ts).
// Composing appends the TypeScript bundle and the main() and config() that
// start them, so `scripts/map.ts rebuild` replaces only the bundle.
import { readFileSync } from "node:fs";
import { payloadKey } from "../src/runtime/hotFiles";
import { checksum } from "../src/runtime/payload";
import { longBrackets } from "./lua";
import { keepSourceMap } from "./sourceMaps";

export interface Bundle {
  readonly text: string;
  /** Payload key; the bundle loads as chunk `map-KEY`, like hot reloads, so scripts/sourceMaps.ts maps its errors. */
  readonly key: string;
}

/** Reads a compiled bundle and keeps its source map under its key. */
export function loadBundle(path: string): Bundle {
  const bytes = readFileSync(path);
  const key = payloadKey(checksum(bytes.length, (index) => bytes[index] ?? 0));
  keepSourceMap(path, key);
  return { text: new TextDecoder().decode(bytes), key };
}

function renameOnly(script: string, from: string, to: string): string {
  const declaration = new RegExp(`^function ${from}\\(\\)`, "gm");
  const count = script.match(declaration)?.length ?? 0;
  if (count !== 1) throw new Error(`base map script must define ${from}() once, not ${count} times`);
  return script.replace(declaration, `function ${to}()`);
}

/**
 * The base for a map whose only project code is TypeScript: the base map's
 * script with its main() and config() renamed, its melee initialization
 * suppressed, and the map's own config.
 */
export function typescriptBase(baseMapScript: string, mapConfig: string): string {
  const script = renameOnly(renameOnly(baseMapScript, "main", "baseMain"), "config", "baseConfig");
  const initialization = /^RunInitializationTriggers\(\)$/gm;
  const count = script.match(initialization)?.length ?? 0;
  if (count !== 1) throw new Error(`base map script must run its initialization triggers once, not ${count} times`);
  // The base map is a terrain fixture whose melee trigger would start a normal melee match.
  return `${script.replace(initialization, "-- Suppressed default melee initialization for the platform fighter.")}\n${mapConfig}`;
}

/** The base, then the bundle, started after the base map's and Wurst's initialization. */
export function composeScript(base: string, bundle: Bundle | undefined): string {
  const wurst = /^function wurstMain\(\)/m.test(base);
  if (!wurst && !/^function mapConfig\(\)/m.test(base)) throw new Error("base script defines neither Wurst's entry points nor mapConfig()");
  if (!wurst && bundle === undefined) throw new Error("a map without Wurst needs the TypeScript bundle");
  let typescript = "";
  if (bundle !== undefined) {
    const [open, close] = longBrackets(bundle.text);
    // Lua drops the newline right after an opening long bracket.
    typescript = `\nsmashcraftTs = assert(load(${open}\n${bundle.text}${close}, "=map-${bundle.key}"))()\n`;
  }
  return `${base}${typescript}
function main()
    baseMain()
${wurst ? "    wurstMain()\n" : ""}${bundle === undefined ? "" : "    smashcraftTs.start()\n"}end

function config()
    ${wurst ? "wurstConfig()" : "mapConfig()"}
end
`;
}

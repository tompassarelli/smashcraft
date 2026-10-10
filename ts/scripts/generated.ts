// Files generated from tracked sources instead of committed (#401). Each is
// rebuilt when a hash of its generator and every local module it imports
// changes; the hash is stamped under build/generated/. `bun install`, `bun run
// test` and `wisp map build` run this; `bun scripts/generated.ts` runs it by hand.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { MOVE_LIST_PATH, moveListMarkdown } from "./moveList";

const tsDirectory = resolve(import.meta.dir, "..");
const STAMPS = join(tsDirectory, "build/generated");

interface Generated { readonly name: string; readonly generator: string; readonly output: string; readonly produce: () => string }

export const GENERATED: readonly Generated[] = [
  { name: "move-list", generator: join(import.meta.dir, "moveList.ts"), output: MOVE_LIST_PATH, produce: moveListMarkdown },
];

const transpiler = new Bun.Transpiler({ loader: "ts" });

function resolveLocal(from: string, specifier: string): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = resolve(dirname(from), specifier);
  return [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((path) => statSync(path, { throwIfNoEntry: false })?.isFile() === true);
}

/** A hash of `entry` and every local module it reaches through its imports, by path and content. */
export function sourceHash(entry: string): string {
  const seen = new Set<string>();
  const queue = [entry];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    for (const { path } of transpiler.scanImports(readFileSync(file, "utf8"))) {
      const local = resolveLocal(file, path);
      if (local !== undefined && !seen.has(local)) queue.push(local);
    }
  }
  const hash = new Bun.CryptoHasher("sha256");
  for (const file of [...seen].sort()) hash.update(`${relative(tsDirectory, file)}\0`).update(readFileSync(file)).update("\n");
  return hash.digest("hex");
}

/** Regenerates every generated file whose inputs changed or whose output is missing; returns the names it wrote. */
export function ensureGenerated(): string[] {
  const written: string[] = [];
  for (const { name, generator, output, produce } of GENERATED) {
    const stamp = join(STAMPS, `${name}.sha256`);
    const hash = sourceHash(generator);
    if (existsSync(output) && existsSync(stamp) && readFileSync(stamp, "utf8").trim() === hash) continue;
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, produce());
    mkdirSync(STAMPS, { recursive: true });
    writeFileSync(stamp, `${hash}\n`);
    written.push(name);
  }
  return written;
}

if (import.meta.main) {
  const written = ensureGenerated();
  console.log(written.length === 0 ? "generated files are current" : `generated ${written.join(", ")}`);
}

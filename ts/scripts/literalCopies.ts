import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

export interface LiteralCopy { readonly file: string; readonly line: number; readonly constant: string; readonly value: string; }

const tunable = /^export const ([A-Z][A-Z0-9_]+)\s*(?::\s*number\s*)?=\s*(?:f32\()?(-?\d+(?:\.\d+)?)\)?;/gm;
const imports = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*"(\.[^"]+)"/g;
const expected = /assertEquals\([^;]*?,\s*(-?\d+(?:\.\d+)?)\s*(?:\)\s*;|,\s*["`])/g;
const isTest = (file: string): boolean => file.endsWith(".tests.ts") || file.startsWith("test/");
const trivial = (value: number): boolean => Number.isInteger(value) && Math.abs(value) < 10;

const generic = new Set(["frame", "frames", "test", "stage", "limit", "max", "min", "first", "last", "index", "ordinary"]);
const related = (name: string, line: string): boolean =>
  name.toLowerCase().split("_").some(word => word.length >= 4 && !generic.has(word) && line.toLowerCase().includes(word));

const echoes = (line: string, value: string): boolean =>
  [...line.slice(0, line.lastIndexOf(value)).matchAll(/(?<![\w.$])-?\d+(?:\.\d+)?(?![\w.])/g)].some(literal => Number(literal[0]) === Number(value));

function constants(text: string): Map<string, number> {
  const found = new Map<string, number>();
  for (const match of text.matchAll(tunable)) found.set(match[1] ?? "", Number(match[2]));
  return found;
}

export function literalCopies(sources: ReadonlyMap<string, string>): LiteralCopy[] {
  const copies: LiteralCopy[] = [];
  for (const [file, text] of sources) {
    if (!isTest(file)) continue;
    const visible = new Map<number, string[]>();
    for (const match of text.matchAll(imports)) {
      const module = sources.get(normalize(join(dirname(file), `${match[2]}.ts`)));
      if (module === undefined) continue;
      for (const [name, value] of constants(module)) {
        if (trivial(value)) continue;
        visible.set(value, [...(visible.get(value) ?? []), name]);
      }
    }
    if (visible.size === 0) continue;
    text.split("\n").forEach((line, index) => {
      for (const call of line.matchAll(expected)) {
        const names = visible.get(Number(call[1]));
        if (names === undefined || names.length !== 1 || names.some(name => line.includes(name)) || echoes(line, call[1] ?? "") || !names.some(name => related(name, line))) continue;
        copies.push({ file, line: index + 1, constant: names.join("|"), value: call[1] ?? "" });
      }
    });
  }
  return copies;
}

function readSources(root: string): Map<string, string> {
  const sources = new Map<string, string>();
  for (const pattern of ["src/**/*.ts", "test/**/*.ts"]) for (const file of new Glob(pattern).scanSync(root)) sources.set(file, readFileSync(join(root, file), "utf8"));
  return sources;
}

const report = (copy: LiteralCopy): string => `${copy.file}:${copy.line}: ${copy.value} restates ${copy.constant}`;

export function refuseLiteralCopies(root: string): void {
  const copies = literalCopies(readSources(root));
  if (copies.length === 0) return;
  console.error(`refused: ${copies.length} expectation${copies.length === 1 ? " restates a tunable constant" : "s restate tunable constants"}; read the constant instead (bun scripts/literalCopies.ts). Nothing ran.`);
  for (const copy of copies) console.error(report(copy));
  process.exit(1);
}

if (import.meta.main) {
  const copies = literalCopies(readSources(join(import.meta.dir, "..")));
  for (const copy of copies) console.log(report(copy));
  console.log(`${copies.length} literal copies of tunable constants`);
  process.exit(copies.length === 0 ? 0 : 1);
}

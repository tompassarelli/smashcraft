import { readFileSync, writeFileSync } from "node:fs";

export type Kind = "json" | "tsv" | "facts" | "markdown";
type Entry = { readonly key: string; readonly text: string };

const unique = (entries: ReadonlyArray<{ key: string; text: string }>): Entry[] => {
  const seen = new Map<string, number>();
  return entries.map(({ key, text }) => {
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    return { key: `${key}\u0000${n}`, text };
  });
};

const lines = (source: string): string[] => {
  const all = source.split("\n");
  if (all.at(-1) === "") all.pop();
  return all;
};

const parseLines = (kind: Exclude<Kind, "json">, source: string): Entry[] => {
  let section = "";
  return unique(lines(source).map((text, index) => {
    if (kind === "tsv") return { key: index === 0 ? "\u0001header" : text.split("\t")[0] ?? text, text };
    if (kind === "facts") {
      const name = /^\s*("(?:[^"\\]|\\.)*"):/.exec(text)?.[1];
      return { key: name !== undefined ? name : `\u0001${text}`, text };
    }
    if (/^#+ /.test(text)) section = text;
    const cell = /^\|([^|]*)\|/.exec(text)?.[1];
    return { key: `${section}\u0001${cell !== undefined && !/^\s*-+\s*$/.test(cell) ? cell.trim() : `\u0002${text}`}`, text };
  }));
};

const parseJson = (source: string): Entry[] => {
  const value: unknown = JSON.parse(source);
  if (value === null || value === undefined) throw new TypeError("mergeGenerated: JSON source is null");
  return Object.entries(value).map(([key, entry]) => ({ key, text: JSON.stringify(entry) }));
};

type Merged = { readonly key: string; readonly text: string }
  | { readonly key: string; readonly conflict: readonly [string | undefined, string | undefined] };

export const mergeEntries = (base: Entry[], ours: Entry[], theirs: Entry[]): Merged[] => {
  const b = new Map(base.map((e) => [e.key, e.text]));
  const o = new Map(ours.map((e) => [e.key, e.text]));
  const t = new Map(theirs.map((e) => [e.key, e.text]));
  const order = ours.map((e) => e.key);
  theirs.forEach((e, i) => {
    if (o.has(e.key) || b.has(e.key)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const prior = theirs[j];
      if (prior === undefined) throw new RangeError(`mergeEntries: no theirs entry ${j}`);
      const found = order.indexOf(prior.key);
      if (found >= 0) { at = found + 1; break; }
    }
    order.splice(at, 0, e.key);
  });
  const merged: Merged[] = [];
  for (const key of order) {
    const [bv, ov, tv] = [b.get(key), o.get(key), t.get(key)];
    const text = ov === tv ? ov : ov === bv ? tv : tv === bv ? ov : null;
    if (text === null) merged.push({ key, conflict: [ov, tv] });
    else if (text !== undefined) merged.push({ key, text });
  }
  return merged;
};

const renderConflict = (ours: string[], theirs: string[]): string[] =>
  ["<<<<<<< ours", ...ours, "=======", ...theirs, ">>>>>>> theirs"];

export const merge = (kind: Kind, base: string, ours: string, theirs: string): { text: string; conflicts: number } => {
  const parse = kind === "json" ? parseJson : (s: string) => parseLines(kind, s);
  const merged = mergeEntries(parse(base), parse(ours), parse(theirs));
  const conflicts = merged.filter((m) => "conflict" in m).length;
  if (kind !== "json") {
    const out = merged.flatMap((m) => "conflict" in m
      ? renderConflict(m.conflict[0] === undefined ? [] : [m.conflict[0]], m.conflict[1] === undefined ? [] : [m.conflict[1]])
      : [m.text]);
    return { text: `${out.join("\n")}\n`, conflicts };
  }
  const field = (key: string, value: string, last: boolean) =>
    `  ${JSON.stringify(key)}: ${JSON.stringify(JSON.parse(value), null, 2).replace(/\n/g, "\n  ")}${last ? "" : ","}`;
  const out = merged.flatMap((m, i) => {
    const last = i === merged.length - 1;
    if (!("conflict" in m)) return [field(m.key, m.text, last)];
    const side = (v: string | undefined) => (v === undefined ? [] : [field(m.key, v, last)]);
    return renderConflict(side(m.conflict[0]), side(m.conflict[1]));
  });
  return { text: merged.length === 0 ? "{}\n" : `{\n${out.join("\n")}\n}\n`, conflicts };
};

export const kindOf = (path: string): Kind | undefined =>
  path.endsWith(".json") ? "json"
  : path.endsWith(".tsv") ? "tsv"
  : path.endsWith("modelFacts.ts") ? "facts"
  : path.endsWith(".md") ? "markdown"
  : undefined;

if (import.meta.main) {
  const [basePath, oursPath, theirsPath, path] = process.argv.slice(2);
  const kind = kindOf(path ?? "");
  if (!basePath || !oursPath || !theirsPath || !kind) {
    console.error("usage: bun scripts/mergeGenerated.ts BASE OURS THEIRS PATH (PATH a .json, .tsv, modelFacts.ts or .md)");
    process.exit(2);
  }
  const read = (p: string) => readFileSync(p, "utf8");
  const { text, conflicts } = merge(kind, read(basePath), read(oursPath), read(theirsPath));
  writeFileSync(oursPath, text);
  if (conflicts > 0) console.error(`mergeGenerated: ${conflicts} entries of ${path} changed differently on both sides`);
  process.exit(conflicts > 0 ? 1 : 0);
}

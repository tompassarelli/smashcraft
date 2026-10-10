


import { existsSync, readFileSync, writeFileSync } from "node:fs";


export const GROWTH = 0.1;

const CRYPT = (() => {
  const table = new Uint32Array(0x500);
  let seed = 0x00100001;
  for (let i = 0; i < 0x100; i++) {
    for (let j = i; j < 0x500; j += 0x100) {
      seed = (seed * 125 + 3) % 0x2aaaab;
      const high = (seed & 0xffff) << 16;
      seed = (seed * 125 + 3) % 0x2aaaab;
      table[j] = (high | (seed & 0xffff)) >>> 0;
    }
  }
  return table;
})();

function hashString(name: string, type: number): number {
  let seed1 = 0x7fed7fed;
  let seed2 = 0xeeeeeeee;
  for (const char of name.toUpperCase().replaceAll("/", "\\")) {
    const ch = char.charCodeAt(0);
    seed1 = ((CRYPT[type * 0x100 + ch] ?? 0) ^ ((seed1 + seed2) >>> 0)) >>> 0;
    seed2 = (ch + seed1 + seed2 + (seed2 << 5) + 3) >>> 0;
  }
  return seed1;
}

function decrypt(words: Uint32Array, key: number): void {
  let seed = 0xeeeeeeee;
  for (let i = 0; i < words.length; i++) {
    seed = (seed + (CRYPT[0x400 + (key & 0xff)] ?? 0)) >>> 0;
    const value = ((words[i] ?? 0) ^ ((key + seed) >>> 0)) >>> 0;
    words[i] = value;
    key = ((((~key << 0x15) >>> 0) + 0x11111111) | (key >>> 0x0b)) >>> 0;
    seed = (value + seed + (seed << 5) + 3) >>> 0;
  }
}

export interface ArchiveTables {

  readonly offset: number;
  readonly hashes: Uint32Array;
  readonly blocks: Uint32Array;
}


export function readTables(read: (start: number, length: number) => Uint8Array, fileSize: number): ArchiveTables {
  for (let offset = 0; offset + 32 <= fileSize; offset += 512) {
    const header = new DataView(read(offset, 32).slice().buffer);
    if (header.getUint32(0, true) !== 0x1a51504d) continue;
    const table = (start: number, entries: number, key: string) => {
      const words = new Uint32Array(read(offset + start, entries * 16).slice().buffer);
      decrypt(words, hashString(key, 3));
      return words;
    };
    return {
      offset,
      hashes: table(header.getUint32(16, true), header.getUint32(24, true), "(hash table)"),
      blocks: table(header.getUint32(20, true), header.getUint32(28, true), "(block table)"),
    };
  }
  throw new Error("no MPQ archive header");
}


export function storedBytes(tables: ArchiveTables, name: string): number | undefined {
  const size = tables.hashes.length / 4;
  const a = hashString(name, 1);
  const b = hashString(name, 2);
  const start = hashString(name, 0) % size;
  for (let probe = 0; probe < size; probe++) {
    const slot = ((start + probe) % size) * 4;
    const block = tables.hashes[slot + 3] ?? 0xffffffff;
    if (block === 0xffffffff) return undefined;
    if (tables.hashes[slot] === a && tables.hashes[slot + 1] === b && block !== 0xfffffffe) return tables.blocks[block * 4 + 1];
  }
  return undefined;
}

export interface MapSize {
  readonly total: number;

  readonly imports: ReadonlyMap<string, number>;
}

export const importedBytes = (size: MapSize) => [...size.imports.values()].reduce((sum, bytes) => sum + bytes, 0);

const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;


export function definitiveBodyBytes(size: MapSize): number {
  let bytes = 0;
  for (const [entry, stored] of size.imports) {
    if (/^_(de|hd)\.w3mod\\war3mapImported\\[^\\]+TimelineBody-[^\\]+\.mdx$/i.test(entry.replaceAll("/", "\\"))) bytes += stored;
  }
  return bytes;
}

export function mapBudgetProblem(size: MapSize): string | undefined {
  if (size.total > 120_000_000) return `the map is ${size.total} bytes, over its 120000000-byte download budget (#334)`;
  const bodies = definitiveBodyBytes(size);
  if (bodies > 60_000_000) return `Definitive fighter bodies occupy ${bodies} compressed bytes, over their 60000000-byte budget (#334)`;
  return undefined;
}

export function describeMapSize(size: MapSize): string {
  const imported = importedBytes(size);
  return `map ${mb(size.total)}, imports ${mb(imported)} (${((100 * imported) / size.total).toFixed(0)}%) in ${size.imports.size} files`;
}


export const largest = (imports: ReadonlyMap<string, number>, count: number) =>
  [...imports].sort(([, a], [, b]) => b - a).slice(0, count);

const HEADER = "entry\tbytes";
/** The map's bytes outside its imports (script, terrain, object data), rounded up to a whole MB so two lanes
 * that grow it slightly write the same row; the total is the imports' sum plus this row, so no row changes
 * with every import (#401). */
const OUTSIDE = "(outside imports)";
const OUTSIDE_STEP = 1_000_000;

export function readMapBaseline(path: string): MapSize | undefined {
  if (!existsSync(path)) return undefined;
  const imports = new Map<string, number>();
  let total = 0;
  for (const line of readFileSync(path, "utf8").split("\n").slice(1)) {
    const [entry, bytes] = line.split("\t");
    if (entry === undefined || entry === "" || bytes === undefined) continue;
    total += Number(bytes);
    if (entry !== OUTSIDE) imports.set(entry, Number(bytes));
  }
  return { total, imports };
}

export function writeMapBaseline(path: string, size: MapSize): void {
  const rows = [...size.imports].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([entry, bytes]) => `${entry}\t${bytes}`);
  const outside = Math.ceil(Math.max(0, size.total - importedBytes(size)) / OUTSIDE_STEP) * OUTSIDE_STEP;
  writeFileSync(path, `${[HEADER, `${OUTSIDE}\t${outside}`, ...rows].join("\n")}\n`);
}


export function mapGrowthProblem(size: MapSize, baseline: MapSize): string | undefined {
  const limit = baseline.total * (1 + GROWTH);
  if (size.total <= limit) return undefined;
  const grown = new Map<string, number>();
  for (const [entry, bytes] of size.imports) {
    const added = bytes - (baseline.imports.get(entry) ?? 0);
    if (added > 0) grown.set(entry, added);
  }
  const named = largest(grown, 5).map(([entry, bytes]) => `${entry} +${mb(bytes)}`).join(", ");
  return `the map is ${mb(size.total)}, more than ${GROWTH * 100}% over its ${mb(baseline.total)} baseline; ` +
    `largest new imports: ${named === "" ? "none (the growth is outside the imports)" : named}. ` +
    "Prefer Warcraft's own assets; if the import is needed, say its size and why stock can't do it in the commit, " +
    "then rebuild with MAP_SIZE_UPDATE=1 and commit ts/map-size-baseline.tsv (bun wisp help map)";
}

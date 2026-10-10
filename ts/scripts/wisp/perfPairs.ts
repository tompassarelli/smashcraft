// Each census run plays one fighter against the standing partner; its pair's worst frame is the highest
// p0 Lua instruction count and the highest allocation over the frames its moves play after the first,
// whose start-up frames vary from run to run (#405).
export interface PairWorst {
  readonly pair: string;
  readonly instructions: number;
  readonly allocatedKb: number;
}

// Five farm census runs of all 26 pairs (2026-10-10) gave identical worst-frame instructions and
// allocation within 6.98% (kael'thas 31.5-33.7 KB); the fixture holds each pair's maximum and 10%
// clears that spread with headroom (#405).
export const PAIR_MARGIN = 0.1;

const LINE = /^pair\t([^\t]+)\tinstructions=(\d+)\talloc-kb=(\d+(?:\.\d+)?)$/;

export const pairText = (pairs: readonly PairWorst[]): string =>
  `${pairs.map(({ pair, instructions, allocatedKb }) => `pair\t${pair}\tinstructions=${instructions}\talloc-kb=${allocatedKb.toFixed(1)}`).join("\n")}\n`;

export const isPairText = (text: string): boolean => text.startsWith("pair\t");

export function parsePairs(text: string): PairWorst[] {
  return text.split(/\r?\n/).filter((line) => line !== "").map((line) => {
    const match = LINE.exec(line);
    if (match === null) throw new Error(`not a census pair line: ${line}`);
    return { pair: match[1] ?? "", instructions: Number(match[2]), allocatedKb: Number(match[3]) };
  });
}

// Names every pair of `run` whose worst frame rises more than `margin` over the fixture's, and every
// pair the fixture lacks; pairs the run did not measure are not judged.
export function comparePairs(fixture: readonly PairWorst[], run: readonly PairWorst[], margin = PAIR_MARGIN): string[] {
  const known = new Map(fixture.map((row) => [row.pair, row]));
  const percent = (before: number, after: number) => (before === 0 ? "new" : `+${((after / before - 1) * 100).toFixed(1)}%`);
  return run.flatMap((row) => {
    const before = known.get(row.pair);
    if (before === undefined) return [`${row.pair} has no fixture row`];
    const problems: string[] = [];
    if (row.instructions > before.instructions * (1 + margin)) problems.push(`${row.pair} worst-frame instructions ${before.instructions} -> ${row.instructions} (${percent(before.instructions, row.instructions)})`);
    if (row.allocatedKb > before.allocatedKb * (1 + margin)) problems.push(`${row.pair} worst-frame allocation ${before.allocatedKb.toFixed(1)} -> ${row.allocatedKb.toFixed(1)} KB (${percent(before.allocatedKb, row.allocatedKb)})`);
    return problems;
  });
}

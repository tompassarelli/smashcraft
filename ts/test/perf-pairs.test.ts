import { expect, test } from "bun:test";
import { PAIR_MARGIN, type PairWorst, comparePairs, pairText, parsePairs } from "../scripts/wisp/perfPairs";
import { censusPairs } from "../scripts/wisp/perfCensus";

const fixture: PairWorst[] = Array.from({ length: 26 }, (_, index) => ({ pair: `fighter-${index} vs rifleman`, instructions: 400_000 + index * 37_123, allocatedKb: 100 + index * 13.7 }));

test("perf compare fails naming exactly the fighter pair whose worst frame rises past the margin, and passes within it [spec #405]", () => {
  const stored = parsePairs(pairText(fixture));
  expect(comparePairs(stored, stored)).toEqual([]);
  for (const [index, row] of stored.entries()) {
    for (const field of ["instructions", "allocatedKb"] as const) {
      const raised = (share: number) => stored.map((other, at) => (at === index ? { ...other, [field]: other[field] * (1 + share) } : other));
      expect(comparePairs(stored, raised(PAIR_MARGIN))).toEqual([]);
      const over = comparePairs(stored, raised(PAIR_MARGIN + 0.001));
      expect(over).toHaveLength(1);
      expect(over[0]).toStartWith(`${row.pair} worst-frame`);
    }
  }
});

test("a census frame whose collector freed more than it allocated still yields the pair's worst frame [repro #405]", () => {
  // Thrall's census on 2026-10-10 failed with "no sample of frame 8376" on this line.
  const output = [
    "census\tthrall\tjab\t1\t2\t3\t5",
    "census\tthrall\tside special\t6\t7\t8\t10",
    ...[1, 2, 3, 4, 5, 6, 7, 8, 10].map((frame) => `frame ${frame} p0 instructions=${116_000 + frame} lua-us=5000 natives=150 alloc-bytes=${7_000 + frame * 100} typed=0`),
    "frame 9 p0 instructions=117100 lua-us=5371 natives=150 alloc-bytes=-4187088 typed=0",
  ].join("\n");
  expect(censusPairs(output)).toEqual([{ pair: "thrall vs rifleman", instructions: 117_100, allocatedKb: 8_000 / 1024 }]);
});

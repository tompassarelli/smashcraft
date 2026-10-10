import { expect, test } from "bun:test";
import { PAIR_MARGIN, type PairWorst, comparePairs, pairText, parsePairs } from "./perfPairs";
import { censusPairs } from "./perfCensus";

const fixture: PairWorst[] = Array.from({ length: 26 }, (_, index) => ({ pair: `fighter-${index} vs rifleman`, instructions: 400_000 + index * 37_123, allocatedKb: 100 + index * 13.7 }));

test("perf compare fails naming exactly the fighter pair whose worst frame rises past the margin, and passes within it [k3 measure #405]", () => {
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

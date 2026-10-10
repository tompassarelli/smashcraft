import { expect, test } from "bun:test";
import { checkMemory, parseMemoryRun } from "../scripts/wisp/memorySoak";

// A synthetic soak: one match a minute for 30 minutes, every third match back at fighter selection.
function soak(heapKb: (match: number) => number, effects: (match: number) => number): string {
  const lines: string[] = [];
  for (let match = 1; match <= 30; match++) {
    const frame = match * 3600;
    const client = `p0 tables=100 functions=50 live=effect=${effects(match)},timer=4`;
    lines.push(`sample kind=match match=${match} frame=${frame} heap-kb=${heapKb(match)} | ${client}`);
    if (match % 3 === 0) lines.push(`sample kind=menu frame=${frame + 600} heap-kb=${heapKb(match)} | ${client}`);
  }
  lines.push("done frames=110000 matches=30 problems=0");
  return lines.join("\n");
}

test("the soak's slope test passes a flat heap and handle count and names what grows after each match [spec #168]", () => {
  const flat = checkMemory(parseMemoryRun(soak((match) => 9000 + (match % 4), (match) => 12 + (match % 3))));
  expect(flat.failures).toEqual([]);
  expect(flat.lines.join("\n")).toContain("live handles after each match");

  const heap = checkMemory(parseMemoryRun(soak((match) => 9000 + 2 * match, () => 12)));
  expect(heap.failures.some((failure) => failure.includes("KB per match"))).toBe(true);

  // One effect left alive every ten matches.
  const effect = checkMemory(parseMemoryRun(soak(() => 9000, (match) => 12 + Math.floor(match / 10))));
  expect(effect.failures.some((failure) => failure.startsWith("p0 live effect grows"))).toBe(true);
});

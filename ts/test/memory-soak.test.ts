import { expect, test } from "bun:test";
import { checkMemory, parseMemoryRun, slope } from "../scripts/wisp/memorySoak";

const MINUTE = 3600;


function output(minutes: number, heapKb: (minute: number) => number, effects: (minute: number) => number, problems: readonly string[] = []): string {
  const lines: string[] = [];
  for (let minute = 1; minute <= minutes; minute += 2) {
    const client = (slot: number) => `p${slot} tables=17843 functions=2294 entries=181593 string-bytes=164482 live=effect=${effects(minute)},framehandle=956,timer=2 top=__smashcraftShell:7000 models=`;
    lines.push(`sample kind=minute minute=${minute} frame=${minute * MINUTE} matches=0 heap-kb=${heapKb(minute) + 900} | ${client(0)} | ${client(1)}`);
    lines.push(`sample kind=menu lineup=${minute} frame=${minute * MINUTE + 100} matches=${minute} heap-kb=${heapKb(minute)} | ${client(0)} | ${client(1)}`);
  }
  for (const problem of problems) lines.push(`problem ${problem}`);
  lines.push(`done frames=${minutes * MINUTE} matches=${minutes} problems=${problems.length}`);
  return lines.join("\n");
}

test("slope is the least-squares slope [invariant]", () => {
  expect(slope([[0, 1], [1, 3], [2, 5]])).toBeCloseTo(2);
  expect(slope([[0, 4], [1, 4], [2, 4]])).toBe(0);
  expect(slope([[1, 4]])).toBe(0);
});

test("a heap and handle counts that only fill pools during warm-up pass [spec #168]", () => {

  const run = parseMemoryRun(output(30, (minute) => (minute < 10 ? 38000 + minute * 300 : 41000 + ((minute * 37) % 200)), (minute) => (minute < 10 ? 460 + minute : 469)));
  expect(run.samples.filter((sample) => sample.kind === "menu")).toHaveLength(15);
  expect(run.samples[1]?.clients[1]?.live.effect).toBe(461);
  const verdict = checkMemory(run);
  expect(verdict.failures).toEqual([]);
  expect(verdict.lines.join("\n")).toContain("effect 469");
});

test("a heap growing 1 MB per 10 minutes after warm-up fails [spec #168]", () => {
  const verdict = checkMemory(parseMemoryRun(output(30, (minute) => 38000 + minute * 103, () => 469)));
  expect(verdict.failures).toEqual([expect.stringContaining("Lua heap grows")]);
});

test("effects left behind by each match fail, whatever the heap does [spec #168]", () => {
  const verdict = checkMemory(parseMemoryRun(output(30, () => 40000, (minute) => 460 + Math.floor(minute / 4))));
  expect(verdict.failures).toEqual([
    "p0 effect at fighter selection rose from 462 during warm-up to 467 after",
    "p1 effect at fighter selection rose from 462 during warm-up to 467 after",
  ]);
});

test("one extra retained map table still fails the strict warm-up high-water gate [spec #168]", () => {
  const text = output(30, () => 40000, () => 469).split("\n").map((line) => {
    const frame = Number(/frame=(\d+)/.exec(line)?.[1]);
    return frame >= 10 * MINUTE ? line.replaceAll("tables=17843", "tables=17844") : line;
  }).join("\n");
  expect(checkMemory(parseMemoryRun(text)).failures).toEqual([
    "p0 tables at fighter selection rose from 17843 during warm-up to 17844 after",
    "p1 tables at fighter selection rose from 17843 during warm-up to 17844 after",
  ]);
});


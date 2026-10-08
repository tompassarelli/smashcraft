import { expect, test } from "bun:test";
import { censusEntries } from "../scripts/wisp/perfCensus";

test("combined census runs retain their own samples when frame numbers repeat [repro #168]", () => {
  const first = [
    "census\tarcher\tjab\t1\t1\t2\t2",
    "frame 1 p0 instructions=100 lua-us=1 natives=0 alloc-bytes=0 typed=0",
    "frame 2 p0 instructions=200 lua-us=1 natives=0 alloc-bytes=0 typed=0",
  ].join("\n");
  const second = [
    "census\tstage\t11\t1\t1\t2\t2",
    "frame 1 p0 instructions=1000 lua-us=1 natives=0 alloc-bytes=0 typed=0",
    "frame 2 p0 instructions=4000 lua-us=1 natives=0 alloc-bytes=0 typed=0",
  ].join("\n");
  expect(censusEntries(`${first}\n${second}`)).toEqual([...censusEntries(first), ...censusEntries(second)]);
  expect(censusEntries(`${first}\n${second}`).map(entry => entry.instructions)).toEqual([100, 3000]);
});

import { expect, test } from "bun:test";
import { suiteProblems } from "wisp/scripts/wisp/accept";
import { SMASHCRAFT_ACCEPT } from "../scripts/wisp/acceptChecks";
import { acceptForClients } from "../scripts/wisp/commands/accept";

test("Smashcraft's declared native checks name known maps, clients and readings", () => {
  expect(suiteProblems(SMASHCRAFT_ACCEPT, ["a", "b"])).toEqual([]);
  expect(SMASHCRAFT_ACCEPT.checks.map(({ closes }) => closes.split(" ")[0])).toContain("smashcraft#57");
});

test("all declared native checks target the selected offline pair's player positions", () => {
  const suite = acceptForClients(SMASHCRAFT_ACCEPT, ["lan1a", "lan1b"]);
  expect(suiteProblems(suite, ["lan1a", "lan1b"])).toEqual([]);
  const outfits = suite.checks.find(({ id }) => id.startsWith("161-"));
  expect(outfits?.capture?.map(capture => capture.client)).toEqual(["lan1a", "lan1b"]);
  expect(SMASHCRAFT_ACCEPT.checks.find(({ id }) => id.startsWith("161-"))?.capture?.map(capture => capture.client)).toEqual(["a", "b"]);
});

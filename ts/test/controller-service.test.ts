// The always-on controller service as play and `bun wisp controller` see it:
// its status file, whether it serves a game, and the launcher link the login
// unit runs. The service itself is tested in smashcraft:companion/tests/service.rs.
import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { awaitService, parseStatus, pointLauncher, servesGame } from "../scripts/wisp/controllerService";

const scratch = mkdtempSync(join(tmpdir(), "smashcraft-controller-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const SERVING = "service_pid=10\nprofile=smashcraft\nstate=serving\ngame_pid=2852\nsession=playable-0047/s0/3\nsession_summary=Smashcraft playable-0047, player 1, fighter selection\nhelper_pid=11\n";

test("the service serves a game once its helper is ready for that game's session of the build", () => {
  const status = parseStatus(SERVING);
  expect(status.session_summary).toBe("Smashcraft playable-0047, player 1, fighter selection");
  expect(servesGame(status, 2852, "playable-0047")).toBe(true);
  expect(servesGame(status, 2853, "playable-0047")).toBe(false);
  expect(servesGame(status, 2852, "playable-0048")).toBe(false);
  // A build whose name another starts with is another build.
  expect(servesGame(status, 2852, "playable-004")).toBe(false);
  expect(servesGame(parseStatus(SERVING.replace("state=serving", "state=starting")), 2852, "playable-0047")).toBe(false);
});

test("play waits on the status file until the service serves its game", async () => {
  const file = join(scratch, "status.txt");
  writeFileSync(file, SERVING);
  expect(await Effect.runPromise(awaitService(2852, "playable-0047", "the login unit", file))).toBe("ready for Warcraft III (pid 2852) through the login unit");
});

test("the launcher link moves to a new helper and reports whether it changed", () => {
  const launcher = join(scratch, "controller/wc3-journal");
  expect(pointLauncher("/helpers/a/wc3-journal", launcher)).toBe(true);
  expect(pointLauncher("/helpers/a/wc3-journal", launcher)).toBe(false);
  expect(pointLauncher("/helpers/b/wc3-journal", launcher)).toBe(true);
  expect(readlinkSync(launcher)).toBe("/helpers/b/wc3-journal");
});

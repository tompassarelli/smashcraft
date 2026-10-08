import { expect, test } from "bun:test";
import { suiteProblems } from "wisp/scripts/wisp/accept";
import { SMASHCRAFT_ACCEPT } from "../scripts/wisp/acceptChecks";

test("Smashcraft's declared native checks name known maps, clients and readings [spec wisp:docs/accept.md]", () => {
  expect(suiteProblems(SMASHCRAFT_ACCEPT, ["a", "b"])).toEqual([]);
});

test("an accept shard that exits nonzero fails with its exit code instead of passing silently [repro #240]", async () => {
  const { Effect } = await import("effect");
  const { runShard } = await import("../scripts/wisp/commands/accept");
  const { mkdtempSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const directory = join(mkdtempSync(join(tmpdir(), "accept-shard-")), "shard-0");
  const { rmSync } = await import("node:fs");
  const { dirname } = await import("node:path");
  try {
    // No pool lists pair 999999, so the shard's own run stops before touching any client.
    const failure = await Effect.runPromise(Effect.flip(runShard("999999", ["no-such-check"], directory)));
    expect(failure.message).toMatch(/exited [1-9]/);
    expect((await Bun.file(`${directory}.err`).text()).trim()).not.toBe("");
  } finally {
    rmSync(dirname(directory), { recursive: true, force: true });
  }
}, 30000);

test("accept's smoke capture stops the batch on a one-fighter solo quick match, naming the failed condition [repro #287]", async () => {
  const { Effect } = await import("effect");
  const { AcceptDriver, AcceptFailure } = await import("wisp/scripts/wisp/accept");
  const { writtenPreloadFile } = await import("wisp/scripts/wisp/headlessInput");
  const { smokeProblem, withSmokeCapture } = await import("../scripts/wisp/commands/accept");
  const quick = (humanFighters: number, computers: number, phase = 2) => ({
    name: "smashcraft-dev-playable-0042-p0.txt", modified: 10,
    text: writtenPreloadFile([
      "SMASHCRAFT DEV v=1 build=playable-0042 receipt=4 epoch=2 rb=12 delay=0 batch=1 rematchSeconds=5 ",
      `SETUP phase=${phase} human-fighters=${humanFighters} computers=${computers} characters=0,1,2,0 stocks=3 minutes=7 automatic-rematch=0 stage=2 `,
    ]),
  });
  const drawn = { width: 4, height: 1, rgb: Uint8Array.from([0, 0, 0, 200, 180, 90, 30, 60, 90, 255, 255, 255]) };
  const flat = { width: 4, height: 1, rgb: new Uint8Array(12) };
  const replay = { name: "smashcraft-replay-7.txt", modified: 20, text: "" };
  expect(await Effect.runPromise(smokeProblem(drawn, [quick(1, 2)], 0))).toBeUndefined();
  expect(await Effect.runPromise(smokeProblem(drawn, [quick(1, 0)], 0))).toBe("two fighters present: the match has 1 fighter");
  expect(await Effect.runPromise(smokeProblem(drawn, [quick(1, 2, 0)], 0))).toStartWith("match still running");
  expect(await Effect.runPromise(smokeProblem(drawn, [quick(1, 2), replay], 0))).toStartWith("match still running");
  expect(await Effect.runPromise(smokeProblem(flat, [quick(1, 2)], 0))).toStartWith("frame not blank");

  let starts = 0;
  let captures = 0;
  const fail = Effect.fail(new AcceptFailure({ operation: "fake", problem: "unused" }));
  const fake = AcceptDriver.of({
    clients: ["a"], prepare: Effect.void,
    start: () => Effect.sync(() => { starts++; }),
    capture: () => Effect.sync(() => { captures++; return drawn; }),
    receipts: () => Effect.succeed([quick(1, 0)]),
    chat: () => fail, keys: () => fail, read: () => fail, log: () => Effect.succeed(""), state: () => Effect.succeed("in match"),
  });
  const smoke = withSmokeCapture(fake, "0 millis");
  const first = await Effect.runPromise(Effect.flip(smoke.driver.start("presentation", "shared")));
  const second = await Effect.runPromise(Effect.flip(smoke.driver.start("presentation", "other")));
  expect(first.message).toContain("two fighters present");
  expect(second.message).toContain("the batch stopped");
  expect(smoke.failed()).toBe("two fighters present: the match has 1 fighter");
  expect([starts, captures]).toEqual([1, 1]);
});

test("accept's smoke capture passes a live solo match whose earlier replay and own replay parts exist, and still stops a one-fighter match [repro #287]", async () => {
  const { Effect } = await import("effect");
  const { smokeProblem } = await import("../scripts/wisp/commands/accept");
  const { writtenPreloadFile } = await import("wisp/scripts/wisp/headlessInput");
  const quick = (humanFighters: number, computers: number) => ({
    name: "smashcraft-dev-playable-0042-p0.txt", modified: 10,
    text: writtenPreloadFile([
      "SMASHCRAFT DEV v=1 build=playable-0042 receipt=4 epoch=2 rb=12 delay=0 batch=1 rematchSeconds=5 ",
      `SETUP phase=2 human-fighters=${humanFighters} computers=${computers} characters=0,1,2,0 stocks=3 minutes=7 automatic-rematch=0 stage=2 `,
    ]),
  });
  const drawn = { width: 4, height: 1, rgb: Uint8Array.from([0, 0, 0, 200, 180, 90, 30, 60, 90, 255, 255, 255]) };
  const file = (name: string, modified: number) => ({ name, modified, text: "" });
  const earlier = [file("smashcraft-replay-11.txt", 1), file("smashcraft-replay-11-1.txt", 1)];
  const live = [...earlier, file("smashcraft-replay-12-1.txt", 20)];
  expect(await Effect.runPromise(smokeProblem(drawn, [quick(1, 2), ...live], 5))).toBeUndefined();
  expect(await Effect.runPromise(smokeProblem(drawn, [quick(1, 2), ...live, file("smashcraft-replay-11.txt", 15)], 5))).toBeUndefined();
  expect(await Effect.runPromise(smokeProblem(drawn, [quick(1, 2), ...live, file("smashcraft-replay-12.txt", 25)], 5))).toBe("match still running: the match had already ended (smashcraft-replay-12.txt)");
  expect(await Effect.runPromise(smokeProblem(drawn, [quick(1, 0), ...live], 5))).toBe("two fighters present: the match has 1 fighter");
});

import { expect, test } from "bun:test";
import recorded from "./autoland.recorded.json";
import { QUEUED, TEST_SLOTS, TRAIN_CAP, TRAIN_TITLE, WAITING, laneState, passedAlone, passedDescription, plan, testTitle, train, type Lane, type Run } from "./autolandCore";

const lanes = recorded.lanes as Lane[];
const runs = recorded.runs as Run[];

test("the recorded queue tests its 7 queued tips at once across both slots and leaves the 6 bisect tips to their live runs, recorded 2026-10-10T03:35Z [spec docs/ci.md]", () => {
  const result = plan(lanes, runs);
  const queued = lanes.filter((lane) => lane.status?.description === QUEUED).toSorted((a, b) => a.status!.at.localeCompare(b.status!.at));
  expect(result.test.map((order) => order.branch)).toEqual(queued.map((lane) => lane.branch));
  expect(result.test.map((order) => order.slot)).toEqual([0, 1, 0, 1, 0, 1, 0]);
  expect(lanes.filter((lane) => laneState(lane, runs) === "held")).toHaveLength(6);
  expect(result.train).toBe(false);
});

test("a cancelled bisect half or test run never strands its tip: without a live run every pending tip is tested, recorded 2026-10-10T03:35Z [spec docs/ci.md]", () => {
  const legacyGone = runs.filter((run) => run.title === "Autoland waiting branches");
  expect(plan(lanes, legacyGone).test).toHaveLength(13);
  const waiting = lanes.map((lane): Lane => (lane.status?.state === "pending" ? { ...lane, status: { ...lane.status, description: WAITING } } : lane));
  const live = waiting.filter((lane) => lane.status?.state === "pending").map((lane, i) => ({ title: testTitle(i % TEST_SLOTS, lane.branch, lane.tip), status: "pending" }));
  expect(plan(waiting, live).test).toEqual([]);
  expect(plan(waiting, live.slice(1)).test.map((order) => order.branch)).toEqual([waiting.filter((lane) => lane.status?.state === "pending")[0]!.branch]);
});

function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

const hex = (next: () => number): string => Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(next() * 16)]).join("");

function scenario(seed: number): { lanes: Lane[]; runs: Run[]; retry: string[] } {
  const next = random(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!;
  const generated: Lane[] = Array.from({ length: Math.floor(next() * 12) }, (_, i) => {
    const at = `2026-10-10T0${Math.floor(next() * 10)}:${String(Math.floor(next() * 60)).padStart(2, "0")}:00Z`;
    const description = pick([QUEUED, WAITING, "testing alone on abc", "bisect", passedDescription(hex(next), hex(next)), "landed as x", "conflicts"]);
    const state = description === "landed as x" ? "success" : description === "conflicts" ? "failure" : "pending";
    return { branch: `claude/lane-${i}`, tip: hex(next), status: next() < 0.15 ? null : { state, description, at } };
  });
  const generatedRuns: Run[] = [];
  for (const lane of generated) {
    if (next() < 0.4) generatedRuns.push({ title: testTitle(Math.floor(next() * TEST_SLOTS), lane.branch, next() < 0.8 ? lane.tip : hex(next)), status: pick(["pending", "in_progress"]) });
    if (next() < 0.2) generatedRuns.push({ title: `Autoland ${lane.branch}`, status: "pending" });
  }
  if (next() < 0.5) generatedRuns.push({ title: TRAIN_TITLE, status: pick(["pending", "in_progress", "queued"]) });
  return { lanes: generated, runs: generatedRuns, retry: generated.filter(() => next() < 0.1).map((lane) => lane.branch) };
}

test("every pending tip without a live run is tested exactly once, nothing held or finished is, slots stay level, and a train is asked for only when a tip passed and none waits [invariant]", () => {
  for (let seed = 1; seed <= 400; seed++) {
    const { lanes: generated, runs: generatedRuns, retry } = scenario(seed);
    const result = plan(generated, generatedRuns, retry);
    const tested = result.test.map((order) => order.branch);
    expect(new Set(tested).size).toBe(tested.length);
    for (const lane of generated) {
      const live = generatedRuns.some((run) => run.title.endsWith(` ${lane.branch} ${lane.tip}`) && run.title.startsWith("Autoland test "));
      const legacy = lane.status?.description === "bisect" && generatedRuns.some((run) => run.title === `Autoland ${lane.branch}`);
      const finished = lane.status !== null && lane.status.state !== "pending";
      const expected = finished ? retry.includes(lane.branch) : passedAlone(lane) === undefined && !live && !legacy;
      expect({ seed, branch: lane.branch, tested: tested.includes(lane.branch) }).toEqual({ seed, branch: lane.branch, tested: expected });
    }
    const load = Array.from({ length: TEST_SLOTS }, (_, slot) => generatedRuns.filter((run) => run.title.startsWith(`Autoland test ${slot} `)).length);
    const before = Math.max(...load) - Math.min(...load);
    for (const order of result.test) load[order.slot]! += 1;
    expect(Math.max(...load) - Math.min(...load)).toBeLessThanOrEqual(Math.max(before, 1));
    const passed = generated.some((lane) => passedAlone(lane) !== undefined);
    expect(result.train).toBe(passed && !generatedRuns.some((run) => run.title === TRAIN_TITLE && run.status !== "in_progress"));
  }
});

test("a train holds only tips that passed alone, first passed first, at most the cap [invariant]", () => {
  for (let seed = 1; seed <= 400; seed++) {
    const generated = scenario(seed).lanes;
    const chosen = train(generated);
    const passed = generated.filter((lane) => passedAlone(lane) !== undefined).toSorted((a, b) => a.status!.at.localeCompare(b.status!.at) || a.branch.localeCompare(b.branch));
    expect(chosen.map((lane) => lane.branch)).toEqual(passed.slice(0, TRAIN_CAP).map((lane) => lane.branch));
    for (const lane of chosen) expect(passedDescription(lane.base, lane.tree)).toBe(generated.find((candidate) => candidate.branch === lane.branch)!.status!.description);
  }
});

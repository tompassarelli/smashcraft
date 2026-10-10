import { expect, test } from "bun:test";
import { DEFAULT_CONFIG, FINDING_KINDS, ISSUE_TITLES, classify, firstDivergence, issueBody, planIssueActions, planMatches, runPlaytest, shardRanges, shardsFor, wilson, type Observation, type Play, type Run } from "./playtestCore";

const roster = {
  fighters: Array.from({ length: 26 }, (_, i) => `f${i}`),
  stages: Array.from({ length: 12 }, (_, i) => `s${i}`),
  tiers: ["rookie", "beginner", "intermediate", "advanced", "expert"],
};

function rng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}

const clean: Observation = { frames: 3000, ended: true, winner: 0, timedOut: false, stockLosses: 3, strings: [], checksums: [[600, "a"], [3000, "b"]], kos: [] };

test("a plan is deterministic, never pits a fighter against itself and joins up across split ranges [invariant]", () => {
  const random = rng(7);
  for (let trial = 0; trial < 50; trial++) {
    const first = Math.floor(random() * 3000);
    const count = 1 + Math.floor(random() * 200);
    const cut = Math.floor(random() * (count + 1));
    const whole = planMatches(roster, first, count);
    expect(planMatches(roster, first, count)).toEqual(whole);
    expect([...planMatches(roster, first, cut), ...planMatches(roster, first + cut, count - cut)]).toEqual(whole);
    for (const spec of whole) expect(spec.a).not.toBe(spec.b);
    expect(new Set(whole.map((spec) => spec.seed)).size).toBe(count);
  }
});

test("any 60 matches reach every fighter, stage and computer level, and 650 reach every ordered pair [invariant]", () => {
  const specs = planMatches(roster, 0, 650);
  const head = specs.slice(0, 60);
  expect(new Set(head.map((spec) => spec.stage)).size).toBe(12);
  expect(new Set(head.map((spec) => spec.tier)).size).toBe(5);
  expect(new Set(head.flatMap((spec) => [spec.a, spec.b])).size).toBe(26);
  expect(new Set(specs.map((spec) => `${spec.a}:${spec.b}`)).size).toBe(650);
});

test("shard ranges partition the matches exactly and differ in size by at most one [invariant]", () => {
  const random = rng(11);
  for (let trial = 0; trial < 100; trial++) {
    const total = Math.floor(random() * 2000);
    const shards = 1 + Math.floor(random() * 30);
    const ranges = shardRanges(total, shards);
    let next = 0;
    for (const range of ranges) {
      expect(range.first).toBe(next);
      next += range.count;
    }
    expect(next).toBe(total);
    const sizes = ranges.map((range) => range.count);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  }
});

test("the shard count follows the measured time a match and never drops below one [invariant]", () => {
  expect(shardsFor(1000, 1151, 4, 2)).toBe(3);
  expect(shardsFor(1000, 1, 4, 20)).toBe(1);
  expect(shardsFor(0, 1000, 4, 2)).toBe(1);
  expect(shardsFor(1000, 2300, 4, 2)).toBeGreaterThan(shardsFor(1000, 1151, 4, 2));
});

test("the loop plays each seed twice, and once with repeats off, timing every match [invariant]", () => {
  let played = 0;
  const play: Play = () => { played++; return clean; };
  let now = 0;
  const specs = planMatches(roster, 0, 5);
  const runs = runPlaytest(specs, play, 100, true, () => (now += 10));
  expect(played).toBe(10);
  expect(runs.every((run) => run.second !== undefined && run.wallMs === 10)).toBe(true);
  played = 0;
  expect(runPlaytest(specs, play, 100, false, () => 0).every((run) => run.second === undefined)).toBe(true);
  expect(played).toBe(5);
});

const runOf = (index: number, first: Observation, second: Observation | undefined = first): Run => ({ spec: planMatches(roster, index, 1)[0]!, first, second, wallMs: 1 });

test("a match still in play at the cap is a never-ends finding with its seed and frame [spec #403]", () => {
  const stuck = runOf(9, { ...clean, ended: false, frames: 14700 });
  const findings = classify([runOf(1, clean), stuck, runOf(2, clean)]);
  const hits = findings.filter((finding) => finding.kind === "never-ends");
  expect(hits.length).toBe(1);
  expect(hits[0]?.spec?.seed).toBe(9);
  expect(hits[0]?.frame).toBe(14700);
});

test("a zero-to-death finding is exactly a string of the minimum hits from a stock's start to its loss with no actionable frame between hits; one escapable frame anywhere clears it [spec #388]", () => {
  const random = rng(11);
  for (let trial = 0; trial < 200; trial++) {
    const hits = 1 + Math.floor(random() * 8);
    const gaps = Array.from({ length: hits - 1 }, () => (random() > 0.7 ? Math.floor(random() * 80) : 0));
    const string = { victim: 0, frame: 900, hits, damage: 80, gaps, tail: Math.floor(random() * 60) };
    const flagged = classify([runOf(trial, { ...clean, strings: [string] })]).filter((finding) => finding.kind === "zero-to-death").length;
    expect(flagged).toBe(hits >= DEFAULT_CONFIG.minStringHits && gaps.every((gap) => gap === 0) ? 1 : 0);
    if (hits > 1) {
      const escapable = gaps.map((gap, i) => (i === trial % gaps.length ? gap + 1 : gap));
      expect(classify([runOf(trial, { ...clean, strings: [{ ...string, gaps: escapable }] })]).filter((finding) => finding.kind === "zero-to-death")).toEqual([]);
    }
  }
});

test("two runs of one seed that differ in a state hash or outcome are a desync at the first differing frame, and equal runs never are [spec #403]", () => {
  const forked = { ...clean, checksums: [[600, "a"], [3000, "z"]] as const };
  expect(firstDivergence(clean, forked)).toBe(3000);
  expect(firstDivergence(clean, clean)).toBeUndefined();
  expect(firstDivergence(clean, { ...clean, winner: 1 })).toBe(3000);
  expect(firstDivergence(clean, { ...clean, checksums: [[600, "a"]] })).toBe(3000);
  const findings = classify([runOf(4, clean, forked), runOf(5, clean)]);
  expect(findings.filter((finding) => finding.kind === "desync").map((finding) => [finding.spec?.index, finding.frame])).toEqual([[4, 3000]]);
});

test("a fighter outside the win band with enough decisive matches is flagged, and a small sample never is [spec #403]", () => {
  const winsFor = (count: number, winner: number) => Array.from({ length: count }, (_, i) => ({ spec: { index: i, seed: i, a: "x", b: "y", stage: "s0", tier: "expert" }, first: { ...clean, winner }, second: undefined, wallMs: 1 }) satisfies Run);
  const flagged = classify(winsFor(40, 0)).filter((finding) => finding.kind === "win-rate-band").map((finding) => finding.subject).sort();
  expect(flagged).toEqual(["x", "y"]);
  expect(classify(winsFor(DEFAULT_CONFIG.minDecisive - 1, 0)).filter((finding) => finding.kind === "win-rate-band")).toEqual([]);
  expect(classify([...winsFor(20, 0), ...winsFor(20, 1)]).filter((finding) => finding.kind === "win-rate-band")).toEqual([]);
});

test("a move above its share of a fighter's KOs is flagged and a spread kit is not [spec #403]", () => {
  const koRun = (kos: Observation["kos"]) => runOf(0, { ...clean, kos });
  const dominant = classify([koRun([{ fighter: "x", move: "jab", count: 18 }, { fighter: "x", move: "up-air", count: 2 }])]);
  expect(dominant.filter((finding) => finding.kind === "move-share").map((finding) => finding.subject)).toEqual(["x jab"]);
  const spread = classify([koRun([{ fighter: "x", move: "jab", count: 8 }, { fighter: "x", move: "up-air", count: 8 }, { fighter: "x", move: "grab", count: 4 }])]);
  expect(spread.filter((finding) => finding.kind === "move-share")).toEqual([]);
});

test("a stage with enough matches and no stock lost is flagged and one with a KO is not [spec #403]", () => {
  const onStage = (stage: string, losses: number, n: number) => Array.from({ length: n }, (_, i) => ({ spec: { ...planMatches(roster, i, 1)[0]!, stage }, first: { ...clean, stockLosses: losses }, second: undefined, wallMs: 1 }) satisfies Run);
  const findings = classify([...onStage("quiet", 0, 6), ...onStage("busy", 3, 6), ...onStage("tiny", 0, 2)]).filter((finding) => finding.kind === "stage-no-kos");
  expect(findings.map((finding) => finding.subject)).toEqual(["quiet"]);
});

test("classification ignores run order and a merge of shards equals the whole [invariant]", () => {
  const random = rng(3);
  const runs: Run[] = planMatches(roster, 0, 120).map((spec) => ({
    spec, wallMs: 1, second: undefined,
    first: { ...clean, ended: random() > 0.1, winner: random() > 0.5 ? 0 : 1, stockLosses: Math.floor(random() * 5), strings: random() > 0.8 ? [{ victim: 0, frame: Math.floor(random() * 9000), hits: 3, damage: 50, gaps: [0, random() > 0.5 ? 0 : 9], tail: 0 }] : [], kos: [{ fighter: spec.a, move: random() > 0.3 ? "jab" : "grab", count: 1 }] },
  }));
  const whole = classify(runs);
  const shuffled = [...runs].sort(() => random() - 0.5);
  expect(classify(shuffled)).toEqual(whole);
  expect(classify([...runs.slice(60), ...runs.slice(0, 60)])).toEqual(whole);
  for (const kind of ["never-ends", "zero-to-death", "desync"] as const) {
    const parts = [...classify(runs.slice(0, 60)), ...classify(runs.slice(60))].filter((finding) => finding.kind === kind);
    expect(parts.length).toBe(whole.filter((finding) => finding.kind === kind).length);
  }
});

test("each finding kind has one issue body that carries the reproducing seed, and an empty kind says so [spec #403]", () => {
  const findings = classify([runOf(9, { ...clean, ended: false, frames: 14700 })]);
  expect(issueBody("never-ends", findings, "head")).toContain("seed 9, frame 14700");
  expect(issueBody("desync", findings, "head")).toContain("No desync finding");
  expect(new Set(FINDING_KINDS).size).toBe(FINDING_KINDS.length);
});

test("findings update their kind's open issue or open one with the seed, an empty kind only comments on an open issue, and no kind ever gets two [spec #403]", () => {
  const findings = classify([runOf(9, { ...clean, ended: false, frames: 14700 })]);
  const neverEnds = ISSUE_TITLES["never-ends"];
  const desync = ISSUE_TITLES.desync;
  expect(planIssueActions(findings, [], "head")).toEqual([{ action: "create", kind: "never-ends", title: neverEnds, body: issueBody("never-ends", findings, "head") }]);
  const open = [{ number: 12, title: neverEnds }, { number: 7, title: neverEnds }, { number: 30, title: desync }, { number: 31, title: "Playtester: something else" }];
  const actions = planIssueActions(findings, open, "head");
  expect(actions.map((action) => [action.action, action.kind, "number" in action ? action.number : undefined])).toEqual([["update", "never-ends", 7], ["comment", "desync", 30]]);
  expect(actions[0]?.body).toContain("seed 9, frame 14700");
  expect(actions[1]?.body).toContain("No desync finding");
  expect(planIssueActions([], [], "head")).toEqual([]);
  expect(new Set(Object.values(ISSUE_TITLES)).size).toBe(FINDING_KINDS.length);
});

test("the Wilson interval brackets the rate and narrows with more trials [invariant]", () => {
  const [low, high] = wilson(30, 60);
  expect(low).toBeLessThan(0.5);
  expect(high).toBeGreaterThan(0.5);
  const [lowMore, highMore] = wilson(300, 600);
  expect(highMore - lowMore).toBeLessThan(high - low);
  expect(wilson(0, 0)).toEqual([0, 1]);
});

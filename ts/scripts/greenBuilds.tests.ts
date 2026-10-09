import { expect, test } from "bun:test";
import { type Candidate, type Verdict, installName, isGreen, parseInstalled, pickGreen, pruneTargets, verdictOf } from "./wisp/greenBuilds";

const VERDICTS: readonly Verdict[] = ["success", "failure", "pending", "missing"];
const CASES = 400;

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const below = (next: () => number, limit: number) => Math.floor(next() * limit);
const hex = (next: () => number, length: number) => Array.from({ length }, () => below(next, 16).toString(16)).join("");

function commits(next: () => number): Candidate[] {
  const seen = new Set<string>();
  return Array.from({ length: below(next, 12) }, () => {
    let sha = hex(next, 40);
    while (seen.has(sha)) sha = hex(next, 40);
    seen.add(sha);
    return { sha, ci: VERDICTS[below(next, 4)]!, farm: VERDICTS[below(next, 4)]! };
  });
}

const indexOfSha = (list: readonly Candidate[], sha: string) => list.findIndex((commit) => commit.sha === sha);

test("the pick is green, not installed, and the newest green commit [spec #402]", () => {
  const next = rng(402);
  for (let i = 0; i < CASES; i++) {
    const list = commits(next);
    const installed = list.filter(() => next() < 0.2).map(({ sha }) => sha.slice(0, 7));
    const pick = pickGreen(list, installed);
    if (pick === undefined) continue;
    expect(isGreen(pick)).toBe(true);
    expect(installed.some((commit) => pick.sha.startsWith(commit))).toBe(false);
    const index = indexOfSha(list, pick.sha);
    expect(list.slice(0, index).some(isGreen)).toBe(false);
  }
});

test("a red, pending or missing commit is never picked [spec #402]", () => {
  const next = rng(1402);
  for (let i = 0; i < CASES; i++) {
    const list = commits(next).map((commit) => ({ ...commit, farm: next() < 0.5 ? commit.farm : "failure" as Verdict }));
    const pick = pickGreen(list, []);
    const unfinished = list.filter((commit) => !isGreen(commit));
    expect(unfinished.some((commit) => commit.sha === pick?.sha)).toBe(false);
    expect(pick === undefined).toBe(!list.some(isGreen));
  }
});

test("with nothing installed the pick is the first green commit, and picking is idempotent once installed [invariant]", () => {
  const next = rng(2402);
  for (let i = 0; i < CASES; i++) {
    const list = commits(next);
    const pick = pickGreen(list, []);
    expect(pick).toEqual(list.find(isGreen));
    if (pick !== undefined) expect(pickGreen(list, [installName("0.0.1", pick.sha).split(" ")[2]!])).toBeUndefined();
  }
});

test("an installed commit at or above the newest green one blocks the pick, so builds never go backwards [spec #402]", () => {
  const next = rng(3402);
  for (let i = 0; i < CASES; i++) {
    const list = commits(next);
    const green = list.findIndex(isGreen);
    if (green === -1) continue;
    const newer = list[below(next, green + 1)]!;
    expect(pickGreen(list, [newer.sha.slice(0, 7)])).toBeUndefined();
  }
});

test("the install name carries the version and the short commit and parses back [invariant]", () => {
  const next = rng(4402);
  for (let i = 0; i < CASES; i++) {
    const version = [below(next, 5), below(next, 50), below(next, 500)] as const;
    const sha = hex(next, 40);
    const name = installName(version.join("."), sha);
    expect(name).toBe(`Smashcraft ${version.join(".")} ${sha.slice(0, 7)}`);
    expect(parseInstalled(`${name}.w3x`)).toEqual({ version, commit: sha.slice(0, 7) });
  }
  expect(parseInstalled("Smashcraft 0.0.12.w3x")).toEqual({ version: [0, 0, 12], commit: undefined });
  expect(parseInstalled("Smashcraft 0.0.12 test 1.w3x")).toBeUndefined();
});

test("pruning keeps the new build and the two highest prior versions, and moves the rest [spec docs/commands/play.md]", () => {
  const next = rng(5402);
  for (let i = 0; i < CASES; i++) {
    const count = below(next, 10);
    const versions = new Set<number>();
    while (versions.size < count) versions.add(below(next, 200));
    const files = [...versions].map((patch) => `Smashcraft 0.0.${patch} ${hex(next, 7)}.w3x`);
    const keep = `Smashcraft 0.0.${200 + below(next, 5)} ${hex(next, 7)}.w3x`;
    const present = [...files, keep, "readme.txt"].sort(() => next() - 0.5);
    const pruned = pruneTargets(present, keep);
    const stay = files.filter((file) => !pruned.includes(file));
    expect(pruned).not.toContain(keep);
    expect(pruned).not.toContain("readme.txt");
    expect(stay.length).toBe(Math.min(2, files.length));
    const patch = (file: string) => parseInstalled(file)!.version[2];
    for (const moved of pruned) for (const kept of stay) expect(patch(moved)).toBeLessThan(patch(kept));
    expect(pruneTargets(present.filter((file) => !pruned.includes(file)), keep)).toEqual([]);
  }
});

test("versions order numerically, so 0.0.10 outranks 0.0.9 when pruning [repro #402]", () => {
  const files = ["Smashcraft 0.0.9.w3x", "Smashcraft 0.0.10 abc1234.w3x", "Smashcraft 0.0.11 def5678.w3x", "Smashcraft 0.0.8.w3x"];
  expect(pruneTargets(files, "Smashcraft 0.0.12 aaaaaaa.w3x").sort()).toEqual(["Smashcraft 0.0.8.w3x", "Smashcraft 0.0.9.w3x"]);
});

test("the latest run decides a verdict: running is pending, a re-run can turn red green and no runs is missing [invariant]", () => {
  const next = rng(6402);
  expect(verdictOf([])).toBe("missing");
  for (let i = 0; i < CASES; i++) {
    const runs = Array.from({ length: 1 + below(next, 6) }, (_, n) => ({
      status: next() < 0.2 ? "in_progress" : "completed",
      conclusion: next() < 0.5 ? "success" : "failure",
      createdAt: `2026-10-09T10:${String(n).padStart(2, "0")}:00Z`,
    })).sort(() => next() - 0.5);
    const latest = runs.reduce((best, run) => run.createdAt > best.createdAt ? run : best);
    expect(verdictOf(runs)).toBe(latest.status !== "completed" ? "pending" : latest.conclusion === "success" ? "success" : "failure");
  }
});

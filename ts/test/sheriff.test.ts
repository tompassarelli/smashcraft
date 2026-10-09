import { expect, test } from "bun:test";
import { decide, referencedIssues, REVERT_TRAILER, type CiRun, type Job } from "../scripts/sheriff";

const PERF = "Run bun wisp perf playable-bot-four --samples --out build/playable-bot-four.perf && bun wisp perf compare test/fixtures/perf/playable-bot-four.perf build/playable-bot-four.perf";
const green = (name: string): Job => ({ name, conclusion: "success", steps: [] });
const lua = ["bot", "remainder", ...[1, 2, 3, 4, 5, 6].map((n) => `sweeps ${n}/6`)].map((part) => green(`Lua32 (${part})`));
const failingAt = (step: string, job = "development-loop"): CiRun => ({
  conclusion: "failure",
  jobs: [{ name: job, conclusion: "failure", steps: [{ name: step, conclusion: "failure" }] }, ...lua, green("Sweeps (Bun)"), { name: "main-red", conclusion: "skipped", steps: [] }],
});
const GREEN: CiRun = { conclusion: "success", jobs: [] };
const A0563720E = { sha: "a0563720e", message: "Input delay setting, lobby agreement and online Auto delay in the map (#396)\n\nClaude-Session: https://claude.ai/code/session_01WjtBhvenVfQkgrEuaAY5Z6" };

test("sheriff verdicts on main's recorded CI runs of 2026-10-09 [spec docs/ci.md]", () => {
  const red396 = failingAt(PERF);
  const scenarios = [
    { name: "37948697382: a0563720e red after green 138a2fbda", situation: { run: red396, previous: { ...GREEN, ancestor: true }, commits: [A0563720E], workflowFiles: [] }, kind: "revert" },
    { name: "37950390317: b6575b559 red at the same step after red", situation: { run: failingAt(PERF), previous: { ...red396, ancestor: true }, commits: [{ sha: "b6575b559", message: "x" }], workflowFiles: [] }, kind: "report", why: /already red/ },
    { name: "37940482240: cancelled run", situation: { run: { conclusion: "cancelled", jobs: [] }, previous: { ...GREEN, ancestor: true }, commits: [A0563720E], workflowFiles: [] }, kind: "report", why: /infrastructure/ },
    { name: "job timed out", situation: { run: { ...red396, jobs: [...red396.jobs, { name: "Sweeps (Bun)", conclusion: "cancelled", steps: [] }] }, previous: { ...GREEN, ancestor: true }, commits: [A0563720E], workflowFiles: [] }, kind: "report", why: /infrastructure/ },
    { name: "setup step failed", situation: { run: failingAt("Run bun install --frozen-lockfile"), previous: { ...GREEN, ancestor: true }, commits: [A0563720E], workflowFiles: [] }, kind: "report", why: /setup/ },
    { name: "different red atop red", situation: { run: failingAt("Run bun scripts/lua-tests.ts", "Lua32 (bot)"), previous: { ...red396, ancestor: true }, commits: [A0563720E], workflowFiles: [] }, kind: "report", why: /two different failures/ },
    { name: "injected fault: the landing is a sheriff revert", situation: { run: red396, previous: { ...GREEN, ancestor: true }, commits: [{ sha: "r", message: `Revert "x"\n\n${REVERT_TRAILER} a0563720e` }], workflowFiles: [] }, kind: "report", why: /never revert a revert/ },
    { name: "landing changes workflows", situation: { run: red396, previous: { ...GREEN, ancestor: true }, commits: [A0563720E], workflowFiles: [".github/workflows/ci.yml"] }, kind: "report", why: /workflow token/ },
    { name: "previous run's commit not an ancestor", situation: { run: red396, previous: { ...GREEN, ancestor: false }, commits: [], workflowFiles: [] }, kind: "report", why: /ancestor/ },
  ] as const;
  for (const { name, situation, kind, ...rest } of scenarios) {
    const verdict = decide(situation);
    expect(`${name}: ${verdict.kind}`).toBe(`${name}: ${kind}`);
    if ("why" in rest) expect(verdict.why).toMatch(rest.why);
  }
  const revert = decide(scenarios[0].situation);
  expect(revert.kind === "revert" && revert.step).toBe(`development-loop: ${PERF}`);
  expect(referencedIssues([A0563720E, { sha: "b", message: "Train\n\nRefs smashcraft#401" }])).toEqual([396, 401]);
});

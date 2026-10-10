
















import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Effect } from "effect";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";
import { FarmFailure, type RunState, currentRepo, dispatch, farmTest, resolveRef, run, runTag, waitFor } from "wisp/scripts/wisp/farm";
import { type Admission, type FarmWorkflow, admit, revertedBy } from "../../farmGuard";

const WORKFLOWS = { balance: "balance.yml", pads: "headless-pads.yml", perf: "perf.yml", memory: "memory-soak.yml" } as const;
type Job = keyof typeof WORKFLOWS;

const isAncestor = (sha: string, tip: string) => run(["git", "merge-base", "--is-ancestor", sha, tip]).pipe(Effect.as(true), Effect.orElseSucceed(() => false));

const admission = (workflow: FarmWorkflow, given: string | undefined, named: string | undefined, repo: string) => Effect.gen(function*() {
  const lane = named === undefined ? undefined : named.includes("/") ? named : `claude/${named}`;
  const laneTip = lane === undefined ? undefined : (yield* run(["git", "ls-remote", "origin", `refs/heads/${lane}`])).split(/\s/)[0] || undefined;
  const missing: Admission = { kind: "refuse", why: `${lane} isn't on origin: push the lane first` };
  if (lane !== undefined && laneTip === undefined) return { sha: "", verdict: missing };
  if (lane !== undefined) yield* run(["git", "fetch", "--quiet", "origin", `refs/heads/${lane}`]);
  const sha = yield* run(["git", "rev-parse", "--verify", `${given ?? laneTip ?? "HEAD"}^{commit}`]);
  yield* run(["git", "fetch", "--quiet", "origin", "main"]);
  const main = yield* run(["git", "rev-parse", "FETCH_HEAD"]);
  const onMain = yield* isAncestor(sha, main);
  const log = onMain ? yield* run(["git", "log", "--format=%H%x1f%B%x1e", `${sha}..${main}`]) : "";
  const after = log.split("\x1e").map((entry) => entry.trim()).filter(Boolean).map((entry) => ({ sha: entry.split("\x1f")[0] ?? "", message: entry.split("\x1f")[1] ?? "" }));
  const onLane = laneTip !== undefined && (yield* isAncestor(sha, laneTip));
  const autoland = workflow === "test" && !onMain
    ? yield* run(["gh", "api", `repos/${repo}/commits/${sha}/statuses`, "--jq", "[.[] | select(.context == \"autoland\")][0].description // \"\""]).pipe(Effect.orElseSucceed(() => ""))
    : "";
  return { sha, verdict: admit({ workflow, sha, onMain, revertedBy: revertedBy(sha, after), lane, onLane, autoland: autoland === "" ? undefined : autoland }) };
});


const balanceResult = (repo: string, id: number, state: RunState) => Effect.gen(function*() {
  const folder = mkdtempSync(join(tmpdir(), "farm-balance-"));
  const downloaded = yield* run(["gh", "run", "download", String(id), "-R", repo, "-n", "balance-field", "-D", folder]).pipe(Effect.as(true), Effect.orElseSucceed(() => false));
  if (downloaded) {
    console.log(readFileSync(join(folder, "field.md"), "utf8"));
    console.log(`Merged records: gh run download ${id} -R ${repo} -n balance-field`);
  }
  rmSync(folder, { recursive: true });
  if (state.conclusion !== "success") {
    const failed = state.jobs.filter((job) => job.conclusion !== "success" && job.conclusion !== "skipped").map((job) => job.name);
    return yield* new FarmFailure({ problem: `the balance run ended ${state.conclusion} (${failed.join(", ")}); gh run view ${id} -R ${repo} --log-failed` });
  }
});

const padsResult = (repo: string, id: number, state: RunState) => Effect.gen(function*() {
  const pads = state.jobs.filter((job) => job.name.startsWith("pad "));
  const failed = pads.filter((job) => job.conclusion !== "success");
  for (const job of pads) console.log(`${job.conclusion === "success" ? "pass" : job.conclusion === "failure" ? "FAIL" : job.conclusion}  ${job.name.replace(/^pad \((.*)\)$/, "$1")}`);
  if (state.conclusion === "success") return;
  if (failed.length > 0) {
    const log = yield* run(["gh", "run", "view", String(id), "-R", repo, "--log-failed"]).pipe(Effect.orElseSucceed(() => ""));
    for (const line of log.split("\n").filter((text) => /FAIL|failed for|error/.test(text)).slice(0, 40)) console.log(line);
  }
  return yield* new FarmFailure({ problem: `${failed.length} of ${pads.length} pad scripts failed (${state.conclusion}); evidence: gh run download ${id} -R ${repo}` });
});


const perfArtifact = (runArgs: string) => `perf-${runArgs.replace(/[^A-Za-z0-9-]/g, "_")}`;

const perfResult = (repo: string, id: number, state: RunState, runs: readonly string[], out: string | undefined) => Effect.gen(function*() {
  const folder = mkdtempSync(join(tmpdir(), "farm-perf-"));
  const failed: string[] = [];
  for (const runArgs of runs) {
    const name = perfArtifact(runArgs);
    const got = yield* run(["gh", "run", "download", String(id), "-R", repo, "-n", name, "-D", join(folder, name)]).pipe(Effect.as(true), Effect.orElseSucceed(() => false));
    if (!got) {
      failed.push(`${runArgs} (no output)`);
      continue;
    }
    console.log(`== perf ${runArgs}`);
    console.log(readFileSync(join(folder, name, "summary.txt"), "utf8").split("\n").filter((line) => !line.startsWith("frame ")).join("\n").trimEnd());
    if (out !== undefined) yield* Effect.tryPromise({ try: () => Bun.write(join(out, `${name.slice(5)}.txt`), Bun.file(join(folder, name, "run.txt"))), catch: (cause) => new FarmFailure({ problem: describeCause(cause) }) }).pipe(Effect.orElseSucceed(() => 0));
  }
  rmSync(folder, { recursive: true });
  const jobsFailed = state.jobs.filter((job) => job.conclusion !== "success").map((job) => job.name);
  if (state.conclusion !== "success" || failed.length > 0) return yield* new FarmFailure({ problem: `the perf run ended ${state.conclusion} (${[...jobsFailed, ...failed].join(", ")}); gh run view ${id} -R ${repo} --log-failed` });
});

const memoryResult = (repo: string, id: number, state: RunState, matches?: number) => Effect.gen(function*() {
  const folder = mkdtempSync(join(tmpdir(), "farm-memory-"));
  let completed = 0;
  let problems = 0;
  const shards = matches === undefined ? 1 : Math.min(4, matches);
  for (let shard = 0; shard < shards; shard++) {
    const name = matches === undefined ? "memory-soak" : `memory-soak-${shard}`;
    const destination = join(folder, String(shard));
    const downloaded = yield* run(["gh", "run", "download", String(id), "-R", repo, "-n", name, "-D", destination]).pipe(Effect.as(true), Effect.orElseSucceed(() => false));
    if (!downloaded) { problems++; continue; }
    const verdict = readFileSync(join(destination, "verdict.txt"), "utf8");
    console.log(verdict.trimEnd());
    if (matches !== undefined) {
      const result = /^release matches=(\d+) crashes=(\d+) desyncs=(\d+)$/m.exec(verdict);
      if (result === null) problems++;
      else { completed += Number(result[1]); problems += Number(result[2]) + Number(result[3]); }
    }
  }
  rmSync(folder, { recursive: true });
  console.log(`Samples: gh run download ${id} -R ${repo}`);
  if (matches !== undefined) console.log(`release total matches=${completed} crashes-and-desyncs=${problems}`);
  if (state.conclusion !== "success" || (matches !== undefined && (completed !== matches || problems !== 0))) return yield* new FarmFailure({ problem: `the memory soak ended ${state.conclusion}; gh run view ${id} -R ${repo} --log-failed` });
});

export const farm: Command = (args) => Effect.gen(function*() {
  const parsed = yield* Effect.try({
    try: () => parseArgs({ args: [...args], allowPositionals: true, options: {
      ref: { type: "string" }, lane: { type: "string" }, wait: { type: "boolean" }, out: { type: "string" }, opponent: { type: "string" }, tier: { type: "string" }, "per-pair": { type: "string" }, seeds: { type: "string" }, matchups: { type: "string" }, probe: { type: "string" }, minutes: { type: "string" }, matches: { type: "string" }, only: { type: "string", multiple: true },
    } }),
    catch: (cause) => new UsageFailure({ problem: describeCause(cause) }),
  });
  const [job, ...perfRuns] = parsed.positionals;
  if (job !== "test" && job !== "balance" && job !== "pads" && job !== "perf" && job !== "memory") return yield* new UsageFailure({ problem: "farm test, farm balance, farm pads, farm perf or farm memory" });
  const repo = yield* currentRepo;
  const admitted = yield* admission(job, parsed.values.ref, parsed.values.lane, repo);
  if (admitted.verdict.kind === "refuse") return yield* new FarmFailure({ problem: `not dispatched: ${admitted.verdict.why}` });
  if (job === "test") return yield* farmTest({ ref: parsed.values.ref, wait: parsed.values.wait === true });
  const verdict = admitted.verdict;
  const runs = perfRuns.length > 0 ? perfRuns : ["playable-bot-four"];
  const workflow = WORKFLOWS[job satisfies Job];

  yield* Effect.scoped(Effect.gen(function*() {
    const { ref, scratch } = verdict.kind === "dispatch" ? { ref: admitted.sha, scratch: undefined } : yield* resolveRef(parsed.values.ref, repo);
    const lane = verdict.kind === "dispatch" ? verdict.lane : `farm/${ref.slice(0, 12)}`;
    const tag = runTag();
    const inputs = job === "balance"
      ? { ref, lane, opponent: parsed.values.opponent ?? "wren", tier: parsed.values.tier ?? "expert", "per-pair": parsed.values["per-pair"] ?? "400", seeds: parsed.values.seeds ?? "100", matchups: parsed.values.matchups ?? "", probe: parsed.values.probe ?? "40", tag }
      : job === "perf" ? { ref, lane, runs: JSON.stringify(runs), tag } : job === "memory" ? { ref, lane, minutes: parsed.values.minutes ?? "30", matches: parsed.values.matches ?? "", tag } : { ref, lane, dirs: parsed.values.only?.join(" ") ?? ".", tag };
    const started = performance.now();
    const found = yield* dispatch(repo, workflow, inputs);
    if (parsed.values.wait !== true && scratch === undefined && job !== "perf") return;
    const state = yield* waitFor(repo, found.databaseId);
    console.error(`${((performance.now() - started) / 60000).toFixed(1)} min from dispatch to the result`);
    if (job === "balance") yield* balanceResult(repo, found.databaseId, state);
    else if (job === "perf") yield* perfResult(repo, found.databaseId, state, runs, parsed.values.out);
    else if (job === "pads") yield* padsResult(repo, found.databaseId, state);
    else yield* memoryResult(repo, found.databaseId, state, parsed.values.matches === undefined ? undefined : Number(parsed.values.matches));
  }));
});

// `bun wisp farm balance|pads [--ref REF] [--wait]`: runs headless work on
// GitHub's free hosted runners instead of this machine. `balance` dispatches
// smashcraft:.github/workflows/balance.yml (the balance gate's computer
// field, a `cpuField --pairs` process a core over about 17 jobs, merged in
// one); `pads` dispatches smashcraft:.github/workflows/headless-pads.yml
// (every native check script, headless, against its own expectations).
// --wait waits for the run and prints the verdict and field table, or each
// failing script. Without --ref, the checkout's HEAD: a commit main doesn't
// hold yet is pushed with safe-push to a scratch branch farm/<commit>, which
// CI ignores and the command deletes after the run (so it always waits).
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Effect, Schema } from "effect";
import { type Command, UsageFailure, describeCause } from "wisp/scripts/wisp/command";

class FarmFailure extends Schema.TaggedError<FarmFailure>()("FarmFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

const WORKFLOWS = { balance: "balance.yml", pads: "headless-pads.yml" } as const;
type Job = keyof typeof WORKFLOWS;

/** Runs a program to completion; its trimmed stdout, or a failure naming its stderr. */
const run = (argv: readonly string[], inherit = false) => Effect.tryPromise({
  try: async () => {
    const child = Bun.spawn([...argv], { stdout: inherit ? "inherit" : "pipe", stderr: inherit ? "inherit" : "pipe" });
    const [out, err, code] = await Promise.all([inherit ? "" : new Response(child.stdout).text(), inherit ? "" : new Response(child.stderr).text(), child.exited]);
    if (code !== 0) throw new Error(`${argv.slice(0, 3).join(" ")} exited ${code}${err.trim() === "" ? "" : `: ${err.trim()}`}`);
    return out.trim();
  },
  catch: (cause) => new FarmFailure({ problem: describeCause(cause) }),
});

/** The commit to measure, and the scratch branch it was pushed to when main doesn't hold it. */
const resolveRef = (given: string | undefined) => Effect.gen(function*() {
  if (given !== undefined) return { ref: given, scratch: undefined };
  const sha = yield* run(["git", "rev-parse", "HEAD"]);
  yield* run(["git", "fetch", "--quiet", "origin", "main"]);
  const onMain = yield* run(["git", "merge-base", "--is-ancestor", sha, "FETCH_HEAD"]).pipe(Effect.as(true), Effect.orElseSucceed(() => false));
  if (onMain) return { ref: sha, scratch: undefined };
  const scratch = `farm/${sha.slice(0, 12)}`;
  console.error(`${sha.slice(0, 12)} isn't on main: pushing it to ${scratch} for the run (deleted afterwards)`);
  yield* run(["safe-push", "--to", scratch], true);
  return { ref: sha, scratch };
});

/** The run `gh workflow run` started, found by the tag in its name. */
const findRun = (repo: string, workflow: string, tag: string) => Effect.gen(function*() {
  for (let tries = 0; tries < 30; tries++) {
    const listed = yield* run(["gh", "run", "list", "-R", repo, "--workflow", workflow, "--event", "workflow_dispatch", "-L", "20", "--json", "databaseId,displayTitle,url"]);
    const runs = JSON.parse(listed) as { databaseId: number; displayTitle: string; url: string }[];
    const found = runs.find((item) => item.displayTitle.endsWith(` ${tag}`));
    if (found !== undefined) return found;
    yield* Effect.sleep("2 seconds");
  }
  return yield* new FarmFailure({ problem: `no ${workflow} run named ${tag} appeared within a minute` });
});

interface RunState {
  readonly status: string;
  readonly conclusion: string;
  readonly jobs: readonly { readonly name: string; readonly status: string; readonly conclusion: string }[];
}

/** Polls the run until it completes, printing a line when its jobs move. */
const waitFor = (repo: string, id: number) => Effect.gen(function*() {
  let last = "";
  for (;;) {
    const state = JSON.parse(yield* run(["gh", "run", "view", String(id), "-R", repo, "--json", "status,conclusion,jobs"])) as RunState;
    const done = state.jobs.filter((job) => job.status === "completed").length;
    const running = state.jobs.filter((job) => job.status === "in_progress").length;
    const line = `${state.status}: ${done} jobs done, ${running} running, ${state.jobs.length - done - running} waiting`;
    if (line !== last) console.error(line);
    last = line;
    if (state.status === "completed") return state;
    yield* Effect.sleep("15 seconds");
  }
});

const balanceResult = (repo: string, id: number, state: RunState) => Effect.gen(function*() {
  if (state.conclusion !== "success") {
    const failed = state.jobs.filter((job) => job.conclusion !== "success" && job.conclusion !== "skipped").map((job) => job.name);
    return yield* new FarmFailure({ problem: `the balance run ended ${state.conclusion} (${failed.join(", ")}); gh run view ${id} -R ${repo} --log-failed` });
  }
  const folder = mkdtempSync(join(tmpdir(), "farm-balance-"));
  yield* run(["gh", "run", "download", String(id), "-R", repo, "-n", "balance-field", "-D", folder]);
  console.log(readFileSync(join(folder, "field.md"), "utf8"));
  console.log(`Merged records: gh run download ${id} -R ${repo} -n balance-field`);
  rmSync(folder, { recursive: true });
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

export const farm: Command = (args) => Effect.gen(function*() {
  const parsed = yield* Effect.try({
    try: () => parseArgs({ args: [...args], allowPositionals: true, options: {
      ref: { type: "string" }, wait: { type: "boolean" }, level: { type: "string" }, "per-pair": { type: "string" }, seeds: { type: "string" },
    } }),
    catch: (cause) => new UsageFailure({ problem: describeCause(cause) }),
  });
  const [job] = parsed.positionals;
  if (job !== "balance" && job !== "pads") return yield* new UsageFailure({ problem: "farm balance or farm pads" });
  const workflow = WORKFLOWS[job satisfies Job];
  const repo = yield* run(["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
  const { ref, scratch } = yield* resolveRef(parsed.values.ref);
  const tag = randomBytes(4).toString("hex");
  const inputs = job === "balance"
    ? { ref, level: parsed.values.level ?? "9", "per-pair": parsed.values["per-pair"] ?? "400", seeds: parsed.values.seeds ?? "100", tag }
    : { ref, tag };
  const started = performance.now();
  const work = Effect.gen(function*() {
    yield* run(["gh", "workflow", "run", workflow, "-R", repo, "--ref", "main", ...Object.entries(inputs).flatMap(([name, value]) => ["-f", `${name}=${value}`])]);
    const found = yield* findRun(repo, workflow, tag);
    console.error(`${found.displayTitle}: ${found.url}`);
    if (parsed.values.wait !== true && scratch === undefined) return;
    const state = yield* waitFor(repo, found.databaseId);
    console.error(`${((performance.now() - started) / 60000).toFixed(1)} min from dispatch to the result`);
    if (job === "balance") yield* balanceResult(repo, found.databaseId, state);
    else yield* padsResult(repo, found.databaseId, state);
  });
  yield* work.pipe(Effect.ensuring(scratch === undefined ? Effect.void
    : run(["gh", "api", "-X", "DELETE", `repos/${repo}/git/refs/heads/${scratch}`]).pipe(Effect.catch((failure) => Effect.sync(() => console.error(`couldn't delete ${scratch}: ${failure.message}`))))));
});

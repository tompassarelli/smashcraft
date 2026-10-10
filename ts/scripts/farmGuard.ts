import { parseArgs } from "node:util";
import { Console, Effect, Schema } from "effect";
import { captureProcess } from "wisp/scripts/wisp/mapBuild";

export type FarmWorkflow = "balance" | "playtest" | "memory" | "perf" | "pads" | "tiers" | "test";
export const FARM_WORKFLOWS: readonly FarmWorkflow[] = ["balance", "playtest", "memory", "perf", "pads", "tiers", "test"];
export const MAIN_ONLY: ReadonlySet<FarmWorkflow> = new Set(["balance", "playtest", "memory"]);

export interface MainCommit { readonly sha: string; readonly message: string }

export interface Facts {
  readonly workflow: FarmWorkflow;
  readonly sha: string;
  readonly onMain: boolean;
  readonly revertedBy: string | undefined;
  readonly lane: string | undefined;
  readonly onLane: boolean;
}

export type Verdict = { readonly live: boolean; readonly why: string };

export type Admission =
  | { readonly kind: "dispatch"; readonly lane: string }
  | { readonly kind: "scratch" }
  | { readonly kind: "refuse"; readonly why: string };

const sameCommit = (sha: string, named: string) => named.length >= 7 && (sha.startsWith(named) || named.startsWith(sha));

export function revertedBy(sha: string, after: readonly MainCommit[]): string | undefined {
  return after.find(({ message }) => {
    const sheriff = [...message.matchAll(/^Sheriff-Reverts:(.*)$/gm)].flatMap((match) => (match[1] ?? "").trim().split(/[\s,]+/));
    const git = [...message.matchAll(/This reverts commit ([0-9a-f]{7,40})/g)].map((match) => match[1] ?? "");
    return [...sheriff, ...git].some((named) => sameCommit(sha, named));
  })?.sha;
}

export function laneAllowed(workflow: FarmWorkflow, lane: string): boolean {
  return MAIN_ONLY.has(workflow) ? /^claude\/[^/]/.test(lane) : /^(claude|farm)\/[^/]/.test(lane);
}

export function liveness(facts: Facts): Verdict {
  const short = facts.sha.slice(0, 12);
  const lane = facts.lane !== undefined && laneAllowed(facts.workflow, facts.lane) ? facts.lane : undefined;
  if (lane !== undefined && facts.onLane) return { live: true, why: `${short} is on ${lane}` };
  if (facts.onMain && facts.revertedBy === undefined) return { live: true, why: `${short} is on main` };
  if (facts.onMain) return { live: false, why: `${short} was reverted on main by ${facts.revertedBy?.slice(0, 12)}` };
  if (facts.lane !== undefined && lane === undefined) return { live: false, why: `${facts.workflow} runs only on main or a claude/ lane, not ${facts.lane}` };
  return { live: false, why: lane === undefined ? `${short} isn't on main` : `${short} isn't on main or on ${lane}` };
}

export function admit(facts: Facts & { readonly autoland: string | undefined }): Admission {
  const short = facts.sha.slice(0, 12);
  if (facts.workflow === "test") {
    if (facts.onMain) return { kind: "refuse", why: `${short} is on main, whose CI runs these suites: gh run list --workflow ci.yml --commit ${facts.sha}` };
    if (facts.autoland === "queued" || facts.autoland === "bisect") return { kind: "refuse", why: `${short} is ${facts.autoland} in Autoland, which runs these suites on it` };
    return { kind: "scratch" };
  }
  const verdict = liveness(facts);
  if (verdict.live) return { kind: "dispatch", lane: facts.lane !== undefined && facts.onLane ? facts.lane : "" };
  if (!MAIN_ONLY.has(facts.workflow) && facts.lane === undefined && !facts.onMain) return { kind: "scratch" };
  return { kind: "refuse", why: MAIN_ONLY.has(facts.workflow) && facts.lane === undefined && !facts.onMain ? `${verdict.why}: ${facts.workflow} runs only on main or on a lane tip pushed to claude/NAME (--lane NAME)` : verdict.why };
}

export function balanceTimeouts(perPair: number, probe: number): { readonly shard: number; readonly probe: number } {
  return { shard: Math.max(15, Math.ceil((15 * perPair) / 400)), probe: Math.max(25, Math.ceil((25 * probe) / 40)) };
}

class GuardFailure extends Schema.TaggedError<GuardFailure>()("GuardFailure", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

const gh = (...args: string[]) => captureProcess("gh", args.join(" "), ["gh", ...args]).pipe(
  Effect.mapError((cause) => new GuardFailure({ problem: String(cause) })),
);

const Compare = Schema.fromJsonString(Schema.Struct({
  status: Schema.String,
  commits: Schema.Array(Schema.Struct({ sha: Schema.String, commit: Schema.Struct({ message: Schema.String }) })),
}));

const compare = (repo: string, base: string, head: string) => gh("api", `repos/${repo}/compare/${base}...${head}?per_page=250`).pipe(
  Effect.flatMap(({ exitCode, stdout, stderr }) => exitCode === 0
    ? Schema.decodeEffect(Compare)(stdout).pipe(Effect.mapError((cause) => new GuardFailure({ problem: String(cause) })))
    : /HTTP 404/.test(stderr) ? Effect.succeed({ status: "missing", commits: [] }) : Effect.fail(new GuardFailure({ problem: `gh api compare ${base}...${head}: ${stderr.trim()}` }))),
);

const contains = (status: string) => status === "ahead" || status === "identical";

export const measure = (repo: string, workflow: FarmWorkflow, sha: string, lane: string | undefined) => Effect.gen(function*() {
  const main = yield* compare(repo, sha, "main");
  const onLane = lane === undefined ? false : contains((yield* compare(repo, sha, lane)).status);
  const after = main.commits.map(({ sha, commit }) => ({ sha, message: commit.message }));
  return { workflow, sha, onMain: contains(main.status), revertedBy: revertedBy(sha, after), lane, onLane } satisfies Facts;
});

const guard = (repo: string, runId: string, workflow: FarmWorkflow, sha: string, lane: string | undefined) => Effect.gen(function*() {
  const verdict = liveness(yield* measure(repo, workflow, sha, lane));
  if (verdict.live) return yield* Console.log(`farm guard: ${verdict.why}; running`);
  yield* Console.log(`::warning title=Cancelled::${verdict.why}; cancelling run ${runId}`);
  yield* gh("api", "-X", "POST", `repos/${repo}/actions/runs/${runId}/cancel`);
  yield* Effect.sleep("60 seconds");
  yield* gh("api", "-X", "POST", `repos/${repo}/actions/runs/${runId}/force-cancel`);
  yield* Effect.sleep("30 seconds");
  return yield* new GuardFailure({ problem: `${verdict.why}; the run didn't stop` });
});

if (import.meta.main) {
  const { values } = parseArgs({ args: process.argv.slice(2), options: {
    workflow: { type: "string" }, sha: { type: "string" }, lane: { type: "string" }, "per-pair": { type: "string" }, probe: { type: "string" },
  } });
  if (values["per-pair"] !== undefined) {
    const timeouts = balanceTimeouts(Number(values["per-pair"]), Number(values.probe ?? "0"));
    console.log(`shard-timeout=${timeouts.shard}\nprobe-timeout=${timeouts.probe}`);
  } else {
    const workflow = FARM_WORKFLOWS.find((name) => name === values.workflow);
    const repo = process.env.GITHUB_REPOSITORY;
    const runId = process.env.GITHUB_RUN_ID;
    if (workflow === undefined || values.sha === undefined || repo === undefined || runId === undefined) {
      console.error("usage: GITHUB_REPOSITORY=R GITHUB_RUN_ID=N bun scripts/farmGuard.ts --workflow NAME --sha SHA [--lane BRANCH] | --per-pair N --probe N");
      process.exit(2);
    }
    await Effect.runPromise(guard(repo, runId, workflow, values.sha, values.lane === "" ? undefined : values.lane));
  }
}

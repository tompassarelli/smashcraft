// The pre-push gate. Git runs smashcraft:.githooks/pre-push (core.hooksPath
// .githooks) on every push; safe-push runs it itself before taking its
// landing lock, then pushes with it skipped. It names the open "main is
// red" issue's failing tests (smashcraft:ts/scripts/mainRed.ts) and runs the
// clean-room check (smashcraft:ts/scripts/cleanRoom.ts) and the fast checks
// for the projects the pushed commits change, so no lane lands a
// compile break, a type escape or stale model facts. A push to main then runs
// the tests its change affects and is refused when one fails that main's
// latest CI run didn't (smashcraft:ts/scripts/newFailures.ts). CI runs the
// full suite on main. The checks read the working tree, so the gate refuses a push whose
// commit isn't the clean checkout.
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { Console, Effect, Option, Schema } from "effect";
import { issueTests, redTitle } from "./mainRed";
import { GATE_BUDGET_S, affectedTests, appendLanding, decodeRuns, knownFailing, landingLine, newFailures, processResult, refusal } from "./newFailures";

const root = join(import.meta.dir, "../..");
const ZERO = /^0+$/;

export class PrePushRefusal extends Schema.TaggedError<PrePushRefusal>()("PrePushRefusal", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

interface Check { readonly name: string; readonly directory: string; readonly args: readonly string[]; readonly fix?: string }

/** Inputs that rename imported models (content-hashed) or change which models the scene names. */
const MODEL_INPUTS = ["build-inputs.json", "tools/animations/", "ts/src/game/assets/", "ts/src/game/presentation/", "ts/scripts/wisp/playerView.ts", "ts/scripts/wisp/modelFacts.ts"];

export const MODEL_FACTS_REFRESH = "cd ts && bun wisp view models --assets ASSETS --summon ASSETS/summon-original-clips"
  + " --extractor ../build/animation-assets/casc-extract --storage WARCRAFT_III_DIR (smashcraft:docs/player-view.md), then commit ts/scripts/wisp/modelFacts.ts";

/** The checks a push changing `paths` (relative to the repository root) needs. */
export function checksFor(paths: readonly string[]): Check[] {
  const ts = paths.some((path) => path.startsWith("ts/") || path === "typescript-toolchain.lock");
  const client = paths.some((path) => path.startsWith("client/ui/"));
  const models = paths.some((path) => MODEL_INPUTS.some((input) => path === input || input.endsWith("/") && path.startsWith(input)));
  return [
    ...(paths.length > 0 ? [{ name: "clean room", directory: "ts", args: ["scripts/cleanRoom.ts"], fix: "follow wisp:docs/clean-room.md and the line above." }] : []),
    ...(ts ? [
      { name: "type-check ts", directory: "ts", args: ["run", "check"] },
      { name: "type escapes and source shapes", directory: "ts", args: ["test", "test/source-shapes.test.ts"] },
    ] : []),
    ...(models ? [
      { name: "model facts fresh", directory: "ts", args: ["test", "test/model-facts.test.ts"], fix: `refresh them with: ${MODEL_FACTS_REFRESH}` },
      { name: "generated models stored", directory: "ts", args: ["scripts/storedModels.ts"], fix: "store the regenerated family (smashcraft:docs/build-inputs.md, \"Change art\")." },
    ] : []),
    ...(client ? [{ name: "type-check client/ui", directory: "client/ui", args: ["run", "check"] }] : []),
  ];
}

/** Process groups of the children still running; the hook kills them when a signal ends it early. */
const liveGroups = new Set<number>();

const signalGroup = (group: number, signal: NodeJS.Signals) => {
  try {
    process.kill(-group, signal);
  } catch {
    // ESRCH: the group has no members left.
  }
};

/** Kills every child's process group; the hook calls it on SIGINT, SIGTERM and SIGHUP. */
export function killChildren(): void {
  for (const group of liveGroups) signalGroup(group, "SIGKILL");
  liveGroups.clear();
}

/**
 * Runs a child in its own process group to completion and captures its output.
 * Whatever it started dies with it: anything left holding its pipes would keep
 * git waiting for EOF. Interruption sends the group SIGTERM, so a queued
 * capacity request withdraws itself, then SIGKILL after a second.
 */
export const run = (command: readonly string[], cwd: string, stdout: "pipe" | "ignore" = "pipe") => Effect.acquireUseRelease(
  Effect.try({
    try: () => {
      const child = Bun.spawn([...command], { cwd, stdin: "ignore", stdout, stderr: "pipe", detached: true });
      liveGroups.add(child.pid);
      return child;
    },
    catch: (cause) => new PrePushRefusal({ problem: `pre-push: could not start ${command[0]}: ${String(cause)}` }),
  }),
  (child) => Effect.promise(async () => {
    const output = Promise.all([child.stdout === null ? "" : new Response(child.stdout).text(), new Response(child.stderr).text()]);
    const exitCode = await child.exited;
    signalGroup(child.pid, "SIGKILL");
    const [out, err] = await output;
    return { exitCode, stdout: out, stderr: err };
  }),
  (child) => Effect.promise(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      signalGroup(child.pid, "SIGTERM");
      await Promise.race([child.exited, Bun.sleep(1000)]);
    }
    signalGroup(child.pid, "SIGKILL");
    liveGroups.delete(child.pid);
    await child.exited;
  }),
);

/** Git's trimmed output; a failed call refuses the push, since an unknown change set can't pick its checks. */
const git = (...args: string[]) => run(["git", ...args], root).pipe(
  Effect.flatMap(({ exitCode, stdout, stderr }) => exitCode === 0
    ? Effect.succeed(stdout.trim())
    : Effect.fail(new PrePushRefusal({ problem: `pre-push: git ${args.join(" ")} exited ${exitCode}${stderr.trim() === "" ? "" : `: ${stderr.trim()}`}` }))),
);

/** Whether this clone has `commit`; `git cat-file -e` answers with its exit code. */
const hasCommit = (commit: string) => run(["git", "cat-file", "-e", `${commit}^{commit}`], root).pipe(Effect.map(({ exitCode }) => exitCode === 0));

/** The files the pushed commits change: from what the remote has, else from where they leave origin/main. */
const changedPaths = (local: string, remote: string) => Effect.gen(function*() {
  const base = !ZERO.test(remote) && (yield* hasCommit(remote)) ? remote : yield* git("merge-base", local, "origin/main");
  return (yield* git("diff", "--name-only", base, local)).split("\n").filter((path) => path.length > 0);
});

const RedIssues = Schema.fromJsonString(Schema.Array(Schema.Struct({ number: Schema.Finite, title: Schema.String, body: Schema.String, url: Schema.String })));

/** One line naming the open "main is red" issue's failing tests; nothing when main is green or GitHub can't be reached in time. */
export function redNotice(issue: { readonly number: number; readonly body: string; readonly url: string }): string {
  const tests = issueTests(issue.body);
  const shown = tests.slice(0, 8).join("; ");
  return `pre-push: main is red (#${issue.number} ${issue.url}), ${tests.length} failing: ${shown}${tests.length > 8 ? `; and ${tests.length - 8} more` : ""}`;
}

const mainRedNotice = run(["gh", "issue", "list", "--state", "open", "--search", `"${redTitle("main")}" in:title`, "--json", "number,title,body,url"], root).pipe(
  Effect.flatMap(({ exitCode, stdout }) => (exitCode === 0 ? Schema.decodeEffect(RedIssues)(stdout) : Effect.succeed([]))),
  Effect.map((issues) => issues.filter(({ title }) => title === redTitle("main"))),
  Effect.flatMap(Effect.forEach((issue) => Console.error(redNotice(issue)), { discard: true })),
  Effect.timeout("5 seconds"),
  Effect.ignore,
);

/** Runs the gate on git's pre-push input: one "LOCAL_REF LOCAL_SHA REMOTE_REF REMOTE_SHA" line per pushed ref. */
export const prePush = (input: string) => Effect.gen(function*() {
  yield* mainRedNotice;
  const pushed = input.split("\n").flatMap((line) => {
    const [, local, remoteRef, remote] = line.trim().split(/\s+/);
    return local === undefined || remote === undefined || ZERO.test(local) ? [] : [{ local, remoteRef, remote }];
  });
  const paths = [...new Set((yield* Effect.forEach(pushed, ({ local, remote }) => changedPaths(local, remote))).flat())];
  const checks = checksFor(paths);
  if (checks.length === 0) return;
  const head = yield* git("rev-parse", "HEAD");
  const dirty = yield* git("status", "--porcelain", "--", ...new Set(checks.map(({ directory }) => directory)));
  if (pushed.some(({ local }) => local !== head) || dirty !== "") {
    return yield* new PrePushRefusal({ problem: `pre-push: the checks read the working tree, so push the clean checked-out commit (HEAD ${head.slice(0, 12)}).\n${dirty}` });
  }
  for (const { name, directory, args, fix } of checks) {
    const cwd = join(root, directory);
    if (!existsSync(join(cwd, "node_modules"))) yield* run([process.execPath, "install", "--frozen-lockfile"], cwd, "ignore");
    const started = performance.now();
    const child = yield* run([process.execPath, ...args], cwd);
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    if (child.exitCode !== 0) {
      return yield* new PrePushRefusal({ problem: `${child.stdout}${child.stderr}\npre-push: ${name} failed (${seconds} s); ${fix ?? "fix it before landing."}` });
    }
    yield* Console.error(`pre-push: ${name} passed (${seconds} s)`);
  }
  if (pushed.some(({ remoteRef }) => remoteRef === "refs/heads/main")) yield* newFailureGate(head, paths);
});

/** Refuses a push to main whose affected tests fail where main's latest CI run passed; logs each verdict. */
const newFailureGate = (head: string, paths: readonly string[]) => Effect.gen(function*() {
  const plan = affectedTests(paths);
  const gitDirectory = resolve(root, yield* git("rev-parse", "--git-common-dir"));
  const log = join(gitDirectory, "new-fail-gate.tsv");
  for (const path of plan.uncovered) yield* Console.error(`pre-push: no affected-test selection for ${path}; CI covers it`);
  if (plan.deferred.length > 0) yield* Console.error(`pre-push: ${plan.deferred.length} heavier affected test files left to CI: ${plan.deferred.join(", ")}`);
  const units = plan.files.length + plan.game.length + plan.lua.length;
  if (units === 0) return yield* appendLanding(log, landingLine(new Date(), head, "passed", 0, [], 0, "none affected"));
  yield* Console.error(`pre-push: running the affected tests: ${plan.files.length} Bun files, ${plan.game.length} game modules${plan.lua.length === 0 ? "" : `, ${plan.lua.length} in Lua32`} (budget ${GATE_BUDGET_S} s)`);
  const started = performance.now();
  const [finished, known] = yield* Effect.all([
    run([process.execPath, "scripts/newFailures.ts", "run", JSON.stringify(plan)], join(root, "ts")).pipe(Effect.timeoutOption(`${GATE_BUDGET_S} seconds`)),
    knownFailing(join(gitDirectory, "known-failing")),
  ], { concurrency: "unbounded" });
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  const knownFrom = known === undefined ? "main's failing set unavailable" : `main ${known.sha.slice(0, 10)}: ${known.tests.length} failing`;
  if (Option.isNone(finished)) {
    yield* Console.error(`pre-push: the affected tests didn't finish within ${GATE_BUDGET_S} s; landing unverified, CI decides`);
    return yield* appendLanding(log, landingLine(new Date(), head, "unverified", 0, [], units, knownFrom));
  }
  const runs = yield* decodeRuns(finished.value.stdout);
  if (runs === undefined) {
    return yield* new PrePushRefusal({ problem: `${finished.value.stdout}${finished.value.stderr}\npre-push: the affected-test runner exited ${finished.value.exitCode} without a result` });
  }
  const knownTests = new Set(known?.tests ?? []);
  const failures = newFailures(runs, knownTests);
  const passed = runs.reduce((sum, ran) => sum + processResult(ran).passed, 0);
  yield* appendLanding(log, landingLine(new Date(), head, failures.length === 0 ? "passed" : "refused", passed, failures, units, knownFrom));
  if (failures.length > 0) {
    for (const ran of runs) {
      if (newFailures([ran], knownTests).length > 0) yield* Console.error(`${ran.command}\n${ran.output.trimEnd()}`);
    }
    return yield* new PrePushRefusal({ problem: refusal(failures, knownFrom) });
  }
  yield* Console.error(`pre-push: affected tests: ${passed} passed, none newly failing (${knownFrom}; ${seconds} s)`);
});

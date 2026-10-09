










import { existsSync } from "node:fs";
import { join } from "node:path";
import { Console, Effect, Option, Schema } from "effect";
import { issueTests, redTitle } from "./mainRed";

const root = join(import.meta.dir, "../..");
const ZERO = /^0+$/;

export class PrePushRefusal extends Schema.TaggedError<PrePushRefusal>()("PrePushRefusal", { problem: Schema.String }) {
  override get message(): string {
    return this.problem;
  }
}

interface Check { readonly name: string; readonly directory: string; readonly args: readonly string[]; readonly fix?: string }


const MODEL_INPUTS = ["build-inputs.json", "tools/animations/", "ts/src/game/assets/", "ts/src/game/presentation/", "ts/scripts/wisp/playerView.ts", "ts/scripts/wisp/modelFacts.ts"];

export const MODEL_FACTS_REFRESH = "cd ts && bun wisp view models --assets ASSETS --summon ASSETS/summon-original-clips"
  + " --extractor ../build/animation-assets/casc-extract --storage WARCRAFT_III_DIR (smashcraft:docs/player-view.md), then commit ts/scripts/wisp/modelFacts.ts";


export function checksFor(paths: readonly string[]): Check[] {
  const ts = paths.some((path) => path.startsWith("ts/") || path === "typescript-toolchain.lock");
  const models = paths.some((path) => MODEL_INPUTS.some((input) => path === input || input.endsWith("/") && path.startsWith(input)));
  return [
    ...(paths.length > 0 ? [{ name: "clean room", directory: "ts", args: ["scripts/cleanRoom.ts"], fix: "follow wisp:docs/clean-room.md and the line above." }] : []),
    ...(ts ? [
      { name: "type-check ts", directory: "ts", args: ["run", "check"] },
      { name: "type escapes and source shapes", directory: "ts", args: ["test", "test/source-shapes.test.ts"] },
      { name: "oracle tags on tests", directory: "ts", args: ["scripts/oracleTagsCheck.ts"], fix: "tag each refused test title with its oracle (listed above) or delete the test." },
    ] : []),
    ...(models ? [
      { name: "model facts fresh", directory: "ts", args: ["test", "test/model-facts.test.ts"], fix: `refresh them with: ${MODEL_FACTS_REFRESH}` },
      { name: "generated models stored", directory: "ts", args: ["scripts/storedModels.ts"], fix: "store the regenerated family (smashcraft:docs/build-inputs.md, \"Change art\")." },
    ] : []),
  ];
}


const liveGroups = new Set<number>();

const signalGroup = (group: number, signal: NodeJS.Signals) => {
  try {
    process.kill(-group, signal);
  } catch {

  }
};


export function killChildren(): void {
  for (const group of liveGroups) signalGroup(group, "SIGKILL");
  liveGroups.clear();
}







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


const git = (...args: string[]) => run(["git", ...args], root).pipe(
  Effect.flatMap(({ exitCode, stdout, stderr }) => exitCode === 0
    ? Effect.succeed(stdout.trim())
    : Effect.fail(new PrePushRefusal({ problem: `pre-push: git ${args.join(" ")} exited ${exitCode}${stderr.trim() === "" ? "" : `: ${stderr.trim()}`}` }))),
);


const hasCommit = (commit: string) => run(["git", "cat-file", "-e", `${commit}^{commit}`], root).pipe(Effect.map(({ exitCode }) => exitCode === 0));


const changedPaths = (local: string, remote: string) => Effect.gen(function*() {
  const base = !ZERO.test(remote) && (yield* hasCommit(remote)) ? remote : yield* git("merge-base", local, "origin/main");
  return (yield* git("diff", "--name-only", base, local)).split("\n").filter((path) => path.length > 0);
});

const RedIssues = Schema.fromJsonString(Schema.Array(Schema.Struct({ number: Schema.Finite, title: Schema.String, body: Schema.String, url: Schema.String })));


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


export const prePush = (input: string) => Effect.gen(function*() {
  yield* mainRedNotice;
  const pushed = input.split("\n").flatMap((line) => {
    const [, local, remoteRef, remote] = line.trim().split(/\s+/);
    return local === undefined || remote === undefined || ZERO.test(local) ? [] : [{ local, remoteRef, remote }];
  });
  const paths = [...new Set((yield* Effect.forEach(pushed, ({ local, remote }) => changedPaths(local, remote))).flat())];
  const checks = checksFor(paths);
  const toMain = pushed.some(({ remoteRef }) => remoteRef === "refs/heads/main");
  if (checks.length === 0 && !toMain) return;
  const head = yield* git("rev-parse", "HEAD");
  const dirty = checks.length === 0 ? "" : yield* git("status", "--porcelain", "--", ...new Set(checks.map(({ directory }) => directory)));
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
  if (toMain) yield* farmGate(head);
});


const FARM_TIMEOUT_MINUTES = 30;
const FarmRuns = Schema.fromJsonString(Schema.Array(Schema.Struct({ displayTitle: Schema.String, conclusion: Schema.String, url: Schema.String })));


export function greenFarmRun(runs: readonly { readonly displayTitle: string; readonly conclusion: string; readonly url: string }[], sha: string): string | undefined {
  return runs.find(({ displayTitle, conclusion }) => conclusion === "success" && displayTitle.startsWith(`Farm test ${sha} `))?.url;
}


const farmGate = (head: string) => Effect.gen(function*() {
  const listed = yield* run(["gh", "run", "list", "--workflow", "farm-test.yml", "--status", "success", "--limit", "100", "--json", "displayTitle,conclusion,url"], root);
  const runs = listed.exitCode === 0 ? yield* Schema.decodeEffect(FarmRuns)(listed.stdout).pipe(Effect.orElseSucceed(() => [])) : [];
  const green = greenFarmRun(runs, head);
  if (green !== undefined) return yield* Console.error(`pre-push: the farm suite is green on ${head.slice(0, 12)} (${green})`);
  yield* Console.error(`pre-push: main lands only on a green farm suite for this exact commit; running bun wisp farm test --ref ${head.slice(0, 12)} --wait`);
  const started = performance.now();
  const farm = yield* run([process.execPath, "wisp", "farm", "test", "--ref", head, "--wait"], join(root, "ts")).pipe(Effect.timeoutOption(`${FARM_TIMEOUT_MINUTES} minutes`));
  const minutes = ((performance.now() - started) / 60000).toFixed(1);
  if (Option.isNone(farm)) return yield* new PrePushRefusal({ problem: `pre-push: the farm suite on ${head.slice(0, 12)} didn't finish within ${FARM_TIMEOUT_MINUTES} minutes; NOT landed` });
  if (farm.value.exitCode !== 0) {
    return yield* new PrePushRefusal({ problem: `${farm.value.stdout}${farm.value.stderr}\npre-push: the farm suite failed on ${head.slice(0, 12)} (${minutes} min); main lands only on a green suite, including tests main already fails` });
  }
  yield* Console.error(`pre-push: the farm suite passed on ${head.slice(0, 12)} (${minutes} min)`);
});

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/process";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { runProcess } from "../hostProcess";
import { currentPlaytest } from "./currentPlaytest";
import { type Candidate, type RunSummary, parseInstalled, pickGreen, verdictOf } from "./greenBuilds";
import { installLatest } from "./mapLibrary";
import { projectRoot } from "./project";

const COMMITS_CONSIDERED = 20;
const FARM_RUNS_LISTED = 200;

const Runs = Schema.Array(Schema.Struct({
  displayTitle: Schema.String,
  status: Schema.String,
  conclusion: Schema.String,
  createdAt: Schema.String,
}));
const decodeRuns = Schema.decodeUnknownEffect(Schema.fromJsonString(Runs));

const problem = (cause: { readonly message: string }) => new PlayProblem({ problem: cause.message });

const host = (program: string, args: readonly string[]) =>
  runProcess(ChildProcess.make(program, args, { cwd: projectRoot, stdin: "ignore" })).pipe(Effect.mapError(problem));

const runs = (args: readonly string[]) => host("gh", ["run", "list", ...args, "--json", "displayTitle,status,conclusion,createdAt"]).pipe(
  Effect.flatMap((text) => decodeRuns(text).pipe(Effect.mapError(problem))),
);

const summary = ({ status, conclusion, createdAt }: RunSummary): RunSummary => ({ status, conclusion, createdAt });

function installedCommits(documents: string): string[] {
  const root = join(documents, "Maps/00-Smashcraft");
  return [root, join(root, "older")].flatMap((folder) => existsSync(folder) ? readdirSync(folder) : [])
    .flatMap((file) => parseInstalled(file)?.commit ?? []);
}

export const installGreen = (documents: string) => Effect.gen(function*() {
  yield* host("git", ["fetch", "origin", "main"]);
  const listed = yield* host("git", ["rev-list", "--first-parent", "-n", String(COMMITS_CONSIDERED), "origin/main"]);
  const shas = listed.split("\n").filter((sha) => /^[a-f0-9]{40}$/.test(sha));
  if (shas.length === 0) return yield* new PlayProblem({ problem: "origin/main lists no commits" });

  const farmRuns = yield* runs(["--workflow", "farm-test.yml", "--limit", String(FARM_RUNS_LISTED)]);
  const considered: Candidate[] = [];
  for (const sha of shas) {
    const ci = verdictOf((yield* runs(["--workflow", "ci.yml", "--commit", sha, "--limit", "20"])).map(summary));
    const farm = verdictOf(farmRuns.filter(({ displayTitle }) => displayTitle.startsWith(`Farm test ${sha} `)).map(summary));
    considered.push({ sha, ci, farm });
    if (ci === "success" && farm === "success") break;
  }

  const installed = installedCommits(documents);
  const pick = pickGreen(considered, installed);
  if (pick === undefined) {
    console.log(considered.some(({ ci, farm }) => ci === "success" && farm === "success")
      ? "The newest green commit on main is already installed (or an installed build is newer)"
      : `No green commit among the newest ${shas.length} on main (${considered.map(({ sha, ci, farm }) => `${sha.slice(0, 7)} ci ${ci} farm ${farm}`).join("; ")})`);
    return;
  }

  const { map } = yield* currentPlaytest(join(documents, "Maps/00-Smashcraft"), { revision: pick.sha, named: true, helper: false });
  yield* Effect.try({ try: () => installLatest(documents, map.source), catch: (cause) => new PlayProblem({ problem: String(cause) }) });
  console.log(`Installed ${map.title} under Maps/${map.folder}`);
}).pipe(Effect.provide(BunServices.layer));

// The owner's play command consumes main. Experiments use fresh/accept instead.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { Effect, Schema } from "effect";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { projectRoot } from "./project";

const inputsRoot = join(homedir(), ".local/share/smashcraft-build-inputs");
const Inputs = Schema.Struct({ base: Schema.String, container: Schema.String, assets: Schema.String, summon: Schema.String });
const run = (cwd: string, args: readonly string[]) => Effect.tryPromise({
  try: async () => {
    const child = Bun.spawn([...args], { cwd, stdout: "inherit", stderr: "inherit" });
    if (await child.exited !== 0) throw new Error(`${args[0]} failed while preparing the current build`);
  },
  catch: (cause) => new PlayProblem({ problem: String(cause) }),
});

/** Main's build keeps its number; a new build of main takes the next number after every one built or in the owner's library. */
export function playVersion(builds: string, library: string, revision: string): string {
  const numbered = (directory: string): (readonly [number, number, number])[] => {
    if (!existsSync(directory)) return [];
    return readdirSync(directory).flatMap((entry) => {
      const match = /^Smashcraft (\d+)\.(\d+)\.(\d+)\.w3x$/.exec(entry);
      return match === null ? [] : [[Number(match[1]), Number(match[2]), Number(match[3])] as const];
    });
  };
  const [own] = numbered(join(builds, revision));
  if (own !== undefined) return own.join(".");
  const seen = [library, join(library, "older"), ...(existsSync(builds) ? readdirSync(builds).map((entry) => join(builds, entry)) : [])].flatMap(numbered);
  const [major, minor, patch] = seen.reduce((best, next) => (next[0] - best[0] || next[1] - best[1] || next[2] - best[2]) > 0 ? next : best, [0, 0, 0] as const);
  return `${major}.${minor}.${patch + 1}`;
}

/** Main's revision, its companion tree and the main checkout. */
const resolveMain = Effect.tryPromise({
  try: async () => {
    const child = Bun.spawn(["git", "rev-parse", "main", "main:companion"], { cwd: projectRoot, stdout: "pipe", stderr: "pipe" });
    const [revision, companion] = (await new Response(child.stdout).text()).trim().split("\n");
    if (await child.exited !== 0 || revision === undefined || companion === undefined || !/^[a-f0-9]{40}$/.test(revision) || !/^[a-f0-9]{40}$/.test(companion)) throw new Error("couldn't resolve Smashcraft main");
    const registry = Bun.spawn(["git", "worktree", "list", "--porcelain"], { cwd: projectRoot, stdout: "pipe", stderr: "pipe" });
    const mainBlock = (await new Response(registry.stdout).text()).split("\n\n").find((block) => block.split("\n").includes("branch refs/heads/main"));
    const mainCheckout = mainBlock?.split("\n").find((line) => line.startsWith("worktree "))?.slice(9);
    if (await registry.exited !== 0 || mainCheckout === undefined) throw new Error("couldn't locate the main checkout");
    return { mainCheckout, revision, companion };
  },
  catch: (cause) => new PlayProblem({ problem: String(cause) }),
});

/** Builds and dependency installs stay in a dedicated lane, never main. */
const buildLane = (mainCheckout: string, revision: string) => Effect.gen(function*() {
  const lane = join(dirname(mainCheckout), "worktrees", `play-build-${revision.slice(0, 12)}`);
  if (!existsSync(lane)) yield* run(projectRoot, ["git", "worktree", "add", "--detach", lane, revision]);
  return lane;
});

const helperPath = (companion: string) => join(inputsRoot, "play-helpers", companion, "wc3-journal");

const buildHelper = (lane: string, helper: string) => Effect.gen(function*() {
  const capacity = join(homedir(), ".codex/skills/machine-capacity/scripts/machine-capacity.mjs");
  yield* run(join(lane, "companion"), ["nix-shell", "-p", "stdenv.cc", "cmake", "pkg-config", "libxkbcommon", "udev", "--run",
    `PATH=${join(homedir(), ".rustup/toolchains/1.96.1-x86_64-unknown-linux-gnu/bin")}:$PATH bun '${capacity}' run --class moderate --owner smashcraft:play-helper --timeout-seconds 900 -- cargo build --release --locked --jobs 2 --bin wc3-journal`]);
  mkdirSync(dirname(helper), { recursive: true });
  copyFileSync(join(lane, "companion/target/release/wc3-journal"), helper);
});

/** Main's controller helper, built on first use. */
export const currentHelper = Effect.gen(function*() {
  const { revision, companion, mainCheckout } = yield* resolveMain;
  const helper = helperPath(companion);
  if (existsSync(helper)) return helper;
  console.log("Building the controller helper");
  yield* buildHelper(yield* buildLane(mainCheckout, revision), helper);
  return helper;
});

/** Main's playable map and helper, built on first use; `library` is the owner's Smashcraft maps folder. */
export const currentPlaytest = (library: string) => Effect.gen(function*() {
  const { revision, companion, mainCheckout } = yield* resolveMain;
  const builds = join(inputsRoot, "play-current");
  const title = `Smashcraft ${playVersion(builds, library, revision)}`;
  const directory = join(builds, revision);
  const source = join(directory, `${title}.w3x`);
  const helper = helperPath(companion);
  if (existsSync(source) && existsSync(helper)) return { map: { folder: "00-Smashcraft", file: `${title}.w3x`, title, source }, helper };
  console.log(`Building ${title} for your controller`);
  const input = yield* Effect.tryPromise({ try: () => Bun.file(join(inputsRoot, "play-inputs.json")).json(), catch: (cause) => new PlayProblem({ problem: `couldn't read play's private build inputs: ${String(cause)}` }) }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Inputs)), Effect.mapError((cause) => new PlayProblem({ problem: String(cause) })),
  );
  const lane = yield* buildLane(mainCheckout, revision);
  yield* run(join(lane, "ts"), ["bun", "install", "--frozen-lockfile"]);
  mkdirSync(directory, { recursive: true });
  yield* run(join(lane, "ts"), ["bun", "wisp", "build", "--profile", "playable", "--base", input.base, "--container", input.container,
    "--assets", input.assets, "--summon", input.summon, "--name", title, "--out", source]);
  if (!existsSync(helper)) yield* buildHelper(lane, helper);
  return { map: { folder: "00-Smashcraft", file: `${title}.w3x`, title, source }, helper };
});

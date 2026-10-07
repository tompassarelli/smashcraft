// The owner's play command consumes main. Experiments use fresh/accept instead.
// Every builder of a revision takes that revision's lock, builds in a private
// staging folder and publishes the finished folder by one rename, so
// concurrent plays of one revision wait and reuse one build
// (smashcraft:docs/build-inputs.md).
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { Effect } from "effect";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { buildOnce } from "./buildInputs";
import { withLock } from "./fileLock";
import { projectRoot } from "./project";

const inputsRoot = join(homedir(), ".local/share/smashcraft-build-inputs");
const builds = join(inputsRoot, "play-current");
const locks = join(inputsRoot, "locks");
const run = (cwd: string, args: readonly string[]) => Effect.tryPromise({
  try: async () => {
    const child = Bun.spawn([...args], { cwd, stdout: "inherit", stderr: "inherit" });
    if (await child.exited !== 0) throw new Error(`${args[0]} failed while preparing the current build`);
  },
  catch: (cause) => new PlayProblem({ problem: String(cause) }),
});
const capture = (cwd: string, args: readonly string[]) => {
  const child = Bun.spawnSync([...args], { cwd, stdout: "pipe", stderr: "pipe" });
  return child.exitCode === 0 ? child.stdout.toString().trim() : undefined;
};
const tryPlay = <A>(run: () => A) => Effect.try({ try: run, catch: (cause) => new PlayProblem({ problem: String(cause) }) });

/** A revision's reserved version: `play-current/REVISION.version`. */
const reservation = (directory: string, revision: string) => join(directory, `${revision}.version`);

/**
 * Main's build keeps its number; a new build of main takes the next number
 * after every one built, reserved or in the owner's library.
 */
export function playVersion(directory: string, library: string, revision: string): string {
  const parse = (text: string) => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(text.trim());
    return match === null ? [] : [[Number(match[1]), Number(match[2]), Number(match[3])] as const];
  };
  const numbered = (folder: string): (readonly [number, number, number])[] => {
    if (statSync(folder, { throwIfNoEntry: false })?.isDirectory() !== true) return [];
    return readdirSync(folder).flatMap((entry) => {
      const match = /^Smashcraft (\d+\.\d+\.\d+)\.w3x$/.exec(entry);
      return match === null ? [] : parse(match[1]!);
    });
  };
  const reserved = (path: string) => existsSync(path) ? parse(readFileSync(path, "utf8")) : [];
  const [own] = [...reserved(reservation(directory, revision)), ...numbered(join(directory, revision))];
  if (own !== undefined) return own.join(".");
  const entries = existsSync(directory) ? readdirSync(directory).map((entry) => join(directory, entry)) : [];
  const seen = [
    ...[library, join(library, "older"), ...entries].flatMap(numbered),
    ...entries.filter((entry) => entry.endsWith(".version")).flatMap(reserved),
  ];
  const [major, minor, patch] = seen.reduce((best, next) => (next[0] - best[0] || next[1] - best[1] || next[2] - best[2]) > 0 ? next : best, [0, 0, 0] as const);
  return `${major}.${minor}.${patch + 1}`;
}

/** Reserves `revision`'s version under the numbering lock, so two revisions built at once never share a number. */
const reserveVersion = (library: string, revision: string) => withLock(join(locks, "play-version.lock"), "Waiting for another play build to number its map",
  tryPlay(() => {
    const version = playVersion(builds, library, revision);
    const path = reservation(builds, revision);
    if (!existsSync(path)) {
      mkdirSync(builds, { recursive: true });
      writeFileSync(`${path}.${process.pid}.next`, `${version}\n`);
      renameSync(`${path}.${process.pid}.next`, path);
    }
    return version;
  }));

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

/** The lock held by whoever uses `revision`'s build lane or builds its map. */
const revisionLock = (revision: string) => join(locks, `play-${revision}.lock`);

/**
 * The revision's build lane, outside main. Only the holder of the
 * revision's lock uses it; one left half-made by an interrupted run is replaced.
 */
const buildLane = (mainCheckout: string, revision: string) => Effect.gen(function*() {
  const lane = join(dirname(mainCheckout), "worktrees", `play-build-${revision.slice(0, 12)}`);
  if (existsSync(lane) && capture(lane, ["git", "rev-parse", "HEAD"]) !== revision) {
    capture(projectRoot, ["git", "worktree", "remove", "--force", lane]);
    yield* tryPlay(() => rmSync(lane, { recursive: true, force: true }));
    capture(projectRoot, ["git", "worktree", "prune"]);
  }
  if (!existsSync(lane)) yield* run(projectRoot, ["git", "worktree", "add", "--detach", lane, revision]);
  return lane;
});

/** The lane is scratch: a finished build removes it. */
const removeLane = (mainCheckout: string, revision: string) => Effect.sync(() => {
  capture(projectRoot, ["git", "worktree", "remove", "--force", join(dirname(mainCheckout), "worktrees", `play-build-${revision.slice(0, 12)}`)]);
});

const helperPath = (companion: string) => join(inputsRoot, "play-helpers", companion, "wc3-journal");

const buildHelper = (lane: string, helper: string) => Effect.gen(function*() {
  const capacity = join(homedir(), "code/nixos-config/main/dotfiles/agents/skills/machine-capacity/scripts/machine-capacity.mjs");
  yield* run(join(lane, "companion"), ["nix-shell", "-p", "stdenv.cc", "cmake", "pkg-config", "libxkbcommon", "udev", "--run",
    `PATH=${join(homedir(), ".rustup/toolchains/1.96.1-x86_64-unknown-linux-gnu/bin")}:$PATH bun '${capacity}' run --class moderate --owner smashcraft:play-helper --timeout-seconds 900 -- cargo build --release --locked --jobs 2 --bin wc3-journal`]);
  // A helper another run installed meanwhile may be running: replace it by rename, never write over it (ETXTBSY).
  yield* tryPlay(() => {
    mkdirSync(dirname(helper), { recursive: true });
    const staged = `${helper}.${process.pid}.tmp`;
    copyFileSync(join(lane, "companion/target/release/wc3-journal"), staged);
    renameSync(staged, helper);
  });
});

/** Main's controller helper, built on first use. */
export const currentHelper = Effect.gen(function*() {
  const { revision, companion, mainCheckout } = yield* resolveMain;
  const helper = helperPath(companion);
  if (existsSync(helper)) return helper;
  return yield* withLock(revisionLock(revision), `Waiting for another build of ${revision.slice(0, 12)}`, Effect.gen(function*() {
    if (existsSync(helper)) return helper;
    console.log("Building the controller helper");
    yield* buildHelper(yield* buildLane(mainCheckout, revision), helper);
    yield* removeLane(mainCheckout, revision);
    return helper;
  }));
});

/**
 * Main's playable map, built once per revision into play-current/REVISION
 * from the inputs main's build-inputs.json names; `library` is the owner's
 * Smashcraft maps folder. The controller helper is optional (#166): a new
 * build tries it after the map, and a failed helper build leaves the keyboard
 * (`bun wisp controller` builds it on demand).
 */
export const currentPlaytest = (library: string) => Effect.gen(function*() {
  const { revision, companion, mainCheckout } = yield* resolveMain;
  const title = `Smashcraft ${yield* reserveVersion(library, revision)}`;
  const final = join(builds, revision);
  const map = { folder: "00-Smashcraft", file: `${title}.w3x`, title, source: join(final, `${title}.w3x`) };
  const helper = helperPath(companion);
  yield* buildOnce(revisionLock(revision), final, (folder) => existsSync(join(folder, map.file)), `Waiting for another build of ${title}`, (staging) => Effect.gen(function*() {
    console.log(`Building ${title}`);
    const lane = yield* buildLane(mainCheckout, revision);
    yield* run(join(lane, "ts"), ["bun", "install", "--frozen-lockfile"]);
    yield* run(join(lane, "ts"), ["bun", "wisp", "build", "--profile", "playable", "--name", title, "--out", join(staging, map.file)]);
    if (!existsSync(helper)) {
      yield* buildHelper(lane, helper).pipe(Effect.catch((problem) => Effect.sync(() => console.log(`No controller helper for this build (${problem.problem}); the keyboard plays`))));
    }
    yield* removeLane(mainCheckout, revision);
  })).pipe(Effect.mapError((cause) => cause instanceof PlayProblem ? cause : new PlayProblem({ problem: cause.message })));
  return { map, helper: existsSync(helper) ? helper : undefined };
});

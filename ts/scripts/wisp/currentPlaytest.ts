




import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { ChildProcess } from "effect/process";
import { PlayProblem } from "wisp/scripts/wisp/play";
import { runProcess } from "../hostProcess";
import { buildOnce } from "./buildInputs";
import { withLock } from "./fileLock";
import { PLAYABLE_FILE, installName } from "./greenBuilds";
import { projectRoot } from "./project";

const inputsRoot = join(homedir(), ".local/share/smashcraft-build-inputs");
const builds = join(inputsRoot, "play-current");
const locks = join(inputsRoot, "locks");
const playProblem = (cause: unknown) => new PlayProblem({ problem: String(cause) });

const run = (cwd: string, [program = "", ...args]: readonly string[]) =>
  runProcess(ChildProcess.make(program, args, { cwd, stdin: "ignore", stdout: "inherit", stderr: "inherit" })).pipe(
    Effect.asVoid,
    Effect.mapError(() => playProblem(new Error(`${program} failed while preparing the current build`))),
  );

const capture = (cwd: string, [program = "", ...args]: readonly string[]) =>
  runProcess(ChildProcess.make(program, args, { cwd, stdin: "ignore" })).pipe(Effect.orElseSucceed(() => undefined));
const tryPlay = <A>(run: () => A) => Effect.try({ try: run, catch: playProblem });


const reservation = (directory: string, revision: string) => join(directory, `${revision}.version`);





function playVersion(directory: string, library: string, revision: string): string {
  const parse = (text: string) => {
    const match = /^(0)\.(0)\.(\d+)$/.exec(text.trim());
    return match === null ? [] : [[Number(match[1]), Number(match[2]), Number(match[3])] as const];
  };
  const numbered = (folder: string): (readonly [number, number, number])[] => {
    if (statSync(folder, { throwIfNoEntry: false })?.isDirectory() !== true) return [];
    return readdirSync(folder).flatMap((entry) => {
      const version = PLAYABLE_FILE.exec(entry)?.[1];
      return version === undefined ? [] : parse(version);
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


const reserveVersion = (library: string, revision: string) => withLock(join(locks, "play-version.lock"), "Waiting for another play build to number its map",
  tryPlay(() => {
    const version = playVersion(builds, library, revision);
    const path = reservation(builds, revision);
    if (!existsSync(path) || readFileSync(path, "utf8").trim() !== version) {
      mkdirSync(builds, { recursive: true });
      writeFileSync(`${path}.${process.pid}.next`, `${version}\n`);
      renameSync(`${path}.${process.pid}.next`, path);
    }
    return version;
  }));


const mainCheckoutOf = Effect.gen(function*() {
  const registry = yield* capture(projectRoot, ["git", "worktree", "list", "--porcelain"]);
  const mainBlock = registry?.split("\n\n").find((block) => block.split("\n").includes("branch refs/heads/main"));
  const mainCheckout = mainBlock?.split("\n").find((line) => line.startsWith("worktree "))?.slice(9);
  if (mainCheckout === undefined) return yield* playProblem(new Error("couldn't locate the main checkout"));
  return mainCheckout;
});


const resolveMain = Effect.gen(function*() {
  const resolved = yield* capture(projectRoot, ["git", "rev-parse", "main", "main:controller"]);
  const [revision, controller] = (resolved ?? "").split("\n");
  if (resolved === undefined || revision === undefined || controller === undefined || !/^[a-f0-9]{40}$/.test(revision) || !/^[a-f0-9]{40}$/.test(controller)) return yield* playProblem(new Error("couldn't resolve Smashcraft main"));
  return { mainCheckout: yield* mainCheckoutOf, revision, controller };
});


const resolveRevision = (revision: string) => Effect.gen(function*() {
  const controller = (yield* capture(projectRoot, ["git", "rev-parse", `${revision}:controller`]))?.trim();
  if (controller === undefined || !/^[a-f0-9]{40}$/.test(controller)) return yield* playProblem(new Error(`couldn't resolve commit ${revision}`));
  return { mainCheckout: yield* mainCheckoutOf, revision, controller };
});


const revisionLock = (revision: string) => join(locks, `play-${revision}.lock`);





const buildLane = (mainCheckout: string, revision: string) => Effect.gen(function*() {
  const lane = join(dirname(mainCheckout), "worktrees", `play-build-${revision.slice(0, 12)}`);
  if (existsSync(lane) && (yield* capture(lane, ["git", "rev-parse", "HEAD"])) !== revision) {
    yield* capture(projectRoot, ["git", "worktree", "remove", "--force", lane]);
    yield* tryPlay(() => rmSync(lane, { recursive: true, force: true }));
    yield* capture(projectRoot, ["git", "worktree", "prune"]);
  }
  if (!existsSync(lane)) yield* run(projectRoot, ["git", "worktree", "add", "--detach", lane, revision]);
  return lane;
});


const removeLane = (mainCheckout: string, revision: string) =>
  capture(projectRoot, ["git", "worktree", "remove", "--force", join(dirname(mainCheckout), "worktrees", `play-build-${revision.slice(0, 12)}`)]).pipe(Effect.asVoid);

const helperPath = (controller: string) => join(inputsRoot, "play-helpers", controller, "wc3-journal");
const helperTarget = join(inputsRoot, "play-helper-target");


const buildHelper = (lane: string, helper: string) => withLock(join(locks, "play-helper-target.lock"), "Waiting for another controller helper build", Effect.gen(function*() {
  const capacity = join(homedir(), "code/nixos-config/main/dotfiles/agents/skills/machine-capacity/scripts/machine-capacity.mjs");
  // The pinned wc3-controller service comes from the plug-in's git dependency (controller/Cargo.toml).
  const build = (target: string) => `cargo build --release --locked --jobs 2 --target-dir '${helperTarget}' ${target}`;
  yield* run(join(lane, "controller"), ["nix-shell", "-p", "stdenv.cc", "cmake", "pkg-config", "libxkbcommon", "udev", "--run",
    `PATH=${join(homedir(), ".rustup/toolchains/1.96.1-x86_64-unknown-linux-gnu/bin")}:$PATH bun '${capacity}' run --class moderate --owner smashcraft:play-helper --timeout-seconds 900 -- sh -c "${build("--bin wc3-journal")} && ${build("-p wc3-controller --bin wc3-controller")}"`]);

  yield* tryPlay(() => {
    mkdirSync(dirname(helper), { recursive: true });
    for (const name of ["wc3-controller", "wc3-journal"]) {
      const staged = join(dirname(helper), `${name}.${process.pid}.tmp`);
      copyFileSync(join(helperTarget, "release", name), staged);
      renameSync(staged, join(dirname(helper), name));
    }
  });
}));


export const currentHelper = Effect.gen(function*() {
  const { revision, controller, mainCheckout } = yield* resolveMain;
  const helper = helperPath(controller);
  if (existsSync(helper)) return helper;
  return yield* withLock(revisionLock(revision), `Waiting for another build of ${revision.slice(0, 12)}`, Effect.gen(function*() {
    if (existsSync(helper)) return helper;
    console.log("Building the controller helper");
    yield* buildHelper(yield* buildLane(mainCheckout, revision), helper);
    yield* removeLane(mainCheckout, revision);
    return helper;
  }));
}).pipe(Effect.provide(BunServices.layer));








interface PlaytestOptions {
  readonly revision?: string;
  readonly named?: boolean;
  readonly helper?: boolean;
}

const builtMap = (folder: string): string | undefined =>
  existsSync(folder) ? readdirSync(folder).find((entry) => PLAYABLE_FILE.test(entry)) : undefined;

export const currentPlaytest = (library: string, { revision: wanted, named = false, helper: wantsHelper = true }: PlaytestOptions = {}) => Effect.gen(function*() {
  const { revision, controller, mainCheckout } = yield* (wanted === undefined ? resolveMain : resolveRevision(wanted));
  const version = yield* reserveVersion(library, revision);
  const final = join(builds, revision);
  const built = builtMap(final);
  const title = built !== undefined ? built.slice(0, -".w3x".length) : named ? installName(version, revision) : `Smashcraft ${version}`;
  const map = { folder: "00-Smashcraft", file: `${title}.w3x`, title, source: join(final, `${title}.w3x`) };
  const helper = helperPath(controller);
  yield* buildOnce(revisionLock(revision), final, (folder) => existsSync(join(folder, map.file)), `Waiting for another build of ${title}`, (staging) => Effect.gen(function*() {
    console.log(`Building ${title}`);
    const lane = yield* buildLane(mainCheckout, revision);
    yield* run(join(lane, "ts"), ["bun", "install", "--frozen-lockfile"]);
    yield* run(join(lane, "ts"), ["bun", "wisp", "map", "build", "--profile", "playable", "--name", title, "--out", join(staging, map.file)]);
    if (wantsHelper && !existsSync(helper)) {
      yield* buildHelper(lane, helper).pipe(Effect.catch((problem) => Effect.sync(() => console.log(`No controller helper for this build (${problem.problem}); the keyboard plays`))));
    }
    yield* removeLane(mainCheckout, revision);
  })).pipe(Effect.mapError((cause) => cause instanceof PlayProblem ? cause : new PlayProblem({ problem: cause.message })));
  return { map, helper: existsSync(helper) ? helper : undefined };
}).pipe(Effect.provide(BunServices.layer));

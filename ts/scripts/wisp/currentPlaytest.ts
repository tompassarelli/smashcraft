// The owner's play command consumes main. Experiments use fresh/accept instead.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
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

export const currentPlaytest = Effect.gen(function*() {
  const { revision, companion, mainCheckout, version } = yield* Effect.tryPromise({
    try: async () => {
      const child = Bun.spawn(["git", "rev-parse", "main", "main:companion"], { cwd: projectRoot, stdout: "pipe", stderr: "pipe" });
      const [revision, companion] = (await new Response(child.stdout).text()).trim().split("\n");
      if (await child.exited !== 0 || revision === undefined || companion === undefined || !/^[a-f0-9]{40}$/.test(revision) || !/^[a-f0-9]{40}$/.test(companion)) throw new Error("couldn't resolve Smashcraft main");
      const registry = Bun.spawn(["git", "worktree", "list", "--porcelain"], { cwd: projectRoot, stdout: "pipe", stderr: "pipe" });
      const mainBlock = (await new Response(registry.stdout).text()).split("\n\n").find((block) => block.split("\n").includes("branch refs/heads/main"));
      const mainCheckout = mainBlock?.split("\n").find((line) => line.startsWith("worktree "))?.slice(9);
      if (await registry.exited !== 0 || mainCheckout === undefined) throw new Error("couldn't locate the main checkout");
      const manifest = Bun.spawn(["git", "show", `${revision}:ts/package.json`], { cwd: projectRoot, stdout: "pipe", stderr: "pipe" });
      const version: unknown = JSON.parse(await new Response(manifest.stdout).text()).version;
      if (await manifest.exited !== 0 || typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Smashcraft main has no version in ts/package.json");
      return { mainCheckout, revision, companion, version };
    },
    catch: (cause) => new PlayProblem({ problem: String(cause) }),
  });
  const title = `Smashcraft ${version} ${revision.slice(0, 8)}`;
  const directory = join(inputsRoot, "play-current", revision);
  const source = join(directory, `${title}.w3x`);
  const helper = join(inputsRoot, "play-helpers", companion, "wc3-journal");
  if (existsSync(source) && existsSync(helper)) return { map: { folder: "00-Smashcraft", file: `${title}.w3x`, title, source }, helper };
  console.log(`Building ${title} for your controller`);
  const input = yield* Effect.tryPromise({ try: () => Bun.file(join(inputsRoot, "play-inputs.json")).json(), catch: (cause) => new PlayProblem({ problem: `couldn't read play's private build inputs: ${String(cause)}` }) }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Inputs)), Effect.mapError((cause) => new PlayProblem({ problem: String(cause) })),
  );
  // Builds and dependency installs stay in a dedicated lane, never main.
  const lane = join(dirname(mainCheckout), "worktrees", `play-build-${revision.slice(0, 12)}`);
  if (!existsSync(lane)) yield* run(projectRoot, ["git", "worktree", "add", "--detach", lane, revision]);
  yield* run(join(lane, "ts"), ["bun", "install", "--frozen-lockfile"]);
  mkdirSync(directory, { recursive: true });
  yield* run(join(lane, "ts"), ["bun", "wisp", "build", "--profile", "playable", "--base", input.base, "--container", input.container,
    "--assets", input.assets, "--summon", input.summon, "--name", title, "--out", source]);
  if (!existsSync(helper)) {
    const capacity = join(homedir(), ".codex/skills/machine-capacity/scripts/machine-capacity.mjs");
    yield* run(join(lane, "companion"), ["nix-shell", "-p", "stdenv.cc", "cmake", "pkg-config", "libxkbcommon", "udev", "--run",
      `PATH=${join(homedir(), ".rustup/toolchains/1.96.1-x86_64-unknown-linux-gnu/bin")}:$PATH bun '${capacity}' run --class moderate --owner smashcraft:play-helper --timeout-seconds 900 -- cargo build --release --locked --jobs 2 --bin wc3-journal`]);
    mkdirSync(dirname(helper), { recursive: true });
    copyFileSync(join(lane, "companion/target/release/wc3-journal"), helper);
  }
  return { map: { folder: "00-Smashcraft", file: `${title}.w3x`, title, source }, helper };
});

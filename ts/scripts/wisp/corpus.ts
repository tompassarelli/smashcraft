// `bun wisp parity corpus` (wisp#69): replays every native recording headless
// in Bun and in 32-bit Lua and names each replay's first divergent frame and
// field. A recording is a folder Wisp's session recorder wrote
// (wisp:docs/autopsy.md, "Corpus"): session.json and, per client, the files
// its map wrote, among them each match's replay (smashcraft:ts/src/game/replay/matchReplay.ts),
// whose test-build frames each carry a digest (frameDigest.ts).
//
// A replay plays only on the source that recorded it. Replays of this
// checkout's version play here; others play in that recording's commit,
// extracted from Git into a cache, by its own `parity corpus`.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { Console, Effect, Schema } from "effect";
import { describeCause } from "wisp/scripts/wisp/command";
import { captureProcess } from "wisp/scripts/wisp/mapBuild";
import { type MatchReplayResult, parseReplayHeader, replayMatch } from "../../src/game/replay/matchReplay";
import { sourceVersion } from "../sourceVersion";
import { replayInLua } from "./commands/replay";
import { projectRoot, tsDirectory } from "./project";
import { readReplay } from "./replayFiles";

export class CorpusFailure extends Schema.TaggedError<CorpusFailure>()("CorpusFailure", {
  problem: Schema.String,
}) {
  override get message(): string {
    return this.problem;
  }
}

/** The checked-in corpus the farm replays on every push. */
export const CHECKED_IN_CORPUS = join(tsDirectory, "test/corpus");
/** Where Wisp's session recorder writes. */
export const localCorpus = () => join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "wisp/corpus");

const MANIFEST = /^smashcraft-replay-(\d+)\.txt$/;

interface Session {
  readonly commit?: string;
  readonly dirty?: boolean;
}

/** A recording folder: session.json beside one folder per client. */
interface Recording {
  readonly id: string;
  readonly path: string;
  readonly session: Session;
  /** Each complete replay's manifest, by client. */
  readonly manifests: readonly { readonly client: string; readonly path: string }[];
}

function readSession(path: string): Session {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(path, "session.json"), "utf8"));
    if (typeof parsed !== "object" || parsed === null || !("git" in parsed)) return {};
    const git: unknown = parsed.git;
    if (typeof git !== "object" || git === null) return {};
    return {
      ...("commit" in git && typeof git.commit === "string" ? { commit: git.commit } : {}),
      ...("dirty" in git && typeof git.dirty === "boolean" ? { dirty: git.dirty } : {}),
    };
  } catch {
    return {};
  }
}

const isDirectory = (path: string) => existsSync(path) && statSync(path).isDirectory();

/** Every recording under `root`: a folder holding session.json, at any depth. */
export function findRecordings(root: string): Recording[] {
  if (!isDirectory(root)) return [];
  if (existsSync(join(root, "session.json"))) {
    const manifests = readdirSync(root).filter((client) => isDirectory(join(root, client))).sort().flatMap((client) =>
      readdirSync(join(root, client)).filter((name) => MANIFEST.test(name)).sort().map((name) => ({ client, path: join(root, client, name) })));
    return [{ id: basename(root), path: root, session: readSession(root), manifests }];
  }
  return readdirSync(root).sort().flatMap((name) => findRecordings(join(root, name)));
}

const ReplayResult = Schema.Struct({
  checksum: Schema.String, frames: Schema.Number, problems: Schema.Array(Schema.String),
  reached: Schema.Number, recorded: Schema.Number, digests: Schema.Number, divergent: Schema.Number,
});

/** One replay's outcome in Bun and in 32-bit Lua; `skipped` says why it didn't replay here (its source is elsewhere, missing or unreadable). */
const ReplayOutcome = Schema.Struct({
  recording: Schema.String, client: Schema.String, file: Schema.String, version: Schema.String, frames: Schema.Number,
  bun: Schema.optionalKey(ReplayResult), lua: Schema.optionalKey(ReplayResult), skipped: Schema.optionalKey(Schema.String),
});
export type ReplayOutcome = typeof ReplayOutcome.Type;
const ReplayOutcomes = Schema.Array(ReplayOutcome);

const passed = (result: MatchReplayResult | undefined) => result !== undefined && result.problems.length === 0 && result.reached === result.recorded;

/** Replays `file` in Bun and 32-bit Lua here, where its version is this source's. */
const replayHere = (recording: Recording, client: string, file: string, lines: readonly string[], version: string, frames: number) => Effect.gen(function*() {
  const joined = join(tmpdir(), `smashcraft-corpus-${process.pid}-${recording.id}-${client}-${basename(file)}`);
  writeFileSync(joined, `${lines.join("\n")}\n`);
  const [bun, lua] = yield* Effect.all([
    Effect.try({ try: () => replayMatch(lines), catch: (cause) => new CorpusFailure({ problem: `${file}: the replay stopped in Bun: ${describeCause(cause)}` }) }),
    replayInLua(joined).pipe(Effect.mapError((failure) => new CorpusFailure({ problem: `${file}: ${failure.message}` }))),
  ], { concurrency: 2 }).pipe(Effect.ensuring(Effect.sync(() => rmSync(joined, { force: true }))));
  const outcome: ReplayOutcome = { recording: recording.id, client, file, version, frames, bun, lua };
  return outcome;
});

/** Each recording's replays: played here when their version is this source's, otherwise left for their own source. */
const replayRecordings = (recordings: readonly Recording[], here: string) => Effect.forEach(recordings, (recording) =>
  Effect.forEach(recording.manifests, ({ client, path }) => Effect.gen(function*() {
    const lines = readReplay(path);
    const header = typeof lines === "string" ? lines : parseReplayHeader(lines);
    if (typeof lines === "string" || typeof header === "string") {
      const skipped = typeof lines === "string" ? lines : String(header);
      const outcome: ReplayOutcome = { recording: recording.id, client, file: path, version: "?", frames: 0, skipped };
      return outcome;
    }
    if (header.version !== here) {
      const outcome: ReplayOutcome = { recording: recording.id, client, file: path, version: header.version, frames: header.repro.frame, skipped: `recorded on version ${header.version}; this source is ${here}` };
      return outcome;
    }
    return yield* replayHere(recording, client, path, lines, header.version, header.repro.frame);
  })), { concurrency: 1 }).pipe(Effect.map((outcomes) => outcomes.flat()));

const cacheRoot = () => join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "smashcraft/corpus-sources");

function environment(extra: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) if (value !== undefined) env[name] = value;
  return { ...env, ...extra };
}

const run = (operation: string, path: string, command: readonly string[], env?: Record<string, string>) =>
  captureProcess(operation, path, command, env === undefined ? {} : { env: environment(env) }).pipe(
    Effect.mapError((cause) => new CorpusFailure({ problem: `${operation}: ${describeCause(cause)}` })),
    Effect.flatMap((result) => result.exitCode === 0
      ? Effect.succeed(result.stdout)
      : Effect.fail(new CorpusFailure({ problem: `${operation}: ${(result.stderr || result.stdout).trim().split("\n").slice(-6).join(" | ") || `exit ${result.exitCode}`}` }))),
  );

/** The recording commit's ts/ extracted from Git into the cache, its packages installed; its path. */
const sourceAt = (commit: string) => Effect.gen(function*() {
  const root = join(cacheRoot(), commit);
  const ready = join(root, ".ready");
  if (existsSync(ready)) return join(root, "ts");
  const present = yield* run(`find commit ${commit}`, projectRoot, ["git", "-C", projectRoot, "cat-file", "-t", commit]).pipe(Effect.as(true), Effect.orElseSucceed(() => false));
  if (!present) yield* run(`fetch commit ${commit}`, projectRoot, ["git", "-C", projectRoot, "fetch", "--quiet", "--depth=1", "origin", commit]);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  const archive = join(root, "source.tar");
  yield* run(`extract ${commit}`, projectRoot, ["git", "-C", projectRoot, "archive", "--format=tar", "-o", archive, commit, "ts"]);
  yield* run(`unpack ${commit}`, root, ["tar", "-x", "-C", root, "-f", archive]);
  rmSync(archive, { force: true });
  yield* run(`install packages at ${commit}`, root, [process.execPath, "install", "--cwd", join(root, "ts"), "--frozen-lockfile"]);
  writeFileSync(ready, "");
  return join(root, "ts");
});

/** Replays recordings of another version in their commit's own `parity corpus`; its outcomes, or each replay skipped with why. */
const replayElsewhere = (skipped: readonly ReplayOutcome[], recordings: readonly Recording[]) => Effect.gen(function*() {
  const byCommit = new Map<string, Recording[]>();
  const outcomes: ReplayOutcome[] = [];
  for (const recording of recordings) {
    const mine = skipped.filter((outcome) => outcome.recording === recording.id && outcome.version !== "?");
    if (mine.length === 0) continue;
    // A checkout with untracked files counts as dirty; the source version, which that commit's run checks, decides.
    const { commit } = recording.session;
    if (commit === undefined) {
      outcomes.push(...mine.map((outcome) => ({ ...outcome, skipped: `${outcome.skipped ?? ""}; the session ran outside a Git checkout, so its source is unknown` })));
      continue;
    }
    byCommit.set(commit, [...(byCommit.get(commit) ?? []), recording]);
  }
  for (const [commit, group] of byCommit) {
    const result = join(tmpdir(), `smashcraft-corpus-${process.pid}-${commit}.json`);
    const played = yield* sourceAt(commit).pipe(
      Effect.flatMap((source) => run(`replay at ${commit.slice(0, 12)}`, source, [process.execPath, join(source, "scripts/wisp.ts"), "parity", "corpus", ...group.map(({ path }) => path)], { SMASHCRAFT_CORPUS_RESULT: result, SMASHCRAFT_CORPUS_HERE: "1" })),
      Effect.flatMap(() => Effect.try({ try: (): unknown => JSON.parse(readFileSync(result, "utf8")), catch: (cause) => new CorpusFailure({ problem: `reading ${result}: ${describeCause(cause)}` }) })),
      Effect.flatMap((parsed) => Schema.decodeUnknownEffect(ReplayOutcomes)(parsed).pipe(Effect.mapError((cause) => new CorpusFailure({ problem: `${result}: ${String(cause)}` })))),
      Effect.catch((failure: CorpusFailure) => Effect.succeed(group.flatMap((recording) => skipped
        .filter((outcome) => outcome.recording === recording.id)
        .map((outcome): ReplayOutcome => ({ ...outcome, skipped: `at its commit ${commit.slice(0, 12)}: ${failure.problem}${recording.session.dirty === true ? " (its checkout had uncommitted changes)" : ""}` }))))),
      Effect.ensuring(Effect.sync(() => rmSync(result, { force: true }))),
    );
    outcomes.push(...played);
  }
  return outcomes;
});

const runtimeLine = (name: string, result: MatchReplayResult | undefined) => {
  if (result === undefined) return `${name} did not run`;
  const digests = result.digests === 0 ? "no frame digests (a build without the dev console)" : `${result.divergent} of ${result.digests} frames divergent`;
  const first = result.problems[0];
  return `${name} ${digests}, ${result.reached}/${result.recorded} checksums${first === undefined ? "" : `: ${first}`}`;
};

/** The report's lines and whether every replay that played matched. */
export function corpusReport(outcomes: readonly ReplayOutcome[], recordings: number): { readonly lines: readonly string[]; readonly passed: boolean } {
  const lines: string[] = [];
  let frames = 0;
  let divergentBun = 0;
  let divergentLua = 0;
  let played = 0;
  let failed = 0;
  for (const outcome of outcomes) {
    const where = `${outcome.recording} ${outcome.client} ${basename(outcome.file)}`;
    if (outcome.skipped !== undefined) {
      // A checked-in recording must play; the local corpus also holds sessions from uncommitted sources.
      const kept = outcome.file.startsWith(CHECKED_IN_CORPUS);
      if (kept) failed++;
      lines.push(`${kept ? "FAIL " : ""}${where}: not replayed: ${outcome.skipped}`);
      continue;
    }
    played++;
    frames += outcome.bun?.digests ?? 0;
    divergentBun += outcome.bun?.divergent ?? 0;
    divergentLua += outcome.lua?.divergent ?? 0;
    const ok = passed(outcome.bun) && passed(outcome.lua);
    if (!ok) failed++;
    lines.push(`${ok ? "PASS" : "FAIL"} ${where} (version ${outcome.version}, ${outcome.frames} frames): ${runtimeLine("Bun", outcome.bun)}; ${runtimeLine("Lua32", outcome.lua)}`);
  }
  const skipped = outcomes.length - played;
  lines.push(`corpus: ${recordings} recordings, ${played} replays played, ${frames} frames compared, ${divergentBun} divergent in Bun, ${divergentLua} in 32-bit Lua${failed === 0 ? "" : `, ${failed} replays FAILED`}${skipped === 0 ? "" : `, ${skipped} not replayed`}`);
  return { lines, passed: failed === 0 };
}

/** `bun wisp parity corpus [DIR...]`: every recording under the folders, by default the checked-in and the local corpus. */
export const corpus = (args: readonly string[]) => Effect.gen(function*() {
  if (args[0] === "keep") return yield* keep(args.slice(1));
  const roots = args.length > 0 ? args : [CHECKED_IN_CORPUS, localCorpus()];
  const recordings = roots.flatMap(findRecordings);
  const here = sourceVersion(tsDirectory);
  const local = yield* replayRecordings(recordings, here);
  const resultFile = process.env.SMASHCRAFT_CORPUS_RESULT;
  if (resultFile !== undefined && process.env.SMASHCRAFT_CORPUS_HERE === "1") {
    // Called by another checkout's `parity corpus` to play the replays of this source.
    writeFileSync(resultFile, JSON.stringify(local));
    return;
  }
  const elsewhere = local.filter((outcome) => outcome.skipped !== undefined && outcome.version !== "?" && outcome.version !== here);
  const others = yield* replayElsewhere(elsewhere, recordings);
  const outcomes = [...local.filter((outcome) => !elsewhere.includes(outcome)), ...others];
  const { lines, passed: ok } = corpusReport(outcomes, recordings.length);
  yield* Console.log(lines.join("\n"));
  if (!ok) return yield* new CorpusFailure({ problem: "a native recording replays differently headless" });
});

/** `parity corpus keep ID...`: copies local recordings' session.json and replays into the checked-in corpus. */
const keep = (ids: readonly string[]) => Effect.gen(function*() {
  if (ids.length === 0) return yield* new CorpusFailure({ problem: "parity corpus keep takes one or more recording names from the local corpus" });
  const recordings = findRecordings(localCorpus());
  for (const id of ids) {
    const recording = recordings.find((candidate) => candidate.id === id);
    if (recording === undefined) return yield* new CorpusFailure({ problem: `no recording ${id} in ${localCorpus()}` });
    const target = join(CHECKED_IN_CORPUS, id);
    mkdirSync(target, { recursive: true });
    cpSync(join(recording.path, "session.json"), join(target, "session.json"));
    let files = 0;
    for (const client of readdirSync(recording.path).filter((name) => isDirectory(join(recording.path, name)))) {
      for (const name of readdirSync(join(recording.path, client)).filter((file) => /^smashcraft-replay-\d+(-\d+)?\.txt$/.test(file))) {
        mkdirSync(join(target, client), { recursive: true });
        cpSync(join(recording.path, client, name), join(target, client, name));
        files++;
      }
    }
    yield* Console.log(`kept ${id}: ${files} replay files in ${relative(projectRoot, target)}`);
  }
});

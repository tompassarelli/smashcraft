
















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

class CorpusFailure extends Schema.TaggedError<CorpusFailure>()("CorpusFailure", {
  problem: Schema.String,
}) {
  override get message(): string {
    return this.problem;
  }
}


const CHECKED_IN_CORPUS = join(tsDirectory, "test/corpus");

const localCorpus = () => join(process.env.XDG_STATE_HOME ?? join(homedir(), ".local/state"), "wisp/corpus");


const REPLAY_FILE = /^smashcraft-replay-(\d+)(?:-(\d+))?\.txt$/;

interface Session {
  readonly commit?: string;
  readonly dirty?: boolean;
}


interface Recording {
  readonly id: string;
  readonly path: string;
  readonly session: Session;
}


interface Replay {

  readonly recording: Recording;
  readonly client: string;
  readonly manifest: string;

  readonly parts: ReadonlyMap<number, string>;

  readonly sources: readonly Recording[];
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


function findRecordings(root: string): Recording[] {
  if (!isDirectory(root)) return [];
  if (existsSync(join(root, "session.json"))) return [{ id: basename(root), path: root, session: readSession(root) }];
  return readdirSync(root).sort().flatMap((name) => findRecordings(join(root, name)));
}

const clientsOf = (recording: Recording) => readdirSync(recording.path).filter((client) => isDirectory(join(recording.path, client))).sort();


function assembleReplays(recordings: readonly Recording[]): { readonly replays: readonly Replay[]; readonly open: number } {
  interface Found { manifest?: { recording: Recording; path: string }; parts: Map<number, string>; sources: Recording[] }
  const found = new Map<string, Found>();
  for (const recording of recordings) {
    for (const client of clientsOf(recording)) {
      for (const name of readdirSync(join(recording.path, client)).sort()) {
        const match = REPLAY_FILE.exec(name);
        if (match === null) continue;
        const key = `${client} ${match[1]}`;
        const entry: Found = found.get(key) ?? { parts: new Map<number, string>(), sources: [] };
        found.set(key, entry);
        if (!entry.sources.includes(recording)) entry.sources.push(recording);
        const path = join(recording.path, client, name);
        if (match[2] === undefined) entry.manifest = { recording, path };
        else entry.parts.set(Number(match[2]), path);
      }
    }
  }
  const replays: Replay[] = [];
  let open = 0;
  for (const [key, entry] of found) {
    if (entry.manifest === undefined) {
      open++;
      continue;
    }
    replays.push({ recording: entry.manifest.recording, client: key.split(" ")[0] ?? "", manifest: entry.manifest.path, parts: entry.parts, sources: entry.sources });
  }
  return { replays, open };
}


function joinedLines(replay: Replay): string[] | string {
  const folder = join(tmpdir(), `smashcraft-corpus-${process.pid}-${replay.recording.id}-${replay.client}-${basename(replay.manifest, ".txt")}`);
  mkdirSync(folder, { recursive: true });
  try {
    cpSync(replay.manifest, join(folder, basename(replay.manifest)));
    for (const path of replay.parts.values()) cpSync(path, join(folder, basename(path)));
    return readReplay(join(folder, basename(replay.manifest)));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

const ReplayResult = Schema.Struct({
  checksum: Schema.String, frames: Schema.Finite, problems: Schema.Array(Schema.String),
  reached: Schema.Finite, recorded: Schema.Finite, digests: Schema.Finite, divergent: Schema.Finite,
});


const ReplayOutcome = Schema.Struct({
  recording: Schema.String, client: Schema.String, file: Schema.String, version: Schema.String, frames: Schema.Finite,
  bun: Schema.optionalKey(ReplayResult), lua: Schema.optionalKey(ReplayResult), skipped: Schema.optionalKey(Schema.String),
});
type ReplayOutcome = typeof ReplayOutcome.Type;
const ReplayOutcomes = Schema.Array(ReplayOutcome);

const passed = (result: MatchReplayResult | undefined) => result !== undefined && result.problems.length === 0 && result.reached === result.recorded;


const replayHere = (recording: Recording, client: string, file: string, lines: readonly string[], version: string, frames: number) => Effect.gen(function*() {
  const joined = join(tmpdir(), `smashcraft-corpus-${process.pid}-${recording.id}-${client}-${basename(file)}.joined`);
  writeFileSync(joined, `${lines.join("\n")}\n`);
  const [bun, lua] = yield* Effect.all([
    Effect.try({ try: () => replayMatch(lines), catch: (cause) => new CorpusFailure({ problem: `${file}: the replay stopped in Bun: ${describeCause(cause)}` }) }),
    replayInLua(joined).pipe(Effect.mapError((failure) => new CorpusFailure({ problem: `${file}: ${failure.message}` }))),
  ], { concurrency: 2 }).pipe(Effect.ensuring(Effect.sync(() => rmSync(joined, { force: true }))));
  const outcome: ReplayOutcome = { recording: recording.id, client, file, version, frames, bun, lua };
  return outcome;
});


const replayAll = (replays: readonly Replay[], here: string) => Effect.forEach(replays, (replay) => Effect.gen(function*() {
  const { recording, client, manifest } = replay;
  const lines = joinedLines(replay);
  const header = typeof lines === "string" ? lines : parseReplayHeader(lines);
  if (typeof lines === "string" || typeof header === "string") {
    const skipped = typeof lines === "string" ? lines : String(header);
    const outcome: ReplayOutcome = { recording: recording.id, client, file: manifest, version: "?", frames: 0, skipped };
    return outcome;
  }
  if (header.version !== here) {
    const outcome: ReplayOutcome = { recording: recording.id, client, file: manifest, version: header.version, frames: header.repro.frame, skipped: `recorded on version ${header.version}; this source is ${here}` };
    return outcome;
  }
  return yield* replayHere(recording, client, manifest, lines, header.version, header.repro.frame);
}), { concurrency: 1 });

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


const commitOf = (replay: Replay) => replay.recording.session.commit ?? replay.sources.find((source) => source.session.commit !== undefined)?.session.commit;






const replayElsewhere = (skipped: readonly ReplayOutcome[], replays: readonly Replay[], roots: readonly string[]) => Effect.gen(function*() {
  const byCommit = new Map<string, { outcome: ReplayOutcome; replay: Replay }[]>();
  const outcomes: ReplayOutcome[] = [];
  for (const outcome of skipped) {
    const replay = replays.find((candidate) => candidate.manifest === outcome.file);
    const commit = replay === undefined ? undefined : commitOf(replay);
    if (replay === undefined || commit === undefined) {
      outcomes.push({ ...outcome, skipped: `${outcome.skipped ?? ""}; its sessions ran outside a Git checkout, so its source is unknown` });
      continue;
    }
    byCommit.set(commit, [...(byCommit.get(commit) ?? []), { outcome, replay }]);
  }
  for (const [commit, group] of byCommit) {
    const result = join(tmpdir(), `smashcraft-corpus-${process.pid}-${commit}.json`);
    const played = yield* sourceAt(commit).pipe(
      Effect.flatMap((source) => run(`replay at ${commit.slice(0, 12)}`, source, [process.execPath, join(source, "scripts/wisp.ts"), "parity", "corpus", ...roots], { SMASHCRAFT_CORPUS_RESULT: result, SMASHCRAFT_CORPUS_HERE: "1" })),
      Effect.flatMap(() => Effect.try({ try: (): unknown => JSON.parse(readFileSync(result, "utf8")), catch: (cause) => new CorpusFailure({ problem: `reading ${result}: ${describeCause(cause)}` }) })),
      Effect.flatMap((parsed) => Schema.decodeUnknownEffect(ReplayOutcomes)(parsed).pipe(Effect.mapError((cause) => new CorpusFailure({ problem: `${result}: ${String(cause)}` })))),
      Effect.map((theirs) => group.map(({ outcome }) => theirs.find((other) => other.file === outcome.file)
        ?? { ...outcome, skipped: `at its commit ${commit.slice(0, 12)}: that source's replayer didn't find it` })),
      Effect.catch((failure: CorpusFailure) => Effect.succeed(group.map(({ outcome, replay }): ReplayOutcome => ({
        ...outcome,
        skipped: `at its commit ${commit.slice(0, 12)}: ${/parity takes numeric or tapes/.test(failure.problem) ? "that commit predates `parity corpus` (smashcraft 88644ee8), so its replays have no frame digests" : failure.problem}${replay.recording.session.dirty === true ? " (its checkout had uncommitted changes)" : ""}`,
      })))),
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


function corpusReport(outcomes: readonly ReplayOutcome[], recordings: number, open: number): { readonly lines: readonly string[]; readonly passed: boolean } {
  const lines: string[] = [];
  let frames = 0;
  let divergentBun = 0;
  let divergentLua = 0;
  let played = 0;
  let failed = 0;
  for (const outcome of outcomes) {
    const where = `${outcome.recording} ${outcome.client} ${basename(outcome.file)}`;
    if (outcome.skipped !== undefined) {

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
  lines.push(`corpus: ${recordings} recordings, ${played} replays played, ${frames} frames compared, ${divergentBun} divergent in Bun, ${divergentLua} in 32-bit Lua${failed === 0 ? "" : `, ${failed} replays FAILED`}${skipped === 0 ? "" : `, ${skipped} not replayed`}${open === 0 ? "" : `, ${open} still open (their match hadn't ended)`}`);
  return { lines, passed: failed === 0 };
}


export const corpus = (args: readonly string[]) => Effect.gen(function*() {
  if (args[0] === "keep") return yield* keep(args.slice(1));
  const roots = args.length > 0 ? args : [CHECKED_IN_CORPUS, localCorpus()];
  const found = roots.map((root) => assembleReplays(findRecordings(root)));
  const recordings = roots.reduce((count, root) => count + findRecordings(root).length, 0);
  const replays = found.flatMap(({ replays: some }) => some);
  const open = found.reduce((count, { open: some }) => count + some, 0);
  const here = sourceVersion(tsDirectory);
  const local = yield* replayAll(replays, here);
  const resultFile = process.env.SMASHCRAFT_CORPUS_RESULT;
  if (resultFile !== undefined && process.env.SMASHCRAFT_CORPUS_HERE === "1") {

    writeFileSync(resultFile, JSON.stringify(local));
    return;
  }
  const elsewhere = local.filter((outcome) => outcome.skipped !== undefined && outcome.version !== "?" && outcome.version !== here);
  const others = yield* replayElsewhere(elsewhere, replays, roots);
  const outcomes = [...local.filter((outcome) => !elsewhere.includes(outcome)), ...others];
  const { lines, passed: ok } = corpusReport(outcomes, recordings, open);
  yield* Console.log(lines.join("\n"));
  if (!ok) return yield* new CorpusFailure({ problem: "a native recording replays differently headless" });
});


const keep = (ids: readonly string[]) => Effect.gen(function*() {
  if (ids.length === 0) return yield* new CorpusFailure({ problem: "parity corpus keep takes one or more recording names from the local corpus" });
  const recordings = findRecordings(localCorpus());
  const { replays } = assembleReplays(recordings);
  for (const id of ids) {
    const recording = recordings.find((candidate) => candidate.id === id);
    if (recording === undefined) return yield* new CorpusFailure({ problem: `no recording ${id} in ${localCorpus()}` });

    const ended = replays.filter((replay) => replay.recording === recording);
    if (ended.length === 0) return yield* new CorpusFailure({ problem: `recording ${id} holds no finished replay's manifest` });
    const target = join(CHECKED_IN_CORPUS, id);
    mkdirSync(target, { recursive: true });
    cpSync(join(recording.path, "session.json"), join(target, "session.json"));
    let files = 0;
    for (const replay of ended) {
      mkdirSync(join(target, replay.client), { recursive: true });
      for (const path of [replay.manifest, ...replay.parts.values()]) {
        cpSync(path, join(target, replay.client, basename(path)));
        files++;
      }
    }
    yield* Console.log(`kept ${id}: ${ended.length} replays, ${files} files in ${relative(projectRoot, target)}`);
  }
});

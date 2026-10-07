// `bun wisp pad --headless --compare NATIVE`: a native `bun wisp pad` run
// and a headless run of the same script through the same real helper agree.
// The integrity build's input trace (smashcraft:ts/src/platform/shell/diagnostics.ts)
// records a confirmed-state checksum about once a second and a frame-tagged
// line whenever a fighter starts a special, an attack or a jump, is hit or
// recovers. The headless run's moment (View held a second, so the script
// asks for it) replays its rows to the native checksums, the confirmed
// fighter lines of both traces are equal, and each `#! expect` line in the
// script holds on both sides. Scripts state what must happen in comments:
//   #! expect CLIENT FRAME TEXT    a line for that fighter on that frame starts with TEXT (CLIENT a-d: slots 0-3, so c is a computer)
//   #! absent CLIENT FROM-TO TEXT  no line for that fighter in those frames starts with TEXT
//   #! scene CLIENT MODEL         that client's scene report had an effect whose model path contains MODEL in view
//   #! chat TEXT                  the developer command that starts the match, when --chat gives none
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { preloadLines } from "wisp/scripts/wisp/boundary";
import { readSceneLines } from "wisp/scripts/wisp/scene";
import { type Repro, parseRepro } from "wisp/src/runtime/repro";
import { parseMoment, replayRepro } from "../../src/game/replay/moment";
import { replayMatch } from "../../src/game/replay/matchReplay";
import { readReplay } from "../wisp/replayFiles";
import { BTN_SELECT, EV_KEY } from "./linuxInput";
import { parsePadScript, type PadStep } from "./padScript";

/** Comparison needs the consumer's existing View-hold export before either session starts. */
export function comparisonSteps(script: string, path = "pad script"): readonly PadStep[] {
  const steps = parsePadScript(script);
  const held: [number | undefined, number | undefined] = [undefined, undefined];
  for (const step of steps) {
    if (step.kind !== "edge") continue;
    for (const edge of step.edges) {
      if (edge.type !== EV_KEY || edge.code !== BTN_SELECT) continue;
      if (edge.value === 1 && held[step.slot] === undefined) held[step.slot] = step.frame;
      if (edge.value === 0) {
        const start = held[step.slot];
        if (start !== undefined && step.frame - start >= 60) return steps;
        held[step.slot] = undefined;
      }
    }
  }
  throw new Error(`${path}: pad replay comparison requires a replay export: hold VIEW for at least 60 frames (normally 70) and release it; append the hold after the last capture to preserve action frames`);
}

export const TRACE_FILE = "wc3-melee-input-trace.txt";
export const REPRO_NAME = /^smashcraft-repro-p(\d)-f(\d+)-\d+\.txt$/;
export const MATCH_REPLAY_NAME = /^smashcraft-replay-p[01]-\d+\.txt$/;

interface TraceEvent {
  readonly slot: number;
  readonly frame: number;
  /** The line after `frame F `: its phase and what happened. */
  readonly text: string;
}

interface Trace {
  readonly checksums: ReadonlyMap<number, string>;
  readonly events: readonly TraceEvent[];
}

/** Confirmed-state changes the shell traces the same way on every client; presentation lines are left out. */
const COMPARED = /^phase \d+ (special |special-form |applied attack |applied jump |damage \d|recovery |grab action |grab-hold |shield-break |shield tilt |ledge |di |ground action )/;

export function parseTrace(lines: readonly string[]): Trace {
  const checksums = new Map<number, string>();
  const events: TraceEvent[] = [];
  for (const line of lines) {
    const checksum = /^\d+ \S+ confirmed frame (\d+) state (\S+)$/.exec(line);
    if (checksum !== null) checksums.set(Number(checksum[1]), checksum[2] ?? "");
    const event = /^\d+ \S+ participant (\d) frame (\d+) (.*)$/.exec(line);
    if (event !== null && COMPARED.test(event[3] ?? "")) events.push({ slot: Number(event[1]), frame: Number(event[2]), text: event[3] ?? "" });
  }
  return { checksums, events };
}

interface Expectation {
  readonly kind: "expect" | "absent";
  readonly slot: number;
  readonly from: number;
  readonly to: number;
  readonly text: string;
  readonly line: number;
}

/** A `#! scene CLIENT MODEL` line: that client's scene report shows an effect whose model path contains MODEL in view. */
interface SceneExpectation {
  readonly slot: number;
  readonly model: string;
  readonly line: number;
}

function parseSceneExpectations(script: string): readonly SceneExpectation[] {
  const found: SceneExpectation[] = [];
  script.split("\n").forEach((raw, index) => {
    const match = /^\s*#!\s*scene\s+([ab])\s+(\S+)\s*$/.exec(raw);
    if (match !== null) found.push({ slot: match[1] === "a" ? 0 : 1, model: match[2] ?? "", line: index + 1 });
  });
  return found;
}

/** What each scene expectation found wrong in a client's scene report (smashcraft:docs/player-view.md). */
function unmetSceneExpectations(reports: readonly (readonly string[] | undefined)[], expectations: readonly SceneExpectation[], side: string): string[] {
  return expectations.flatMap((expectation) => {
    const where = `${side} script line ${expectation.line} (scene ${"ab"[expectation.slot]} ${expectation.model})`;
    const lines = reports[expectation.slot];
    const report = lines === undefined ? undefined : readSceneLines(lines);
    if (report === undefined) return [`${where}: no scene report`];
    if ("problem" in report) return [`${where}: scene report line ${report.line}: ${report.problem}`];
    const seen = report.models.filter((model) => model.model.includes(expectation.model) && model.longest > 0);
    return seen.length > 0 ? [] : [`${where}: no effect with that model was in view`];
  });
}

/** The script's `#! expect` and `#! absent` lines. */
export function parseExpectations(script: string): readonly Expectation[] {
  const found: Expectation[] = [];
  script.split("\n").forEach((raw, index) => {
    const match = /^\s*#!\s*(expect|absent)\s+([abcd])\s+(\d+)(?:-(\d+))?\s+(.+?)\s*$/.exec(raw);
    if (match === null) {
      if (/^\s*#!/.test(raw) && !/^\s*#!\s*(scene|chat)\s/.test(raw)) throw new Error(`pad script line ${index + 1}: a #! line is "#! expect CLIENT FRAME TEXT", "#! absent CLIENT FROM-TO TEXT", "#! scene CLIENT MODEL" or "#! chat TEXT"`);
      return;
    }
    const from = Number(match[3]);
    found.push({ kind: match[1] === "expect" ? "expect" : "absent", slot: "abcd".indexOf(match[2] ?? "a"), from, to: match[4] === undefined ? from : Number(match[4]), text: match[5] ?? "", line: index + 1 });
  });
  return found;
}

/** What each expectation found wrong in a trace; empty when all hold. */
export function unmetExpectations(trace: Trace, expectations: readonly Expectation[], side: string): string[] {
  const problems: string[] = [];
  const last = Math.max(0, ...trace.events.map((event) => event.frame), ...trace.checksums.keys());
  for (const expectation of expectations) {
    const hits = trace.events.filter((event) => event.slot === expectation.slot && event.frame >= expectation.from && event.frame <= expectation.to
      && event.text.replace(/^phase \d+ /, "").startsWith(expectation.text));
    const where = `${side} script line ${expectation.line} (${expectation.kind} ${"abcd"[expectation.slot]} ${expectation.from}${expectation.to === expectation.from ? "" : `-${expectation.to}`} ${expectation.text})`;
    if (expectation.to > last) problems.push(`${where}: the trace ends at frame ${last}`);
    else if (expectation.kind === "expect" && hits.length === 0) {
      const near = trace.events.filter((event) => event.slot === expectation.slot && Math.abs(event.frame - expectation.from) <= 30).map((event) => `${event.frame} ${event.text}`);
      problems.push(`${where}: no such line${near.length === 0 ? "" : `; nearby: ${near.join(" | ")}`}`);
    } else if (expectation.kind === "absent" && hits.length > 0) problems.push(`${where}: found ${hits.map((event) => `${event.frame} ${event.text}`).join(" | ")}`);
  }
  return problems;
}

/** A pad run's folder: client-N/CustomMapData (headless) or the files `bun wisp pad` collected beside its result. */
function readLines(path: string): string[] | undefined {
  try {
    return preloadLines(readFileSync(path, "latin1"));
  } catch {
    return undefined;
  }
}

interface ParityReport {
  /** The native run proves nothing either way: rerun it. */
  readonly invalid?: boolean;
  readonly passed: boolean;
  readonly lines: readonly string[];
}

/** Equal fighter lines on the frames both traces cover; the first difference otherwise. */
function eventDifference(native: Trace, headless: Trace, through: number): string | undefined {
  const key = (event: TraceEvent) => `${event.slot} ${event.frame} ${event.text}`;
  const a = native.events.filter((event) => event.frame <= through).map(key);
  const b = headless.events.filter((event) => event.frame <= through).map(key);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    if (a[index] !== b[index]) return `native ${a[index] ?? "(none)"} | headless ${b[index] ?? "(none)"}`;
  }
  return undefined;
}

interface RunResult {
  readonly off_frame?: number;
  readonly helpers_stopped?: readonly string[];
  readonly build?: string;
  /** Why the native run proves nothing: a desync, a crash or an early end (pad.ts). */
  readonly invalid?: readonly string[];
}

const isStrings = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every((item) => typeof item === "string");

const isRunResult = (value: unknown): value is RunResult => typeof value === "object" && value !== null
  && (!("build" in value) || typeof value.build === "string")
  && ("invalid" in value ? isStrings(value.invalid) && (!("off_frame" in value) || typeof value.off_frame === "number")
    : "off_frame" in value && typeof value.off_frame === "number" && "helpers_stopped" in value && isStrings(value.helpers_stopped));

/** Compares a native pad run's folder with a headless one's, both written by `bun wisp pad`. */
export function compareRuns(nativeDir: string, headlessDir: string, script: string): ParityReport {
  const lines: string[] = [];
  const problems: string[] = [];
  const result = (dir: string): RunResult => {
    const parsed: unknown = JSON.parse(readFileSync(join(dir, "result.json"), "utf8"));
    if (!isRunResult(parsed)) throw new Error(`${dir}/result.json is not a pad result`);
    return parsed;
  };
  const [native, headless] = [result(nativeDir), result(headlessDir)];
  if (native.invalid !== undefined && native.invalid.length > 0) return { passed: false, invalid: true, lines: [`INVALID: desynced, rerun: ${native.invalid.join("; ")}`] };
  for (const [side, run] of [["native", native], ["headless", headless]] as const) {
    if (run.off_frame !== 0) problems.push(`${side}: ${run.off_frame ?? "?"} edges landed off their planned frame`);
    if ((run.helpers_stopped ?? []).length > 0) problems.push(`${side}: ${(run.helpers_stopped ?? []).join("; ")}`);
  }
  if (native.build !== undefined && native.build !== headless.build) problems.push(`native build ${native.build}, headless build ${headless.build ?? "?"}`);
  const nativeLines = readLines(join(nativeDir, "trace-a.txt")) ?? readLines(join(nativeDir, "trace-b.txt"));
  const headlessLines = readLines(join(headlessDir, "trace-a.txt"));
  if (nativeLines === undefined) problems.push(`native: no input trace in ${nativeDir} (trace-a.txt): is the map the integrity build?`);
  if (headlessLines === undefined) problems.push(`headless: no input trace in ${headlessDir}`);
  const expectations = parseExpectations(script);
  if (nativeLines !== undefined && headlessLines !== undefined) {
    const nativeTrace = parseTrace(nativeLines);
    const headlessTrace = parseTrace(headlessLines);
    problems.push(...unmetExpectations(nativeTrace, expectations, "native"), ...unmetExpectations(headlessTrace, expectations, "headless"));
    const moments = (dir: string) => readdirSync(dir).flatMap((name) => {
      const parsed = REPRO_NAME.test(name) ? parseRepro(readLines(join(dir, name)) ?? []) : undefined;
      return parsed === undefined || typeof parsed === "string" ? [] : [parsed];
    });
    const headlessMoments = moments(headlessDir).sort((x, y) => x.frame - y.frame);
    const nativeMoments = moments(nativeDir);
    if (headlessMoments.length === 0) problems.push("headless: no moment saved (hold View a second in the script)");
    const checked = new Set<number>();
    for (const moment of headlessMoments) {
      // Each moment, saved by a View hold, replays to the native checksums of its frames.
      const start = Number(/^start (\d+) /m.exec(moment.lines.join("\n"))?.[1] ?? Number.NaN);
      const checkpoints = new Map<number, string>();
      for (const [frame, checksum] of nativeTrace.checksums) if (frame > start && frame <= moment.frame) checkpoints.set(frame, checksum);
      for (const saved of nativeMoments) if (saved.frame > start && saved.frame <= moment.frame) checkpoints.set(saved.frame, saved.checksum);
      const replay = replayRepro({ ...moment, lines: [...moment.lines, ...[...checkpoints].map(([frame, checksum]) => `checkpoint ${frame} ${checksum}`)] });
      problems.push(...replay.problems.map((problem) => `checksum parity (moment ending ${moment.frame}): ${problem}`));
      for (const frame of checkpoints.keys()) checked.add(frame);
      lines.push(`checksums: ${checkpoints.size} native confirmed-state checksums on frames ${[...checkpoints.keys()].sort((x, y) => x - y).join(", ")} replay ${replay.problems.length === 0 ? "equal" : "UNEQUAL"} in the headless moment of frames ${start + 1}-${moment.frame}`);
    }
    if (headlessMoments.length > 0 && checked.size < 2) problems.push(`checksum parity: only ${checked.size} native checksums fall in the headless moments`);
    const compared = momentDifferences(nativeMoments, headlessMoments);
    lines.push(...compared.lines);
    problems.push(...compared.problems);
    const last = headlessMoments.at(-1)?.frame ?? 0;
    const through = Math.min(last, Math.max(0, ...nativeTrace.checksums.keys()), Math.max(0, ...headlessTrace.checksums.keys()));
    const difference = eventDifference(nativeTrace, headlessTrace, through);
    if (difference !== undefined) problems.push(`fighter lines differ through frame ${through}: ${difference}`);
    else lines.push(`fighter lines: ${nativeTrace.events.filter((event) => event.frame <= through).length} confirmed lines equal through frame ${through}`);
    lines.push(`expectations: ${expectations.length} checked on both sides`);
  }
  const scenes = parseSceneExpectations(script);
  if (scenes.length > 0) {
    const reports = (dir: string) => [readLines(join(dir, "scene-a.txt")), readLines(join(dir, "scene-b.txt"))];
    problems.push(...unmetSceneExpectations(reports(nativeDir), scenes, "native"), ...unmetSceneExpectations(reports(headlessDir), scenes, "headless"));
    lines.push(`scene: ${scenes.length} effect models checked in view on both sides`);
  }
  lines.push(...problems.map((problem) => `FAIL ${problem}`));
  lines.push(problems.length === 0 ? "PASS: native run equals the headless run of the same script" : `FAIL: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
  return { passed: problems.length === 0, lines };
}

/**
 * A headless pad run alone, with no native run to compare (`bun wisp farm
 * pads`): its edges landed on their frames and the script's `#! expect`,
 * `#! absent` and `#! scene` lines hold in its trace and scene reports,
 * and every saved moment and completed match replays to its recorded checksums.
 */
export function checkHeadlessRun(headlessDir: string, script: string): ParityReport {
  const lines: string[] = [];
  const problems: string[] = [];
  const parsed: unknown = JSON.parse(readFileSync(join(headlessDir, "result.json"), "utf8"));
  if (!isRunResult(parsed)) throw new Error(`${headlessDir}/result.json is not a pad result`);
  if (parsed.off_frame !== 0) problems.push(`headless: ${parsed.off_frame ?? "?"} edges landed off their planned frame`);
  if ((parsed.helpers_stopped ?? []).length > 0) problems.push(`headless: ${(parsed.helpers_stopped ?? []).join("; ")}`);
  const traceLines = readLines(join(headlessDir, "trace-a.txt"));
  const expectations = parseExpectations(script);
  if (traceLines === undefined) problems.push(`headless: no input trace in ${headlessDir}`);
  else {
    problems.push(...unmetExpectations(parseTrace(traceLines), expectations, "headless"));
    lines.push(`expectations: ${expectations.length} checked`);
  }
  const exports = readdirSync(headlessDir).filter(name => REPRO_NAME.test(name));
  const matches = readdirSync(headlessDir).filter(name => MATCH_REPLAY_NAME.test(name));
  if (exports.length === 0 && matches.length === 0) problems.push("headless: no moment saved (hold View a second in the script)");
  let replayed = 0;
  let frames = 0;
  for (const name of exports) {
    const moment = parseRepro(readLines(join(headlessDir, name)) ?? []);
    if (typeof moment === "string") {
      problems.push(`checksum replay ${name}: ${moment}`);
      continue;
    }
    const replay = replayRepro(moment);
    const failures = [...replay.problems];
    if (replay.checksum !== moment.checksum) failures.push(`frame ${moment.frame} replays to checksum ${replay.checksum}; the game recorded ${moment.checksum}`);
    problems.push(...failures.map(problem => `checksum replay ${name}: ${problem}`));
    if (failures.length === 0) replayed++;
    frames += replay.frames;
  }
  lines.push(`checksums: ${replayed}/${exports.length} exported moments replay equal (${frames} frames)`);
  let replayedMatches = 0;
  let matchFrames = 0;
  for (const name of matches) {
    const saved = readReplay(join(headlessDir, name));
    if (typeof saved === "string") {
      problems.push(`checksum replay ${name}: ${saved}`);
      continue;
    }
    const replay = replayMatch(saved);
    const failures = [...replay.problems];
    if (replay.reached !== replay.recorded) failures.push(`${replay.reached}/${replay.recorded} recorded checksums reached`);
    problems.push(...failures.map(problem => `checksum replay ${name}: ${problem}`));
    if (failures.length === 0) replayedMatches++;
    matchFrames += replay.frames;
  }
  if (matches.length > 0) lines.push(`checksums: ${replayedMatches}/${matches.length} exported full matches replay equal (${matchFrames} frames)`);
  const scenes = parseSceneExpectations(script);
  if (scenes.length > 0) {
    problems.push(...unmetSceneExpectations([readLines(join(headlessDir, "scene-a.txt")), readLines(join(headlessDir, "scene-b.txt"))], scenes, "headless"));
    lines.push(`scene: ${scenes.length} effect models checked in view`);
  }
  lines.push(...problems.map((problem) => `FAIL ${problem}`));
  lines.push(problems.length === 0 ? "PASS: the script's expectations hold headless" : `FAIL: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
  return { passed: problems.length === 0, lines };
}

/** The script's `#! chat TEXT` line: the developer command that starts its match, such as `-dev quick hero rifleman`. */
export function scriptChat(script: string): string | undefined {
  return /^\s*#!\s*chat\s+(.+?)\s*$/m.exec(script)?.[1];
}

/** Fields where two decoded states differ, as `path: a vs b`, at most `limit`. */
function stateDifferences(a: unknown, b: unknown, limit = 12): string[] {
  const found: string[] = [];
  const walk = (x: unknown, y: unknown, path: string) => {
    if (found.length >= limit) return;
    if (typeof x === "object" && x !== null && typeof y === "object" && y !== null) {
      for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) walk(Reflect.get(x, key), Reflect.get(y, key), `${path}.${key}`);
    } else if (x !== y && !(Number.isNaN(x) && Number.isNaN(y))) found.push(`${path}: native ${String(x)} vs headless ${String(y)}`);
  };
  walk(a, b, "state");
  return found;
}

/**
 * Native moments against headless moments that start on the same frame: the
 * rows each match ran on every frame both hold (the intended presses as the
 * helper made them, against what the native match ran), and the starting
 * states field by field, which names what a checksum difference is in.
 */
function momentDifferences(native: readonly Repro[], headless: readonly Repro[]): { lines: string[]; problems: string[] } {
  const lines: string[] = [];
  const problems: string[] = [];
  for (const saved of native) {
    const ours = parseMoment(saved.lines, saved.frame);
    if (typeof ours === "string") {
      problems.push(`native moment ending ${saved.frame}: ${ours}`);
      continue;
    }
    for (const other of headless) {
      const theirs = parseMoment(other.lines, other.frame);
      if (typeof theirs === "string" || theirs.start !== ours.start) continue;
      const frames = Math.min(ours.frames.length, theirs.frames.length);
      const differing = [];
      for (let index = 0; index < frames; index++) if (JSON.stringify(ours.frames[index]) !== JSON.stringify(theirs.frames[index])) differing.push(ours.start + index + 1);
      if (differing.length > 0) problems.push(`rows: the native match ran other rows than the intended script on ${differing.length} of frames ${ours.start + 1}-${ours.start + frames}, first ${differing[0]}`);
      else lines.push(`rows: the native match ran the intended script's rows on all ${frames} frames ${ours.start + 1}-${ours.start + frames}`);
      if (ours.start > 0) {
        const fields = stateDifferences(ours.state, theirs.state);
        if (fields.length > 0) problems.push(`state at frame ${ours.start} differs: ${fields.join("; ")}`);
      }
    }
  }
  return { lines, problems };
}

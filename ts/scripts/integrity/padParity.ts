// `bun wisp pad --headless --compare NATIVE`: a native `bun wisp pad` run
// and a headless run of the same script through the same real helper agree.
// The integrity build's input trace (smashcraft:ts/src/platform/shell/diagnostics.ts)
// records a confirmed-state checksum about once a second and a frame-tagged
// line whenever a fighter starts a special, an attack or a jump, is hit or
// recovers. The headless run's moment (View held a second, so the script
// asks for it) replays its rows to the native checksums, the confirmed
// fighter lines of both traces are equal, and each `#! expect` line in the
// script holds on both sides. Scripts state what must happen in comments:
//   #! expect CLIENT FRAME TEXT    a line for that fighter on that frame starts with TEXT
//   #! absent CLIENT FROM-TO TEXT  no line for that fighter in those frames starts with TEXT
//   #! scene CLIENT MODEL         that client's scene report had an effect whose model path contains MODEL in view
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { preloadLines } from "wisp/scripts/wisp/boundary";
import { readSceneLines } from "wisp/scripts/wisp/scene";
import { parseRepro } from "wisp/src/runtime/repro";
import { replayRepro } from "../../src/game/replay/moment";

export const TRACE_FILE = "wc3-melee-input-trace.txt";
export const REPRO_NAME = /^smashcraft-repro-p(\d)-f(\d+)-\d+\.txt$/;

export interface TraceEvent {
  readonly slot: number;
  readonly frame: number;
  /** The line after `frame F `: its phase and what happened. */
  readonly text: string;
}

export interface Trace {
  readonly checksums: ReadonlyMap<number, string>;
  readonly events: readonly TraceEvent[];
}

/** Confirmed-state changes the shell traces the same way on every client; presentation lines are left out. */
const COMPARED = /^phase \d+ (special |applied attack |applied jump |recovery |grab action |grab-hold |shield-break |ledge |di )/;

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

export interface Expectation {
  readonly kind: "expect" | "absent";
  readonly slot: number;
  readonly from: number;
  readonly to: number;
  readonly text: string;
  readonly line: number;
}

/** A `#! scene CLIENT MODEL` line: that client's scene report shows an effect whose model path contains MODEL in view. */
export interface SceneExpectation {
  readonly slot: number;
  readonly model: string;
  readonly line: number;
}

export function parseSceneExpectations(script: string): readonly SceneExpectation[] {
  const found: SceneExpectation[] = [];
  script.split("\n").forEach((raw, index) => {
    const match = /^\s*#!\s*scene\s+([ab])\s+(\S+)\s*$/.exec(raw);
    if (match !== null) found.push({ slot: match[1] === "a" ? 0 : 1, model: match[2] ?? "", line: index + 1 });
  });
  return found;
}

/** What each scene expectation found wrong in a client's scene report (smashcraft:docs/player-view.md). */
export function unmetSceneExpectations(reports: readonly (readonly string[] | undefined)[], expectations: readonly SceneExpectation[], side: string): string[] {
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
    const match = /^\s*#!\s*(expect|absent)\s+([ab])\s+(\d+)(?:-(\d+))?\s+(.+?)\s*$/.exec(raw);
    if (match === null) {
      if (/^\s*#!/.test(raw) && !/^\s*#!\s*scene\s/.test(raw)) throw new Error(`pad script line ${index + 1}: a #! line is "#! expect CLIENT FRAME TEXT", "#! absent CLIENT FROM-TO TEXT" or "#! scene CLIENT MODEL"`);
      return;
    }
    const from = Number(match[3]);
    found.push({ kind: match[1] === "expect" ? "expect" : "absent", slot: match[2] === "a" ? 0 : 1, from, to: match[4] === undefined ? from : Number(match[4]), text: match[5] ?? "", line: index + 1 });
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
    const where = `${side} script line ${expectation.line} (${expectation.kind} ${"ab"[expectation.slot]} ${expectation.from}${expectation.to === expectation.from ? "" : `-${expectation.to}`} ${expectation.text})`;
    if (expectation.to > last) problems.push(`${where}: the trace ends at frame ${last}`);
    else if (expectation.kind === "expect" && hits.length === 0) {
      const near = trace.events.filter((event) => event.slot === expectation.slot && Math.abs(event.frame - expectation.from) <= 30).map((event) => `${event.frame} ${event.text}`);
      problems.push(`${where}: no such line${near.length === 0 ? "" : `; nearby: ${near.join(" | ")}`}`);
    } else if (expectation.kind === "absent" && hits.length > 0) problems.push(`${where}: found ${hits.map((event) => `${event.frame} ${event.text}`).join(" | ")}`);
  }
  return problems;
}

/** A pad run's folder: client-N/CustomMapData (headless) or the files `bun wisp pad` collected beside its result. */
export function readLines(path: string): string[] | undefined {
  try {
    return preloadLines(readFileSync(path, "latin1"));
  } catch {
    return undefined;
  }
}

export interface ParityReport {
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
  readonly off_frame: number;
  readonly helpers_stopped: readonly string[];
  readonly build?: string;
}

const isRunResult = (value: unknown): value is RunResult => typeof value === "object" && value !== null
  && "off_frame" in value && typeof value.off_frame === "number"
  && "helpers_stopped" in value && Array.isArray(value.helpers_stopped) && value.helpers_stopped.every((item) => typeof item === "string")
  && (!("build" in value) || typeof value.build === "string");

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
  for (const [side, run] of [["native", native], ["headless", headless]] as const) {
    if (run.off_frame !== 0) problems.push(`${side}: ${run.off_frame} edges landed off their planned frame`);
    if (run.helpers_stopped.length > 0) problems.push(`${side}: ${run.helpers_stopped.join("; ")}`);
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
    const momentName = readdirSync(headlessDir).find((name) => REPRO_NAME.test(name));
    const moment = momentName === undefined ? undefined : parseRepro(readLines(join(headlessDir, momentName)) ?? []);
    if (moment === undefined || typeof moment === "string") problems.push(`headless: no moment saved (${moment ?? "hold View a second at the script's end"})`);
    else {
      const start = Number(/^start (\d+) /m.exec(moment.lines.join("\n"))?.[1] ?? Number.NaN);
      const nativeMoments = readdirSync(nativeDir).flatMap((name) => {
        const parsed = REPRO_NAME.test(name) ? parseRepro(readLines(join(nativeDir, name)) ?? []) : undefined;
        return parsed === undefined || typeof parsed === "string" ? [] : [parsed];
      });
      const checkpoints = new Map<number, string>();
      for (const [frame, checksum] of nativeTrace.checksums) if (frame > start && frame <= moment.frame) checkpoints.set(frame, checksum);
      for (const saved of nativeMoments) if (saved.frame > start && saved.frame <= moment.frame) checkpoints.set(saved.frame, saved.checksum);
      const replay = replayRepro({ ...moment, lines: [...moment.lines, ...[...checkpoints].map(([frame, checksum]) => `checkpoint ${frame} ${checksum}`)] });
      problems.push(...replay.problems.map((problem) => `checksum parity: ${problem}`));
      if (checkpoints.size < 2) problems.push(`checksum parity: only ${checkpoints.size} native checksums fall in the headless moment (frames ${start + 1}-${moment.frame})`);
      lines.push(`checksums: ${checkpoints.size} native confirmed-state checksums on frames ${[...checkpoints.keys()].sort((x, y) => x - y).join(", ")} replay equal in the headless moment (frames ${start + 1}-${moment.frame})${replay.problems.length === 0 ? "" : " -- NOT"}`);
      const through = Math.min(moment.frame, Math.max(0, ...nativeTrace.checksums.keys()), Math.max(0, ...headlessTrace.checksums.keys()));
      const difference = eventDifference(nativeTrace, headlessTrace, through);
      if (difference !== undefined) problems.push(`fighter lines differ through frame ${through}: ${difference}`);
      else lines.push(`fighter lines: ${nativeTrace.events.filter((event) => event.frame <= through).length} confirmed lines equal through frame ${through}`);
    }
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

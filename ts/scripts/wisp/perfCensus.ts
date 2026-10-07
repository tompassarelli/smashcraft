// `bun wisp perf census [--fighter NAME ...] [--stage ID ...] [--limit MS] [--jobs N] [--profile] [--out FILE]`:
// the spike census (#168). Every move, special and follow-up of every
// selectable fighter (scripts/wisp/census.ts), and every stage's hazards,
// played in the playable build in 32-bit Lua; each entry's worst frame is
// predicted in Warcraft (wisp's nativeFrameCost: Lua instructions, native
// calls, allocation) and reported above its baseline, the median of the
// standing frames just before it (a stage: its own median). It fails when
// any entry rises more than --limit ms (2 by default). --profile then replays
// the runs of the entries over it (or the five worst) with a sampling
// profiler on each one's worst frame and baseline, and prints the map
// functions that frame spent most in beyond a baseline frame.
import { join } from "node:path";
import { Console, Effect } from "effect";
import { mapCompiler, report } from "wisp/scripts/compiler";
import { type Command, UsageFailure, describeCause, flagValues } from "wisp/scripts/wisp/command";
import { PerfFailure } from "wisp/scripts/wisp/commands/perf";
import { WARCRAFT_COST, nativeFrameCost } from "wisp/src/headless/nativeCost";
import { SELECTABLE_CHARACTERS, fighterSlug } from "../../src/game/sim/heroes/registry";
import { STAGE_CATALOG } from "../../src/game/menu/stageCatalog";
import { CENSUS_STAGE } from "./census";
import { tsDirectory } from "./project";

/** An entry may rise this much above its baseline, in ms (#168). */
export const CENSUS_LIMIT_MS = 2;

interface FrameSample {
  readonly instructions: number;
  readonly natives: number;
  readonly allocatedKb: number;
}

export interface CensusEntry {
  readonly group: string;
  readonly name: string;
  /** Median predicted ms of the baseline frames. */
  readonly baselineMs: number;
  /** Worst predicted ms of the entry's frames. */
  readonly worstMs: number;
  /** The worst frame, counted from the entry's first. */
  readonly worstAt: number;
  /** The worst frame's number in its run, and the baseline's first and last. */
  readonly worstFrame: number;
  readonly baseFrames: readonly [number, number];
  readonly spikeMs: number;
  /** The worst frame's work above the baseline frames' medians. */
  readonly instructions: number;
  readonly natives: number;
  readonly allocatedKb: number;
}

const SAMPLE = /^frame (\d+) p0 instructions=(\d+) lua-us=\d+ natives=(\d+) alloc-bytes=(\d+) typed=\d+$/;

const predictedMs = (frame: FrameSample) => nativeFrameCost(WARCRAFT_COST, { ...frame, typedCharacters: 0 }).callbacksUs / 1000;

function median(values: readonly number[]): number {
  const order = [...values].sort((a, b) => a - b);
  const middle = Math.floor(order.length / 2);
  return order.length === 0 ? 0 : order.length % 2 === 1 ? order[middle]! : (order[middle - 1]! + order[middle]!) / 2;
}

/** The census entries a census run printed: its `census` lines read against its p0 frame samples. */
export function censusEntries(output: string): CensusEntry[] {
  const frames = new Map<number, FrameSample>();
  const marks: string[][] = [];
  for (const line of output.split(/\r?\n/)) {
    const sample = SAMPLE.exec(line);
    if (sample !== null) frames.set(Number(sample[1]), { instructions: Number(sample[2]), natives: Number(sample[3]), allocatedKb: Number(sample[4]) / 1024 });
    else if (line.startsWith("census\t")) marks.push(line.split("\t"));
  }
  const range = (first: number, last: number) => {
    const picked: FrameSample[] = [];
    for (let frame = first; frame <= last; frame++) {
      const sample = frames.get(frame);
      if (sample === undefined) throw new Error(`the census has no sample of frame ${frame}`);
      picked.push(sample);
    }
    return picked;
  };
  return marks.map(([, group = "", name = "", baseFirst, baseLast, moveFirst, moveLast]) => {
    const base = range(Number(baseFirst), Number(baseLast));
    const move = range(Number(moveFirst), Number(moveLast));
    const baselineMs = median(base.map(predictedMs));
    let worstAt = 0;
    move.forEach((frame, index) => {
      if (predictedMs(frame) > predictedMs(move[worstAt]!)) worstAt = index;
    });
    const worst = move[worstAt]!;
    const worstMs = predictedMs(worst);
    return {
      group, name, baselineMs, worstMs, worstAt, spikeMs: worstMs - baselineMs,
      worstFrame: Number(moveFirst) + worstAt, baseFrames: [Number(baseFirst), Number(baseLast)],
      instructions: worst.instructions - median(base.map((frame) => frame.instructions)),
      natives: worst.natives - median(base.map((frame) => frame.natives)),
      allocatedKb: worst.allocatedKb - median(base.map((frame) => frame.allocatedKb)),
    };
  });
}

export function censusLines(entries: readonly CensusEntry[], limitMs: number): string[] {
  const lines = ["group         entry                              base ms  worst ms  spike ms  at   +instructions  +natives  +KB"];
  for (const entry of entries) {
    lines.push(`${entry.group.padEnd(13)} ${entry.name.padEnd(34)} ${entry.baselineMs.toFixed(2).padStart(7)}  ${entry.worstMs.toFixed(2).padStart(8)}  ${entry.spikeMs.toFixed(2).padStart(8)}  ${String(entry.worstAt).padStart(3)}  ${String(Math.round(entry.instructions)).padStart(13)}  ${String(Math.round(entry.natives)).padStart(8)}  ${entry.allocatedKb.toFixed(0).padStart(3)}${entry.spikeMs > limitMs ? "  OVER" : ""}`);
  }
  const worst = [...entries].sort((a, b) => b.spikeMs - a.spikeMs)[0];
  if (worst !== undefined) lines.push(`${entries.length} entries; worst spike ${worst.spikeMs.toFixed(2)} ms (${worst.group} ${worst.name}); ${entries.filter((entry) => entry.spikeMs > limitMs).length} over ${limitMs} ms`);
  return lines;
}

/** A name for the map function starting on each line of the bundle: its module and the name its line gives it. */
export function functionNamer(bundle: string): (line: number) => string {
  const lines = bundle.split("\n");
  const modules: [number, string][] = [];
  lines.forEach((text, index) => {
    const module = /^\["([^"]+)"\] = function/.exec(text);
    if (module !== null) modules.push([index + 1, module[1]!]);
  });
  return (line) => {
    let module = "?";
    for (const [start, name] of modules) if (start <= line) module = name;
    const text = lines[line - 1] ?? "";
    const named = /function ([\w.:]+)\s*\(/.exec(text) ?? /([\w.\]["]+)\s*=\s*function/.exec(text);
    const name = named === null ? `line ${line}` : named[1]!.replace(/____exports\.?/, "").replace(/\["?|"?\]/g, "");
    return `${module.replace(/^game\.|^lua_modules\.wisp\.src\./, "")} ${name}`;
  };
}

/** Per function line: [self, inclusive] samples of the frames listed, summed. */
function profileOf(output: string, frames: ReadonlySet<number>): Map<number, [number, number]> {
  const totals = new Map<number, [number, number]>();
  for (const text of output.split("\n")) {
    if (!text.startsWith("prof\t")) continue;
    const [, frame, line, self, inclusive] = text.split("\t").map(Number);
    if (!frames.has(frame!)) continue;
    const entry = totals.get(line!) ?? [0, 0];
    entry[0] += self!;
    entry[1] += inclusive!;
    totals.set(line!, entry);
  }
  return totals;
}

/** The functions the worst frame spent most beyond a mean baseline frame, in thousands of instructions. */
export function profileLines(entry: CensusEntry, output: string, name: (line: number) => string, top = 12): string[] {
  const [first, last] = entry.baseFrames;
  const baseFrames = new Set<number>();
  for (let frame = first; frame <= last; frame++) baseFrames.add(frame);
  const base = profileOf(output, baseFrames);
  const worst = profileOf(output, new Set([entry.worstFrame]));
  const rows = [...worst].map(([line, [self, inclusive]]) => {
    const [baseSelf, baseInclusive] = base.get(line) ?? [0, 0];
    return { line, self: self - baseSelf / baseFrames.size, inclusive: inclusive - baseInclusive / baseFrames.size };
  });
  const lines = [`profile ${entry.group} ${entry.name} (frame +${entry.worstAt}, ${entry.spikeMs.toFixed(2)} ms over baseline): k-instructions above a baseline frame, inclusive / self`];
  for (const row of rows.sort((a, b) => b.inclusive - a.inclusive).slice(0, top)) lines.push(`  ${row.inclusive.toFixed(0).padStart(5)} ${row.self.toFixed(0).padStart(5)}  ${name(row.line)}`);
  return lines;
}

const compile = (config: string) => Effect.try({
  try: () => report(mapCompiler(config)()),
  catch: (cause) => new PerfFailure({ problem: `compiling ${config}: ${describeCause(cause)}` }),
}).pipe(Effect.flatMap((problems) => (problems === "" ? Effect.void : Effect.fail(new PerfFailure({ problem: problems })))));

export interface CensusProject {
  readonly map: { readonly config: string; readonly bundle: string };
  readonly program: { readonly config: string; readonly bundle: string };
}

/** The run that played an entry. */
const runOf = (entry: CensusEntry) => (entry.group === "stage" ? `census-stage-${entry.name}` : `census-${entry.group}`);

const runOne = (project: CensusProject, run: string, profileFrames?: readonly number[]) => Effect.tryPromise({
  try: async () => {
    const lua = process.env.LUA ?? "lua";
    const env = profileFrames === undefined ? process.env : { ...process.env, CENSUS_PROFILE_FRAMES: profileFrames.join(",") };
    const child = Bun.spawn([lua, project.program.bundle, project.map.bundle, join(tsDirectory, "node_modules/wisp/src/natives/warcraft.d.ts"), run, "0", "samples"], { stdout: "pipe", stderr: "pipe", env });
    const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    if (code !== 0) throw new Error(`${run}: ${lua} exited ${code}: ${err}${out.split("\n").filter((line) => !line.startsWith("frame ")).join("\n")}`);
    return out;
  },
  catch: (cause) => new PerfFailure({ problem: describeCause(cause) }),
});

export const census = (project: CensusProject): Command => (args) => Effect.gen(function*() {
  const [limitText = String(CENSUS_LIMIT_MS)] = flagValues(args, "limit");
  const [jobsText = "2"] = flagValues(args, "jobs");
  const [out] = flagValues(args, "out");
  const profile = args.includes("--profile");
  const fighters = flagValues(args, "fighter");
  const stages = flagValues(args, "stage");
  const limit = Number(limitText);
  const jobs = Number(jobsText);
  const known = SELECTABLE_CHARACTERS.map(fighterSlug);
  const unknown = fighters.filter((name) => !known.includes(name));
  if (!(limit > 0) || !(jobs >= 1) || unknown.length > 0) return yield* new UsageFailure({ problem: `perf census takes --fighter NAME (${known.join(", ")}), --stage ID, --limit MS, --jobs N, --profile and --out FILE` });
  const everything = fighters.length === 0 && stages.length === 0;
  const runs = [
    ...(everything ? known : fighters).map((name) => `census-${name}`),
    ...(everything ? STAGE_CATALOG.map((stage) => String(stage.id)).filter((id) => id !== String(CENSUS_STAGE)) : stages).map((id) => `census-stage-${id}`),
  ];
  yield* compile(project.map.config);
  yield* compile(project.program.config);
  const outputs = yield* Effect.forEach(runs, (run) => runOne(project, run), { concurrency: jobs });
  const output = outputs.join("\n");
  if (out !== undefined) yield* Effect.tryPromise({ try: () => Bun.write(out, output), catch: (cause) => new PerfFailure({ problem: `writing ${out}: ${describeCause(cause)}` }) });
  const errors = output.split("\n").filter((line) => line.startsWith("journey: "));
  const entries = yield* Effect.try({ try: () => censusEntries(output), catch: (cause) => new PerfFailure({ problem: describeCause(cause) }) });
  yield* Console.log(censusLines(entries, limit).join("\n"));
  if (profile) {
    const shown = entries.filter((entry) => entry.spikeMs > limit);
    const picked = shown.length > 0 ? shown : [...entries].sort((a, b) => b.spikeMs - a.spikeMs).slice(0, 5);
    const name = functionNamer(yield* Effect.promise(() => Bun.file(project.map.bundle).text()));
    const byRun = new Map<string, CensusEntry[]>();
    for (const entry of picked) byRun.set(runOf(entry), [...(byRun.get(runOf(entry)) ?? []), entry]);
    for (const [run, items] of byRun) {
      const frames = items.flatMap((entry) => {
        const listed = [entry.worstFrame];
        for (let frame = entry.baseFrames[0]; frame <= entry.baseFrames[1]; frame++) listed.push(frame);
        return listed;
      });
      const profiled = yield* runOne(project, run.replace(/^census-/, "census-profile-"), frames);
      for (const entry of items) yield* Console.log(profileLines(entry, profiled, name).join("\n"));
    }
  }
  if (errors.length > 0) return yield* new PerfFailure({ problem: `the census found problems: ${errors.join("; ")}` });
  const over = entries.filter((entry) => entry.spikeMs > limit);
  if (over.length > 0) return yield* new PerfFailure({ problem: `${over.length} census entries rise more than ${limit} ms: ${over.map((entry) => `${entry.group} ${entry.name} ${entry.spikeMs.toFixed(2)} ms`).join(", ")}` });
});

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Console, Effect, Schema } from "effect";
import { captureProcess } from "wisp/scripts/wisp/mapBuild";
import { STAGE_CATALOG } from "../../src/game/menu/stageCatalog";
import { SELECTABLE_CHARACTERS, fighterName } from "../../src/game/sim/heroes/registry";

const MATCH_START = 300;
const BUTTONS = ["A", "A", "A", "X", "X", "B", "RB"] as const;

export interface AcceptanceMatch {
  readonly index: number;
  readonly rttMs: number;
  readonly seed: number;
  readonly fighters: readonly [string, string];
  readonly stage: number;
}

const random = (seed: number) => {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
};

/** The matches: round trips 0, 60 and 120 ms in turn, each with its own fighters and stage. */
export function acceptanceMatches(count: number, rtts: readonly number[], seed: number): readonly AcceptanceMatch[] {
  const draw = random(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(draw() * items.length)] as T;
  return Array.from({ length: count }, (_, index) => ({
    index, rttMs: rtts[index % rtts.length] ?? 0, seed: seed + index,
    fighters: [fighterName(pick(SELECTABLE_CHARACTERS)), fighterName(pick(SELECTABLE_CHARACTERS))],
    stage: pick(STAGE_CATALOG).id,
  }));
}

/** Three stocks, no time limit; a starts the match; then both players walk, jump, shield, grab and attack in every direction until someone is KO'd. */
export function acceptancePad(match: AcceptanceMatch, frames: number, setup: readonly string[] = ["#! chat -dev stocks 3"]): string {
  const draw = random(match.seed * 7919);
  const lines = [
    `# wisp#112 match ${match.index}: ${match.fighters[0]} against ${match.fighters[1]} on stage ${match.stage}, ${match.rttMs} ms round trip`,
    ...setup, "#! chat -dev time 0", "#! chat -dev auto-rematch off",
    `#! chat -dev fighter 1 ${match.fighters[0]}`, `#! chat -dev fighter 2 ${match.fighters[1]}`, `#! chat -dev stage ${match.stage}`,
    "60 a tap START 3", "140 a tap A 3",
  ];
  const edges: { frame: number; line: string }[] = [];
  for (const player of ["a", "b"] as const) {
    let frame = MATCH_START + Math.floor(draw() * 20);
    while (frame < frames - 60) {
      const roll = draw();
      const x = Math.round((draw() * 2 - 1) * 10) / 10, y = Math.round((draw() * 2 - 1) * 10) / 10;
      if (roll < 0.3) {
        const hold = 8 + Math.floor(draw() * 30);
        edges.push({ frame, line: `${player} stick ${draw() < 0.5 ? -1 : 1} 0` }, { frame: frame + hold, line: `${player} stick 0 0` });
        frame += hold + 2;
      } else if (roll < 0.4) {
        const hold = 6 + Math.floor(draw() * 24);
        edges.push({ frame, line: `${player} shield 1` }, { frame: frame + hold, line: `${player} shield 0` });
        frame += hold + 2;
      } else {
        const button = BUTTONS[Math.floor(draw() * BUTTONS.length)] ?? "A";
        edges.push({ frame, line: `${player} stick ${x} ${y}` }, { frame: frame + 1, line: `${player} tap ${button} 3` }, { frame: frame + 5, line: `${player} stick 0 0` });
        frame += 6;
      }
      frame += 4 + Math.floor(draw() * 16);
    }
  }
  edges.sort((a, b) => a.frame - b.frame);
  return [...lines, ...edges.map(({ frame, line }) => `${frame} ${line}`)].join("\n") + "\n";
}

const Distribution = Schema.Struct({ n: Schema.Finite, p50: Schema.Finite, p95: Schema.Finite, p99: Schema.Finite, max: Schema.Finite });
const RollbackReport = Schema.Struct({ window: Schema.Finite, delay: Schema.Finite, depth: Distribution, lead: Distribution, leadInsideWindow: Schema.Finite, stalls: Schema.Finite });
const decodeRollback = Schema.decodeUnknownSync(Schema.fromJsonString(RollbackReport));
const CapturedRow = Schema.Struct({ frame: Schema.Finite, pressed: Schema.Finite, tick: Schema.Finite, frontier: Schema.Finite, drawnTick: Schema.Finite, pressTicks: Schema.Array(Schema.Finite) });
const PressReport = Schema.Struct({
  slot: Schema.Finite, delay: Schema.Finite, conflicts: Schema.Finite, unmatched: Schema.Finite, lost: Schema.Finite, captured: Schema.Array(CapturedRow),
  received: Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Finite)),
});
const decodePresses = Schema.decodeUnknownSync(Schema.fromJsonString(PressReport));

export interface SideResult {
  readonly summary: string;
  readonly frames: number | undefined;
  readonly checksums: number | undefined;
  readonly mismatches: number | undefined;
  readonly rollback: typeof RollbackReport.Type | undefined;
  readonly presses: typeof PressReport.Type | undefined;
  readonly matchAt: number | undefined;
  readonly resultAt: number | undefined;
}

/** One side's outcome from `net pair`: its summary line on stdout and its relayed `net:` lines on stderr. */
export function sideResult(stdout: string, stderr: string, side: "host" | "join"): SideResult {
  const summary = stdout.split("\n").find((line) => line.startsWith(`${side}: `)) ?? `${side}: no summary`;
  const relayed = stderr.split("\n").filter((line) => line.startsWith(`${side} net: `)).map((line) => line.substring(side.length + 6));
  const number = (pattern: RegExp) => {
    const found = pattern.exec(summary)?.[1];
    return found === undefined ? undefined : Number(found);
  };
  const phaseAt = (name: string) => {
    const line = relayed.find((text) => text.startsWith(`${name} at frame `));
    return line === undefined ? undefined : Number(line.split(" ").at(-1));
  };
  const rollback = relayed.find((text) => text.startsWith("rollback "));
  const presses = relayed.find((text) => text.startsWith("presses "));
  return {
    summary, frames: number(/: (\d+) frames,/), checksums: number(/(\d+) checksums compared/), mismatches: number(/(\d+) mismatches/),
    rollback: rollback === undefined ? undefined : decodeRollback(rollback.substring(9)),
    presses: presses === undefined ? undefined : decodePresses(presses.substring(8)),
    matchAt: phaseAt("match"), resultAt: phaseAt("result"),
  };
}

const ts = join(import.meta.dir, "../..");

/** Two players and two computers, 99 stocks, so four fighters stay on stage for the whole run. */
export const FOUR_FIGHTER_SETUP = ["#! chat -dev slots 3 12", "#! chat -dev stocks 99", "#! chat -dev fighter 3 Illidan", "#! chat -dev fighter 4 Warden"];

const DisplaySummary = Schema.Struct({ frames: Schema.Finite, fps: Schema.Finite, frameMs: Schema.Struct({ p50: Schema.Finite, p95: Schema.Finite, p99: Schema.Finite }), intervalMs: Schema.Struct({ p50: Schema.Finite, p95: Schema.Finite, p99: Schema.Finite }), presentedMs: Schema.Struct({ p50: Schema.Finite, p95: Schema.Finite, p99: Schema.Finite }) });
const decodeDisplay = Schema.decodeUnknownSync(Schema.fromJsonString(DisplaySummary));

/** A four-fighter online match in two standalone windows, host and join on this machine, each keeping its own display timing in `out`/host and `out`/join. */
export const runFourFighters = (options: { readonly frames: number; readonly seed: number; readonly out: string; readonly port: number }) =>
  Effect.gen(function*() {
    mkdirSync(options.out, { recursive: true });
    const [match] = acceptanceMatches(1, [0], options.seed);
    if (match === undefined) return [];
    const pad = join(options.out, "four-fighters.pad");
    writeFileSync(pad, acceptancePad({ ...match, stage: 0 }, options.frames, FOUR_FIGHTER_SETUP));
    const side = (name: string, role: readonly string[]) => Effect.gen(function*() {
      const out = join(options.out, name);
      mkdirSync(out, { recursive: true });
      const run = yield* captureProcess("play --standalone", pad, [process.execPath, "scripts/wisp.ts", "play", "--standalone", ...role, "--script", pad, "--frames", `${options.frames}`, "--out", out]);
      writeFileSync(join(options.out, `${name}.log`), `${run.stdout}\n${run.stderr}`);
      return { side: name, exitCode: run.exitCode, display: decodeDisplay(yield* Effect.promise(() => Bun.file(join(out, "standalone.json")).text())) };
    });
    return yield* Effect.all([side("host", ["--host", "--port", `${options.port}`]), Effect.sleep("3 seconds").pipe(Effect.andThen(side("join", ["--join", `127.0.0.1:${options.port}`])))], { concurrency: 2 });
  });

/** Runs every match as `net pair` through the delay and loss proxy, `jobs` at a time, and writes each pad, log and the summary to `out`. */
export const runAcceptance = (options: { readonly matches: number; readonly frames: number; readonly jobs: number; readonly loss: number; readonly seed: number; readonly out: string; readonly rtts: readonly number[] }) =>
  Effect.gen(function*() {
    mkdirSync(options.out, { recursive: true });
    const matches = acceptanceMatches(options.matches, options.rtts, options.seed);
    const results = yield* Effect.forEach(matches, (match) => Effect.gen(function*() {
      const pad = join(options.out, `match-${match.index}.pad`);
      writeFileSync(pad, acceptancePad(match, options.frames));
      const command = [process.execPath, "scripts/wisp.ts", "net", "pair", "--script", pad, "--frames", `${options.frames}`, "--rtt", `${match.rttMs}`, "--loss", `${options.loss}`, "--seed", `${match.seed}`];
      const run = yield* captureProcess("net pair", pad, command).pipe(Effect.orElseSucceed(() => ({ exitCode: -1, stdout: "", stderr: "spawn failed" })));
      writeFileSync(join(options.out, `match-${match.index}.log`), `${run.stdout}\n${run.stderr}`);
      const host = sideResult(run.stdout, run.stderr, "host"), join_ = sideResult(run.stdout, run.stderr, "join");
      const row = { ...match, exitCode: run.exitCode, host, join: join_, accounting: [pressAccounting(host, join_), pressAccounting(join_, host)] };
      yield* Console.log(`match ${match.index} rtt ${match.rttMs} ${match.fighters.join(" v ")} stage ${match.stage}: exit ${run.exitCode} result ${host.resultAt}/${join_.resultAt} mismatches ${host.mismatches}/${join_.mismatches} depth p95 ${host.rollback?.depth.p95}/${join_.rollback?.depth.p95}`);
      return row;
    }), { concurrency: options.jobs });
    writeFileSync(join(options.out, "results.json"), JSON.stringify(results, null, 1));
    return results;
  });

/** One player's presses against the other side: lost or extra presses, rows off their assigned frame or missing remotely, and press-to-drawn ticks. */
export function pressAccounting(local: SideResult, remote: SideResult) {
  const report = local.presses;
  if (report === undefined) return { presses: 0, lost: 1, extra: 1, offFrame: 1, remoteMismatch: 1, drawn: [] as number[], delay: 0 };
  const remoteRows = remote.presses?.received[`${report.slot}`] ?? {};
  const ownFrames = new Set(report.captured.map((row) => row.frame));
  const drawn = report.captured.flatMap((row) => row.pressTicks.map((tick) => row.drawnTick < 0 ? Infinity : row.drawnTick - tick));
  return {
    presses: report.captured.reduce((sum, row) => sum + row.pressTicks.length, 0), lost: report.lost,
    extra: report.unmatched + Object.keys(remoteRows).filter((frame) => !ownFrames.has(Number(frame))).length + report.conflicts,
    offFrame: report.captured.filter((row) => row.frame - row.frontier !== report.delay).length,
    remoteMismatch: report.captured.filter((row) => remoteRows[`${row.frame}`] !== row.pressed).length,
    drawn, delay: report.delay,
  };
}

type Accounting = ReturnType<typeof pressAccounting>;
type Row = AcceptanceMatch & { readonly exitCode: number; readonly host: SideResult; readonly join: SideResult; readonly accounting: readonly Accounting[] };

/** Per round trip: matches, both sides at the results screen, checksums and mismatches, and the worst match's rollback depth and remote lead. */
export function acceptanceSummary(rows: readonly Row[]) {
  return [...new Set(rows.map((row) => row.rttMs))].map((rttMs) => {
    const at = rows.filter((row) => row.rttMs === rttMs);
    const sides = at.flatMap((row) => [row.host, row.join]);
    const rollbacks = sides.flatMap((side) => side.rollback === undefined ? [] : [side.rollback]);
    const worst = (pick: (report: typeof RollbackReport.Type) => number) => Math.max(0, ...rollbacks.map(pick));
    return {
      rttMs, matches: at.length,
      results: at.filter((row) => row.host.resultAt !== undefined && row.join.resultAt !== undefined).length,
      checksums: sides.reduce((sum, side) => sum + (side.checksums ?? 0), 0),
      mismatches: sides.reduce((sum, side) => sum + (side.mismatches ?? 1), 0),
      window: worst((report) => report.window), delay: worst((report) => report.delay),
      corrections: rollbacks.reduce((sum, report) => sum + report.depth.n, 0),
      depthP95: worst((report) => report.depth.p95), depthP99: worst((report) => report.depth.p99), depthMax: worst((report) => report.depth.max),
      leadP99: worst((report) => report.lead.p99), leadMax: worst((report) => report.lead.max),
      leadInsideWindow: Math.min(1, ...rollbacks.map((report) => report.leadInsideWindow)),
      stalls: rollbacks.reduce((sum, report) => sum + report.stalls, 0),
      ...pressSummary(at.flatMap((row) => row.accounting)),
      matchSeconds: Math.round(Math.max(0, ...at.map((row) => ((row.host.resultAt ?? 0) - (row.host.matchAt ?? 0)) / 60))),
    };
  });
}

function pressSummary(sides: readonly Accounting[]) {
  const drawn = sides.flatMap((side) => side.drawn).sort((a, b) => a - b);
  const sum = (pick: (side: Accounting) => number) => sides.reduce((total, side) => total + pick(side), 0);
  const presses = sum((side) => side.presses);
  return {
    presses, pressesLost: sum((side) => side.lost), pressesExtra: sum((side) => side.extra),
    onAssignedFrame: presses === 0 ? 0 : 1 - (sum((side) => side.offFrame) + sum((side) => side.remoteMismatch)) / Math.max(1, sides.reduce((total, side) => total + side.drawn.length, 0)),
    offFrame: sum((side) => side.offFrame), remoteMismatch: sum((side) => side.remoteMismatch), inputDelay: Math.max(0, ...sides.map((side) => side.delay)),
    drawnWithin3: drawn.length === 0 ? 0 : drawn.filter((ticks) => ticks <= 3).length / drawn.length,
    drawnP50: drawn[Math.floor(drawn.length / 2)] ?? 0, drawnMax: drawn.at(-1) ?? 0,
  };
}

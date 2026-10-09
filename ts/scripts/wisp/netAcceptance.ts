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
export function acceptancePad(match: AcceptanceMatch, frames: number): string {
  const draw = random(match.seed * 7919);
  const lines = [
    `# wisp#112 match ${match.index}: ${match.fighters[0]} against ${match.fighters[1]} on stage ${match.stage}, ${match.rttMs} ms round trip`,
    "#! chat -dev stocks 3", "#! chat -dev time 0", "#! chat -dev auto-rematch off",
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

export interface SideResult {
  readonly summary: string;
  readonly frames: number | undefined;
  readonly checksums: number | undefined;
  readonly mismatches: number | undefined;
  readonly rollback: typeof RollbackReport.Type | undefined;
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
  return {
    summary, frames: number(/: (\d+) frames,/), checksums: number(/(\d+) checksums compared/), mismatches: number(/(\d+) mismatches/),
    rollback: rollback === undefined ? undefined : decodeRollback(rollback.substring(9)),
    matchAt: phaseAt("match"), resultAt: phaseAt("result"),
  };
}

const ts = join(import.meta.dir, "../..");

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
      const row = { ...match, exitCode: run.exitCode, host, join: join_ };
      yield* Console.log(`match ${match.index} rtt ${match.rttMs} ${match.fighters.join(" v ")} stage ${match.stage}: exit ${run.exitCode} result ${host.resultAt}/${join_.resultAt} mismatches ${host.mismatches}/${join_.mismatches} depth p95 ${host.rollback?.depth.p95}/${join_.rollback?.depth.p95}`);
      return row;
    }), { concurrency: options.jobs });
    writeFileSync(join(options.out, "results.json"), JSON.stringify(results, null, 1));
    return results;
  });

type Row = AcceptanceMatch & { readonly exitCode: number; readonly host: SideResult; readonly join: SideResult };

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
      matchSeconds: Math.round(Math.max(0, ...at.map((row) => ((row.host.resultAt ?? 0) - (row.host.matchAt ?? 0)) / 60))),
    };
  });
}

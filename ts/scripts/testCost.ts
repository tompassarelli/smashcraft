// The suite's CPU budget (ts/AGENTS.md), shared by `bun run test`
// (scripts/test.ts) and the Lua32 runner (scripts/lua-tests.ts). Each test
// file (a src module for game tests) has a committed baseline row: its test
// count and CPU seconds, scaled to the reference machine. A run fails a test
// over the per-test ceiling, and a file whose CPU per test rises more than
// RISE over its baseline at the same test count. CPU is the test process's
// rusage (user plus system), so other work on the machine slows a run without
// adding to it, except where it competes for a core's shared resources; a
// verdict reached while CPU pressure was above Wisp's BUSY_PRESSURE is
// inconclusive instead (wisp:docs/testing.md).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** Bun: CPU seconds one test may use (AGENTS.md). Never raise it to fit a test. */
export const BUN_TEST_CEILING_S = 4;
/** Lua32: CPU seconds one test may use (AGENTS.md). Never raise it to fit a test. */
export const LUA_TEST_CEILING_S = 6;
/** A file fails when its CPU per test exceeds its baseline by more than this share. */
export const RISE = 0.25;
/** A rise smaller than this many CPU seconds over the whole file is measurement noise. */
export const NOISE_S = 1;
/** Files with at least this much baseline CPU set the machine's speed against the reference. */
const SPEED_SAMPLE_MIN_S = 0.5;
const SPEED_SAMPLES_MIN = 8;

export interface UnitCost {
  readonly tests: number;
  readonly cpu: number;
  /** The CPU seconds of the file's heaviest test, when measured. */
  readonly max?: number;
}

export type Costs = Map<string, UnitCost>;

export function addCost(costs: Costs, unit: string, tests: number, cpu: number, max = 0): void {
  const before = costs.get(unit) ?? { tests: 0, cpu: 0 };
  costs.set(unit, { tests: before.tests + tests, cpu: before.cpu + cpu, max: Math.max(before.max ?? 0, max) });
}

const HEADER = "unit\ttests\tcpu_s";

export function readBaseline(path: string): Costs {
  const costs: Costs = new Map();
  if (!existsSync(path)) return costs;
  for (const line of readFileSync(path, "utf8").split("\n").slice(1)) {
    const [unit, tests, cpu] = line.split("\t");
    if (unit !== undefined && unit !== "" && tests !== undefined && cpu !== undefined) costs.set(unit, { tests: Number(tests), cpu: Number(cpu) });
  }
  return costs;
}

function writeBaseline(path: string, costs: Costs): void {
  const rows = [...costs].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([unit, cost]) => `${unit}\t${cost.tests}\t${cost.cpu.toFixed(3)}`);
  writeFileSync(path, `${[HEADER, ...rows].join("\n")}\n`);
}

/**
 * This machine's CPU seconds per reference-machine CPU second: the median
 * ratio over files measured at their baseline test count. A partial run with
 * too few such files compares at 1.
 */
export function speedFactor(measured: Costs, baseline: Costs): number {
  const ratios: number[] = [];
  for (const [unit, cost] of measured) {
    const base = baseline.get(unit);
    if (base !== undefined && base.tests === cost.tests && base.cpu >= SPEED_SAMPLE_MIN_S && cost.cpu > 0) ratios.push(cost.cpu / base.cpu);
  }
  if (ratios.length < SPEED_SAMPLES_MIN) return 1;
  ratios.sort((a, b) => a - b);
  const middle = Math.floor(ratios.length / 2);
  const upper = ratios[middle] ?? 1;
  return ratios.length % 2 === 1 ? upper : ((ratios[middle - 1] ?? upper) + upper) / 2;
}

export interface Judgement {
  /** One line per file over budget, naming it. */
  readonly risen: readonly string[];
  readonly factor: number;
  readonly summary: string;
  /** The files of the five heaviest tests, heaviest first. */
  readonly heaviest: string;
  /** Baseline rows written: new files and files whose test count changed. */
  readonly updated: number;
}

/**
 * Compares a run with its baseline, rewrites the rows of new files and of
 * files whose test count changed (all measured rows with TEST_COST_UPDATE=1),
 * drops rows whose file is gone, and summarizes the run.
 */
export function judge(options: {
  readonly label: string;
  readonly measured: Costs;
  readonly baselinePath: string;
  readonly project: string;
  readonly totalCpu?: number;
  /**
   * False for a run of a few files: each pays the module loading that the
   * whole suite shares, so only the ceiling applies and no row is written.
   */
  readonly whole?: boolean;
  /** False leaves the baseline file untouched and only prints its new rows (the pre-push gate). */
  readonly write?: boolean;
}): Judgement {
  const { label, measured, baselinePath, project } = options;
  const baseline = readBaseline(baselinePath);
  const factor = speedFactor(measured, baseline);
  const risen: string[] = [];
  const rewriteAll = process.env.TEST_COST_UPDATE === "1";
  const next: Costs = new Map(baseline);
  let updated = 0;
  let tests = 0;
  let cpu = 0;
  let baseTests = 0;
  let baseCpu = 0;
  for (const [unit, cost] of [...measured].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (cost.tests === 0) continue;
    // game.test.ts counts module tests again to amortize loading, not as new tests.
    const wrapper = unit === "test/game.test.ts";
    tests += wrapper ? 0 : cost.tests;
    cpu += cost.cpu;
    const base = baseline.get(unit);
    if (base !== undefined) {
      baseTests += wrapper ? 0 : base.tests;
      baseCpu += base.cpu;
    }
    if (options.whole === false) continue;
    if (base !== undefined && base.tests === cost.tests && !rewriteAll) {
      const allowed = base.cpu * factor * (1 + RISE);
      if (cost.cpu > allowed && cost.cpu - base.cpu * factor > NOISE_S) {
        const rise = (cost.cpu / (base.cpu * factor) - 1) * 100;
        risen.push(`${unit}: ${(cost.cpu / cost.tests).toFixed(2)} s CPU per test, ${rise.toFixed(0)}% over its baseline ${((base.cpu * factor) / base.tests).toFixed(2)} s; shrink it or move it to the farm`);
      }
      continue;
    }
    next.set(unit, { tests: cost.tests, cpu: cost.cpu / factor });
    console.log(`test cost baseline row: ${unit}\t${cost.tests}\t${(cost.cpu / factor).toFixed(3)}`);
    updated++;
  }
  for (const unit of next.keys()) {
    if (options.whole !== false && !existsSync(resolve(project, unit))) {
      next.delete(unit);
      updated++;
    }
  }
  if (updated > 0 && options.write !== false) writeBaseline(baselinePath, next);
  const perTest = tests === 0 ? 0 : cpu / tests;
  const basePerTest = baseTests === 0 ? 0 : (baseCpu * factor) / baseTests;
  const change = basePerTest === 0 ? "" : ` (${perTest >= basePerTest ? "+" : ""}${((perTest / basePerTest - 1) * 100).toFixed(0)}%)`;
  const total = options.totalCpu === undefined ? "" : `, ${options.totalCpu.toFixed(1)} s in all with process start-up`;
  const summary = `${label} CPU: ${cpu.toFixed(1)} s for ${tests} tests${total}; ${perTest.toFixed(3)} s per test against the baseline's ${basePerTest.toFixed(3)} s${change}, this machine at ${factor.toFixed(2)}x the reference`;
  const heaviest = [...measured].filter(([, cost]) => (cost.max ?? 0) > 0).sort(([, a], [, b]) => (b.max ?? 0) - (a.max ?? 0)).slice(0, 5)
    .map(([unit, cost]) => `${unit} ${(cost.max ?? 0).toFixed(2)} s`).join(", ");
  return { risen, factor, summary, updated, heaviest: `${label} heaviest tests (CPU): ${heaviest}` };
}

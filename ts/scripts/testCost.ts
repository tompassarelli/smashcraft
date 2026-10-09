// The suite's cost budget (ts/AGENTS.md). The Lua32 runner (scripts/lua-tests.ts)
// gates each test file on deterministic counts: Lua VM instructions and
// kilobytes allocated per test, against committed rows in
// test/lua/cost-baseline.tsv (#394). CPU seconds vary 0.5-1.9x between CI
// machines, so they gate nothing here; `bun run test` (scripts/test.ts) only
// reports them, and wall-clock budgets live in the exclusive-lease perf
// measurements (#168).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** Bun: CPU seconds one test may use (AGENTS.md). Never raise it to fit a test. */
export const BUN_TEST_CEILING_S = 4;
/** Lua32: CPU seconds one test may use on the reference runner (AGENTS.md). Never raise it to fit a test. */
export const LUA_TEST_CEILING_S = 6;
/** The reference CI runner's stock Lua32 speed: the median over the heaviest files of their instructions per baseline CPU second (#394). */
export const LUA_INSTRUCTIONS_PER_S = 70_000_000;
export const LUA_TEST_CEILING_INSTRUCTIONS = LUA_TEST_CEILING_S * LUA_INSTRUCTIONS_PER_S;
/** A file fails when its instructions or allocation per test exceed its baseline by more than this share. */
export const RISE = 0.25;
/** Rises below these totals per file are too small to matter: one reference second, and 16 MB. */
export const MATTERS_INSTRUCTIONS = LUA_INSTRUCTIONS_PER_S;
export const MATTERS_KB = 16384;

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

/** Bun CPU estimates per file (test/cost-baseline.tsv), used only to order and select processes. */
export function readBaseline(path: string): Costs {
  const costs: Costs = new Map();
  if (!existsSync(path)) return costs;
  for (const line of readFileSync(path, "utf8").split("\n").slice(1)) {
    const [unit, tests, cpu] = line.split("\t");
    if (unit !== undefined && unit !== "" && tests !== undefined && cpu !== undefined) costs.set(unit, { tests: Number(tests), cpu: Number(cpu) });
  }
  return costs;
}

/** The heaviest five files and the run's CPU, for the log; it gates nothing. */
export function cpuReport(label: string, measured: Costs, totalCpu?: number): readonly string[] {
  let tests = 0;
  let cpu = 0;
  for (const [unit, cost] of measured) {
    // game.test.ts counts module tests again to amortize loading, not as new tests.
    if (unit !== "test/game.test.ts") tests += cost.tests;
    cpu += cost.cpu;
  }
  const heaviest = [...measured].filter(([, cost]) => (cost.max ?? 0) > 0).sort(([, a], [, b]) => (b.max ?? 0) - (a.max ?? 0)).slice(0, 5)
    .map(([unit, cost]) => `${unit} ${(cost.max ?? 0).toFixed(2)} s`).join(", ");
  const total = totalCpu === undefined ? "" : `, ${totalCpu.toFixed(1)} s in all with process start-up`;
  return [`${label} heaviest tests (CPU): ${heaviest}`, `${label} CPU: ${cpu.toFixed(1)} s for ${tests} tests${total} (reported, not gated)`];
}

export interface LuaCost {
  readonly tests: number;
  readonly instructions: number;
  readonly allocKb: number;
  readonly maxInstructions?: number;
}

export type LuaCosts = Map<string, LuaCost>;

export function addLuaCost(costs: LuaCosts, unit: string, instructions: number, allocKb: number): void {
  const before = costs.get(unit) ?? { tests: 0, instructions: 0, allocKb: 0, maxInstructions: 0 };
  costs.set(unit, {
    tests: before.tests + 1, instructions: before.instructions + instructions, allocKb: before.allocKb + allocKb,
    maxInstructions: Math.max(before.maxInstructions ?? 0, instructions),
  });
}

const LUA_HEADER = "unit\ttests\tinstructions\talloc_kb";

export function readLuaBaseline(path: string): LuaCosts {
  const costs: LuaCosts = new Map();
  if (!existsSync(path)) return costs;
  for (const line of readFileSync(path, "utf8").split("\n").slice(1)) {
    const [unit, tests, instructions, allocKb] = line.split("\t");
    if (unit !== undefined && unit !== "" && tests !== undefined && instructions !== undefined && allocKb !== undefined) {
      costs.set(unit, { tests: Number(tests), instructions: Number(instructions), allocKb: Number(allocKb) });
    }
  }
  return costs;
}

function writeLuaBaseline(path: string, costs: LuaCosts): void {
  const rows = [...costs].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([unit, cost]) => `${unit}\t${cost.tests}\t${cost.instructions}\t${cost.allocKb}`);
  writeFileSync(path, `${[LUA_HEADER, ...rows].join("\n")}\n`);
}

const megas = (instructions: number) => `${(instructions / 1e6).toFixed(1)}M`;

/** The rule for one file measured at its baseline's test count: a line naming it when it rose, else undefined. */
export function luaRise(unit: string, cost: LuaCost, base: LuaCost): string | undefined {
  const rose = (now: number, was: number, matters: number) => now > was * (1 + RISE) && now - was > matters;
  if (rose(cost.instructions, base.instructions, MATTERS_INSTRUCTIONS)) {
    return `${unit}: ${megas(cost.instructions / cost.tests)} Lua instructions per test, ${((cost.instructions / base.instructions - 1) * 100).toFixed(0)}% over its baseline ${megas(base.instructions / base.tests)}; shrink it or move it to the farm`;
  }
  if (rose(cost.allocKb, base.allocKb, MATTERS_KB)) {
    return `${unit}: ${(cost.allocKb / cost.tests / 1024).toFixed(1)} MB allocated per test, ${((cost.allocKb / base.allocKb - 1) * 100).toFixed(0)}% over its baseline ${(base.allocKb / base.tests / 1024).toFixed(1)} MB; shrink it or move it to the farm`;
  }
  return undefined;
}

export interface LuaJudgement {
  /** One line per file over budget, naming it. */
  readonly risen: readonly string[];
  readonly summary: string;
  readonly heaviest: string;
  /** Baseline rows written: new files and files whose test count changed. */
  readonly updated: number;
}

/**
 * Compares a Lua run's counts with the baseline, rewrites the rows of new
 * files and of files whose test count changed (all measured rows with
 * TEST_COST_UPDATE=1), drops rows whose file is gone, and summarizes the run.
 */
export function judgeLua(options: {
  readonly measured: LuaCosts;
  readonly baselinePath: string;
  readonly project: string;
}): LuaJudgement {
  const { measured, baselinePath, project } = options;
  const baseline = readLuaBaseline(baselinePath);
  const rewriteAll = process.env.TEST_COST_UPDATE === "1";
  const next: LuaCosts = new Map(baseline);
  const risen: string[] = [];
  let updated = 0;
  let tests = 0;
  let instructions = 0;
  let allocKb = 0;
  for (const [unit, cost] of [...measured].sort(([a], [b]) => (a < b ? -1 : 1))) {
    tests += cost.tests;
    instructions += cost.instructions;
    allocKb += cost.allocKb;
    const base = baseline.get(unit);
    if (base !== undefined && base.tests === cost.tests && !rewriteAll) {
      const line = luaRise(unit, cost, base);
      if (line !== undefined) risen.push(line);
      continue;
    }
    next.set(unit, { tests: cost.tests, instructions: cost.instructions, allocKb: cost.allocKb });
    console.log(`test cost baseline row: ${unit}\t${cost.tests}\t${cost.instructions}\t${cost.allocKb}`);
    updated++;
  }
  for (const unit of next.keys()) {
    if (!existsSync(resolve(project, unit))) {
      next.delete(unit);
      updated++;
    }
  }
  if (updated > 0) writeLuaBaseline(baselinePath, next);
  const heaviest = [...measured].sort(([, a], [, b]) => (b.maxInstructions ?? 0) - (a.maxInstructions ?? 0)).slice(0, 5)
    .map(([unit, cost]) => `${unit} ${megas(cost.maxInstructions ?? 0)}`).join(", ");
  const summary = `Lua32: ${megas(instructions)} instructions and ${(allocKb / 1024).toFixed(0)} MB allocated for ${tests} tests; ${megas(tests === 0 ? 0 : instructions / tests)} instructions per test (about ${(instructions / LUA_INSTRUCTIONS_PER_S).toFixed(0)} reference CPU seconds)`;
  return { risen, summary, updated, heaviest: `Lua32 heaviest tests (instructions): ${heaviest}` };
}

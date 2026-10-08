// Preloaded into every test process (bunfig.toml). Under `bun run test`
// (scripts/test.ts sets TEST_COST_OUT) it charges each test's CPU, from the
// process's own rusage, to its file, or to the src module game.test.ts names,
// fails a test over the per-test ceiling, and charges the rest (loading,
// beforeAll, afterAll) to the file that ran it. A plain `bun test` measures nothing.
import { afterAll, afterEach, beforeEach } from "bun:test";
import { appendFileSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const out = process.env.TEST_COST_OUT;
const ceiling = Number(process.env.TEST_COST_CEILING_S ?? "0");
const busy = Number(process.env.TEST_COST_BUSY ?? "100");

/** game.test.ts names the module a test belongs to here (testCostUnit). */
const unitKey = "smashcraftTestCostUnit";
export const chargeTestsTo = (unit: string): void => {
  (globalThis as Record<string, unknown>)[unitKey] = unit;
};

if (out !== undefined && out !== "") {
  const project = resolve(import.meta.dir, "..");
  const seconds = () => {
    const { user, system } = process.cpuUsage();
    return (user + system) / 1e6;
  };
  const pressure = (): number => {
    try {
      return Number(/^some avg10=([\d.]+)/m.exec(readFileSync("/proc/pressure/cpu", "utf8"))?.[1] ?? "0");
    } catch {
      return 0;
    }
  };
  const costs = new Map<string, { tests: number; cpu: number; max: number }>();
  const charge = (unit: string, tests: number, cpu: number) => {
    const before = costs.get(unit) ?? { tests: 0, cpu: 0, max: 0 };
    costs.set(unit, { tests: before.tests + tests, cpu: before.cpu + cpu, max: tests > 0 ? Math.max(before.max, cpu) : before.max });
  };
  const file = () => relative(project, Bun.main);
  let mark = seconds();
  beforeEach(() => {
    const now = seconds();
    charge(file(), 0, now - mark);
    mark = now;
  });
  afterEach(() => {
    const now = seconds();
    const used = now - mark;
    mark = now;
    const globals = globalThis as Record<string, unknown>;
    const named = globals[unitKey];
    globals[unitKey] = undefined;
    const unit = typeof named === "string" ? named : file();
    charge(unit, 1, used);
    // game.test.ts's module loading is charged to it, per game test.
    if (unit !== file()) charge(file(), 1, 0);
    if (ceiling > 0 && used > ceiling) {
      const line = `${unit}: this test used ${used.toFixed(2)} s CPU, over the ${ceiling} s ceiling per test; shrink it or move it to the farm`;
      const now = pressure();
      if (now > busy) appendFileSync(out, `${JSON.stringify({ inconclusive: `${line} (inconclusive: CPU pressure ${now.toFixed(0)}%)` })}\n`);
      else throw new Error(line);
    }
  });
  afterAll(() => {
    charge(file(), 0, seconds() - mark);
    appendFileSync(out, [...costs].map(([unit, cost]) => `${JSON.stringify({ unit, ...cost })}\n`).join(""));
  });
}

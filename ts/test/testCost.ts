import { afterAll, afterEach, beforeEach } from "bun:test";
import { appendFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { steppedFrames } from "../src/game/match/frameCount";

const out = process.env.TEST_COST_OUT;
const ceiling = Number(process.env.TEST_COST_CEILING_FRAMES ?? "0");

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
  const costs = new Map<string, { tests: number; cpu: number; max: number; frames: number; maxFrames: number }>();
  const charge = (unit: string, tests: number, cpu: number, frames: number) => {
    const before = costs.get(unit) ?? { tests: 0, cpu: 0, max: 0, frames: 0, maxFrames: 0 };
    costs.set(unit, {
      tests: before.tests + tests, cpu: before.cpu + cpu, max: tests > 0 ? Math.max(before.max, cpu) : before.max,
      frames: before.frames + frames, maxFrames: tests > 0 ? Math.max(before.maxFrames, frames) : before.maxFrames,
    });
  };
  const file = () => relative(project, Bun.main);
  let mark = seconds();
  let frameMark = steppedFrames.count;
  beforeEach(() => {
    const now = seconds();
    charge(file(), 0, now - mark, steppedFrames.count - frameMark);
    mark = now;
    frameMark = steppedFrames.count;
  });
  afterEach(() => {
    const now = seconds();
    const used = now - mark;
    const frames = steppedFrames.count - frameMark;
    mark = now;
    frameMark = steppedFrames.count;
    const globals = globalThis as Record<string, unknown>;
    const named = globals[unitKey];
    globals[unitKey] = undefined;
    const unit = typeof named === "string" ? named : file();
    charge(unit, 1, used, frames);

    if (unit !== file()) charge(file(), 1, 0, 0);
    if (ceiling > 0 && frames > ceiling) {
      throw new Error(`${unit}: this test simulated ${frames} frames, over the ${ceiling}-frame ceiling per test; shrink it or move it to the farm`);
    }
  });
  afterAll(() => {
    charge(file(), 0, seconds() - mark, steppedFrames.count - frameMark);
    appendFileSync(out, [...costs].map(([unit, cost]) => `${JSON.stringify({ unit, ...cost })}\n`).join(""));
  });
}

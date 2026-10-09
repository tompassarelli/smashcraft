import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { Action, bit } from "../src/game/input/actions";
import { selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { DEFAULT_OPTIONS, playTextMatch } from "./textMatch";
import { InputTimeline, parseCommands } from "./textMatchView";

const INPUT = "30 right\n70 neutral\n90 attack!\n120 jump! shield\n125 neutral\n";
const FRAMES = 900;

test("the same seed and the same input file reproduce the same text byte for byte [invariant]", () => {
  const options = { ...DEFAULT_OPTIONS, seed: 7, frames: FRAMES };
  const first = playTextMatch(options, parseCommands(INPUT)).lines.join("\n");
  const second = playTextMatch(options, parseCommands(INPUT)).lines.join("\n");
  expect(second).toBe(first);
  expect(first.split("\n").length).toBeGreaterThan(FRAMES);
});

test("a command stated at frame F reaches the fighter at frame F plus the input delay [spec #407]", () => {
  const rows = (delay: number) => {
    const timeline = new InputTimeline(parseCommands("10 right attack!\n12 neutral\n"), delay);
    return Array.from({ length: 20 }, (_, index) => timeline.row(index + 1));
  };
  for (const delay of [0, 3]) {
    const seen = rows(delay);
    expect(seen.findIndex((row) => row.held !== 0) + 1).toBe(10 + delay);
    expect(seen[10 + delay - 1]?.pressed).toBe(bit(Action.moveRight) | bit(Action.attack));
    expect(seen[10 + delay]?.held).toBe(bit(Action.moveRight));
    expect(seen[12 + delay - 1]?.held).toBe(0);
  }
});

test("a different input delay changes the output and a different seed changes the computer's play [spec #407]", () => {
  const base = { ...DEFAULT_OPTIONS, seed: 3, frames: 400 };
  const play = (options: typeof base) => playTextMatch(options, parseCommands(INPUT)).lines.join("\n");
  expect(play({ ...base, delay: 9 })).not.toBe(play(base));
  expect(play({ ...base, seed: 4 })).not.toBe(play(base));
});

test("bad input lines name the line and the problem [spec #407]", () => {
  expect(() => parseCommands("5 right\n3 left\n")).toThrow("line 2");
  expect(() => parseCommands("5 flurry\n")).toThrow('unknown command "flurry"');
  expect(() => parseCommands("x right\n")).toThrow("not a frame number");
});

test("every frame line names both fighters and a run of every N frames prints fewer lines [spec #407]", () => {
  const every = playTextMatch({ ...DEFAULT_OPTIONS, frames: 120, every: 10 }, []).lines;
  const body = every.filter((line) => !line.startsWith("#"));
  expect(body.map((line) => Number(line.split(" ")[0]))).toEqual(Array.from({ length: 13 }, (_, index) => index * 10));
  for (const line of body) expect(line).toMatch(/^\d+ A x-?\d+ z-?\d+ \d+% \d+st \S+ [LR] ledge-?\d+ plat\S+ hb\S+ \| B x-?\d+/);
});

test("a fully raised shield blocks Illidan's forward air for every fighter [spec #413]", () => {
  const input = "0 neutral\n46 shield\n70 neutral\n";
  for (const slug of ["warden", "blademaster", "thrall", "dreadlord", "rifleman", "peon"]) {
    const you = selectableCharacterBySlug(slug);
    const cpu = selectableCharacterBySlug("illidan");
    if (you === undefined || cpu === undefined) throw new Error(`no fighter ${slug}`);
    const lines = playTextMatch({ ...DEFAULT_OPTIONS, seed: 44, you, cpu, frames: 70 }, parseCommands(input)).lines;
    const damaged = lines.filter((line) => /^\d+ A x\S+ z\S+ [1-9]\d*% /.test(line));
    expect(damaged, slug).toEqual([]);
  }
});

test("an Expert computer hit by a stationary opponent's down smash stops re-approaching into it and punishes [repro #412]", () => {
  const input = readFileSync(new URL("../test/playtest407/dsmash-loop.in", import.meta.url), "utf8");
  const options = { ...DEFAULT_OPTIONS, seed: 9, cpu: selectableCharacterBySlug("thrall") ?? DEFAULT_OPTIONS.cpu, level: "expert" as const, frames: 3000 };
  const lines = playTextMatch(options, parseCommands(input)).lines.filter((line) => /^\d+ A x/.test(line));
  const percents = lines.map((line) => /^\d+ A \S+ \S+ (\d+)% \d+st .* \| B \S+ \S+ (\d+)% (\d)st/.exec(line));
  let taken = 0;
  let landed = 0;
  for (let index = 1; index < percents.length; index++) {
    const before = percents[index - 1];
    const now = percents[index];
    if (before === null || now === null || before === undefined || now === undefined) continue;
    if (Number(now[2]) > Number(before[2]) && now[3] === before[3]) taken++;
    if (Number(now[1]) > Number(before[1])) landed++;
  }
  expect(taken).toBeLessThanOrEqual(2);
  expect(landed).toBeGreaterThanOrEqual(1);
});

import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { selectableCharacterBySlug } from "../src/game/sim/heroes/registry";
import { DEFAULT_OPTIONS, playTextMatch } from "../scripts/textMatch";
import { parseCommands } from "../scripts/textMatchView";

test("a fully raised shield blocks Illidan's forward air for every fighter [k1 scenario]", () => {
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

test("an Expert computer hit by a stationary opponent's down smash stops re-approaching into it and punishes [k1 scenario]", () => {
  const input = readFileSync(new URL("./playtest407/dsmash-loop.in", import.meta.url), "utf8");
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

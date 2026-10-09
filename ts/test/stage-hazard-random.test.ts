import { expect, test } from "bun:test";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

const HAZARD_FILES = [
  "src/game/sim/stageHazards.ts",
  "src/game/sim/lava.ts",
  "src/game/sim/water.ts",
  "src/game/sim/stage.ts",
  "src/game/presentation/stageHazards.ts",
];


const RANDOM_SOURCE = /\bmatchSeed\b|\bbotRandom\b|\bbotChoice\b|\bbotChance\b|\buseMatchSeed\b|\bcentreItem\b|\bitemDraw\b|\brandomStage\b|Math\.random|\bGetRandom\w*/;

function enclosing(lines: readonly string[], index: number): string {
  for (let line = index; line >= 0; line--) {
    const found = /(?:function|const|let)\s+(\w+)/.exec(lines[line] ?? "");
    if (found !== null && !/^\s/.test(lines[line] ?? "")) return found[1] ?? "module";
  }
  return "module";
}

test("stage hazard code never reads the match's random source [spec #274]", async () => {
  const problems: string[] = [];
  for (const file of HAZARD_FILES) {
    const lines = (await Bun.file(join(root, file)).text()).split("\n");
    lines.forEach((line, index) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      const found = RANDOM_SOURCE.exec(line);
      if (found !== null) problems.push(`${file}:${index + 1} ${enclosing(lines, index)} reads the random source (${found[0]})`);
    });
  }
  expect(problems).toEqual([]);
});

import { expect, test } from "bun:test";
import { definitiveBodyBytes, mapBudgetProblem, mapGrowthProblem } from "../scripts/mapSize";

const baseline = { total: 100_000_000, imports: new Map([["war3mapImported\\Old.mdx", 90_000_000]]) };

test("map size: more than 10% over the baseline fails naming the largest new imports, 10% passes [spec #264]", () => {
  const grown = (extra: number) => ({ total: baseline.total + extra, imports: new Map([...baseline.imports, ["war3mapImported\\Dummy.blp", extra], ["war3mapImported\\Small.blp", 1]]) });
  expect(mapGrowthProblem(grown(10_000_000), baseline)).toBeUndefined();
  const problem = mapGrowthProblem(grown(11_000_000), baseline) ?? "";
  expect(problem).toContain("war3mapImported\\Dummy.blp +11.0 MB, war3mapImported\\Small.blp");
});

test("map size: 60 MB of Definitive body aliases and a 120 MB map pass, one extra byte fails [spec #334]", () => {
  const de = "_de.w3mod\\war3mapImported\\CairneTimelineBody-a.mdx";
  const hd = "_hd.w3mod\\war3mapImported\\CairneTimelineBody-a.mdx";
  const imports = new Map([
    [de, 30_000_000],
    [hd, 30_000_000],
    ["war3mapImported\\CairneTimelineBody-a.mdx", 5_000_000],
    ["_de.w3mod\\Doodads\\Terrain\\Waterfall.mdx", 5_000_000],
    ["_hd.w3mod\\war3mapImported\\StageMainDeck-a.mdx", 5_000_000],
  ]);
  const size = { total: 120_000_000, imports };
  expect(definitiveBodyBytes(size)).toBe(60_000_000);
  expect(mapBudgetProblem(size)).toBeUndefined();
  expect(mapBudgetProblem({ ...size, total: size.total + 1 })).toContain("120000000-byte download budget");
  expect(mapBudgetProblem({ ...size, imports: new Map([...imports, [de, 30_000_001]]) })).toContain("60000000-byte budget");
});

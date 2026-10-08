import { expect, test } from "bun:test";
import { mapGrowthProblem } from "../scripts/mapSize";

const baseline = { total: 100_000_000, imports: new Map([["war3mapImported\\Old.mdx", 90_000_000]]) };

test("map size: more than 10% over the baseline fails naming the largest new imports, 10% passes [spec #264]", () => {
  const grown = (extra: number) => ({ total: baseline.total + extra, imports: new Map([...baseline.imports, ["war3mapImported\\Dummy.blp", extra], ["war3mapImported\\Small.blp", 1]]) });
  expect(mapGrowthProblem(grown(10_000_000), baseline)).toBeUndefined();
  const problem = mapGrowthProblem(grown(11_000_000), baseline) ?? "";
  expect(problem).toContain("war3mapImported\\Dummy.blp +11.0 MB, war3mapImported\\Small.blp");
});

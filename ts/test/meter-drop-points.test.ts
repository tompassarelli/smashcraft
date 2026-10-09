import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { meterDropPoints } from "../src/game/match/meterDrops";
import { STAGE_CATALOG } from "../src/game/menu/stageCatalog";

test("stages.md lists every stage's meter drop points in rotation order, centre first [spec docs/design/stages.md]", () => {
  const doc = readFileSync(join(import.meta.dir, "../../docs/design/stages.md"), "utf8");
  const start = doc.indexOf("### Meter drop points\n");
  expect(start).toBeGreaterThanOrEqual(0);
  const section = doc.slice(start, doc.indexOf("\n## ", start));
  for (const stage of STAGE_CATALOG) {
    const points = meterDropPoints(stage.id);
    expect(points[0]?.x).toBe(0.0);
    expect(section).toContain(`| ${stage.name} | ${points.map(point => `(${point.x}, ${Math.round(point.z)})`).join(", ")} |`);
  }
});

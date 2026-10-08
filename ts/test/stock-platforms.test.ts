import { expect, test } from "bun:test";
import { MODEL_FACTS } from "../scripts/wisp/modelFacts";
import { platformParts } from "../src/game/presentation/stockPlatforms";
import { surfaceCount, surfaceLeft, surfaceRight } from "../src/game/sim/stage";
import { STAGE_CATALOG } from "../src/game/menu/stageCatalog";

/** A part's drawn extent across the screen and its top, from its model's bounds, scale and quarter-turn yaw. */
function drawn(part: ReturnType<typeof platformParts>[number]): { readonly left: number; readonly right: number; readonly top: number } {
  const facts = MODEL_FACTS[part.model];
  if (facts === undefined) throw new Error(`${part.model} has no model facts`);
  const { min, max } = facts.bounds;
  const turns = Math.round(part.yaw / 90) % 4;
  const axis = turns % 2 === 0 ? 0 : 1;
  const low = (min[axis] ?? 0) * (part.scale[axis] ?? 1);
  const high = (max[axis] ?? 0) * (part.scale[axis] ?? 1);
  const [a, b] = turns === 0 || turns === 3 ? [low, high] : [-high, -low];
  return { left: part.x + a, right: part.x + b, top: part.z + (max[2] ?? 0) * part.scale[2] };
}

test("a stock-built platform's walking piece spans its deck and its top meets the walking line [spec docs/design/stock-platforms.md]", () => {
  let built = 0;
  for (const { id } of STAGE_CATALOG) {
    for (let index = 1; index < surfaceCount(id); index++) {
      const [walking] = platformParts(id, index);
      if (walking === undefined) continue;
      built++;
      const half = (surfaceRight(id, index, 0) - surfaceLeft(id, index, 0)) / 2;
      const piece = drawn(walking);
      expect({ stage: id, index, left: piece.left <= -0.9 * half, right: piece.right >= 0.9 * half, top: Math.abs(piece.top) <= 2 })
        .toEqual({ stage: id, index, left: true, right: true, top: true });
    }
  }
  expect(built).toBeGreaterThan(0);
});

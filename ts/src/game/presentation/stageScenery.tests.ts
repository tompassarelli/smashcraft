import { assertEquals, test } from "wisp/src/runtime/testing";
import { STAGE_CATALOG } from "../menu/stageCatalog";
import { stageScenery } from "./stageScenery";

// smashcraft:docs/design/stage-art.md, rules 2 and 7.
/** Unit models that read as inanimate props: a stone statue and a mine cart. */
const STATIC_UNIT_PROPS = ["Units\\Undead\\ObsidianStatue\\ObsidianStatue.mdx", "Units\\Other\\DwarfCar\\DwarfCar.mdx"];

test("no stage's scenery pairs a piece with its mirror twin", () => {
  for (const { id, name } of STAGE_CATALOG) {
    const pieces = stageScenery(id).pieces;
    for (const [index, a] of pieces.entries()) {
      for (const b of pieces.slice(index + 1)) {
        const mirrored = a.model === b.model && Math.abs(a.x) >= 200.0 && Math.abs(a.x + b.x) < 400.0
          && Math.abs(a.y - b.y) < 600.0 && Math.abs(a.z - b.z) < 300.0
          && Math.max(a.scale, b.scale) < 1.25 * Math.min(a.scale, b.scale);
        assertEquals(mirrored, false, `${name}: ${a.model} at x ${a.x} mirrors x ${b.x}`);
      }
    }
  }
});

test("stage scenery shows no creatures", () => {
  for (const { id, name } of STAGE_CATALOG) {
    for (const { model } of stageScenery(id).pieces) {
      const creature = model.toLowerCase().startsWith("units\\") && !STATIC_UNIT_PROPS.includes(model);
      assertEquals(creature, false, `${name}: ${model} is a creature`);
    }
  }
});
